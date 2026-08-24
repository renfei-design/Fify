import { describe, expect, it } from "vitest";
import {
  compileGroundedInformationUI,
  createDefaultGroundedCompositionPlan,
  formatInformationEnvelopeFallback,
  groundedComponentTypes,
  informationEnvelopeV1Schema,
  parseGroundedCompositionPlan,
  type InformationEnvelopeV1,
} from "./grounded.js";

const envelope: InformationEnvelopeV1 = {
  version: "1.0",
  originalRequest: "Compare the two rollout options by cost and risk.",
  groundedAnswer: "Option Alpha costs less. Option Beta reduces launch risk.",
  locale: "en-US",
  sections: [
    {
      id: "options",
      title: "Rollout options",
      body: "The options trade lower cost for lower launch risk.",
      sourceIds: ["brief"],
      items: [
        { id: "alpha", label: "Alpha", value: "$10", detail: "Lower cost", sourceIds: ["brief"] },
        { id: "beta", label: "Beta", value: "$20", detail: "Lower risk", sourceIds: ["brief"] },
      ],
    },
  ],
  sources: [{ id: "brief", title: "Approved rollout brief", url: "https://example.com/rollout" }],
  suggestedRefinements: ["Focus on the risks"],
};

describe("InformationEnvelopeV1", () => {
  it("compiles exact grounded copy into a portable UIExperience", () => {
    const plan = createDefaultGroundedCompositionPlan(envelope);
    const result = compileGroundedInformationUI(envelope, plan, "run-1");
    const section = result.experience.nodes.find((node) => node.id === "section-options");

    expect(plan.placements[0]?.component).toBe("Comparison");
    expect(section?.title).toBe("Rollout options");
    expect(section?.text).toBe("The options trade lower cost for lower launch risk.");
    expect(section?.items).toEqual([
      { id: "alpha", label: "Alpha", value: "$10", detail: "Lower cost", tone: "neutral", progress: null },
      { id: "beta", label: "Beta", value: "$20", detail: "Lower risk", tone: "neutral", progress: null },
    ]);
    expect(result.experience.suggestions).toEqual(["Focus on the risks"]);
  });

  it("rejects duplicate IDs, unresolved sources, unsafe URLs, and unknown fields", () => {
    const duplicate = structuredClone(envelope);
    duplicate.sections[0]!.items[1]!.id = "alpha";
    expect(informationEnvelopeV1Schema.safeParse(duplicate).error?.issues.map((issue) => issue.message).join(" ")).toContain("Duplicate ID");

    const unresolved = structuredClone(envelope);
    unresolved.sections[0]!.items[0]!.sourceIds = ["missing"];
    expect(informationEnvelopeV1Schema.safeParse(unresolved).error?.issues.map((issue) => issue.message).join(" ")).toContain("Unknown source");

    const unsafe = structuredClone(envelope);
    unsafe.sources[0]!.url = "http://127.0.0.1/private";
    expect(informationEnvelopeV1Schema.safeParse(unsafe).error?.issues.map((issue) => issue.message).join(" ")).toContain("public HTTPS URL");

    const unknown = { ...structuredClone(envelope), surprise: true };
    expect(informationEnvelopeV1Schema.safeParse(unknown).error?.issues.map((issue) => issue.message).join(" ")).toContain("Unrecognized key");
  });

  it("binds only trusted, sourced media into the compiled experience", () => {
    const withMedia = structuredClone(envelope);
    withMedia.media = [{
      id: "subject-portrait",
      url: "https://upload.wikimedia.org/wikipedia/commons/example.jpg",
      alt: "Grounded subject portrait",
      caption: "Openly licensed portrait",
      role: "identity",
      sourceId: "brief",
    }];
    const result = compileGroundedInformationUI(
      withMedia,
      createDefaultGroundedCompositionPlan(withMedia),
      "run-media",
    );
    expect(result.composition.topology).toBe("focal-split");
    expect(result.experience.representation.blueprintIds).toEqual(["profile-reference"]);
    expect(result.experience.nodes.find((node) => node.id === "media-subject-portrait")).toMatchObject({
      type: "Image",
      value: withMedia.media[0]!.url,
      title: withMedia.media[0]!.alt,
      text: withMedia.media[0]!.caption,
      mediaRole: "identity",
      meta: "brief",
    });

    const untrusted = structuredClone(withMedia);
    untrusted.media![0]!.url = "https://images.example.com/portrait.jpg";
    expect(informationEnvelopeV1Schema.safeParse(untrusted).error?.issues.map((issue) => issue.message).join(" ")).toContain("approved public HTTPS image host");

    const unresolved = structuredClone(withMedia);
    unresolved.media![0]!.sourceId = "missing";
    expect(informationEnvelopeV1Schema.safeParse(unresolved).error?.issues.map((issue) => issue.message).join(" ")).toContain("Unknown source");

    const duplicate = structuredClone(withMedia);
    duplicate.media![0]!.id = "alpha";
    expect(informationEnvelopeV1Schema.safeParse(duplicate).error?.issues.map((issue) => issue.message).join(" ")).toContain("Duplicate ID");
  });

  it("rejects invented, missing, or repeated semantic references", () => {
    expect(() => parseGroundedCompositionPlan(envelope, {
      version: "1.0",
      topology: "editorial-stack",
      placements: [{ sectionId: "options", component: "Comparison", itemIds: ["alpha", "invented"], importance: "primary" }],
    })).toThrow(/every item/);
  });

  it("compiles grounded selection and input surfaces with resumable semantic state", () => {
    const choicePlan = parseGroundedCompositionPlan(envelope, {
      version: "1.0",
      topology: "responsive-grid",
      placements: [{ sectionId: "options", component: "ChoiceGroup", itemIds: ["alpha", "beta"], importance: "primary" }],
    });
    const choice = compileGroundedInformationUI(envelope, choicePlan, "run-choice");
    expect(choice.experience.representation.interactionLevel).toBe("select");
    expect(choice.experience.nodes.find((node) => node.id === "section-options")).toMatchObject({
      type: "ChoiceGroup",
      action: { type: "select", targetId: "options" },
    });

    const inputEnvelope = structuredClone(envelope);
    inputEnvelope.originalRequest = "Make this an editable input field.";
    inputEnvelope.sections[0]!.items = [{ id: "budget", label: "Budget", value: "Enter an amount", detail: "Use the approved budget ceiling.", sourceIds: ["brief"] }];
    inputEnvelope.continuationState = { priorRunId: "prior", checkedIds: [], selectedIds: [], inputs: { options: "15" } };
    const inputPlan = createDefaultGroundedCompositionPlan(inputEnvelope);
    const input = compileGroundedInformationUI(inputEnvelope, inputPlan, "run-input");
    expect(inputPlan.placements[0]?.component).toBe("Input");
    expect(input.experience.representation.interactionLevel).toBe("edit");
    expect(input.experience.nodes.find((node) => node.id === "section-options")).toMatchObject({
      type: "Input",
      label: "Budget",
      value: "Enter an amount",
    });

    const invalidContinuation = structuredClone(inputEnvelope);
    invalidContinuation.continuationState!.inputs = { missing: "15" };
    expect(informationEnvelopeV1Schema.safeParse(invalidContinuation).error?.issues.map((issue) => issue.message).join(" ")).toContain("unknown input");
  });

  it("keeps the authoritative plain answer available with sources", () => {
    expect(formatInformationEnvelopeFallback(envelope)).toContain(envelope.groundedAnswer);
    expect(formatInformationEnvelopeFallback(envelope)).toContain("https://example.com/rollout");
  });

  it("offers the broader semantic catalog while keeping data-shaped surfaces grounded", () => {
    expect(groundedComponentTypes).toEqual(expect.arrayContaining([
      "Hero", "Card", "ColorPalette", "Badge", "Metric", "Chart", "Donut", "Progress",
      "Quote", "MapPanel", "Calendar", "CodeBlock", "Visual",
    ]));

    const chartEnvelope = structuredClone(envelope);
    chartEnvelope.originalRequest = "Show the approved readiness scores as a chart.";
    chartEnvelope.sections[0]!.items = [
      { id: "alpha", label: "Alpha", value: "41", detail: "Initial readiness", sourceIds: ["brief"] },
      { id: "beta", label: "Beta", value: "86", detail: "Validated readiness", sourceIds: ["brief"] },
    ];
    const chartPlan = createDefaultGroundedCompositionPlan(chartEnvelope);
    expect(chartPlan.placements[0]?.component).toBe("Chart");
    const chart = compileGroundedInformationUI(chartEnvelope, chartPlan, "run-chart");
    expect(chart.experience.nodes.find((node) => node.id === "section-options")?.items).toEqual([
      { id: "alpha", label: "Alpha", value: "41", detail: "Initial readiness", tone: "neutral", progress: 41 },
      { id: "beta", label: "Beta", value: "86", detail: "Validated readiness", tone: "neutral", progress: 86 },
    ]);

    expect(() => parseGroundedCompositionPlan(envelope, {
      version: "1.0",
      topology: "responsive-grid",
      placements: [{ sectionId: "options", component: "Chart", itemIds: ["alpha", "beta"], importance: "primary" }],
    })).toThrow(/numeric grounded item values/);
  });
});
