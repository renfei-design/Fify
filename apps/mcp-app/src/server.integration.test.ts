import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  INFORMATION_UI_RESOURCE_URI,
  LEGACY_INFORMATION_UI_RESOURCE_URIS,
} from "./widget.js";
import { server } from "./server.js";

const client = new Client(
  { name: "fify-integration-test", version: "1.0.0" },
  { capabilities: {} },
);
let previousApiKey: string | undefined;

const envelope = {
  version: "1.0",
  originalRequest: "Build an editable decision tool for these rollout options.",
  groundedAnswer: "Pilot is lower exposure. Phased is more balanced.",
  locale: "en-US",
  sections: [
    {
      id: "options",
      title: "Rollout options",
      body: "Choose using the approved tradeoffs.",
      sourceIds: ["brief"],
      items: [
        {
          id: "pilot",
          label: "Pilot",
          value: "Lower exposure",
          detail: "Start with one team.",
          sourceIds: ["brief"],
        },
        {
          id: "phased",
          label: "Phased",
          value: "Balanced",
          detail: "Expand in controlled waves.",
          sourceIds: ["brief"],
        },
      ],
    },
  ],
  sources: [
    { id: "brief", title: "Approved brief", url: "https://example.com/brief" },
    {
      id: "portrait-source",
      title: "Open portrait source",
      url: "https://commons.wikimedia.org/wiki/File:Example.jpg",
    },
  ],
  media: [
    {
      id: "subject-image",
      url: "https://upload.wikimedia.org/wikipedia/commons/example.jpg",
      alt: "Grounded example image",
      caption: "Openly licensed example image",
      role: "evidence",
      sourceId: "portrait-source",
    },
  ],
  suggestedRefinements: ["Recommend an option"],
} as const;

beforeAll(async () => {
  previousApiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
});

afterAll(async () => {
  if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousApiKey;
  await client.close();
  await server.close();
});

