import { describe, expect, it } from "vitest";
import {
  buildUXDecisionCompositionInstructions,
  buildUXDirectorInstructions,
  extractRequestedItemCount,
  repairUXDecisionBrief,
} from "./decision.js";
import {
  applyUXDecisionPolicy,
  createRepresentationSkeleton,
  parseModelAuthoredUIExperience,
  uiLanguageFixture,
  uiLanguageFixtureRepresentation,
} from "./language.js";

function brief(overrides: Record<string, unknown> = {}) {
  return {
    version: "1.0",
    userOutcome: "Understand the direct answer without unnecessary interface",
    primarySubject: "",
    audience: "general",
    attentionMode: "glance",
    disclosureStrategy: "none",
    latencyTier: "standard",
    compositionIntent:
      "Use one decisive answer and one compact supporting group only if needed.",
    confidence: 0.9,
    representation: {
      ...uiLanguageFixtureRepresentation,
      interactionLevel: "read",
      scale: "compact",
    },
    contentObligations: [
      {
        id: "direct-answer",
        slotId: "primary",
        purpose: "Communicate the answer immediately.",
        shape: "narrative",
        priority: "primary",
        mediaQuery: "",
        itemCount: null,
      },
      {
        id: "system-proof",
        slotId: "system",
        purpose: "Provide the minimum evidence needed to trust the answer.",
        shape: "hierarchy",
        priority: "supporting",
        mediaQuery: "",
        itemCount: null,
      },
      {
        id: "extra-comparison",
        slotId: "comparison",
        purpose: "Offer optional comparative depth.",
        shape: "comparison",
        priority: "supporting",
        mediaQuery: "",
        itemCount: null,
      },
    ],
    contentBudget: {
      maxVisibleNodes: 8,
      maxItemsPerNode: 12,
      maxVisibleCopyCharacters: 4_000,
    },
    ...overrides,
  };
}

