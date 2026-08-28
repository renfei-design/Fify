import { describe, expect, it } from "vitest";
import { normalizePresentationInput } from "./input-normalization.js";

function envelope() {
  return {
    version: "1.0",
    originalRequest: "Show this college plan with Fify.",
    groundedAnswer: "Prepare, submit, and verify every application.",
    locale: "en-US",
    sources: [{ id: "guide", title: "Guide", url: "https://example.com" }],
    sections: [
      {
        id: "submit",
        title: "Submit and verify",
        body: "Review each application.",
        sourceIds: ["guide"],
        items: [
          {
            id: "submit",
            label: "Submit",
            value: "Save confirmation",
            detail: "Pay or waive the fee, then submit.",
            sourceIds: ["guide"],
          },
        ],
      },
    ],
    suggestedRefinements: [],
  };
}

describe("presentation ID normalization", () => {
  it("repairs a section/item collision without changing factual content", () => {
    const input = envelope();
    const normalized = normalizePresentationInput(input);

    expect(normalized.repairs).toEqual([
      {
        path: ["sections", 0, "id"],
        from: "submit",
        to: "submit-section",
      },
    ]);
    expect(normalized.value.sections[0]?.id).toBe("submit-section");
    expect(normalized.value.sections[0]?.items[0]?.id).toBe("submit");
    expect(normalized.value.groundedAnswer).toBe(input.groundedAnswer);
    expect(normalized.value.sources).toEqual(input.sources);
  });

  it("does not rewrite ambiguous IDs when continuation state is present", () => {
    const input = {
      ...envelope(),
      continuationState: {
        priorRunId: "prior",
        checkedIds: ["submit"],
        selectedIds: [],
        inputs: {},
      },
    };
    const normalized = normalizePresentationInput(input);

    expect(normalized.value).toBe(input);
    expect(normalized.repairs).toEqual([]);
  });

  it("keeps the first two suggested refinements instead of rejecting the tool call", () => {
    const input = {
      ...envelope(),
      suggestedRefinements: ["One", "Two", "Three", "Four", "Five"],
    };

    const normalized = normalizePresentationInput(input);

    expect(normalized.value.suggestedRefinements).toEqual(["One", "Two"]);
  });

  it("drops malformed optional media without changing authoritative content", () => {
    const input = {
      ...envelope(),
      media: [
        {
          id: "unsafe-product",
          url: "https://images.example.com/product.jpg",
          alt: "A product",
          caption: "Optional product image",
          role: "product",
          subject: "Product",
          sourceId: "guide",
        },
      ],
    };

    const normalized = normalizePresentationInput(input);

    expect(normalized.value.media).toEqual([]);
    expect(normalized.value.groundedAnswer).toBe(input.groundedAnswer);
    expect(normalized.value.sections[0]).toMatchObject({
      title: input.sections[0]!.title,
      body: input.sections[0]!.body,
      items: input.sections[0]!.items,
    });
    expect(normalized.mediaDiagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "repaired" }),
        expect.objectContaining({
          action: "dropped",
          message: expect.stringContaining("approved public HTTPS image host"),
        }),
      ]),
    );
  });

  it("maps product media to illustration and retains supported official images", () => {
    const input = {
      ...envelope(),
      media: [
        {
          id: "official-product",
          url: "https://www.sony.com/images/product.jpg",
          alt: "A supported product",
          caption: "Official product image",
          role: "product",
          subject: "Product",
          sourceId: "guide",
        },
      ],
    };

    const normalized = normalizePresentationInput(input);

    expect(normalized.value.media).toEqual([
      expect.objectContaining({
        id: "official-product",
        role: "illustration",
      }),
    ]);
    expect(normalized.mediaDiagnostics).toEqual([
      expect.objectContaining({ action: "repaired" }),
    ]);
  });
});
