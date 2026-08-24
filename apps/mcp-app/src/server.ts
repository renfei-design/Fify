import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "node:url";
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

const semanticId = z.string().min(1).max(64).regex(/^[a-z0-9]+(?:[-_.:][a-z0-9]+)*$/i);
const sourceInput = z.object({ id: semanticId, title: z.string().min(1).max(180), url: z.string().max(2_048) }).strict();
const mediaInput = z.object({
  id: z.string().min(1).max(48).regex(/^[a-z0-9]+(?:[-_.:][a-z0-9]+)*$/i),
  url: z.string().max(2_048),
  alt: z.string().min(1).max(180),
  caption: z.string().max(400),
  role: z.enum(["identity", "evidence", "illustration"]),
  sourceId: semanticId,
}).strict();
const itemInput = z.object({ id: semanticId, label: z.string().min(1).max(90), value: z.string().max(120), detail: z.string().max(2_048), sourceIds: z.array(semanticId).max(8) }).strict();
const sectionInput = z.object({ id: semanticId, title: z.string().min(1).max(110), body: z.string().max(4_000), items: z.array(itemInput).max(12), sourceIds: z.array(semanticId).max(8) }).strict();
const continuationInput = z.object({ priorRunId: z.string().min(1).max(96), checkedIds: z.array(semanticId).max(96), selectedIds: z.array(semanticId).max(24), inputs: z.record(semanticId, z.string().max(500)) }).strict();

function registerInformationUIResource(server: McpServer, name: string, uri: string) {
  server.registerResource(
    name,
    uri,
    {},
    async () => ({
    contents: [{
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
            ],
          },
        },
      },
    }],
    }),
  );
}

export function createFifyServer(store = new InformationUIRunStore()) {
  const server = new McpServer({ name: "fify", version: "0.1.0" });

  registerInformationUIResource(server, "fify-information-ui", INFORMATION_UI_RESOURCE_URI);
  LEGACY_INFORMATION_UI_RESOURCE_URIS.forEach((uri, index) =>
    registerInformationUIResource(server, `fify-information-ui-legacy-v${3 - index}`, uri),
  );

  server.registerTool(
  "render_information_ui",
  {
    title: "Render information as an interactive view",
    description: "Render a fully grounded answer as a non-consequential interactive information view when structure or interaction materially improves it. Complete factual reasoning first and always pass the authoritative plain answer.",
    inputSchema: {
      version: z.literal("1.0"),
      originalRequest: z.string(),
      groundedAnswer: z.string().min(1).max(16_000),
      locale: z.string().min(2).max(35),
      sections: z.array(sectionInput).min(1).max(8),
      sources: z.array(sourceInput).max(32),
      media: z.array(mediaInput).max(4).optional(),
      suggestedRefinements: z.array(z.string().min(1).max(140)).max(2),
      continuationState: continuationInput.optional(),
    },
    outputSchema: {
      runId: z.string(),
      state: z.enum(["running", "complete", "failed"]),
      lastSequence: z.number(),
      fallbackText: z.string(),
      frames: z.array(z.unknown()),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: {
      ui: { resourceUri: INFORMATION_UI_RESOURCE_URI, visibility: ["model", "app"] },
      "openai/toolInvocation/invoking": "Preparing an interactive view…",
      "openai/toolInvocation/invoked": "Interactive view ready",
    },
  },
  async (input, extra) => {
    const parsed = informationEnvelopeV1Schema.safeParse(input);
    if (!parsed.success) {
      const fallback = typeof input.groundedAnswer === "string" ? input.groundedAnswer : "The interactive view could not be created.";
      return {
        isError: true,
        content: [{ type: "text" as const, text: `${fallback}\n\nFify could not validate the interactive view input.` }],
        structuredContent: { runId: "invalid", state: "failed" as const, lastSequence: 0, fallbackText: fallback, frames: [] },
      };
    }
    const fallbackText = formatInformationEnvelopeFallback(parsed.data);
    try {
      const hostMeta = (extra as unknown as { _meta?: unknown })._meta;
      const { run, created } = store.findOrCreate(privacyBucket(hostMeta), parsed.data);
      if (created) {
        try {
          await compileInformationUIRun(store, run.id, parsed.data);
        } catch (error) {
          const message = error instanceof Error ? error.message : "The compiler failed.";
          store.append(run.id, { type: "error", code: "COMPILER_FAILED", message });
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
        },
      };
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "SERVICE_UNAVAILABLE";
      const message = error instanceof Error ? error.message : "Fify is temporarily unavailable.";
      return {
        isError: true,
        content: [{ type: "text" as const, text: `${fallbackText}\n\nFify status: ${message}` }],
        structuredContent: { runId: code.toLowerCase(), state: "failed" as const, lastSequence: 0, fallbackText, frames: [] },
      };
    }
  },
);

  server.registerTool(
  "read_information_ui_run",
  {
    title: "Read an information UI run",
    description: "App-only unseen-frame reader for the mounted Fify widget.",
    inputSchema: { runId: z.string(), afterSequence: z.number().int().min(0) },
    outputSchema: {
      runId: z.string(),
      state: z.enum(["running", "complete", "failed"]),
      lastSequence: z.number(),
      frames: z.array(z.unknown()),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { visibility: ["app"] } },
  },
  async ({ runId, afterSequence }) => {
    const result = store.read(runId, afterSequence);
    if (!result) {
      const expired = { runId, state: "failed" as const, lastSequence: afterSequence, frames: [{ sequence: afterSequence + 1, type: "error", code: "RUN_EXPIRED", message: "This view expired. Ask ChatGPT to render it again." }] };
      return { isError: true, content: [{ type: "text" as const, text: "The Fify run expired." }], structuredContent: expired };
    }
    return { content: [{ type: "text" as const, text: result.state }], structuredContent: result };
  },
);

  return server;
}

export const server = createFifyServer();

export async function startStdioServer() {
  await server.connect(new StdioServerTransport());
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await startStdioServer();
}
