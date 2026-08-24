import { describe, expect, it } from "vitest";
import {
  buildBlueprintCompositionInstructions,
  informationShapeIds,
  layoutTopologyIds,
  parseRepresentationPlan,
  repairRepresentationPlan,
  shouldPreferOpenComposition,
  representationPlanSchema,
  responseBlueprintIds,
  responseBlueprintRegistry,
} from "./representation.js";
import { uiLanguageEvalCases } from "./language.js";

const direct = {
  version: "1.0",
  mode: "blueprint",
  blueprintIds: ["direct-answer"],
  confidence: 0.92,
  userJob: "Understand a focused answer",
  informationShapes: ["narrative"],
  interactionLevel: "read",
  scale: "atomic",
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
} as const;

describe("representation architecture", () => {
  it("defines twelve canonical blueprints plus open composition", () => {
    expect(responseBlueprintIds).toHaveLength(13);
    expect(responseBlueprintIds.at(-1)).toBe("open-composition");
    expect(Object.keys(responseBlueprintRegistry).sort()).toEqual(
      [...responseBlueprintIds].sort(),
    );
    expect(informationShapeIds).toHaveLength(13);
    expect(layoutTopologyIds).toHaveLength(8);
    expect(responseBlueprintRegistry.explainer.allowedShapes).toContain(
      "comparison",
    );
    expect(responseBlueprintRegistry.briefing.allowedShapes).toContain(
      "sequence",
    );
    expect(responseBlueprintRegistry["workflow-action"].allowedShapes).toContain(
      "sequence",
    );
  });

  it("validates strict, hybrid, and open routing modes", () => {
    expect(parseRepresentationPlan(direct).mode).toBe("blueprint");
    const hybrid = {
      ...direct,
      mode: "hybrid",
      blueprintIds: ["explainer", "procedure"],
      confidence: 0.71,
      informationShapes: ["narrative", "sequence"],
      scale: "compound",
      noveltyBudget: 0.45,
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
          shape: "narrative",
          priority: "supporting",
          required: true,
        },
        {
          id: "goal",
          role: "goal",
          shape: "narrative",
          priority: "supporting",
          required: true,
        },
        {
          id: "procedure",
          role: "procedure",
          shape: "sequence",
          priority: "supporting",
          required: true,
        },
      ],
    } as const;
    expect(parseRepresentationPlan(hybrid).blueprintIds).toHaveLength(2);
    const open = {
      ...direct,
      mode: "open",
      blueprintIds: ["open-composition"],
      confidence: 0.43,
      topology: "open-canvas",
      noveltyBudget: 0.9,
      slots: [
        {
          id: "primary",
          role: "primary",
          shape: "narrative",
          priority: "primary",
          required: true,
        },
      ],
    } as const;
    expect(parseRepresentationPlan(open).mode).toBe("open");
  });

  it("rejects weak route-to-blueprint compatibility", () => {
    expect(() =>
      representationPlanSchema.parse({
        ...direct,
        mode: "open",
        blueprintIds: ["direct-answer"],
        noveltyBudget: 0.9,
      }),
    ).toThrow(/open-composition/);
    expect(() =>
      parseRepresentationPlan({ ...direct, topology: "spatial-map" }),
    ).toThrow(/not supported/);
    expect(() =>
      parseRepresentationPlan({
        ...direct,
        informationShapes: ["tasks-progress"],
        slots: [{ ...direct.slots[0], shape: "tasks-progress" }],
      }),
    ).toThrow(/not supported/);
    expect(() =>
      parseRepresentationPlan({
        ...direct,
        slots: [{ ...direct.slots[0], role: "context" }],
      }),
    ).toThrow(/requires the 'answer' slot/);
  });

  it("repairs missing required roles and a non-required primary slot", () => {
    const repaired = repairRepresentationPlan({
      ...direct,
      blueprintIds: ["compare-decide"],
      informationShapes: ["narrative"],
      scale: "compact",
      topology: "focal-split",
      slots: [
        {
          id: "recommendation",
          role: "recommendation",
          shape: "narrative",
          priority: "primary",
          required: false,
        },
      ],
    });
    expect(
      repaired.slots.find((slot) => slot.role === "recommendation"),
    ).toMatchObject({ priority: "primary", required: true });
    expect(
      repaired.slots.find((slot) => slot.role === "alternatives"),
    ).toMatchObject({ shape: "comparison", required: true });
    expect(repaired.informationShapes).toContain("comparison");
  });

  it("normalizes incompatible shapes, slot shapes, topology, and duplicate IDs", () => {
    const repaired = repairRepresentationPlan({
      ...direct,
      blueprintIds: ["compare-decide"],
      informationShapes: ["sequence"],
      topology: "timeline-spine",
      slots: [
        {
          id: "answer",
          role: "recommendation",
          shape: "sequence",
          priority: "primary",
          required: true,
        },
        {
          id: "answer",
          role: "alternatives",
          shape: "sequence",
          priority: "supporting",
          required: true,
        },
      ],
    });
    expect(repaired.informationShapes).not.toContain("sequence");
    expect(
      repaired.slots.every((slot) =>
        responseBlueprintRegistry["compare-decide"].allowedShapes.includes(
          slot.shape,
        ),
      ),
    ).toBe(true);
    expect(new Set(repaired.slots.map((slot) => slot.id)).size).toBe(
      repaired.slots.length,
    );
    expect(responseBlueprintRegistry["compare-decide"].topologies).toContain(
      repaired.topology,
    );
  });

  it("canonicalizes inconsistent routing modes instead of rejecting recoverable plans", () => {
    const open = repairRepresentationPlan({
      ...direct,
      mode: "open",
      blueprintIds: ["direct-answer"],
      noveltyBudget: 0.1,
    });
    expect(open).toMatchObject({
      mode: "open",
      blueprintIds: ["open-composition"],
      noveltyBudget: 0.5,
    });
    const hybrid = repairRepresentationPlan({
      ...direct,
      mode: "blueprint",
      blueprintIds: ["explainer", "procedure"],
    });
    expect(hybrid.mode).toBe("hybrid");
  });

  it("uses a deterministic 60% open-first route matrix without weakening structured jobs", () => {
    const openFirst = [
      ["direct-answer", "Explain this idea simply"],
      ["profile-reference", "Who is Steve Jobs?"],
      ["explainer", "Why does compound interest accelerate?"],
      ["explore-recommend", "Recommend books about typography"],
      ["briefing", "Summarize the product launch"],
      ["analysis-evidence", "What does this evidence suggest?"],
    ] as const;
    const constrained = [
      ["procedure", "Show me the steps"],
      ["compare-decide", "Choose between these options"],
      ["plan-schedule", "Build a calendar"],
      ["interactive-tool", "Build an interactive calculator"],
    ] as const;
    const decisions = [...openFirst, ...constrained].map(
      ([blueprint, prompt]) =>
        shouldPreferOpenComposition(
          {
            ...direct,
            blueprintIds: [blueprint],
          } as unknown as Parameters<typeof shouldPreferOpenComposition>[0],
          prompt,
        ),
    );
    expect(decisions.filter(Boolean)).toHaveLength(6);
    expect(decisions.filter(Boolean).length / decisions.length).toBe(0.6);
    expect(
      repairRepresentationPlan(direct, "Explain this idea simply").mode,
    ).toBe("open");
    expect(
      repairRepresentationPlan(direct, "Give the answer as a table").mode,
    ).toBe("blueprint");
  });

  it("does not let model-authored optional roles over-constrain composition", () => {
    const repaired = repairRepresentationPlan({
      ...direct,
      blueprintIds: ["briefing"],
      informationShapes: ["narrative", "facts", "tasks-progress"],
      scale: "compact",
      slots: [
        {
          id: "headline",
          role: "headline",
          shape: "narrative",
          priority: "primary",
          required: true,
        },
        {
          id: "findings",
          role: "findings",
          shape: "facts",
          priority: "supporting",
          required: true,
        },
        {
          id: "action-items",
          role: "actions",
          shape: "tasks-progress",
          priority: "supporting",
          required: true,
        },
      ],
    });
    expect(
      repaired.slots.find((slot) => slot.role === "actions")?.required,
    ).toBe(false);
    expect(
      repaired.slots.filter((slot) => slot.required).map((slot) => slot.role),
    ).toEqual(["headline", "findings"]);
  });

  it("preserves a valid model-authored primary job in a hybrid route", () => {
    const repaired = repairRepresentationPlan({
      ...direct,
      mode: "hybrid",
      blueprintIds: ["plan-schedule", "compare-decide"],
      informationShapes: ["chronology", "narrative", "comparison"],
      scale: "compound",
      topology: "responsive-grid",
      slots: [
        {
          id: "plan",
          role: "plan",
          shape: "chronology",
          priority: "supporting",
          required: true,
        },
        {
          id: "recommendation",
          role: "recommendation",
          shape: "comparison",
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
    expect(
      repaired.slots.find((slot) => slot.priority === "primary")?.role,
    ).toBe("recommendation");
    expect(
      repaired.slots.find((slot) => slot.role === "recommendation")?.shape,
    ).toBe("narrative");
    expect(
      repaired.slots.find((slot) => slot.role === "alternatives")?.shape,
    ).toBe("comparison");
  });

  it("produces authoritative composer constraints from the plan", () => {
    const instructions = buildBlueprintCompositionInstructions(
      parseRepresentationPlan(direct),
    );
    expect(instructions).toContain("AUTHORITATIVE REPRESENTATION PLAN");
    expect(instructions).toContain("Every content node must set slot");
    expect(instructions).toContain("editorial-stack");
  });

  it("keeps a release matrix for every canonical, hybrid, and open route", () => {
    const covered = new Set(
      uiLanguageEvalCases.flatMap((item) => [...item.blueprints]),
    );
    for (const id of responseBlueprintIds) expect(covered.has(id)).toBe(true);
    expect(new Set(uiLanguageEvalCases.map((item) => item.mode))).toEqual(
      new Set(["blueprint", "hybrid", "open"]),
    );
    expect(new Set(uiLanguageEvalCases.map((item) => item.prompt)).size).toBe(
      uiLanguageEvalCases.length,
    );
  });
});