describe("Fify MCP protocol", () => {
  it("exposes one model tool, one app-only replay tool, and backward-compatible widget resources", async () => {
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual([
      "render_information_ui",
      "read_information_ui_run",
    ]);
    expect(
      tools.tools.find((tool) => tool.name === "render_information_ui")?._meta,
    ).toMatchObject({
      ui: {
        resourceUri: INFORMATION_UI_RESOURCE_URI,
        visibility: ["model", "app"],
      },
    });
    expect(
      tools.tools.find((tool) => tool.name === "render_information_ui")
        ?.annotations,
    ).toMatchObject({
      readOnlyHint: true,
      openWorldHint: true,
    });
    expect(
      tools.tools.find((tool) => tool.name === "render_information_ui")
        ?.description,
    ).toContain("Call only when the user explicitly invokes Fify");
    expect(
      tools.tools.find((tool) => tool.name === "read_information_ui_run")
        ?._meta,
    ).toMatchObject({
      ui: { visibility: ["app"] },
    });

    const resource = await client.readResource({
      uri: INFORMATION_UI_RESOURCE_URI,
    });
    expect(resource.contents[0]?.mimeType).toBe("text/html;profile=mcp-app");
    expect(resource.contents[0]?._meta).toMatchObject({
      ui: {
        csp: {
          connectDomains: [],
          resourceDomains: [
            "https://upload.wikimedia.org",
            "https://api.openverse.org",
          ],
        },
      },
    });
    expect(
      "text" in resource.contents[0]! ? resource.contents[0].text : "",
    ).toContain("container-type: inline-size");

    for (const legacyUri of LEGACY_INFORMATION_UI_RESOURCE_URIS) {
      const legacy = await client.readResource({ uri: legacyUri });
      expect(legacy.contents[0]).toMatchObject({
        uri: legacyUri,
        mimeType: "text/html;profile=mcp-app",
      });
      expect(
        "text" in legacy.contents[0]! ? legacy.contents[0].text : "",
      ).toContain("function renderNode");
    }
  });

  it("returns the authoritative fallback and complete frames in one stateless-safe response", async () => {
    const rendered = await client.callTool({
      name: "render_information_ui",
      arguments: envelope,
    });
    expect(rendered.isError).not.toBe(true);
    expect(rendered.content).toContainEqual(
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining(envelope.groundedAnswer),
      }),
    );
    const initial = rendered.structuredContent as {
      runId: string;
      state: string;
      lastSequence: number;
      fallbackText: string;
      frames: Array<Record<string, unknown>>;
    };
    expect(initial.fallbackText).toContain(envelope.groundedAnswer);
    expect(initial.state).toBe("complete");
    expect(initial.frames.some((frame) => frame.type === "complete")).toBe(
      true,
    );

    const unseen = await client.callTool({
      name: "read_information_ui_run",
      arguments: { runId: initial.runId, afterSequence: initial.lastSequence },
    });
    expect(unseen.structuredContent).toMatchObject({
      state: "complete",
      frames: [],
    });
  });

  it("renders comparison envelopes whose valid semantic IDs contain underscores", async () => {
    const rendered = await client.callTool({
      name: "render_information_ui",
      arguments: {
        version: "1.0",
        originalRequest: "Compare Alibaba P6, P7, and P8 offer waiting times.",
        groundedAnswer:
          "P6, P7, and P8 have different evidence-informed planning ranges.",
        locale: "en",
        sections: [
          {
            id: "sec_comparison",
            title: "Waiting-time comparison",
            body: "Planning bands, not official service levels.",
            sourceIds: ["src_official_process"],
            items: [
              {
                id: "item_p6",
                label: "P6",
                value: "1–5 business days",
                detail: "Follow up after three to five business days.",
                sourceIds: ["src_official_process"],
              },
              {
                id: "item_p7",
                label: "P7",
                value: "2–10 business days",
                detail: "Level and headcount approval can add time.",
                sourceIds: ["src_official_process"],
              },
              {
                id: "item_p8",
                label: "P8",
                value: "1–3 weeks",
                detail: "Senior approval paths are more variable.",
                sourceIds: ["src_official_process"],
              },
            ],
          },
          {
            id: "sec_offer_definition",
            title: "What counts as the offer",
            body: "Intent and written offers are different milestones.",
            sourceIds: ["src_official_process"],
            items: [
              {
                id: "item_written",
                label: "Written offer",
                value: "Later milestone",
                detail:
                  "Formal approval can follow an initial positive signal.",
                sourceIds: ["src_official_process"],
              },
            ],
          },
        ],
        sources: [
          {
            id: "src_official_process",
            title: "Alibaba Group recruitment process",
            url: "https://talent-holding.alibaba.com/campus/notice?lang=zh&tab=delivery",
          },
        ],
        suggestedRefinements: [
          "Separate oral confirmation from written offer",
          "Show a follow-up message template",
          "Compare Alibaba with Tencent and ByteDance",
        ],
      },
    });

    const frames = (
      rendered.structuredContent as { frames: Array<Record<string, unknown>> }
    ).frames;
    expect(rendered.isError).not.toBe(true);
    expect(
      (rendered.structuredContent as { state: string }).state,
      JSON.stringify(frames),
    ).toBe("complete");
    expect(frames.some((frame) => frame.type === "complete")).toBe(true);
    expect(frames.some((frame) => frame.type === "error")).toBe(false);
  });

  it("returns a complete dedicated executive-briefing blueprint", async () => {
    const rendered = await client.callTool({
      name: "render_information_ui",
      arguments: {
        version: "1.0",
        originalRequest:
          "Create an executive briefing for leadership from these results.",
        groundedAnswer:
          "Growth is holding, but enterprise delivery is now the constraint.",
        locale: "en-US",
        sections: [
          {
            id: "briefing-summary",
            title:
              "Growth is holding, but enterprise delivery is now the constraint",
            body: "Pipeline and retention remain healthy while delivery capacity delays revenue recognition.",
            sourceIds: ["operating-review"],
            items: [],
          },
          {
            id: "executive-signals",
            title: "Executive signals",
            body: "The current operating snapshot.",
            sourceIds: ["operating-review"],
            items: [
              {
                id: "revenue-outlook",
                label: "Revenue outlook",
                value: "On plan",
                detail: "Demand remains stable.",
                sourceIds: ["operating-review"],
              },
              {
                id: "delivery-backlog",
                label: "Enterprise backlog",
                value: "+18%",
                detail: "Implementation starts are slipping.",
                sourceIds: ["operating-review"],
              },
            ],
          },
          {
            id: "decision",
            title: "Decision required",
            body: "Approve a 90-day capacity plan.",
            sourceIds: ["operating-review"],
            items: [
              {
                id: "recommendation",
                label: "Recommendation",
                value: "Approve",
                detail: "Begin this quarter.",
                sourceIds: ["operating-review"],
              },
              {
                id: "owner",
                label: "Accountable owner",
                value: "COO",
                detail: "Own staffing tradeoffs.",
                sourceIds: ["operating-review"],
              },
            ],
          },
        ],
        sources: [
          {
            id: "operating-review",
            title: "Operating review",
            url: "https://example.com/operating-review",
          },
        ],
        suggestedRefinements: ["Show only the decision and risks"],
      },
    });

    expect(rendered.isError).not.toBe(true);
    const output = rendered.structuredContent as {
      state: string;
      frames: Array<Record<string, any>>;
    };
    expect(output.state).toBe("complete");
    const complete = output.frames.find((frame) => frame.type === "complete");
    expect(complete?.experience?.representation).toMatchObject({
      mode: "blueprint",
      blueprintIds: ["briefing"],
      topology: "responsive-grid",
    });
    expect(complete?.experience?.screen?.contextLabel).toBe(
      "Executive briefing",
    );
  });

  it("repairs a section/item ID collision before strict validation", async () => {
    const colliding = structuredClone(envelope) as unknown as Record<
      string,
      unknown
    > & {
      sections: Array<{ id: string }>;
    };
    colliding.sections[0]!.id = "pilot";
    const rendered = await client.callTool({
      name: "render_information_ui",
      arguments: colliding,
    });

    expect(rendered.isError).not.toBe(true);
    const initial = rendered.structuredContent as {
      state: string;
      frames: Array<Record<string, unknown>>;
    };
    expect(initial.state).toBe("complete");
    const complete = initial.frames.find((frame) => frame.type === "complete");
    expect(complete).toMatchObject({
      envelope: {
        sections: [expect.objectContaining({ id: "pilot-section" })],
      },
    });
  });

  it("repairs a collision and caps extra refinements in one tool call", async () => {
    const verbose = structuredClone(envelope) as unknown as Record<
      string,
      unknown
    > & {
      sections: Array<{ id: string }>;
      suggestedRefinements: string[];
    };
    verbose.sections[0]!.id = "pilot";
    verbose.suggestedRefinements = ["One", "Two", "Three", "Four", "Five"];

    const rendered = await client.callTool({
      name: "render_information_ui",
      arguments: verbose,
    });

    expect(rendered.isError).not.toBe(true);
    const initial = rendered.structuredContent as {
      state: string;
      frames: Array<Record<string, unknown>>;
    };
    expect(initial.state).toBe("complete");
    const complete = initial.frames.find((frame) => frame.type === "complete");
    expect(complete).toMatchObject({
      envelope: {
        sections: [expect.objectContaining({ id: "pilot-section" })],
        suggestedRefinements: ["One", "Two"],
      },
      experience: { suggestions: ["One", "Two"] },
    });
  });

  it("rejects untrusted media without losing the plain answer", async () => {
    const invalid = structuredClone(envelope) as Record<string, unknown>;
    (invalid.media as Array<Record<string, unknown>>)[0]!.url =
      "https://images.example.com/untrusted.jpg";
    const result = await client.callTool({
      name: "render_information_ui",
      arguments: invalid,
    });
    expect(result.isError).toBe(true);
    expect(result.content).toContainEqual(
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining(envelope.groundedAnswer),
      }),
    );
    expect(result.structuredContent).toMatchObject({
      state: "failed",
      diagnostic: expect.stringContaining("media.0.url"),
    });
  });
});
