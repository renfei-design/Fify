import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v3";
import {
  formatInformationEnvelopeFallback,
  informationEnvelopeV1Schema,
} from "@fify/core";
import { compileInformationUIRun } from "./compiler.js";
import { InformationUIRunStore, privacyBucket } from "./run-store.js";
import {
  INFORMATION_UI_RESOURCE_URI,
  LEGACY_INFORMATION_UI_RESOURCE_URIS,
  informationUIWidgetHtml,
} from "./widget.js";
import {
  normalizePresentationInput,
  type InformationEnvelopeInput,
} from "./input-normalization.js";

// Keep the MCP transport schema descriptive but deliberately free of semantic
// limits. Semantic validation happens inside the handler so every mounted UI
// receives a terminal result instead of being orphaned by SDK validation.
const semanticId = z.string();
const sourceInput = z
  .object({
    id: semanticId,
    title: z.string(),
    url: z.string(),
  })
  .passthrough();
const mediaInput = z
  .object({
    id: z.string().optional(),
    url: z.string().optional(),
    alt: z.string().optional(),
    caption: z.string().optional(),
    role: z.string().optional(),
    subject: z.string().optional(),
    sourceId: semanticId.optional(),
  })
  .passthrough()
  .describe(
    "Optional pre-resolved attributed visual evidence from an allowed Wikimedia, Openverse, or supported official product image URL and an existing source page. Set subject to the exact compared option label when the image identifies a product.",
  );
const itemInput = z
  .object({
    id: semanticId,
    label: z.string(),
    value: z.string(),
    detail: z.string(),
    sourceIds: z.array(semanticId),
  })
  .passthrough();
const sectionInput = z
  .object({
    id: semanticId,
    title: z.string(),
    body: z.string(),
    items: z.array(itemInput),
    sourceIds: z.array(semanticId),
  })
  .passthrough();
const continuationInput = z
  .object({
    priorRunId: z.string(),
    checkedIds: z.array(semanticId),
    selectedIds: z.array(semanticId),
    inputs: z.record(semanticId, z.string()),
  })
  .passthrough();

function registerInformationUIResource(
  server: McpServer,
  name: string,
  uri: string,
) {
  server.registerResource(name, uri, {}, async () => ({
    contents: [
      {
        uri,
        mimeType: "text/html;profile=mcp-app",
        text: informationUIWidgetHtml,
        _meta: {
          ui: {
            prefersBorder: false,
            csp: {
              connectDomains: [],
              resourceDomains: [
                "https://upload.wikimedia.org",
                "https://api.openverse.org",
                "https://www.apple.com",
                "https://www.oppo.com",
                "https://www.sony.com",
              ],
            },
          },
        },
      },
    ],
  }));
}

