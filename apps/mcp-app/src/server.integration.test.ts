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
            "https://www.apple.com",
            "https://www.oppo.com",
            "https://www.sony.com",
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
    expect(rendered.isError, JSON.stringify(rendered)).not.toBe(true);
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

  it("returns a complete product comparison with attributed option media", async () => {
    const rendered = await client.callTool({
      name: "render_information_ui",
      arguments: {
        version: "1.0",
        originalRequest: "Compare MacBook Neo and MacBook Air and use Fify.",
        groundedAnswer:
          "MacBook Neo has the lower starting price; MacBook Air offers more memory headroom.",
        locale: "en-US",
        sections: [
          {
            id: "recommendation",
            title: "Recommendation",
            body: "MacBook Air is the stronger balance for most buyers.",
            sourceIds: ["apple-air"],
            items: [
              {
                id: "recommended-option",
                label: "Recommended option",
                value: "MacBook Air",
                detail: "Choose it when memory headroom matters.",
                sourceIds: ["apple-air"],
              },
            ],
          },
          {
            id: "starting-price",
            title: "Starting price comparison",
            body: "Current U.S. starting prices.",
            sourceIds: ["apple-neo", "apple-air"],
            items: [
              {
                id: "neo-price",
                label: "MacBook Neo",
                value: "$599",
                detail: "Lowest starting price.",
                sourceIds: ["apple-neo"],
              },
              {
                id: "air-price",
                label: "MacBook Air",
                value: "$1,099",
                detail: "Higher starting price.",
                sourceIds: ["apple-air"],
              },
            ],
          },
        ],
        sources: [
          {
            id: "apple-neo",
            title: "MacBook Neo - Apple",
            url: "https://www.apple.com/macbook-neo/",
          },
          {
            id: "apple-air",
            title: "MacBook Air - Apple",
            url: "https://www.apple.com/macbook-air/",
          },
        ],
        media: [
          {
            id: "neo-product",
            url: "https://www.apple.com/v/macbook-neo/images/meta/macbook-neo.png",
            alt: "MacBook Neo",
            caption: "Official MacBook Neo product image",
            role: "illustration",
            subject: "MacBook Neo",
            sourceId: "apple-neo",
          },
          {
            id: "air-product",
            url: "https://www.apple.com/v/macbook-air/images/meta/macbook-air.png",
            alt: "MacBook Air",
            caption: "Official MacBook Air product image",
            role: "illustration",
            subject: "MacBook Air",
            sourceId: "apple-air",
          },
        ],
        suggestedRefinements: ["Focus on memory and longevity"],
      },
    });

    expect(rendered.isError, JSON.stringify(rendered)).not.toBe(true);
    const output = rendered.structuredContent as {
      state: string;
      frames: Array<{
        type: string;
        experience?: {
          representation?: { blueprintIds?: string[]; slots?: unknown[] };
          nodes?: Array<Record<string, unknown>>;
        };
      }>;
    };
    expect(output.state).toBe("complete");
    const complete = output.frames.find((frame) => frame.type === "complete");
    expect(complete?.experience?.representation?.blueprintIds).toEqual([
      "compare-decide",
    ]);
    expect(
      complete?.experience?.nodes?.find(
        (node) => node.id === "media-air-product",
      ),
    ).toMatchObject({ label: "MacBook Air" });
  });

  it("keeps misspelling assumptions out of the canonical comparison matrix", async () => {
    const options = ["OPPO Enco Free4", "Sony LinkBuds Fit", "AirPods Pro 3"];
    const item = (
      id: string,
      label: string,
      value: string,
      detail = "Grounded comparison detail.",
    ) => ({ id, label, value, detail, sourceIds: [] });
    const rendered = await client.callTool({
      name: "render_information_ui",
      arguments: {
        version: "1.0",
        originalRequest:
          "Compare Vivo Encore Free, Sony LindBuds, and Apple Airpod pro",
        groundedAnswer:
          "The names resolve to OPPO Enco Free4, Sony LinkBuds Fit, and AirPods Pro 3.",
        locale: "en-US",
        sections: [
          {
            id: "model-assumptions",
            title: "Model assumptions",
            body: "The request is normalized to current canonical names.",
            sourceIds: [],
            items: options.map((value, index) =>
              item(
                `assumption-${index + 1}`,
                [
                  "\u201cVivo Encore Free\u201d",
                  "\u201cSony LindBuds\u201d",
                  "\u201cApple Airpod pro\u201d",
                ][index]!,
                value,
              ),
            ),
          },
          {
            id: "quick-verdict",
            title: "Quick verdict",
            body: "Choose by ecosystem and fit priority.",
            sourceIds: [],
            items: options.map((value, index) =>
              item(
                `verdict-${index + 1}`,
                ["Best value", "Best secure fit", "Best for iPhone"][index]!,
                value,
              ),
            ),
          },
          {
            id: "key-comparison",
            title: "Key comparison",
            body: "Manufacturer test conditions differ.",
            sourceIds: [],
            items: options.map((label, index) =>
              item(
                `spec-${index + 1}`,
                label,
                ["6 h ANC", "5.5 h ANC", "8 h ANC"][index]!,
              ),
            ),
          },
          {
            id: "buying-guidance",
            title: "Which one should you buy?",
            body: "Start with the phone ecosystem.",
            sourceIds: [],
            items: options.map((value, index) =>
              item(
                `buy-${index + 1}`,
                ["Android value", "Cross-platform fit", "iPhone"][index]!,
                value,
              ),
            ),
          },
        ],
        sources: [],
        suggestedRefinements: ["Compare current prices"],
      },
    });

    expect(rendered.isError, JSON.stringify(rendered)).not.toBe(true);
    const output = rendered.structuredContent as {
      state: string;
      frames: Array<{
        type: string;
        experience?: {
          representation?: {
            blueprintIds?: string[];
            slots?: Array<{ role?: string }>;
          };
          nodes?: Array<Record<string, unknown>>;
        };
      }>;
    };
    const complete = output.frames.find((frame) => frame.type === "complete");
    expect(output.state).toBe("complete");
    expect(complete?.experience?.representation?.blueprintIds).toEqual([
      "compare-decide",
    ]);
    expect(
      complete?.experience?.representation?.slots?.map((slot) => slot.role),
    ).toEqual(["context", "recommendation", "criteria", "evidence"]);
    expect(
      complete?.experience?.nodes?.find(
        (node) => node.id === "section-model-assumptions",
      ),
    ).toMatchObject({ type: "FactList" });
    expect(
      complete?.experience?.nodes?.find(
        (node) => node.id === "section-key-comparison",
      ),
    ).toMatchObject({ type: "Comparison" });
  });

  it("renders the exact Vivo, LindBuds, and AirPods payload with official product media", async () => {
    const options = ["OPPO Enco Free", "Sony LinkBuds", "Apple AirPods Pro 3"];
    const sources = [
      {
        id: "src-oppo-free",
        title: "OPPO Enco Free overview",
        url: "https://www.oppo.com/en/newsroom/stories/5-compelling-features-of-oppo-enco-free-tws-headphones/",
      },
      {
        id: "src-sony-design",
        title: "Sony Design story: LinkBuds",
        url: "https://www.sony.com/en/SonyInfo/design/stories/linkbuds/",
      },
      {
        id: "src-apple-specs",
        title: "Apple AirPods Pro 3 technical specifications",
        url: "https://www.apple.com/airpods-pro/specs/",
      },
    ];
    const sourceIds = sources.map((source) => source.id);
    const criterion = (id: string, title: string, values: string[]) => ({
      id,
      title,
      body: `${title} compared across the three resolved products.`,
      sourceIds,
      items: options.map((label, index) => ({
        id: `${id}-${index + 1}`,
        label,
        value: values[index]!,
        detail: `Grounded ${title.toLowerCase()} detail for ${label}.`,
        sourceIds: [sourceIds[index]!],
      })),
    });

    const rendered = await client.callTool({
      name: "render_information_ui",
      arguments: {
        version: "1.0",
        originalRequest:
          "Compare Vivo Encore Free, Sony LindBuds, and Apple Airpod pro",
        groundedAnswer:
          "AirPods Pro 3 are the best overall choice; LinkBuds prioritize awareness; Enco Free is a legacy bargain.",
        locale: "en",
        sources,
        media: [
          {
            id: "media-oppo-free",
            role: "product",
            subject: "OPPO Enco Free",
            alt: "OPPO Enco Free true wireless earbuds",
            caption: "OPPO Enco Free",
            sourceId: "src-oppo-free",
            url: "https://www.oppo.com/content/dam/oppo/en/mkt/newsroom/story/5-compelling-features-of-oppo-enco-free-tws-headphones/main.jpg",
          },
          {
            id: "media-sony-linkbuds",
            role: "product",
            subject: "Sony LinkBuds",
            alt: "Sony LinkBuds design detail",
            caption: "Sony LinkBuds",
            sourceId: "src-sony-design",
            url: "https://www.sony.com/en/SonyInfo/design/stories/linkbuds/img/06.jpg",
          },
          {
            id: "media-apple-airpods-pro-3",
            role: "product",
            subject: "Apple AirPods Pro 3",
            alt: "Apple AirPods Pro 3 and charging case",
            caption: "Apple AirPods Pro 3",
            sourceId: "src-apple-specs",
            url: "https://www.apple.com/v/airpods-pro/s/images/specs/airpods__eqrzs6rwhu2q_large.jpg",
          },
        ],
        sections: [
          {
            id: "verdict",
            title: "Verdict",
            body: "Choose by isolation, awareness, and price.",
            sourceIds,
            items: options.map((label, index) => ({
              id: `verdict-${index + 1}`,
              label,
              value: ["Legacy bargain", "Best for awareness", "Best overall"][
                index
              ]!,
              detail: `Grounded verdict for ${label}.`,
              sourceIds: [sourceIds[index]!],
            })),
          },
          criterion("fit-awareness", "Fit and awareness", [
            "Semi-open",
            "Open ring",
            "Sealed in-ear",
          ]),
          criterion("noise-control", "Noise control", [
            "No playback ANC",
            "No ANC by design",
            "ANC + Adaptive Audio",
          ]),
          criterion("battery", "Battery", [
            "5 h",
            "5.5 h",
            "8 h with ANC",
          ]),
          criterion("ecosystem", "Ecosystem", [
            "Android + iOS",
            "Cross-platform",
            "Best inside Apple",
          ]),
          criterion("durability", "Durability", [
            "IPX4 earbuds",
            "IPX4 earbuds",
            "IP57 earbuds + case",
          ]),
        ],
        suggestedRefinements: ["Compare current prices"],
      },
    });

    expect(rendered.isError, JSON.stringify(rendered)).not.toBe(true);
    const output = rendered.structuredContent as {
      state: string;
      diagnostic?: string;
      frames: Array<{
        type: string;
        experience?: {
          representation?: { blueprintIds?: string[]; slots?: unknown[] };
          nodes?: Array<Record<string, unknown>>;
        };
      }>;
    };
    expect(output.state).toBe("complete");
    expect(output.diagnostic).toContain(
      "Mapped presentation role 'product' to 'illustration'",
    );
    const complete = output.frames.find((frame) => frame.type === "complete");
    expect(complete?.experience?.representation?.blueprintIds).toEqual([
      "compare-decide",
    ]);
    expect(complete?.experience?.representation?.slots).toHaveLength(9);
    expect(
      complete?.experience?.nodes?.filter((node) =>
        String(node.id).startsWith("media-"),
      ),
    ).toHaveLength(3);
  });

  it("renders the exact six-section MacBook comparison that previously exceeded eight slots", async () => {
    const options = ["MacBook Neo", "MacBook Air", "MacBook Pro"];
    const sources = options.map((label, index) => ({
      id: `mac-${index + 1}`,
      title: `${label} technical specifications`,
      url: [
        "https://www.apple.com/macbook-neo/specs/",
        "https://www.apple.com/macbook-air/specs/",
        "https://www.apple.com/macbook-pro/specs/",
      ][index]!,
    }));
    const sourceIds = sources.map((source) => source.id);
    const criterion = (id: string, values: string[]) => ({
      id,
      title: id.replaceAll("-", " "),
      body: "A grounded shared comparison criterion.",
      sourceIds,
      items: options.map((label, index) => ({
        id: `${id}-${index + 1}`,
        label,
        value: values[index]!,
        detail: `Grounded ${id} detail for ${label}.`,
        sourceIds: [sourceIds[index]!],
      })),
    });

    const rendered = await client.callTool({
      name: "render_information_ui",
      arguments: {
        version: "1.0",
        locale: "en-US",
        originalRequest: "Compare MacBook Air, Neo, and Pro",
        groundedAnswer:
          "MacBook Air is the best default; Neo is the budget choice; Pro is for sustained professional workloads.",
        sources,
        media: [
          {
            id: "media-neo-display",
            subject: "MacBook Neo",
            role: "product",
            alt: "MacBook Neo display",
            caption: "MacBook Neo",
            sourceId: "mac-1",
            url: "https://www.apple.com/v/macbook-neo/b/images/specs/display__gjwmz6l3m262_large.jpg",
          },
          {
            id: "media-air-display",
            subject: "MacBook Air",
            role: "product",
            alt: "MacBook Air display",
            caption: "MacBook Air",
            sourceId: "mac-2",
            url: "https://www.apple.com/v/macbook-air/specs/b/images/specs/13-inch/mba_13_display__cnk2rprvaas2_large.jpg",
          },
          {
            id: "media-pro-display",
            subject: "MacBook Pro",
            role: "product",
            alt: "MacBook Pro display",
            caption: "MacBook Pro",
            sourceId: "mac-3",
            url: "https://www.apple.com/v/macbook-pro/specs/c/images/specs/14-inch/display_14_inch__db0ppp7h83ma_large.jpg",
          },
        ],
        sections: [
          {
            id: "recommendation",
            title: "Recommendation",
            body: "Choose by budget and workload.",
            sourceIds,
            items: options.map((value, index) => ({
              id: `recommendation-${index + 1}`,
              label: ["Spend the least", "Best for most people", "Professional choice"][index]!,
              value,
              detail: `Grounded recommendation for ${value}.`,
              sourceIds: [sourceIds[index]!],
            })),
          },
          criterion("starting-configuration", [
            "$599 · 8GB · 256GB",
            "$1,099 · 16GB · 512GB",
            "$1,699 · 16GB · 1TB",
          ]),
          criterion("performance-headroom", [
            "A18 Pro",
            "M5",
            "M5 to M5 Max",
          ]),
          criterion("display-quality", [
            "13-inch · 500 nits",
            "13.6-inch · P3",
            "14.2-inch XDR · 120Hz",
          ]),
          criterion("ports-displays", [
            "2 USB-C · 1 display",
            "MagSafe + 2 TB4",
            "MagSafe + HDMI + SDXC",
          ]),
          criterion("mobility-battery", [
            "2.7 lb · 16 hr",
            "2.7 lb · 18 hr",
            "3.4 lb · 24 hr",
          ]),
        ],
        suggestedRefinements: ["Choose for coding, design, or school"],
      },
    });

    expect(rendered.isError, JSON.stringify(rendered)).not.toBe(true);
    const output = rendered.structuredContent as {
      state: string;
      frames: Array<{
        type: string;
        experience?: {
          representation?: { blueprintIds?: string[]; slots?: unknown[] };
          nodes?: Array<Record<string, unknown>>;
        };
      }>;
    };
    expect(output.state).toBe("complete");
    const complete = output.frames.find((frame) => frame.type === "complete");
    expect(complete?.experience?.representation?.blueprintIds).toEqual([
      "compare-decide",
    ]);
    expect(complete?.experience?.representation?.slots).toHaveLength(9);
    expect(
      complete?.experience?.nodes?.filter((node) =>
        String(node.id).startsWith("media-"),
      ),
    ).toHaveLength(3);
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

  it("drops untrusted optional media and still completes the interactive view", async () => {
    const invalid = structuredClone(envelope) as Record<string, unknown>;
    (invalid.media as Array<Record<string, unknown>>)[0]!.url =
      "https://images.example.com/untrusted.jpg";
    const result = await client.callTool({
      name: "render_information_ui",
      arguments: invalid,
    });
    expect(result.isError).not.toBe(true);
    expect(result.content).toContainEqual(
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining(envelope.groundedAnswer),
      }),
    );
    expect(result.structuredContent).toMatchObject({
      state: "complete",
      diagnostic: expect.stringContaining("media.0: dropped"),
    });
    const complete = (
      result.structuredContent as {
        frames: Array<{ type: string; envelope?: { media?: unknown[] } }>;
      }
    ).frames.find((frame) => frame.type === "complete");
    expect(complete?.envelope?.media).toEqual([]);
  });

  it("drops structurally incomplete optional media before semantic validation", async () => {
    const invalid = structuredClone(envelope) as Record<string, unknown>;
    invalid.media = [
      {
        url: "https://www.apple.com/images/product.jpg",
        role: "product",
      },
    ];

    const result = await client.callTool({
      name: "render_information_ui",
      arguments: invalid,
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      state: "complete",
      diagnostic: expect.stringContaining("media.0: dropped"),
    });
  });

  it("retries without all media when envelope-level validation rejects optional enrichment", async () => {
    const oversized = structuredClone(envelope) as Record<string, unknown>;
    oversized.groundedAnswer = "A".repeat(15_900);
    oversized.media = Array.from({ length: 4 }, (_, index) => ({
      id: `large-media-${index + 1}`,
      url: `https://www.apple.com/${"a".repeat(1_900)}-${index}.jpg`,
      alt: "A".repeat(180),
      caption: "C".repeat(400),
      role: "illustration",
      subject: "S".repeat(90),
      sourceId: "portrait-source",
    }));

    const result = await client.callTool({
      name: "render_information_ui",
      arguments: oversized,
    });

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      state: "complete",
      diagnostic: expect.stringContaining(
        "Optional media failed envelope-level validation",
      ),
    });
    const complete = (
      result.structuredContent as {
        frames: Array<{ type: string; envelope?: { media?: unknown[] } }>;
      }
    ).frames.find((frame) => frame.type === "complete");
    expect(complete?.envelope?.media).toEqual([]);
  });

  it("keeps the interactive view complete across optional-media mutation classes", async () => {
    const validMedia = {
      id: "optional-product",
      url: "https://www.apple.com/images/product.jpg",
      alt: "Optional product image",
      caption: "Official product image",
      role: "illustration",
      subject: "Product",
      sourceId: "portrait-source",
    };
    const mutations: Array<{ name: string; media: unknown[] }> = [
      { name: "missing-id", media: [{ ...validMedia, id: undefined }] },
      {
        name: "unsupported-host",
        media: [
          { ...validMedia, url: "https://images.example.com/product.jpg" },
        ],
      },
      { name: "missing-alt", media: [{ ...validMedia, alt: undefined }] },
      {
        name: "invalid-role",
        media: [{ ...validMedia, role: "decorative-product" }],
      },
      {
        name: "unknown-source",
        media: [{ ...validMedia, sourceId: "missing-source" }],
      },
      {
        name: "source-id-collision",
        media: [{ ...validMedia, id: "portrait-source" }],
      },
      {
        name: "duplicate-media-id",
        media: [validMedia, { ...validMedia }],
      },
      {
        name: "more-than-four",
        media: Array.from({ length: 6 }, (_, index) => ({
          ...validMedia,
          id: `optional-product-${index + 1}`,
        })),
      },
    ];

    for (const mutation of mutations) {
      const candidate = structuredClone(envelope) as Record<string, unknown>;
      candidate.media = mutation.media;
      const result = await client.callTool({
        name: "render_information_ui",
        arguments: candidate,
      });

      expect(result.isError, mutation.name).not.toBe(true);
      expect(result.structuredContent, mutation.name).toMatchObject({
        state: "complete",
        diagnostic: expect.any(String),
      });
    }
  });
});
