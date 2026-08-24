import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  INFORMATION_UI_RESOURCE_URI,
  LEGACY_INFORMATION_UI_RESOURCE_URIS,
} from "./widget.js";
import { server } from "./server.js";

const client = new Client({ name: "fify-integration-test", version: "1.0.0" }, { capabilities: {} });
let previousApiKey: string | undefined;

const envelope = {
  version: "1.0",
  originalRequest: "Build an editable decision tool for these rollout options.",
  groundedAnswer: "Pilot is lower exposure. Phased is more balanced.",
  locale: "en-US",
  sections: [{
    id: "options",
    title: "Rollout options",
    body: "Choose using the approved tradeoffs.",
    sourceIds: ["brief"],
    items: [
      { id: "pilot", label: "Pilot", value: "Lower exposure", detail: "Start with one team.", sourceIds: ["brief"] },
      { id: "phased", label: "Phased", value: "Balanced", detail: "Expand in controlled waves.", sourceIds: ["brief"] },
    ],
  }],
  sources: [
    { id: "brief", title: "Approved brief", url: "https://example.com/brief" },
    { id: "portrait-source", title: "Open portrait source", url: "https://commons.wikimedia.org/wiki/File:Example.jpg" },
  ],
  media: [{
    id: "subject-image",
    url: "https://upload.wikimedia.org/wikipedia/commons/example.jpg",
    alt: "Grounded example image",
    caption: "Openly licensed example image",
    role: "evidence",
    sourceId: "portrait-source",
  }],
  suggestedRefinements: ["Recommend an option"],
} as const;

beforeAll(async () => {
  previousApiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
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
    expect(tools.tools.find((tool) => tool.name === "render_information_ui")?._meta).toMatchObject({
      ui: { resourceUri: INFORMATION_UI_RESOURCE_URI, visibility: ["model", "app"] },
    });
    expect(tools.tools.find((tool) => tool.name === "read_information_ui_run")?._meta).toMatchObject({
      ui: { visibility: ["app"] },
    });

    const resource = await client.readResource({ uri: INFORMATION_UI_RESOURCE_URI });
    expect(resource.contents[0]?.mimeType).toBe("text/html;profile=mcp-app");
    expect(resource.contents[0]?._meta).toMatchObject({
      ui: {
        csp: {
          connectDomains: [],
          resourceDomains: ["https://upload.wikimedia.org", "https://api.openverse.org"],
        },
      },
    });
    expect("text" in resource.contents[0]! ? resource.contents[0].text : "").toContain("gx-primary-region");

    for (const legacyUri of LEGACY_INFORMATION_UI_RESOURCE_URIS) {
      const legacy = await client.readResource({ uri: legacyUri });
      expect(legacy.contents[0]).toMatchObject({
        uri: legacyUri,
        mimeType: "text/html;profile=mcp-app",
      });
      expect("text" in legacy.contents[0]! ? legacy.contents[0].text : "").toContain("function renderNode");
    }
  });

  it("returns the authoritative fallback and complete frames in one stateless-safe response", async () => {
    const rendered = await client.callTool({ name: "render_information_ui", arguments: envelope });
    expect(rendered.isError).not.toBe(true);
    expect(rendered.content).toContainEqual(expect.objectContaining({ type: "text", text: expect.stringContaining(envelope.groundedAnswer) }));
    const initial = rendered.structuredContent as { runId: string; state: string; lastSequence: number; fallbackText: string; frames: Array<Record<string, unknown>> };
    expect(initial.fallbackText).toContain(envelope.groundedAnswer);
    expect(initial.state).toBe("complete");
    expect(initial.frames.some((frame) => frame.type === "complete")).toBe(true);

    const unseen = await client.callTool({
      name: "read_information_ui_run",
      arguments: { runId: initial.runId, afterSequence: initial.lastSequence },
    });
    expect(unseen.structuredContent).toMatchObject({ state: "complete", frames: [] });
  });

  it("rejects untrusted media without losing the plain answer", async () => {
    const invalid = structuredClone(envelope) as Record<string, unknown>;
    (invalid.media as Array<Record<string, unknown>>)[0]!.url = "https://images.example.com/untrusted.jpg";
    const result = await client.callTool({ name: "render_information_ui", arguments: invalid });
    expect(result.isError).toBe(true);
    expect(result.content).toContainEqual(expect.objectContaining({ type: "text", text: expect.stringContaining(envelope.groundedAnswer) }));
  });
});