export function createFifyServer(store = new InformationUIRunStore()) {
  const server = new McpServer({ name: "fify", version: "0.1.0" });

  registerInformationUIResource(
    server,
    "fify-information-ui",
    INFORMATION_UI_RESOURCE_URI,
  );
  LEGACY_INFORMATION_UI_RESOURCE_URIS.forEach((uri, index) =>
    registerInformationUIResource(
      server,
      `fify-information-ui-legacy-${index + 1}`,
      uri,
    ),
  );

  server.registerTool(
    "render_information_ui",
    {
      title: "Render information as an interactive view",
      description:
        "Call only when the user explicitly invokes Fify, names Fify, or asks for an interactive view. Never call for an ordinary untagged request. Call at most once per user turn and always pass the authoritative plain answer. Every source, media, section, and item ID must be globally unique. For a named real-person profile, set profileSubject to the canonical name unless the user requests no image. For a physical-product comparison, resolve misspellings first; use only canonical unquoted product names as option labels; search for exact product imagery with the factual research; and include supported official or openly licensed media when an exact grounded image URL exists, with media.subject equal to the canonical option label. Put disambiguation in the answer or a supporting Assumptions section, never in the comparison matrix. Use a Recommendation, Verdict, Answer, or Summary section for the decision. Then use at least three separate shared-criterion sections when the facts support them; every criterion must repeat the same two-to-five canonical option labels in the same order and contain one scannable value per option. Never pack the entire spec sheet into one criterion. Never invent or guess media URLs.",
      inputSchema: {
        version: z.string(),
        originalRequest: z.string(),
        groundedAnswer: z.string(),
        locale: z.string(),
        profileSubject: z
          .string()
          .optional()
          .describe(
            "Canonical person name for a real-person profile. Omit when the user requests no image or the subject is not a person.",
          ),
        sections: z.array(sectionInput),
        sources: z.array(sourceInput),
        media: z.array(mediaInput).optional(),
        suggestedRefinements: z.array(z.string()),
        continuationState: continuationInput.optional(),
      },
      outputSchema: {
        runId: z.string(),
        state: z.enum(["running", "complete", "failed"]),
        lastSequence: z.number(),
        fallbackText: z.string(),
        frames: z.array(z.unknown()),
        diagnostic: z.string().optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
      _meta: {
        ui: {
          resourceUri: INFORMATION_UI_RESOURCE_URI,
          visibility: ["model", "app"],
        },
        "openai/toolInvocation/invoking": "Preparing an interactive view…",
        "openai/toolInvocation/invoked": "Interactive view ready",
      },
    },
    async (input, extra) => {
      const normalized = normalizePresentationInput(
        input as InformationEnvelopeInput,
      );
      let parsed = informationEnvelopeV1Schema.safeParse(normalized.value);
      let envelopeMediaDiagnostic: string | undefined;

      // Media is optional presentation enrichment. Keep a second independent
      // safety barrier here so a future schema-level or cross-field media rule
      // can never turn an otherwise valid information view into text fallback.
      if (
        !parsed.success &&
        Array.isArray(normalized.value.media) &&
        normalized.value.media.length > 0
      ) {
        const withoutMedia = informationEnvelopeV1Schema.safeParse({
          ...normalized.value,
          media: [],
        });
        if (withoutMedia.success) {
          parsed = withoutMedia;
          envelopeMediaDiagnostic =
            "media: dropped (Optional media failed envelope-level validation; the grounded interactive view continued without imagery.)";
        }
      }
      if (!parsed.success) {
        const fallback =
          typeof input.groundedAnswer === "string"
            ? input.groundedAnswer
            : "The interactive view could not be created.";
        const diagnostic = parsed.error.issues
          .slice(0, 4)
          .map((issue) => {
            const path = issue.path.length > 0 ? issue.path.join(".") : "input";
            return `${path}: ${issue.message}`;
          })
          .join(" ");
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `${fallback}\n\nFify could not validate the interactive view input. Do not retry in this turn; the mounted card is the terminal fallback. Diagnostic: ${diagnostic}`,
            },
          ],
          structuredContent: {
            runId: "invalid",
            state: "failed" as const,
            lastSequence: 0,
            fallbackText: fallback,
            frames: [],
            diagnostic,
          },
        };
      }
      const fallbackText = formatInformationEnvelopeFallback(parsed.data);
      const mediaDiagnostics = [
        ...normalized.mediaDiagnostics.map(
          (entry) =>
            `${entry.path.join(".")}: ${entry.action} (${entry.message})`,
        ),
        ...(envelopeMediaDiagnostic ? [envelopeMediaDiagnostic] : []),
      ];
      const mediaDiagnostic = mediaDiagnostics.length
        ? mediaDiagnostics
            .join(" ")
        : undefined;
      try {
        const hostMeta = (extra as unknown as { _meta?: unknown })._meta;
        const { run, created } = store.findOrCreate(
          privacyBucket(hostMeta),
          parsed.data,
        );
        if (created) {
          try {
            await compileInformationUIRun(store, run.id, parsed.data);
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "The compiler failed.";
            store.append(run.id, {
              type: "error",
              code: "COMPILER_FAILED",
              message,
            });
            store.fail(run.id);
          }
        }
        const result = store.read(run.id, 0);
        return {
          content: [{ type: "text" as const, text: fallbackText }],
          structuredContent: {
            runId: run.id,
            state: result?.state ?? run.state,
            lastSequence: result?.lastSequence ?? run.frames.length,
            fallbackText,
            frames: result?.frames ?? [],
            ...(mediaDiagnostic ? { diagnostic: mediaDiagnostic } : {}),
          },
        };
      } catch (error) {
        const code =
          typeof error === "object" && error && "code" in error
            ? String(error.code)
            : "SERVICE_UNAVAILABLE";
        const message =
          error instanceof Error
            ? error.message
            : "Fify is temporarily unavailable.";
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `${fallbackText}\n\nFify status: ${message}`,
            },
          ],
          structuredContent: {
            runId: code.toLowerCase(),
            state: "failed" as const,
            lastSequence: 0,
            fallbackText,
            frames: [],
          },
        };
      }
    },
  );

  server.registerTool(
    "read_information_ui_run",
    {
      title: "Read an information UI run",
      description: "App-only unseen-frame reader for the mounted Fify widget.",
      inputSchema: {
        runId: z.string(),
        afterSequence: z.number().int().min(0),
      },
      outputSchema: {
        runId: z.string(),
        state: z.enum(["running", "complete", "failed"]),
        lastSequence: z.number(),
        frames: z.array(z.unknown()),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async ({ runId, afterSequence }) => {
      const result = store.read(runId, afterSequence);
      if (!result) {
        const expired = {
          runId,
          state: "failed" as const,
          lastSequence: afterSequence,
          frames: [
            {
              sequence: afterSequence + 1,
              type: "error",
              code: "RUN_EXPIRED",
              message: "This view expired. Ask ChatGPT to render it again.",
            },
          ],
        };
        return {
          isError: true,
          content: [{ type: "text" as const, text: "The Fify run expired." }],
          structuredContent: expired,
        };
      }
      return {
        content: [{ type: "text" as const, text: result.state }],
        structuredContent: result,
      };
    },
  );

  return server;
}

export const server = createFifyServer();

export async function startStdioServer() {
  await server.connect(new StdioServerTransport());
}
