import { describe, expect, it } from "vitest";
import { reduceA2UIMessage, reduceA2UIStream } from "@fify/a2ui";
import { repairUXDecisionBrief } from "./decision.js";
import {
  applyUXDecisionPolicy,
  appendUILanguageNode,
  buildUILanguageInstructions,
  createRepresentationSkeleton,
  createUILanguageStream,
  evaluateUITaste,
  finalizeUILanguageStream,
  parseModelAuthoredUIExperience,
  sanitizeModelAuthoredUINode,
  uiExperienceJsonSchema,
  uiExperienceSchema,
  uiExperienceToA2UI,
  uiLanguageCatalog,
  uiLanguageFixture,
  uiLanguageFixtureRepresentation,
  uiModelNodeSchema,
  uiNodeTypes,
} from "./language.js";
import { representationPlanSchema } from "./representation.js";

describe("Fify UI language", () => {
  it("compiles a hierarchical, trusted component graph", () => {
    const experience = uiExperienceSchema.parse(uiLanguageFixture);
    const state = reduceA2UIStream(uiExperienceToA2UI(experience));
    expect(state?.components.root?.component).toBe("Page");
    expect(state?.components.root?.children).toEqual(
      experience.nodes[0]?.children,
    );
    expect(
      new Set(experience.nodes.map((node) => node.type)).size,
    ).toBeGreaterThanOrEqual(7);
  });

  it("resolves parent-first streams on one persistent surface", () => {
    const surfaceId = "streaming-ui";
    let state = reduceA2UIMessage(null, createUILanguageStream(surfaceId));
    for (const node of uiLanguageFixture.nodes)
      state = reduceA2UIMessage(state, appendUILanguageNode(surfaceId, node));
    for (const message of finalizeUILanguageStream(
      surfaceId,
      uiLanguageFixture,
    ))
      state = reduceA2UIMessage(state, message);
    expect(state?.surfaceId).toBe(surfaceId);
    expect(Object.keys(state?.components ?? {})).toHaveLength(
      uiLanguageFixture.nodes.length,
    );
    expect(state?.dataModel.screen).toEqual(uiLanguageFixture.screen);
  });

  it("rejects missing references, cycles, or orphaned UI", () => {
    const missing = structuredClone(uiLanguageFixture);
    missing.nodes[0]!.children.push("does-not-exist");
    expect(() => uiExperienceSchema.parse(missing)).toThrow(/missing child/);
    const cycle = structuredClone(uiLanguageFixture);
    cycle.nodes.find((node) => node.id === "proof-grid")!.children.push("root");
    expect(() => uiExperienceSchema.parse(cycle)).toThrow(/cycle/);
    const orphan = structuredClone(uiLanguageFixture);
    orphan.nodes.push({ ...orphan.nodes.at(-1)!, id: "orphan-button" });
    expect(() => uiExperienceSchema.parse(orphan)).toThrow(/not reachable/);
  });

  it("publishes every renderer capability in the catalog", () => {
    expect(Object.keys(uiLanguageCatalog.components).sort()).toEqual(
      [...uiNodeTypes].sort(),
    );
  });

  it("publishes a semantic v4 authoring schema and topology-aware skeleton", () => {
    expect(uiExperienceJsonSchema).toMatchObject({
      type: "object",
      properties: { version: { const: "4.0" } },
    });
    expect(JSON.stringify(uiExperienceJsonSchema)).not.toContain('"oneOf"');
    expect(JSON.stringify(uiExperienceJsonSchema)).toContain('"anyOf"');
    expect(() =>
      uiModelNodeSchema.parse({
        id: "bad",
        type: "Text",
        slot: "primary",
        importance: "primary",
        relationship: "standalone",
        mediaRole: "none",
        title: "",
        text: "Copy",
        label: "",
        value: "",
        meta: "",
        children: [],
      }),
    ).toThrow(/children/);
    expect(JSON.stringify(uiExperienceJsonSchema)).not.toMatch(
      /palette|personality|variant|tone|span|icon/,
    );
    const gridPlan = representationPlanSchema.parse({
      ...uiLanguageFixtureRepresentation,
      topology: "responsive-grid",
    });
    const skeleton = createRepresentationSkeleton(gridPlan);
    expect(skeleton.map((item) => item.type)).toContain("Grid");
    expect(skeleton[0]).toMatchObject({ id: "root", type: "Page", slot: "" });
    const visibleSkeleton = createRepresentationSkeleton(gridPlan, [
      "primary",
      "streaming",
    ]);
    expect(visibleSkeleton.map((item) => item.id)).toEqual([
      "root",
      "representation-layout",
      "pending-primary",
      "pending-streaming",
    ]);
    expect(visibleSkeleton.at(-1)).toMatchObject({
      slot: "streaming",
      text: "",
    });
  });

  it("allows a concise answer-sized UI without artificial layout filler", () => {
    const root = structuredClone(uiLanguageFixture.nodes[0]!);
    root.children = ["concise-answer"];
    const answer = structuredClone(
      uiLanguageFixture.nodes.find((node) => node.id === "different-heading")!,
    );
    answer.id = "concise-answer";
    const concise = uiExperienceSchema.parse({
      ...uiLanguageFixture,
      responseId: "concise",
      nodes: [root, answer],
      suggestions: [],
    });
    expect(concise.nodes).toHaveLength(2);
    expect(concise.suggestions).toEqual([]);
  });

  it("accepts a useful flat multi-section answer without stylistic filler", () => {
    const ids = [
      "opening",
      "different-heading",
      "shape-comparison",
      "stream-proof",
      "product-owns",
    ];
    const root = structuredClone(uiLanguageFixture.nodes[0]!);
    root.children = ids;
    const nodes = ids.map((id) =>
      structuredClone(uiLanguageFixture.nodes.find((node) => node.id === id)!),
    );
    const flat = uiExperienceSchema.parse({
      ...uiLanguageFixture,
      responseId: "flat-answer",
      nodes: [root, ...nodes],
      suggestions: [],
    });
    expect(flat.nodes).toHaveLength(6);
    expect(flat.nodes[0]?.children).toEqual(ids);
  });

  it("allows section headers to group the UI they introduce", () => {
    const root = structuredClone(uiLanguageFixture.nodes[0]!);
    root.children = ["section-group"];
    const section = structuredClone(
      uiLanguageFixture.nodes.find((node) => node.id === "different-heading")!,
    );
    section.id = "section-group";
    section.children = ["section-copy"];
    const copy = structuredClone(
      uiLanguageFixture.nodes.find((node) => node.id === "product-owns")!,
    );
    copy.id = "section-copy";
    const grouped = uiExperienceSchema.parse({
      ...uiLanguageFixture,
      responseId: "grouped-section",
      nodes: [root, section, copy],
      suggestions: [],
    });
    expect(grouped.nodes[1]?.children).toEqual(["section-copy"]);
  });

  it("keeps image lookup semantic and strips model-authored media URLs", () => {
    const root = structuredClone(uiLanguageFixture.nodes[0]!);
    root.children = ["portrait"];
    const image = structuredClone(
      uiLanguageFixture.nodes.find((node) => node.id === "product-owns")!,
    );
    Object.assign(image, {
      id: "portrait",
      type: "Image",
      variant: "portrait",
      label: "Steve Jobs",
      title: "Portrait of Steve Jobs",
      text: "Apple co-founder Steve Jobs.",
      value: "https://untrusted.example/model-image.jpg",
      meta: "invented provider",
      items: [
        {
          id: "fake-credit",
          label: "Fake",
          value: "Unknown",
          detail: "https://untrusted.example",
          tone: "neutral",
          progress: null,
        },
      ],
      children: [],
    });
    const modelNodes = [
      {
        id: root.id,
        type: "Page",
        slot: "",
        importance: "supporting",
        relationship: "standalone",
        mediaRole: "none",
        align: root.align,
        columns: root.columns,
        gap: root.gap,
        children: root.children,
      },
      {
        id: image.id,
        type: "Image",
        slot: "primary",
        importance: "primary",
        relationship: "standalone",
        mediaRole: "identity",
        title: image.title,
        text: image.text,
        label: image.label,
      },
    ];
    const mediaRepresentation = representationPlanSchema.parse({
      ...uiLanguageFixtureRepresentation,
      informationShapes: ["media-artifact"],
      slots: [
        {
          id: "primary",
          role: "primary",
          shape: "media-artifact",
          priority: "primary",
          required: true,
        },
      ],
    });
    const parsed = parseModelAuthoredUIExperience(
      {
        version: "4.0",
        responseId: "image-answer",
        goal: uiLanguageFixture.goal,
        screen: uiLanguageFixture.screen,
        nodes: modelNodes,
        suggestions: [],
      },
      mediaRepresentation,
    );
    const safeImage = parsed.nodes[1]!;
    expect(safeImage).toMatchObject({
      type: "Image",
      label: "Steve Jobs",
      value: "",
      meta: "",
      items: [],
    });
    expect(sanitizeModelAuthoredUINode(image).value).toBe("");
  });

  it("deterministically supplies a required semantic image when the model omits it", () => {
    const representation = representationPlanSchema.parse({
      ...uiLanguageFixtureRepresentation,
      mode: "open",
      blueprintIds: ["open-composition"],
      informationShapes: ["narrative", "media-artifact"],
      slots: [
        {
          id: "identity",
          role: "identity",
          shape: "narrative",
          priority: "primary",
          required: true,
        },
        {
          id: "portrait",
          role: "portrait",
          shape: "media-artifact",
          priority: "supporting",
          required: true,
        },
      ],
    });
    const parsed = parseModelAuthoredUIExperience(
      {
        version: "4.0",
        responseId: "missing-image-answer",
        goal: "Identify Steve Jobs",
        screen: { title: "Steve Jobs", contextLabel: "Person" },
        nodes: [
          {
            id: "root",
            type: "Page",
            slot: "",
            importance: "supporting",
            relationship: "standalone",
            mediaRole: "none",
            align: "stretch",
            columns: 2,
            gap: "normal",
            children: ["summary"],
          },
          {
            id: "summary",
            type: "Text",
            slot: "identity",
            importance: "primary",
            relationship: "standalone",
            mediaRole: "none",
            title: "Steve Jobs",
            text: "Apple co-founder and product leader.",
            label: "",
            value: "",
            meta: "",
          },
        ],
        suggestions: [],
      },
      representation,
      "Who is Steve Jobs? Include one useful visual.",
    );
    expect(parsed.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "Image",
          slot: "portrait",
          mediaRole: "identity",
          variant: "portrait",
          label: "Steve Jobs",
          value: "",
        }),
      ]),
    );
  });

  it("requires color answers to carry visible, safe swatch values", () => {
    const root = structuredClone(uiLanguageFixture.nodes[0]!);
    root.children = ["palette"];
    const source = structuredClone(
      uiLanguageFixture.nodes.find((node) => node.id === "shape-comparison")!,
    );
    const palette = {
      ...source,
      id: "palette",
      type: "ColorPalette" as const,
      slot: "palette",
      title: "Coastal palette",
      items: [
        {
          ...source.items[0]!,
          id: "ocean",
          label: "Ocean",
          value: "#2563EB",
          detail: "Primary actions",
        },
        {
          ...source.items[1]!,
          id: "sand",
          label: "Sand",
          value: "#E7D7B8",
          detail: "Warm surfaces",
        },
      ],
    };
    const representation = representationPlanSchema.parse({
      ...uiLanguageFixtureRepresentation,
      informationShapes: ["facts"],
      interactionLevel: "read",
      scale: "atomic",
      topology: "editorial-stack",
      slots: [
        {
          id: "palette",
          role: "primary",
          shape: "facts",
          priority: "primary",
          required: true,
        },
      ],
    });
    const valid = uiExperienceSchema.parse({
      ...uiLanguageFixture,
      responseId: "palette-answer",
      representation,
      nodes: [root, palette],
      suggestions: [],
    });
    expect(valid.nodes[1]?.type).toBe("ColorPalette");
    const invalid = structuredClone(valid);
    invalid.nodes[1]!.items[0]!.value = "ocean blue";
    expect(() => uiExperienceSchema.parse(invalid)).toThrow(/hexadecimal/);
  });

  it("drops optional leaf media that is incompatible with the validated route", () => {
    const representation = representationPlanSchema.parse({
      version: "1.0",
      mode: "blueprint",
      blueprintIds: ["direct-answer"],
      confidence: 0.95,
      userJob: "answer directly",
      informationShapes: ["narrative"],
      interactionLevel: "read",
      scale: "atomic",
      topology: "editorial-stack",
      noveltyBudget: 0.1,
      slots: [
        {
          id: "answer",
          role: "answer",
          shape: "narrative",
          priority: "primary",
          required: true,
        },
      ],
    });
    const authored = {
      version: "4.0",
      responseId: "pruned-media",
      goal: "Answer without unrelated media",
      screen: { title: "Answer", contextLabel: "Direct" },
      suggestions: [],
      nodes: [
        {
          id: "root",
          type: "Page",
          slot: "",
          importance: "supporting",
          relationship: "standalone",
          mediaRole: "none",
          align: "start",
          columns: 1,
          gap: "normal",
          children: ["answer", "extra-image"],
        },
        {
          id: "answer",
          type: "Text",
          slot: "answer",
          importance: "primary",
          relationship: "standalone",
          mediaRole: "none",
          title: "Answer",
          text: "Enough information.",
          label: "",
          value: "",
          meta: "",
        },
        {
          id: "extra-image",
          type: "Image",
          slot: "answer",
          importance: "supporting",
          relationship: "continuation",
          mediaRole: "illustration",
          title: "Decorative image",
          text: "",
          label: "decoration",
        },
      ],
    };
    const parsed = parseModelAuthoredUIExperience(authored, representation);
    expect(parsed.nodes.map((node) => node.id)).toEqual(["root", "answer"]);
    expect(parsed.nodes[0]?.children).toEqual(["answer"]);
  });

  it("recovers route, slot, topology, reachability, and forbidden-component mismatches", () => {
    const representation = representationPlanSchema.parse({
      version: "1.0",
      mode: "blueprint",
      blueprintIds: ["compare-decide"],
      confidence: 0.86,
      userJob: "choose between options",
      informationShapes: ["comparison", "narrative"],
      interactionLevel: "read",
      scale: "compact",
      topology: "horizontal-rail",
      noveltyBudget: 0.2,
      slots: [
        {
          id: "recommendation",
          role: "recommendation",
          shape: "narrative",
          priority: "primary",
          required: true,
        },
        {
          id: "alternatives",
          role: "alternatives",
          shape: "comparison",
          priority: "supporting",
          required: true,
        },
      ],
    });
    const authored = {
      version: "4.0",
      responseId: "recovered",
      goal: "Help choose",
      screen: { title: "Choose", contextLabel: "Decision" },
      suggestions: [],
      nodes: [
        {
          id: "root",
          type: "Page",
          slot: "wrong",
          importance: "supporting",
          relationship: "standalone",
          mediaRole: "none",
          align: "start",
          columns: 1,
          gap: "normal",
          children: ["options", "forbidden"],
        },
        {
          id: "options",
          type: "Comparison",
          slot: "made-up",
          importance: "primary",
          relationship: "standalone",
          mediaRole: "none",
          title: "Options",
          text: "",
          label: "",
          value: "",
          meta: "",
          items: [
            { id: "a", label: "A", value: "", detail: "First", progress: null },
            {
              id: "b",
              label: "B",
              value: "",
              detail: "Second",
              progress: null,
            },
          ],
          action: { type: "none", prompt: "", targetId: "", value: "" },
        },
        {
          id: "forbidden",
          type: "Checklist",
          slot: "alternatives",
          importance: "supporting",
          relationship: "standalone",
          mediaRole: "none",
          title: "Not tasks",
          text: "",
          label: "",
          value: "",
          meta: "",
          items: [
            {
              id: "x",
              label: "X",
              value: "",
              detail: "Not a task",
              progress: null,
            },
            {
              id: "y",
              label: "Y",
              value: "",
              detail: "Not a task",
              progress: null,
            },
          ],
          action: {
            type: "toggle",
            prompt: "",
            targetId: "forbidden",
            value: "",
          },
        },
        {
          id: "orphan",
          type: "Text",
          slot: "recommendation",
          importance: "supporting",
          relationship: "continuation",
          mediaRole: "none",
          title: "Recommendation",
          text: "Choose A.",
          label: "",
          value: "",
          meta: "",
        },
      ],
    };
    const parsed = parseModelAuthoredUIExperience(authored, representation);
    expect(parsed.nodes.some((node) => node.id === "forbidden")).toBe(false);
    expect(parsed.nodes[0]).toMatchObject({
      id: "root",
      type: "Page",
      slot: "",
    });
    expect(parsed.nodes.find((node) => node.id === "options")?.slot).toBe(
      "alternatives",
    );
    expect(parsed.nodes[0]?.children).toContain("orphan");
  });

  it("preserves both jobs in a hybrid route when one blueprint forbids the other's component", () => {
    const representation = representationPlanSchema.parse({
      version: "1.0",
      mode: "hybrid",
      blueprintIds: ["plan-schedule", "compare-decide"],
      confidence: 0.9,
      userJob: "plan an offsite and compare venues",
      informationShapes: ["chronology", "comparison", "narrative"],
      interactionLevel: "read",
      scale: "compound",
      topology: "responsive-grid",
      noveltyBudget: 0.3,
      slots: [
        {
          id: "plan",
          role: "plan",
          shape: "chronology",
          priority: "primary",
          required: true,
        },
        {
          id: "alternatives",
          role: "alternatives",
          shape: "comparison",
          priority: "supporting",
          required: true,
        },
      ],
    });
    const repeated = [
      {
        id: "first",
        label: "Day one",
        value: "",
        detail: "Meet",
        progress: null,
      },
      {
        id: "second",
        label: "Day two",
        value: "",
        detail: "Decide",
        progress: null,
      },
    ];
    const parsed = parseModelAuthoredUIExperience(
      {
        version: "4.0",
        responseId: "hybrid-preserved",
        goal: "Plan and compare",
        screen: { title: "Offsite", contextLabel: "Plan" },
        suggestions: [],
        nodes: [
          {
            id: "root",
            type: "Page",
            slot: "",
            importance: "supporting",
            relationship: "standalone",
            mediaRole: "none",
            align: "start",
            columns: 1,
            gap: "normal",
            children: ["plan", "venues"],
          },
          {
            id: "plan",
            type: "Steps",
            slot: "plan",
            importance: "primary",
            relationship: "standalone",
            mediaRole: "none",
            title: "Two-day plan",
            text: "",
            label: "",
            value: "",
            meta: "",
            items: repeated,
          },
          {
            id: "venues",
            type: "Comparison",
            slot: "alternatives",
            importance: "supporting",
            relationship: "standalone",
            mediaRole: "none",
            title: "Venues",
            text: "",
            label: "",
            value: "",
            meta: "",
            items: repeated,
            action: { type: "none", prompt: "", targetId: "", value: "" },
          },
        ],
      },
      representation,
    );

    expect(parsed.nodes.find((node) => node.id === "plan")).toMatchObject({
      type: "Timeline",
      slot: "plan",
    });
    expect(parsed.nodes.find((node) => node.id === "venues")).toMatchObject({
      type: "Comparison",
      slot: "alternatives",
    });
    expect(parsed.nodes.some((node) => node.id === "primary-summary")).toBe(
      false,
    );
  });

  it("does not let a text fallback silently erase a required supporting job", () => {
    const representation = representationPlanSchema.parse({
      version: "1.0",
      mode: "blueprint",
      blueprintIds: ["workflow-action"],
      confidence: 0.8,
      userJob: "summarize work",
      informationShapes: ["record", "tasks-progress"],
      interactionLevel: "read",
      scale: "compact",
      topology: "responsive-grid",
      noveltyBudget: 0.2,
      slots: [
        {
          id: "work",
          role: "work-items",
          shape: "record",
          priority: "primary",
          required: true,
        },
        {
          id: "status",
          role: "status",
          shape: "tasks-progress",
          priority: "supporting",
          required: true,
        },
      ],
    });
    const authored = {
      version: "4.0",
      responseId: "text-fallback",
      goal: "Summarize",
      screen: { title: "Work", contextLabel: "Summary" },
      suggestions: [],
      nodes: [
        {
          id: "root",
          type: "Page",
          slot: "",
          importance: "supporting",
          relationship: "standalone",
          mediaRole: "none",
          align: "start",
          columns: 1,
          gap: "normal",
          children: ["summary"],
        },
        {
          id: "summary",
          type: "Text",
          slot: "unknown",
          importance: "primary",
          relationship: "standalone",
          mediaRole: "none",
          title: "Current state",
          text: "The launch is on track.",
          label: "",
          value: "",
          meta: "",
        },
      ],
    };
    expect(() =>
      parseModelAuthoredUIExperience(authored, representation),
    ).toThrow(/Required slot 'status'/);
  });

  it("separates a recommendation from alternatives when the model combines them", () => {
    const representation = representationPlanSchema.parse({
      version: "1.0",
      mode: "blueprint",
      blueprintIds: ["compare-decide"],
      confidence: 0.9,
      userJob: "compare two venues",
      informationShapes: ["narrative", "comparison"],
      interactionLevel: "read",
      scale: "compact",
      topology: "focal-split",
      noveltyBudget: 0.2,
      slots: [
        {
          id: "recommendation",
          role: "recommendation",
          shape: "narrative",
          priority: "primary",
          required: true,
        },
        {
          id: "alternatives",
          role: "alternatives",
          shape: "comparison",
          priority: "supporting",
          required: true,
        },
      ],
    });
    const parsed = parseModelAuthoredUIExperience(
      {
        version: "4.0",
        responseId: "combined-comparison",
        goal: "Choose a venue",
        screen: { title: "Venue choice", contextLabel: "Decision" },
        suggestions: [],
        nodes: [
          {
            id: "root",
            type: "Page",
            slot: "",
            importance: "supporting",
            relationship: "standalone",
            mediaRole: "none",
            align: "start",
            columns: 1,
            gap: "normal",
            children: ["combined"],
          },
          {
            id: "combined",
            type: "Comparison",
            slot: "recommendation",
            importance: "primary",
            relationship: "standalone",
            mediaRole: "none",
            title: "Choose venue A",
            text: "Venue A is the stronger fit.",
            label: "Venues",
            value: "",
            meta: "",
            items: [
              {
                id: "venue-a",
                label: "Venue A",
                value: "Recommended",
                detail: "Central and flexible.",
                progress: null,
              },
              {
                id: "venue-b",
                label: "Venue B",
                value: "Alternative",
                detail: "Larger but farther away.",
                progress: null,
              },
            ],
            action: { type: "none", prompt: "", targetId: "", value: "" },
          },
        ],
      },
      representation,
      "Compare the two venues",
    );

    expect(parsed.nodes.find((node) => node.type === "Comparison")?.slot).toBe(
      "alternatives",
    );
    expect(
      parsed.nodes.find((node) => node.slot === "recommendation"),
    ).toMatchObject({ type: "Text", importance: "primary" });
  });

  it("rejects incomplete explicit top-N collections before they reach the user", () => {
    const representation = representationPlanSchema.parse({
      version: "1.0",
      mode: "blueprint",
      blueprintIds: ["explore-recommend"],
      confidence: 0.9,
      userJob: "Rank the top 10 players",
      informationShapes: ["record", "facts"],
      interactionLevel: "read",
      scale: "compact",
      topology: "responsive-grid",
      noveltyBudget: 0.2,
      slots: [
        {
          id: "featured",
          role: "featured",
          shape: "facts",
          priority: "primary",
          required: true,
        },
        {
          id: "players",
          role: "collection",
          shape: "record",
          priority: "supporting",
          required: true,
        },
      ],
    });
    const authored = {
      version: "4.0",
      responseId: "short-ranking",
      goal: "Rank players",
      screen: { title: "Top 10", contextLabel: "Ranking" },
      suggestions: [],
      nodes: [
        {
          id: "root",
          type: "Page",
          slot: "",
          importance: "supporting",
          relationship: "standalone",
          mediaRole: "none",
          align: "start",
          columns: 1,
          gap: "normal",
          children: ["ranking"],
        },
        {
          id: "ranking",
          type: "Table",
          slot: "players",
          importance: "primary",
          relationship: "standalone",
          mediaRole: "none",
          title: "Players",
          text: "",
          label: "",
          value: "",
          meta: "",
          items: [
            {
              id: "one",
              label: "1",
              value: "Player one",
              detail: "Only one entry",
              progress: null,
            },
            {
              id: "two",
              label: "2",
              value: "Player two",
              detail: "Only two entries",
              progress: null,
            },
          ],
        },
      ],
    };
    expect(() =>
      parseModelAuthoredUIExperience(
        authored,
        representation,
        "Who are the top 10 players?",
      ),
    ).toThrow(/of 10 requested entries/);
  });

  it("requires portraits for real-person identity answers", () => {
    expect(buildUILanguageInstructions()).toContain("Who is [real person]?");
    expect(buildUILanguageInstructions()).toContain("requires a portrait");
  });

  it("separates descriptive facts from completable checklist tasks", () => {
    const root = structuredClone(uiLanguageFixture.nodes[0]!);
    root.children = ["facts"];
    const facts = structuredClone(
      uiLanguageFixture.nodes.find((node) => node.id === "shape-comparison")!,
    );
    Object.assign(facts, {
      id: "facts",
      type: "FactList",
      slot: "primary",
      title: "At a glance",
      action: { type: "none", prompt: "", targetId: "", value: "" },
    });
    const factsRepresentation = representationPlanSchema.parse({
      ...uiLanguageFixtureRepresentation,
      informationShapes: ["facts"],
      slots: [
        {
          id: "primary",
          role: "primary",
          shape: "facts",
          priority: "primary",
          required: true,
        },
      ],
    });
    expect(() =>
      uiExperienceSchema.parse({
        ...uiLanguageFixture,
        representation: factsRepresentation,
        responseId: "facts",
        nodes: [root, facts],
        suggestions: [],
      }),
    ).not.toThrow();

    const checklist = {
      ...facts,
      type: "Checklist",
      action: { type: "none", prompt: "", targetId: "", value: "" },
    };
    const taskRepresentation = representationPlanSchema.parse({
      ...uiLanguageFixtureRepresentation,
      informationShapes: ["tasks-progress"],
      slots: [
        {
          id: "primary",
          role: "primary",
          shape: "tasks-progress",
          priority: "primary",
          required: true,
        },
      ],
    });
    expect(() =>
      uiExperienceSchema.parse({
        ...uiLanguageFixture,
        representation: taskRepresentation,
        responseId: "bad-checklist",
        nodes: [root, checklist],
        suggestions: [],
      }),
    ).toThrow(/user-completable tasks/);
    checklist.action = {
      type: "toggle",
      prompt: "",
      targetId: "facts",
      value: "",
    };
    expect(() =>
      uiExperienceSchema.parse({
        ...uiLanguageFixture,
        representation: taskRepresentation,
        responseId: "task-checklist",
        nodes: [root, checklist],
        suggestions: [],
      }),
    ).not.toThrow();
  });

  it("rejects dead generated controls before they can stream", () => {
    const buttonBase = {
      id: "continue",
      type: "Button",
      slot: "primary",
      importance: "primary",
      relationship: "standalone",
      mediaRole: "none",
      title: "",
      text: "",
      label: "Continue with my details",
      value: "",
      meta: "",
    } as const;
    expect(() =>
      uiModelNodeSchema.parse({
        ...buttonBase,
        action: { type: "none", prompt: "", targetId: "", value: "" },
      }),
    ).toThrow();
    expect(() =>
      uiModelNodeSchema.parse({
        ...buttonBase,
        action: {
          type: "prompt",
          prompt: "Use my details to continue",
          targetId: "",
          value: "",
        },
      }),
    ).not.toThrow();

    const comparisonBase = {
      id: "options",
      type: "Comparison",
      slot: "primary",
      importance: "primary",
      relationship: "standalone",
      mediaRole: "none",
      title: "Two options",
      text: "",
      label: "",
      value: "",
      meta: "",
      items: [
        {
          id: "a",
          label: "A",
          value: "",
          detail: "First option",
          progress: null,
        },
        {
          id: "b",
          label: "B",
          value: "",
          detail: "Second option",
          progress: null,
        },
      ],
    } as const;
    expect(() =>
      uiModelNodeSchema.parse({
        ...comparisonBase,
        action: { type: "none", prompt: "", targetId: "", value: "" },
      }),
    ).not.toThrow();
    expect(() =>
      uiModelNodeSchema.parse({
        ...comparisonBase,
        action: {
          type: "prompt",
          prompt: "Choose this",
          targetId: "",
          value: "",
        },
      }),
    ).toThrow();

    const root = structuredClone(uiLanguageFixture.nodes[0]!);
    const input = structuredClone(
      uiLanguageFixture.nodes.find((node) => node.id === "different-heading")!,
    );
    Object.assign(input, {
      id: "source-notes",
      type: "Input",
      slot: "inputs",
      importance: "primary",
      title: "",
      label: "Meeting notes",
      text: "Paste notes here",
      action: { type: "none", prompt: "", targetId: "", value: "" },
      items: [],
      children: [],
    });
    const continuation = structuredClone(
      uiLanguageFixture.nodes.find((node) => node.id === "try-plan")!,
    );
    Object.assign(continuation, {
      id: "continue-with-notes",
      slot: "inputs",
      importance: "supporting",
      label: "Create action room",
      action: {
        type: "prompt",
        prompt: "Create the action room from my current notes.",
        targetId: "",
        value: "",
      },
      children: [],
    });
    const interactiveRepresentation = representationPlanSchema.parse({
      version: "1.0",
      mode: "blueprint",
      blueprintIds: ["interactive-tool"],
      confidence: 0.9,
      userJob: "turn notes into actions",
      informationShapes: ["choice-input"],
      interactionLevel: "edit",
      scale: "compact",
      topology: "form-result",
      noveltyBudget: 0.2,
      slots: [
        {
          id: "inputs",
          role: "inputs",
          shape: "choice-input",
          priority: "primary",
          required: true,
        },
      ],
    });
    root.children = [input.id];
    expect(() =>
      uiExperienceSchema.parse({
        ...uiLanguageFixture,
        responseId: "dead-input",
        representation: interactiveRepresentation,
        nodes: [root, input],
        suggestions: [],
      }),
    ).toThrow(/Stateful controls require one prompt Button/);
    root.children.push(continuation.id);
    expect(() =>
      uiExperienceSchema.parse({
        ...uiLanguageFixture,
        responseId: "live-input",
        representation: interactiveRepresentation,
        nodes: [root, input, continuation],
        suggestions: [],
      }),
    ).not.toThrow();
  });

  it("adds an AI continuation when generated form controls omit one", () => {
    const representation = representationPlanSchema.parse({
      version: "1.0",
      mode: "blueprint",
      blueprintIds: ["interactive-tool"],
      confidence: 0.9,
      userJob: "estimate an emergency fund",
      informationShapes: ["choice-input", "metrics"],
      interactionLevel: "edit",
      scale: "compact",
      topology: "form-result",
      noveltyBudget: 0.2,
      slots: [
        {
          id: "inputs",
          role: "inputs",
          shape: "choice-input",
          priority: "primary",
          required: true,
        },
        {
          id: "result",
          role: "result",
          shape: "metrics",
          priority: "supporting",
          required: true,
        },
      ],
    });
    const authored = {
      version: "4.0",
      responseId: "interactive",
      goal: "Estimate",
      screen: { title: "Estimator", contextLabel: "Tool" },
      suggestions: [],
      nodes: [
        {
          id: "root",
          type: "Page",
          slot: "",
          importance: "supporting",
          relationship: "standalone",
          mediaRole: "none",
          align: "start",
          columns: 1,
          gap: "normal",
          children: ["expenses", "result"],
        },
        {
          id: "expenses",
          type: "Input",
          slot: "inputs",
          importance: "primary",
          relationship: "standalone",
          mediaRole: "none",
          title: "",
          text: "Monthly expenses",
          label: "Essential expenses",
          value: "",
          meta: "number",
        },
        {
          id: "result",
          type: "Metric",
          slot: "result",
          importance: "supporting",
          relationship: "continuation",
          mediaRole: "none",
          title: "Estimate",
          text: "Awaiting inputs",
          label: "Target",
          value: "—",
          meta: "",
        },
      ],
    };
    const parsed = parseModelAuthoredUIExperience(
      authored,
      representation,
      "Help me estimate my emergency fund",
    );
    const continuation = parsed.nodes.find((node) => node.type === "Button");
    expect(continuation).toMatchObject({
      label: "Calculate with these inputs",
      action: { type: "prompt" },
    });
    expect(parsed.nodes[0]?.children).toContain(continuation?.id);
  });

  it("reclaims graph capacity for a required AI continuation", () => {
    const representation = representationPlanSchema.parse({
      version: "1.0",
      mode: "blueprint",
      blueprintIds: ["interactive-tool"],
      confidence: 0.9,
      userJob: "estimate a launch budget",
      informationShapes: ["choice-input", "narrative"],
      interactionLevel: "edit",
      scale: "workflow",
      topology: "form-result",
      noveltyBudget: 0.2,
      slots: [
        {
          id: "inputs",
          role: "inputs",
          shape: "choice-input",
          priority: "primary",
          required: true,
        },
        {
          id: "result",
          role: "result",
          shape: "narrative",
          priority: "supporting",
          required: true,
        },
      ],
    });
    const input = {
      id: "budget-input",
      type: "Input",
      slot: "inputs",
      importance: "primary",
      relationship: "standalone",
      mediaRole: "none",
      title: "",
      text: "Enter a budget",
      label: "Budget",
      value: "",
      meta: "number",
    } as const;
    const explanations = Array.from({ length: 20 }, (_, index) => ({
      id: `detail-${index + 1}`,
      type: "Text" as const,
      slot: "result",
      importance: "supporting" as const,
      relationship: "continuation" as const,
      mediaRole: "none" as const,
      title: index === 0 ? "Estimate" : "",
      text: `Supporting detail ${index + 1}`,
      label: "",
      value: "",
      meta: "",
    }));
    const groups = ["details-a", "details-b"].map((id, groupIndex) => ({
      id,
      type: "Stack" as const,
      slot: "",
      importance: "supporting" as const,
      relationship: "grouped" as const,
      mediaRole: "none" as const,
      align: "start" as const,
      columns: 1,
      gap: "normal" as const,
      children: explanations
        .slice(groupIndex * 10, groupIndex * 10 + 10)
        .map((node) => node.id),
    }));
    const parsed = parseModelAuthoredUIExperience(
      {
        version: "4.0",
        responseId: "full-interactive-graph",
        goal: "Estimate the budget",
        suggestions: [],
        screen: { title: "Budget", contextLabel: "Estimator" },
        nodes: [
          {
            id: "root",
            type: "Page",
            slot: "",
            importance: "supporting",
            relationship: "standalone",
            mediaRole: "none",
            align: "start",
            columns: 1,
            gap: "normal",
            children: [input.id, ...groups.map((node) => node.id)],
          },
          input,
          ...groups,
          ...explanations,
        ],
      },
      representation,
      "Estimate a launch budget",
    );
    expect(parsed.nodes).toHaveLength(24);
    expect(parsed.nodes.map((node) => node.type)).toContain("Button");
    expect(parsed.nodes.find((node) => node.id === "root")?.children).toContain(
      parsed.nodes.find((node) => node.type === "Button")?.id,
    );
  });

  it("turns unrequested read-only controls into static information", () => {
    const representation = representationPlanSchema.parse({
      version: "1.0",
      mode: "open",
      blueprintIds: ["open-composition"],
      confidence: 0.8,
      userJob: "see learning as a garden",
      informationShapes: ["hierarchy"],
      interactionLevel: "read",
      scale: "compact",
      topology: "open-canvas",
      noveltyBudget: 0.8,
      slots: [
        {
          id: "paths",
          role: "exploration",
          shape: "hierarchy",
          priority: "primary",
          required: true,
        },
      ],
    });
    const authored = parseModelAuthoredUIExperience(
      {
        version: "4.0",
        responseId: "static-garden",
        goal: "Explore the garden",
        suggestions: [],
        screen: { title: "Learning garden", contextLabel: "Metaphor" },
        nodes: [
          {
            id: "root",
            type: "Page",
            slot: "",
            importance: "supporting",
            relationship: "standalone",
            mediaRole: "none",
            align: "start",
            columns: 1,
            gap: "normal",
            children: ["paths", "continue"],
          },
          {
            id: "paths",
            type: "ChoiceGroup",
            slot: "paths",
            importance: "primary",
            relationship: "standalone",
            mediaRole: "none",
            title: "Paths through the garden",
            text: "",
            label: "",
            value: "",
            meta: "",
            action: {
              type: "select",
              prompt: "",
              targetId: "paths",
              value: "",
            },
            items: [
              {
                id: "seed",
                label: "Seed",
                value: "Begin",
                detail: "Start with curiosity",
                progress: null,
              },
              {
                id: "canopy",
                label: "Canopy",
                value: "Connect",
                detail: "Link ideas together",
                progress: null,
              },
            ],
          },
          {
            id: "continue",
            type: "Button",
            slot: "paths",
            importance: "supporting",
            relationship: "continuation",
            mediaRole: "none",
            title: "",
            text: "",
            label: "Choose a path",
            value: "",
            meta: "",
            action: {
              type: "prompt",
              prompt: "Continue with my selected path.",
              targetId: "",
              value: "",
            },
          },
        ],
      },
      representation,
      "Show learning as a garden",
    );
    const decision = repairUXDecisionBrief({
      version: "1.0",
      userOutcome: "See learning as a garden",
      primarySubject: "learning",
      audience: "general",
      attentionMode: "read",
      disclosureStrategy: "inline",
      latencyTier: "standard",
      compositionIntent: "Use a concise static metaphor.",
      confidence: 0.9,
      representation,
      contentObligations: [
        {
          id: "paths",
          slotId: "paths",
          purpose: "Show the garden paths.",
          shape: "hierarchy",
          priority: "primary",
          mediaQuery: "",
          itemCount: null,
        },
      ],
      contentBudget: {
        maxVisibleNodes: 2,
        maxItemsPerNode: 4,
        maxVisibleCopyCharacters: 500,
      },
    });
    const applied = applyUXDecisionPolicy(authored, decision).experience;
    expect(applied.nodes.map((node) => node.type)).toContain("FactList");
    expect(applied.nodes.map((node) => node.type)).not.toContain("ChoiceGroup");
    expect(applied.nodes.map((node) => node.type)).not.toContain("Button");
  });

  it("allows declared supporting shapes within a slot and recognizes semantic split layouts", () => {
    const root = structuredClone(uiLanguageFixture.nodes[0]!);
    root.children = ["facts"];
    const facts = structuredClone(
      uiLanguageFixture.nodes.find((node) => node.id === "shape-comparison")!,
    );
    Object.assign(facts, {
      id: "facts",
      type: "FactList",
      slot: "answer",
      action: { type: "none", prompt: "", targetId: "", value: "" },
    });
    const representation = representationPlanSchema.parse({
      version: "1.0",
      mode: "blueprint",
      blueprintIds: ["direct-answer"],
      confidence: 0.9,
      userJob: "answer directly",
      informationShapes: ["narrative"],
      interactionLevel: "read",
      scale: "compact",
      topology: "editorial-stack",
      noveltyBudget: 0.2,
      slots: [
        {
          id: "answer",
          role: "answer",
          shape: "narrative",
          priority: "primary",
          required: true,
        },
      ],
    });
    expect(() =>
      uiExperienceSchema.parse({
        ...uiLanguageFixture,
        representation,
        responseId: "supporting-shape",
        nodes: [root, facts],
        suggestions: [],
      }),
    ).not.toThrow();
    expect(() =>
      uiExperienceSchema.parse({
        ...uiLanguageFixture,
        representation: {
          ...uiLanguageFixtureRepresentation,
          topology: "focal-split",
        },
      }),
    ).not.toThrow();
  });

  it("scores visual restraint with deterministic taste rules", () => {
    const restrained = structuredClone(uiLanguageFixture);
    restrained.nodes = restrained.nodes.map((node) => ({
      ...node,
      importance: node.id === "opening" ? "primary" : "supporting",
    }));
    expect(evaluateUITaste(restrained).issues).not.toContain(
      "A response needs exactly one primary content element.",
    );
    const noisy = structuredClone(restrained);
    noisy.nodes.push({
      ...noisy.nodes.at(-1)!,
      id: "extra-action",
      importance: "primary",
    });
    expect(evaluateUITaste(noisy).score).toBeLessThan(100);
  });
});
