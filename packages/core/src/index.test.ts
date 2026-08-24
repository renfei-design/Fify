import { describe, expect, it } from "vitest";
import { reduceA2UIStream } from "@fify/a2ui";
import {
  createInformationUI,
  defineInformationEnvelope,
  fifyInformationCatalogId,
} from "./index.js";

const envelope = {
  version: "1.0",
  originalRequest: "Compare the two launch options.",
  groundedAnswer: "Option A is faster. Option B costs less.",
  locale: "en",
  sections: [
    {
      id: "options",
      title: "Launch options",
      body: "Choose based on speed or cost.",
      items: [
        {
          id: "option-a",
          label: "Option A",
          value: "Faster",
          detail: "Ships this week.",
          sourceIds: [],
        },
        {
          id: "option-b",
          label: "Option B",
          value: "Lower cost",
          detail: "Uses the current platform.",
          sourceIds: [],
        },
      ],
      sourceIds: [],
    },
  ],
  sources: [],
  suggestedRefinements: [],
} as const;

describe("@fify/core", () => {
  it("validates and compiles a deterministic information surface", () => {
    const result = createInformationUI(envelope, {
      responseId: "core-test",
      surfaceId: "core-test-surface",
    });
    const surface = reduceA2UIStream(result.messages);

    expect(result.compositionSource).toBe("deterministic");
    expect(result.fallbackText).toBe(envelope.groundedAnswer);
    expect(result.experience.responseId).toBe("core-test");
    expect(surface?.catalogId).toBe(fifyInformationCatalogId);
    expect(surface?.components.root?.component).toBe("Page");
    expect(
      Object.values(surface?.components ?? {}).some(
        (component) => component.component === "Comparison",
      ),
    ).toBe(true);
  });

  it("rejects unresolved source references", () => {
    expect(() =>
      defineInformationEnvelope({
        ...envelope,
        sections: [
          {
            ...envelope.sections[0],
            sourceIds: ["missing-source"],
          },
        ],
      }),
    ).toThrow(/Unknown source/);
  });
});