describe("UX decision architecture", () => {
  it("turns attention mode into a hard upper bound and defers overflow", () => {
    const result = repairUXDecisionBrief(brief());
    expect(result.contentBudget).toEqual({
      maxVisibleNodes: 2,
      maxItemsPerNode: 5,
      maxVisibleCopyCharacters: 700,
    });
    expect(
      result.contentObligations.filter(
        (obligation) => obligation.priority !== "deferred",
      ),
    ).toHaveLength(2);
    expect(result.contentObligations.at(-1)?.priority).toBe("deferred");
  });

  it("exposes content judgment to the composer without authoring answer prose", () => {
    const result = repairUXDecisionBrief(brief());
    const director = buildUXDirectorInstructions();
    const composer = buildUXDecisionCompositionInstructions(result);
    expect(director).toContain("what should be deferred or omitted");
    expect(director).toContain("not the final wording or factual answer");
    expect(composer).toContain("Render only the 2 visible obligations");
    expect(composer).toContain("Do not render deferred obligations");
  });

  it("prunes invisible content and preserves a valid reachable UI graph", () => {
    const decision = repairUXDecisionBrief(brief());
    const { experience, report } = applyUXDecisionPolicy(
      uiLanguageFixture,
      decision,
    );
    const contentNodes = experience.nodes.filter(
      (node) =>
        !["Page", "Stack", "Row", "Grid", "Rail", "Divider", "Spacer"].includes(
          node.type,
        ),
    );
    expect(contentNodes).toHaveLength(2);
    expect(contentNodes[0]?.slot).toBe("primary");
    expect(
      contentNodes.some(
        (node) => node.slot === "comparison" || node.slot === "actions",
      ),
    ).toBe(false);
    expect(report.prunedContentNodes).toBeGreaterThan(0);
  });

  it("streams one primary placeholder instead of one card per required slot", () => {
    const decision = repairUXDecisionBrief(brief());
    const skeleton = createRepresentationSkeleton(decision.representation);
    expect(
      skeleton.filter((node) => node.id.startsWith("pending-")),
    ).toHaveLength(1);
    expect(skeleton.at(-1)?.slot).toBe("primary");
  });

  it("preserves a required trusted media intent when the composer omits the image", () => {
    const decision = repairUXDecisionBrief(
      brief({
        attentionMode: "read",
        primarySubject: "Steve Jobs",
        representation: {
          ...uiLanguageFixtureRepresentation,
          interactionLevel: "read",
          scale: "compact",
          informationShapes: [
            ...uiLanguageFixtureRepresentation.informationShapes,
            "media-artifact",
          ],
          slots: [
            ...uiLanguageFixtureRepresentation.slots,
            {
              id: "portrait",
              role: "portrait",
              shape: "media-artifact",
              priority: "supporting",
              required: false,
            },
          ],
        },
        contentObligations: [
          {
            id: "identity",
            slotId: "primary",
            purpose: "Identify Steve Jobs succinctly.",
            shape: "narrative",
            priority: "primary",
            mediaQuery: "",
            itemCount: null,
          },
          {
            id: "portrait",
            slotId: "portrait",
            purpose: "Make the person visually recognizable.",
            shape: "media-artifact",
            priority: "supporting",
            mediaQuery: "Steve Jobs",
            itemCount: null,
          },
        ],
        contentBudget: {
          maxVisibleNodes: 3,
          maxItemsPerNode: 8,
          maxVisibleCopyCharacters: 1_400,
        },
      }),
    );
    const { experience } = applyUXDecisionPolicy(uiLanguageFixture, decision);
    expect(
      experience.nodes.find((node) => node.type === "Image"),
    ).toMatchObject({
      slot: "portrait",
      label: "Steve Jobs",
      title: "Steve Jobs",
    });
  });

  it("never budgets fewer content nodes than its visible obligation slots", () => {
    const decision = repairUXDecisionBrief(
      brief({
        attentionMode: "glance",
        primarySubject: "Steve Jobs",
        representation: {
          version: "1.0",
          mode: "open",
          blueprintIds: ["open-composition"],
          confidence: 0.96,
          userJob: "Identify a notable person quickly",
          informationShapes: ["narrative", "facts", "media-artifact"],
          interactionLevel: "read",
          scale: "compact",
          topology: "focal-split",
          noveltyBudget: 0.5,
          slots: [
            {
              id: "identity",
              role: "identity",
              shape: "narrative",
              priority: "primary",
              required: true,
            },
            {
              id: "facts",
              role: "defining-facts",
              shape: "facts",
              priority: "supporting",
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
        },
        contentObligations: [
          {
            id: "identity",
            slotId: "identity",
            purpose: "Identify Steve Jobs.",
            shape: "narrative",
            priority: "primary",
            mediaQuery: "",
            itemCount: null,
          },
          {
            id: "facts",
            slotId: "facts",
            purpose: "Give defining facts.",
            shape: "facts",
            priority: "supporting",
            mediaQuery: "",
            itemCount: null,
          },
          {
            id: "portrait",
            slotId: "portrait",
            purpose: "Make him recognizable.",
            shape: "media-artifact",
            priority: "supporting",
            mediaQuery: "Steve Jobs",
            itemCount: 18,
          },
        ],
        contentBudget: {
          maxVisibleNodes: 2,
          maxItemsPerNode: 3,
          maxVisibleCopyCharacters: 500,
        },
      }),
      "Who is Steve Jobs? Include one useful visual.",
    );
    expect(decision.contentBudget.maxVisibleNodes).toBe(3);
    expect(
      decision.contentObligations.find(
        (obligation) => obligation.id === "portrait",
      )?.itemCount,
    ).toBeNull();
  });

  it("promotes identity media for profiles unless the user explicitly declines it", () => {
    const profileRepresentation = {
      version: "1.0",
      mode: "blueprint",
      blueprintIds: ["profile-reference"],
      confidence: 0.92,
      userJob: "identify Steve Jobs",
      informationShapes: ["narrative", "facts", "media-artifact"],
      interactionLevel: "read",
      scale: "compact",
      topology: "focal-split",
      noveltyBudget: 0.2,
      slots: [
        {
          id: "identity",
          role: "identity",
          shape: "narrative",
          priority: "primary",
          required: true,
        },
        {
          id: "defining-facts",
          role: "defining-facts",
          shape: "facts",
          priority: "supporting",
          required: true,
        },
        {
          id: "portrait",
          role: "portrait",
          shape: "media-artifact",
          priority: "optional",
          required: false,
        },
      ],
    };
    const input = brief({
      userOutcome: "Understand who Steve Jobs was",
      primarySubject: "Steve Jobs",
      representation: profileRepresentation,
      contentObligations: [
        {
          id: "identity",
          slotId: "identity",
          purpose: "Identify Steve Jobs.",
          shape: "narrative",
          priority: "primary",
          mediaQuery: "",
          itemCount: null,
        },
        {
          id: "facts",
          slotId: "defining-facts",
          purpose: "Explain his defining work.",
          shape: "facts",
          priority: "supporting",
          mediaQuery: "",
          itemCount: null,
        },
        {
          id: "portrait",
          slotId: "portrait",
          purpose: "Make him recognizable.",
          shape: "media-artifact",
          priority: "deferred",
          mediaQuery: "",
          itemCount: null,
        },
      ],
    });

    const withPortrait = repairUXDecisionBrief(input, "Who is Steve Jobs?");
    expect(
      withPortrait.contentObligations.find(
        (obligation) => obligation.id === "portrait",
      ),
    ).toMatchObject({ priority: "supporting", mediaQuery: "Steve Jobs" });

    const withoutPortrait = repairUXDecisionBrief(
      input,
      "Who is Steve Jobs? Do not include an image.",
    );
    expect(
      withoutPortrait.contentObligations.find(
        (obligation) => obligation.id === "portrait",
      )?.priority,
    ).toBe("deferred");
  });

  it("defers a redundant featured block when a ranked collection is complete", () => {
    const representation = {
      version: "1.0",
      mode: "blueprint",
      blueprintIds: ["explore-recommend"],
      confidence: 0.9,
      userJob: "rank top 3 players",
      informationShapes: ["hierarchy", "record"],
      interactionLevel: "read",
      scale: "compound",
      topology: "responsive-grid",
      noveltyBudget: 0.3,
      slots: [
        {
          id: "collection",
          role: "collection",
          shape: "hierarchy",
          priority: "primary",
          required: true,
        },
        {
          id: "featured",
          role: "featured",
          shape: "record",
          priority: "supporting",
          required: true,
        },
        {
          id: "details",
          role: "details",
          shape: "record",
          priority: "supporting",
          required: false,
        },
      ],
    };
    const result = repairUXDecisionBrief(
      brief({
        userOutcome: "See a ranked top 3 list of players",
        attentionMode: "explore",
        representation,
        contentObligations: [
          {
            id: "ranking",
            slotId: "collection",
            purpose: "Show all three ranked players.",
            shape: "hierarchy",
            priority: "primary",
            mediaQuery: "",
            itemCount: 3,
          },
          {
            id: "featured",
            slotId: "featured",
            purpose: "Repeat the number one player.",
            shape: "record",
            priority: "supporting",
            mediaQuery: "",
            itemCount: null,
          },
          {
            id: "details",
            slotId: "details",
            purpose: "Repeat player context.",
            shape: "record",
            priority: "supporting",
            mediaQuery: "",
            itemCount: null,
          },
        ],
        contentBudget: {
          maxVisibleNodes: 4,
          maxItemsPerNode: 10,
          maxVisibleCopyCharacters: 2_200,
        },
      }),
    );
    expect(
      result.contentObligations.find(
        (obligation) => obligation.id === "featured",
      )?.priority,
    ).toBe("deferred");
    expect(
      result.representation.slots.find((slot) => slot.id === "featured"),
    ).toMatchObject({ priority: "optional", required: false });
    const repeatedItems = ["A", "B", "C"].map((label, index) => ({
      id: `player-${index}`,
      label,
      value: `${index + 1}`,
      detail: `${label} context`,
      progress: null,
    }));
    const authored = parseModelAuthoredUIExperience(
      {
        version: "4.0",
        responseId: "ranked-dedup",
        goal: "Rank three players",
        suggestions: [],
        screen: { title: "Top players", contextLabel: "Ranking" },
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
            children: ["ranking", "context"],
          },
          {
            id: "ranking",
            type: "Table",
            slot: "collection",
            importance: "primary",
            relationship: "standalone",
            mediaRole: "none",
            title: "Top three",
            text: "",
            label: "Rank",
            value: "",
            meta: "",
            items: repeatedItems,
          },
          {
            id: "context",
            type: "Table",
            slot: "details",
            importance: "supporting",
            relationship: "continuation",
            mediaRole: "none",
            title: "Player context",
            text: "",
            label: "Players",
            value: "",
            meta: "",
            items: repeatedItems.map((item) => ({
              ...item,
              id: `${item.id}-context`,
            })),
          },
        ],
      },
      result.representation,
      "Show me the top 3 players",
    );
    const applied = applyUXDecisionPolicy(authored, result).experience;
    expect(applied.nodes.filter((node) => node.type === "Table")).toHaveLength(
      1,
    );
  });

  it("repairs an open top-N route into a counted collection slot", () => {
    const result = repairUXDecisionBrief(
      brief({
        userOutcome: "Show the strongest players",
        attentionMode: "explore",
        representation: {
          version: "1.0",
          mode: "open",
          blueprintIds: ["open-composition"],
          confidence: 0.8,
          userJob: "Present the strongest players",
          informationShapes: ["facts"],
          interactionLevel: "read",
          scale: "compact",
          topology: "editorial-stack",
          noveltyBudget: 0.6,
          slots: [
            {
              id: "answer",
              role: "answer",
              shape: "facts",
              priority: "primary",
              required: true,
            },
          ],
        },
        contentObligations: [
          {
            id: "ranking",
            slotId: "answer",
            purpose: "Rank the players.",
            shape: "facts",
            priority: "primary",
            mediaQuery: "",
            itemCount: null,
          },
        ],
      }),
      "Who are the top 5 NBA players right now?",
    );

    expect(result.representation.slots[0]).toMatchObject({
      role: "collection",
    });
    expect(result.contentObligations[0]).toMatchObject({ itemCount: 5 });
  });

  it("reserves enough attention for a complete interactive loop", () => {
    const representation = {
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
          id: "result",
          role: "result",
          shape: "metrics",
          priority: "supporting",
          required: true,
        },
        {
          id: "inputs",
          role: "inputs",
          shape: "choice-input",
          priority: "primary",
          required: true,
        },
        {
          id: "assumptions",
          role: "assumptions",
          shape: "facts",
          priority: "optional",
          required: false,
        },
        {
          id: "explanation",
          role: "explanation",
          shape: "narrative",
          priority: "optional",
          required: false,
        },
        {
          id: "next-action",
          role: "next-action",
          shape: "narrative",
          priority: "optional",
          required: false,
        },
      ],
    };
    const result = repairUXDecisionBrief(
      brief({
        attentionMode: "glance",
        representation,
        contentObligations: [
          {
            id: "result",
            slotId: "result",
            purpose: "Show the estimate.",
            shape: "metrics",
            priority: "primary",
            mediaQuery: "",
            itemCount: null,
          },
          {
            id: "inputs",
            slotId: "inputs",
            purpose: "Collect the inputs needed to recalculate.",
            shape: "choice-input",
            priority: "supporting",
            mediaQuery: "",
            itemCount: null,
          },
          {
            id: "assumptions",
            slotId: "assumptions",
            purpose: "Explain the assumptions.",
            shape: "facts",
            priority: "supporting",
            mediaQuery: "",
            itemCount: null,
          },
          {
            id: "explanation",
            slotId: "explanation",
            purpose: "Explain the estimate.",
            shape: "narrative",
            priority: "supporting",
            mediaQuery: "",
            itemCount: null,
          },
        ],
        contentBudget: {
          maxVisibleNodes: 1,
          maxItemsPerNode: 4,
          maxVisibleCopyCharacters: 500,
        },
      }),
    );
    expect(result.attentionMode).toBe("work");
    expect(result.contentBudget.maxVisibleNodes).toBe(5);
    expect(
      result.representation.slots.find((slot) => slot.id === "result")
        ?.priority,
    ).toBe("primary");
    expect(
      result.contentObligations.find((obligation) => obligation.id === "result")
        ?.slotId,
    ).toBe("result");
    expect(
      result.contentObligations
        .filter((obligation) =>
          ["assumptions", "explanation"].includes(obligation.id),
        )
        .map((obligation) => obligation.priority),
    ).toEqual(["deferred", "deferred"]);
    const authored = parseModelAuthoredUIExperience(
      {
        version: "4.0",
        responseId: "interactive-loop",
        goal: "Estimate the fund",
        suggestions: [],
        screen: { title: "Emergency fund", contextLabel: "Estimator" },
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
            children: ["result", "expenses", "calculate"],
          },
          {
            id: "result",
            type: "Metric",
            slot: "result",
            importance: "primary",
            relationship: "standalone",
            mediaRole: "none",
            title: "Estimate",
            text: "Based on your inputs",
            label: "Target",
            value: "$12,000",
            meta: "4 months",
          },
          {
            id: "expenses",
            type: "Input",
            slot: "inputs",
            importance: "supporting",
            relationship: "continuation",
            mediaRole: "none",
            title: "",
            text: "Enter monthly expenses",
            label: "Monthly expenses",
            value: "",
            meta: "number",
          },
          {
            id: "calculate",
            type: "Button",
            slot: "next-action",
            importance: "supporting",
            relationship: "continuation",
            mediaRole: "none",
            title: "",
            text: "",
            label: "Calculate",
            value: "",
            meta: "",
            action: {
              type: "prompt",
              prompt: "Calculate using my current interface inputs.",
              targetId: "",
              value: "",
            },
          },
        ],
      },
      result.representation,
      "Estimate my emergency fund",
    );
    const applied = applyUXDecisionPolicy(authored, result).experience;
    expect(applied.nodes.map((node) => node.type)).toEqual(
      expect.arrayContaining(["Metric", "Input", "Button"]),
    );
  });

  it("keeps source-material transformations interactive when the source is not in the prompt", () => {
    const result = repairUXDecisionBrief(
      brief({
        representation: {
          version: "1.0",
          mode: "blueprint",
          blueprintIds: ["workflow-action"],
          confidence: 0.9,
          userJob: "turn notes into owned actions",
          informationShapes: ["tasks-progress", "facts"],
          interactionLevel: "read",
          scale: "compound",
          topology: "responsive-grid",
          noveltyBudget: 0.2,
          slots: [
            {
              id: "work-items",
              role: "work-items",
              shape: "tasks-progress",
              priority: "primary",
              required: true,
            },
            {
              id: "status",
              role: "status",
              shape: "facts",
              priority: "supporting",
              required: true,
            },
          ],
        },
        contentObligations: [
          {
            id: "work-items",
            slotId: "work-items",
            purpose: "Capture decisions and actions.",
            shape: "tasks-progress",
            priority: "primary",
            mediaQuery: "",
            itemCount: null,
          },
          {
            id: "status",
            slotId: "status",
            purpose: "Show whether notes are available.",
            shape: "facts",
            priority: "supporting",
            mediaQuery: "",
            itemCount: null,
          },
        ],
      }),
      "Turn these meeting notes into decisions, owners, and next actions",
    );

    expect(result.representation.interactionLevel).toBe("edit");
    expect(result.contentBudget.maxVisibleNodes).toBeGreaterThanOrEqual(3);

    const authored = parseModelAuthoredUIExperience(
      {
        version: "4.0",
        responseId: "missing-source",
        goal: "Create an action room",
        suggestions: [],
        screen: { title: "Action room", contextLabel: "Meeting notes" },
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
            children: ["waiting", "status"],
          },
          {
            id: "waiting",
            type: "Text",
            slot: "work-items",
            importance: "primary",
            relationship: "standalone",
            mediaRole: "none",
            title: "No action items yet",
            text: "Provide the notes to begin.",
            label: "",
            value: "",
            meta: "",
          },
          {
            id: "status",
            type: "FactList",
            slot: "status",
            importance: "supporting",
            relationship: "continuation",
            mediaRole: "none",
            title: "Status",
            text: "",
            label: "",
            value: "",
            meta: "",
            items: [
              {
                id: "source",
                label: "Source",
                value: "Waiting",
                detail: "No notes yet",
                progress: null,
              },
              {
                id: "actions",
                label: "Actions",
                value: "0",
                detail: "Not extracted",
                progress: null,
              },
            ],
          },
        ],
      },
      result.representation,
      "Turn these meeting notes into decisions, owners, and next actions",
    );
    expect(authored.nodes.some((node) => node.type === "Input")).toBe(false);
    const applied = applyUXDecisionPolicy(authored, result).experience;
    expect(applied.nodes.map((node) => node.type)).toEqual(
      expect.arrayContaining(["Input", "Button"]),
    );
  });

  it("turns an explicit item count into an enforceable content obligation", () => {
    expect(
      extractRequestedItemCount(
        "Explain compound interest to a curious 12-year-old",
      ),
    ).toBeNull();
    expect(
      extractRequestedItemCount("Explain this in three concise ideas"),
    ).toBe(3);
    expect(extractRequestedItemCount("Who are the top 10 players?")).toBe(10);

    const representation = {
      version: "1.0",
      mode: "blueprint",
      blueprintIds: ["explainer"],
      confidence: 0.9,
      userJob: "explain why leaves change color",
      informationShapes: ["narrative", "facts"],
      interactionLevel: "read",
      scale: "compact",
      topology: "editorial-stack",
      noveltyBudget: 0.2,
      slots: [
        {
          id: "thesis",
          role: "thesis",
          shape: "narrative",
          priority: "primary",
          required: true,
        },
        {
          id: "explanation",
          role: "explanation",
          shape: "facts",
          priority: "supporting",
          required: true,
        },
      ],
    };
    const decision = repairUXDecisionBrief(
      brief({
        userOutcome: "Understand the cause",
        attentionMode: "read",
        representation,
        contentObligations: [
          {
            id: "thesis",
            slotId: "thesis",
            purpose: "State the cause.",
            shape: "narrative",
            priority: "primary",
            mediaQuery: "",
            itemCount: null,
          },
          {
            id: "ideas",
            slotId: "explanation",
            purpose: "Explain the mechanism.",
            shape: "facts",
            priority: "supporting",
            mediaQuery: "",
            itemCount: null,
          },
        ],
        contentBudget: {
          maxVisibleNodes: 3,
          maxItemsPerNode: 8,
          maxVisibleCopyCharacters: 1_400,
        },
      }),
      "Explain why leaves change color in autumn in three concise ideas",
    );
    expect(
      decision.contentObligations.find(
        (obligation) => obligation.id === "ideas",
      )?.itemCount,
    ).toBe(3);

    const modelExperience = (
      items: Array<{
        id: string;
        label: string;
        value: string;
        detail: string;
        progress: null;
      }>,
    ) =>
      parseModelAuthoredUIExperience(
        {
          version: "4.0",
          responseId: "exact-cardinality",
          goal: "Explain autumn color",
          suggestions: [],
          screen: {
            title: "Why leaves change color",
            contextLabel: "Explainer",
          },
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
              children: ["thesis", "ideas"],
            },
            {
              id: "thesis",
              type: "Text",
              slot: "thesis",
              importance: "primary",
              relationship: "standalone",
              mediaRole: "none",
              title: "Autumn changes leaf pigments",
              text: "Shorter days trigger the transition.",
              label: "",
              value: "",
              meta: "",
            },
            {
              id: "ideas",
              type: "FactList",
              slot: "explanation",
              importance: "supporting",
              relationship: "continuation",
              mediaRole: "none",
              title: "Three mechanisms",
              text: "",
              label: "",
              value: "",
              meta: "",
              items,
            },
          ],
        },
        decision.representation,
        "Explain why leaves change color in autumn in three concise ideas",
      );
    const twoIdeas = [
      {
        id: "chlorophyll",
        label: "Chlorophyll fades",
        value: "",
        detail: "Green pigment breaks down.",
        progress: null,
      },
      {
        id: "hidden-colors",
        label: "Other pigments remain",
        value: "",
        detail: "Yellow and orange become visible.",
        progress: null,
      },
    ];
    expect(() =>
      applyUXDecisionPolicy(modelExperience(twoIdeas), decision),
    ).toThrow(/exactly 3 requested entries/);
    const threeIdeas = [
      ...twoIdeas,
      {
        id: "red-pigment",
        label: "Some leaves make red",
        value: "",
        detail: "Sugars help produce anthocyanins.",
        progress: null,
      },
    ];
    expect(
      applyUXDecisionPolicy(
        modelExperience(threeIdeas),
        decision,
      ).experience.nodes.find((node) => node.id === "ideas")?.items,
    ).toHaveLength(3);
  });

  it("attaches a counted comparison to alternatives rather than its selection control", () => {
    const representation = {
      version: "1.0",
      mode: "hybrid",
      blueprintIds: ["plan-schedule", "compare-decide"],
      confidence: 0.9,
      userJob: "plan an offsite and compare two shortlisted venues",
      informationShapes: ["chronology", "record", "comparison", "choice-input"],
      interactionLevel: "select",
      scale: "compound",
      topology: "responsive-grid",
      noveltyBudget: 0.35,
      slots: [
        {
          id: "plan",
          role: "plan",
          shape: "chronology",
          priority: "primary",
          required: true,
        },
        {
          id: "recommendation",
          role: "recommendation",
          shape: "record",
          priority: "supporting",
          required: true,
        },
        {
          id: "alternatives",
          role: "alternatives",
          shape: "comparison",
          priority: "supporting",
          required: true,
        },
        {
          id: "criteria",
          role: "criteria",
          shape: "comparison",
          priority: "optional",
          required: false,
        },
        {
          id: "schedule",
          role: "schedule",
          shape: "chronology",
          priority: "optional",
          required: false,
        },
        {
          id: "selection",
          role: "selection",
          shape: "choice-input",
          priority: "optional",
          required: false,
        },
      ],
    };
    const decision = repairUXDecisionBrief(
      brief({
        userOutcome:
          "Choose between two shortlisted venues and plan the offsite",
        attentionMode: "explore",
        representation,
        contentObligations: [
          {
            id: "plan",
            slotId: "plan",
            purpose: "Lay out the offsite plan.",
            shape: "chronology",
            priority: "primary",
            mediaQuery: "",
            itemCount: null,
          },
          {
            id: "alternatives",
            slotId: "alternatives",
            purpose: "Compare the shortlisted venues.",
            shape: "comparison",
            priority: "supporting",
            mediaQuery: "",
            itemCount: null,
          },
          {
            id: "criteria",
            slotId: "criteria",
            purpose: "Show the decision criteria.",
            shape: "comparison",
            priority: "supporting",
            mediaQuery: "",
            itemCount: null,
          },
          {
            id: "schedule",
            slotId: "schedule",
            purpose: "Include preparation in the schedule.",
            shape: "chronology",
            priority: "supporting",
            mediaQuery: "",
            itemCount: null,
          },
          {
            id: "selection",
            slotId: "selection",
            purpose: "Let the user select a venue.",
            shape: "choice-input",
            priority: "supporting",
            mediaQuery: "",
            itemCount: 2,
          },
        ],
        contentBudget: {
          maxVisibleNodes: 5,
          maxItemsPerNode: 8,
          maxVisibleCopyCharacters: 2_000,
        },
      }),
      "Plan our offsite and compare the two shortlisted venues",
    );

    expect(
      decision.contentObligations.find(
        (obligation) => obligation.id === "alternatives",
      )?.itemCount,
    ).toBe(2);
    expect(
      decision.contentObligations.find(
        (obligation) => obligation.id === "selection",
      )?.itemCount,
    ).toBeNull();
    expect(
      decision.contentObligations.find(
        (obligation) => obligation.id === "criteria",
      )?.slotId,
    ).toBe("alternatives");
    expect(
      decision.contentObligations.find(
        (obligation) => obligation.id === "schedule",
      )?.slotId,
    ).toBe("plan");
    expect(
      decision.representation.slots.find((slot) => slot.id === "criteria")
        ?.required,
    ).toBe(false);
    expect(
      decision.representation.slots.find((slot) => slot.id === "schedule")
        ?.required,
    ).toBe(false);
    expect(decision.representation.interactionLevel).toBe("read");
    expect(decision.contentBudget.maxVisibleNodes).toBeLessThanOrEqual(3);
    expect(
      decision.contentObligations.find(
        (obligation) => obligation.id === "selection",
      )?.priority,
    ).toBe("deferred");
  });
});
