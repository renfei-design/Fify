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
import { maxRepresentationSlots } from "./representation.js";

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
        {
          id: "alpha",
          label: "Alpha",
          value: "$10",
          detail: "Lower cost",
          sourceIds: ["brief"],
        },
        {
          id: "beta",
          label: "Beta",
          value: "$20",
          detail: "Lower risk",
          sourceIds: ["brief"],
        },
      ],
    },
  ],
  sources: [
    {
      id: "brief",
      title: "Approved rollout brief",
      url: "https://example.com/rollout",
    },
  ],
  suggestedRefinements: ["Focus on the risks"],
};

describe("InformationEnvelopeV1", () => {
  it("compiles the legal maximum of eight sections plus four media slots", () => {
    const maximum = structuredClone(envelope);
    maximum.originalRequest =
      "Compare four products across every grounded criterion.";
    maximum.sections = Array.from({ length: 8 }, (_, sectionIndex) => ({
      id: `criterion-${sectionIndex + 1}`,
      title: `Criterion ${sectionIndex + 1}`,
      body: "A grounded shared criterion.",
      sourceIds: ["brief"],
      items: ["Alpha", "Beta", "Gamma", "Delta"].map(
        (label, itemIndex) => ({
          id: `criterion-${sectionIndex + 1}-option-${itemIndex + 1}`,
          label,
          value: `Value ${itemIndex + 1}`,
          detail: "Grounded comparison detail.",
          sourceIds: ["brief"],
        }),
      ),
    }));
    maximum.media = Array.from({ length: 4 }, (_, index) => ({
      id: `product-media-${index + 1}`,
      url: `https://www.apple.com/images/product-${index + 1}.jpg`,
      alt: `Product ${index + 1}`,
      caption: `Official product ${index + 1}`,
      role: "illustration" as const,
      subject: ["Alpha", "Beta", "Gamma", "Delta"][index]!,
      sourceId: "brief",
    }));

    const result = compileGroundedInformationUI(
      maximum,
      createDefaultGroundedCompositionPlan(maximum),
      "run-maximum-slots",
    );

    expect(result.experience.representation.slots).toHaveLength(
      maxRepresentationSlots,
    );
    expect(result.experience.nodes.filter((node) => node.type === "Image"))
      .toHaveLength(4);
    expect(
      result.experience.nodes.filter((node) => node.type === "Comparison"),
    ).toHaveLength(8);
  });

  it("accepts supported official OPPO and Sony product image hosts", () => {
    for (const [id, url] of [
      ["oppo-product", "https://www.oppo.com/images/product.jpg"],
      ["sony-product", "https://www.sony.com/images/product.jpg"],
    ] as const) {
      const candidate = structuredClone(envelope);
      candidate.media = [
        {
          id,
          url,
          alt: id,
          caption: "Official product image",
          role: "illustration",
          sourceId: "brief",
        },
      ];
      expect(informationEnvelopeV1Schema.safeParse(candidate).success).toBe(
        true,
      );
    }
  });

  it("accepts an optional canonical profile subject without treating it as factual copy", () => {
    const profile = informationEnvelopeV1Schema.parse({
      ...structuredClone(envelope),
      profileSubject: "Steve Jobs",
    });
    expect(profile.profileSubject).toBe("Steve Jobs");
    expect(formatInformationEnvelopeFallback(profile)).not.toContain(
      "profileSubject",
    );
  });

  it("compiles exact grounded copy into a portable UIExperience", () => {
    const plan = createDefaultGroundedCompositionPlan(envelope);
    const result = compileGroundedInformationUI(envelope, plan, "run-1");
    const section = result.experience.nodes.find(
      (node) => node.id === "section-options",
    );

    expect(plan.placements[0]?.component).toBe("Comparison");
    expect(result.experience.representation.blueprintIds).toEqual([
      "compare-decide",
    ]);
    expect(result.experience.representation.slots[0]?.role).toBe("criteria");
    expect(result.experience.screen.contextLabel).toBe("Comparison");
    expect(section?.title).toBe("Rollout options");
    expect(section?.text).toBe(
      "The options trade lower cost for lower launch risk.",
    );
    expect(section?.items).toEqual([
      {
        id: "alpha",
        label: "Alpha",
        value: "$10",
        detail: "Lower cost",
        tone: "neutral",
        progress: null,
      },
      {
        id: "beta",
        label: "Beta",
        value: "$20",
        detail: "Lower risk",
        tone: "neutral",
        progress: null,
      },
    ]);
    expect(result.experience.suggestions).toEqual(["Focus on the risks"]);
  });

  it("does not mistake assumptions and verdicts for shared comparison criteria", () => {
    const comparison = structuredClone(envelope);
    comparison.originalRequest =
      "Compare Vivo Encore Free, Sony LindBuds, and Apple Airpod pro";
    const options = ["OPPO Enco Free4", "Sony LinkBuds Fit", "AirPods Pro 3"];
    comparison.sections = [
      {
        id: "model-assumptions",
        title: "Model assumptions",
        body: "The request is normalized to canonical current product names.",
        sourceIds: ["brief"],
        items: options.map((value, index) => ({
          id: `assumption-${index + 1}`,
          label: [
            "\u201cVivo Encore Free\u201d",
            "\u201cSony LindBuds\u201d",
            "\u201cApple Airpod pro\u201d",
          ][index]!,
          value,
          detail: "Canonical product used for the grounded comparison.",
          sourceIds: ["brief"],
        })),
      },
      {
        id: "quick-verdict",
        title: "Quick verdict",
        body: "Choose by ecosystem and fit priority.",
        sourceIds: ["brief"],
        items: options.map((value, index) => ({
          id: `verdict-${index + 1}`,
          label: ["Best value", "Best secure fit", "Best for iPhone"][index]!,
          value,
          detail: "Grounded recommendation rationale.",
          sourceIds: ["brief"],
        })),
      },
      {
        id: "key-comparison",
        title: "Key comparison",
        body: "Manufacturer specifications use different test conditions.",
        sourceIds: ["brief"],
        items: options.map((label, index) => ({
          id: `spec-${index + 1}`,
          label,
          value: ["6 h ANC", "5.5 h ANC", "8 h ANC"][index]!,
          detail: "Grounded specification summary.",
          sourceIds: ["brief"],
        })),
      },
      {
        id: "buying-guidance",
        title: "Which one should you buy?",
        body: "Start with your phone, then choose the trade-off.",
        sourceIds: ["brief"],
        items: options.map((value, index) => ({
          id: `buy-${index + 1}`,
          label: ["Android value", "Cross-platform fit", "iPhone"][index]!,
          value,
          detail: "Grounded buying guidance.",
          sourceIds: ["brief"],
        })),
      },
    ];

    const plan = createDefaultGroundedCompositionPlan(comparison);
    const result = compileGroundedInformationUI(
      comparison,
      plan,
      "run-misspelled-products",
    );

    expect(plan.placements.map((placement) => placement.component)).toEqual([
      "FactList",
      "FactList",
      "Comparison",
      "FactList",
    ]);
    expect(result.experience.representation.blueprintIds).toEqual([
      "compare-decide",
    ]);
    expect(
      result.experience.representation.slots.map((slot) => slot.role),
    ).toEqual(["context", "recommendation", "criteria", "evidence"]);
  });

  it("keeps grounded semantic IDs separate from internal representation slots", () => {
    const underscored = structuredClone(envelope);
    underscored.sections = [
      {
        ...underscored.sections[0]!,
        id: "sec_comparison",
        items: underscored.sections[0]!.items.map((item, index) => ({
          ...item,
          id: `item_p${index + 6}`,
        })),
      },
      {
        id: "sec_offer_definition",
        title: "What counts as the offer",
        body: "Separate an intent letter from a written offer.",
        sourceIds: ["brief"],
        items: [
          {
            id: "item_written",
            label: "Written offer lag",
            value: "Additional time",
            detail: "Approval can add time after the first positive signal.",
            sourceIds: ["brief"],
          },
        ],
      },
    ];

    const result = compileGroundedInformationUI(
      underscored,
      createDefaultGroundedCompositionPlan(underscored),
      "run-underscored-ids",
    );

    expect(
      result.experience.representation.slots.map((slot) => slot.id),
    ).toEqual(["section-1", "section-2"]);
    expect(
      result.experience.nodes
        .filter((node) => node.id.startsWith("section-"))
        .map((node) => node.slot),
    ).toEqual(["section-1", "section-2"]);
  });

  it("routes an executive briefing through the Fify briefing blueprint", () => {
    const briefing: InformationEnvelopeV1 = {
      version: "1.0",
      originalRequest:
        "Create an executive briefing for leadership from these operating results.",
      groundedAnswer:
        "Growth is holding, but enterprise delivery is now the constraint.",
      locale: "en-US",
      sections: [
        {
          id: "briefing-summary",
          title:
            "Growth is holding, but enterprise delivery is now the constraint",
          body: "Pipeline and retention remain healthy while delivery capacity delays revenue recognition.",
          items: [],
          sourceIds: ["brief"],
        },
        {
          id: "executive-signals",
          title: "Executive signals",
          body: "The current operating snapshot.",
          items: [
            {
              id: "revenue-outlook",
              label: "Revenue outlook",
              value: "On plan",
              detail: "Demand remains stable.",
              sourceIds: ["brief"],
            },
            {
              id: "delivery-backlog",
              label: "Enterprise backlog",
              value: "+18%",
              detail: "Implementation starts are slipping.",
              sourceIds: ["brief"],
            },
          ],
          sourceIds: ["brief"],
        },
        {
          id: "decision-required",
          title: "Approve a 90-day capacity plan",
          body: "Shift budget toward qualified implementation partners.",
          items: [
            {
              id: "recommendation",
              label: "Recommendation",
              value: "Approve",
              detail: "Begin the capacity plan this quarter.",
              sourceIds: ["brief"],
            },
            {
              id: "decision-owner",
              label: "Accountable owner",
              value: "COO",
              detail: "Own delivery and staffing tradeoffs.",
              sourceIds: ["brief"],
            },
          ],
          sourceIds: ["brief"],
        },
        {
          id: "next-actions",
          title: "Next actions",
          body: "Actions required after approval.",
          items: [
            {
              id: "confirm-capacity",
              label: "Confirm partner capacity",
              value: "Wednesday",
              detail: "Operations owns the confirmation.",
              sourceIds: ["brief"],
            },
            {
              id: "assign-sponsors",
              label: "Assign executive sponsors",
              value: "Thursday",
              detail: "Revenue owns the assignments.",
              sourceIds: ["brief"],
            },
          ],
          sourceIds: ["brief"],
        },
      ],
      sources: [
        {
          id: "brief",
          title: "Operating review",
          url: "https://example.com/operating-review",
        },
      ],
      suggestedRefinements: ["Show only the decision and risks"],
    };

    const plan = createDefaultGroundedCompositionPlan(briefing);
    const result = compileGroundedInformationUI(
      briefing,
      plan,
      "run-executive-briefing",
    );

    expect(plan.topology).toBe("responsive-grid");
    expect(plan.placements.map((placement) => placement.component)).toEqual([
      "Hero",
      "FactList",
      "FactList",
      "Steps",
    ]);
    expect(result.experience.representation).toMatchObject({
      mode: "blueprint",
      blueprintIds: ["briefing"],
      topology: "responsive-grid",
    });
    expect(
      result.experience.representation.slots.map((slot) => slot.role),
    ).toEqual(["headline", "status", "decisions", "actions"]);
    expect(result.experience.screen.contextLabel).toBe("Executive briefing");
  });

  it("rejects duplicate IDs, unresolved sources, unsafe URLs, and unknown fields", () => {
    const duplicate = structuredClone(envelope);
    duplicate.sections[0]!.items[1]!.id = "alpha";
    expect(
      informationEnvelopeV1Schema
        .safeParse(duplicate)
        .error?.issues.map((issue) => issue.message)
        .join(" "),
    ).toContain("Duplicate ID");

    const unresolved = structuredClone(envelope);
    unresolved.sections[0]!.items[0]!.sourceIds = ["missing"];
    expect(
      informationEnvelopeV1Schema
        .safeParse(unresolved)
        .error?.issues.map((issue) => issue.message)
        .join(" "),
    ).toContain("Unknown source");

    const unsafe = structuredClone(envelope);
    unsafe.sources[0]!.url = "http://127.0.0.1/private";
    expect(
      informationEnvelopeV1Schema
        .safeParse(unsafe)
        .error?.issues.map((issue) => issue.message)
        .join(" "),
    ).toContain("public HTTPS URL");

    const unknown = { ...structuredClone(envelope), surprise: true };
    expect(
      informationEnvelopeV1Schema
        .safeParse(unknown)
        .error?.issues.map((issue) => issue.message)
        .join(" "),
    ).toContain("Unrecognized key");
  });

  it("binds only trusted, sourced media into the compiled experience", () => {
    const withMedia = structuredClone(envelope);
    withMedia.media = [
      {
        id: "subject-portrait",
        url: "https://upload.wikimedia.org/wikipedia/commons/example.jpg",
        alt: "Grounded subject portrait",
        caption: "Openly licensed portrait",
        role: "identity",
        sourceId: "brief",
      },
    ];
    const result = compileGroundedInformationUI(
      withMedia,
      createDefaultGroundedCompositionPlan(withMedia),
      "run-media",
    );
    expect(result.composition.topology).toBe("focal-split");
    expect(result.experience.representation.blueprintIds).toEqual([
      "profile-reference",
    ]);
    expect(
      result.experience.nodes.find(
        (node) => node.id === "media-subject-portrait",
      ),
    ).toMatchObject({
      type: "Image",
      value: withMedia.media[0]!.url,
      title: withMedia.media[0]!.alt,
      text: withMedia.media[0]!.caption,
      mediaRole: "identity",
      meta: "brief",
    });

    const untrusted = structuredClone(withMedia);
    untrusted.media![0]!.url = "https://images.example.com/portrait.jpg";
    expect(
      informationEnvelopeV1Schema
        .safeParse(untrusted)
        .error?.issues.map((issue) => issue.message)
        .join(" "),
    ).toContain("approved public HTTPS image host");

    const unresolved = structuredClone(withMedia);
    unresolved.media![0]!.sourceId = "missing";
    expect(
      informationEnvelopeV1Schema
        .safeParse(unresolved)
        .error?.issues.map((issue) => issue.message)
        .join(" "),
    ).toContain("Unknown source");

    const duplicate = structuredClone(withMedia);
    duplicate.media![0]!.id = "alpha";
    expect(
      informationEnvelopeV1Schema
        .safeParse(duplicate)
        .error?.issues.map((issue) => issue.message)
        .join(" "),
    ).toContain("Duplicate ID");
  });

  it("associates supported official product imagery with comparison options", () => {
    const comparison = structuredClone(envelope);
    comparison.originalRequest =
      "Compare MacBook Neo and MacBook Air and help me choose.";
    comparison.sections = [
      {
        id: "recommendation",
        title: "Recommendation",
        body: "MacBook Air is the stronger balance for most buyers.",
        sourceIds: ["brief"],
        items: [
          {
            id: "recommended-option",
            label: "Recommended option",
            value: "MacBook Air",
            detail: "It provides more memory headroom and longevity.",
            sourceIds: ["brief"],
          },
        ],
      },
      {
        id: "starting-price",
        title: "Starting price comparison",
        body: "Current U.S. starting prices.",
        sourceIds: ["brief"],
        items: [
          {
            id: "neo-price",
            label: "MacBook Neo",
            value: "$599",
            detail: "Lowest price.",
            sourceIds: ["brief"],
          },
          {
            id: "air-price",
            label: "MacBook Air",
            value: "$1,099",
            detail: "Higher starting price.",
            sourceIds: ["brief"],
          },
        ],
      },
    ];
    comparison.sources.push({
      id: "apple-air",
      title: "MacBook Air - Apple",
      url: "https://www.apple.com/macbook-air/",
    });
    comparison.media = [
      {
        id: "air-product",
        url: "https://www.apple.com/v/macbook-air/images/meta/macbook-air.png",
        alt: "MacBook Air",
        caption: "Official MacBook Air product image",
        role: "illustration",
        subject: "MacBook Air",
        sourceId: "apple-air",
      },
    ];

    const result = compileGroundedInformationUI(
      comparison,
      createDefaultGroundedCompositionPlan(comparison),
      "run-product-comparison",
    );

    expect(result.experience.representation).toMatchObject({
      mode: "blueprint",
      blueprintIds: ["compare-decide"],
      topology: "responsive-grid",
    });
    expect(
      result.experience.representation.slots.map((slot) => slot.role),
    ).toEqual(["featured", "recommendation", "criteria"]);
    expect(
      result.experience.nodes.find((node) => node.id === "media-air-product"),
    ).toMatchObject({
      type: "Image",
      label: "MacBook Air",
      title: "MacBook Air",
      value: comparison.media[0]!.url,
    });
  });

  it("rejects invented, missing, or repeated semantic references", () => {
    expect(() =>
      parseGroundedCompositionPlan(envelope, {
        version: "1.0",
        topology: "editorial-stack",
        placements: [
          {
            sectionId: "options",
            component: "Comparison",
            itemIds: ["alpha", "invented"],
            importance: "primary",
          },
        ],
      }),
    ).toThrow(/every item/);
  });

  it("compiles grounded selection and input surfaces with resumable semantic state", () => {
    const choicePlan = parseGroundedCompositionPlan(envelope, {
      version: "1.0",
      topology: "responsive-grid",
      placements: [
        {
          sectionId: "options",
          component: "ChoiceGroup",
          itemIds: ["alpha", "beta"],
          importance: "primary",
        },
      ],
    });
    const choice = compileGroundedInformationUI(
      envelope,
      choicePlan,
      "run-choice",
    );
    expect(choice.experience.representation.interactionLevel).toBe("select");
    expect(
      choice.experience.nodes.find((node) => node.id === "section-options"),
    ).toMatchObject({
      type: "ChoiceGroup",
      action: { type: "select", targetId: "options" },
    });

    const inputEnvelope = structuredClone(envelope);
    inputEnvelope.originalRequest = "Make this an editable input field.";
    inputEnvelope.sections[0]!.items = [
      {
        id: "budget",
        label: "Budget",
        value: "Enter an amount",
        detail: "Use the approved budget ceiling.",
        sourceIds: ["brief"],
      },
    ];
    inputEnvelope.continuationState = {
      priorRunId: "prior",
      checkedIds: [],
      selectedIds: [],
      inputs: { options: "15" },
    };
    const inputPlan = createDefaultGroundedCompositionPlan(inputEnvelope);
    const input = compileGroundedInformationUI(
      inputEnvelope,
      inputPlan,
      "run-input",
    );
    expect(inputPlan.placements[0]?.component).toBe("Input");
    expect(input.experience.representation.interactionLevel).toBe("edit");
    expect(
      input.experience.nodes.find((node) => node.id === "section-options"),
    ).toMatchObject({
      type: "Input",
      label: "Budget",
      value: "Enter an amount",
    });

    const invalidContinuation = structuredClone(inputEnvelope);
    invalidContinuation.continuationState!.inputs = { missing: "15" };
    expect(
      informationEnvelopeV1Schema
        .safeParse(invalidContinuation)
        .error?.issues.map((issue) => issue.message)
        .join(" "),
    ).toContain("unknown input");
  });

  it("keeps the authoritative plain answer available with sources", () => {
    expect(formatInformationEnvelopeFallback(envelope)).toContain(
      envelope.groundedAnswer,
    );
    expect(formatInformationEnvelopeFallback(envelope)).toContain(
      "https://example.com/rollout",
    );
  });

  it("offers the broader semantic catalog while keeping data-shaped surfaces grounded", () => {
    expect(groundedComponentTypes).toEqual(
      expect.arrayContaining([
        "Hero",
        "Card",
        "ColorPalette",
        "Badge",
        "Metric",
        "Chart",
        "Donut",
        "Progress",
        "Quote",
        "MapPanel",
        "Calendar",
        "CodeBlock",
        "Visual",
      ]),
    );

    const chartEnvelope = structuredClone(envelope);
    chartEnvelope.originalRequest =
      "Show the approved readiness scores as a chart.";
    chartEnvelope.sections[0]!.items = [
      {
        id: "alpha",
        label: "Alpha",
        value: "41",
        detail: "Initial readiness",
        sourceIds: ["brief"],
      },
      {
        id: "beta",
        label: "Beta",
        value: "86",
        detail: "Validated readiness",
        sourceIds: ["brief"],
      },
    ];
    const chartPlan = createDefaultGroundedCompositionPlan(chartEnvelope);
    expect(chartPlan.placements[0]?.component).toBe("Chart");
    const chart = compileGroundedInformationUI(
      chartEnvelope,
      chartPlan,
      "run-chart",
    );
    expect(
      chart.experience.nodes.find((node) => node.id === "section-options")
        ?.items,
    ).toEqual([
      {
        id: "alpha",
        label: "Alpha",
        value: "41",
        detail: "Initial readiness",
        tone: "neutral",
        progress: 41,
      },
      {
        id: "beta",
        label: "Beta",
        value: "86",
        detail: "Validated readiness",
        tone: "neutral",
        progress: 86,
      },
    ]);

    expect(() =>
      parseGroundedCompositionPlan(envelope, {
        version: "1.0",
        topology: "responsive-grid",
        placements: [
          {
            sectionId: "options",
            component: "Chart",
            itemIds: ["alpha", "beta"],
            importance: "primary",
          },
        ],
      }),
    ).toThrow(/numeric grounded item values/);
  });
});
