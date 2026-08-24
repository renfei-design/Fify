import { describe, expect, it } from "vitest";
import { uiLanguageFixture } from "./language.js";
import {
  GroundingValidationError,
  attachGroundingSources,
  evaluateGroundingPacket,
  finalizeWebGrounding,
  groundingPolicyForPrompt,
  webGroundingBenchmarkCasesV1,
  webGroundingDraftJsonSchema,
} from "./web-grounding.js";

const draft = {
  version: "1.0" as const,
  asOf: "2026-08-24T09:00:00.000Z",
  answer: "The current answer is supported by a retrieved source.",
  locale: "en-US",
  sections: [
    {
      id: "current-answer",
      title: "Current answer",
      body: "A concise grounded summary.",
      sourceUrls: ["https://example.com/report"],
      items: [
        {
          id: "verified-fact",
          label: "Verified fact",
          value: "Current",
          detail: "A fact confirmed by the retrieved page.",
          sourceUrls: ["https://example.com/report"],
        },
      ],
    },
  ],
  sources: [{ title: "Example report", url: "https://example.com/report" }],
};

describe("web grounding", () => {
  it("requires search for current facts and skips creative work", () => {
    expect(
      groundingPolicyForPrompt("Who are the top NBA players right now?").mode,
    ).toBe("required");
    expect(
      groundingPolicyForPrompt("Create a color palette for my app").mode,
    ).toBe("none");
    expect(
      groundingPolicyForPrompt("Compare current electric cars to buy").mode,
    ).toBe("helpful");
    expect(
      groundingPolicyForPrompt("Use no web search and explain gravity").mode,
    ).toBe("none");
  });

  it("passes the v1 search-trigger benchmark without a routing model call", () => {
    for (const benchmarkCase of webGroundingBenchmarkCasesV1)
      expect(
        groundingPolicyForPrompt(benchmarkCase.prompt).mode,
        benchmarkCase.id,
      ).toBe(benchmarkCase.expectedMode);
  });

  it("uses only Structured Outputs-compatible JSON Schema keywords", () => {
    expect(JSON.stringify(webGroundingDraftJsonSchema)).not.toContain(
      '"format"',
    );
  });

  it("accepts only URLs confirmed by the provider search result", () => {
    const packet = finalizeWebGrounding(
      "What is current?",
      draft,
      [
        {
          title: "Provider-confirmed report",
          url: "https://example.com/report",
          cited: true,
        },
      ],
      1,
    );
    expect(packet.envelope.sources).toEqual([
      {
        id: "source-1",
        title: "Provider-confirmed report",
        url: "https://example.com/report",
      },
    ]);
    expect(packet.envelope.sections[0]?.sourceIds).toEqual(["source-1"]);
    expect(
      evaluateGroundingPacket(packet, {
        now: new Date("2026-08-24T09:01:00.000Z"),
        maxAgeMs: 5 * 60_000,
        maxToolCalls: 1,
      }),
    ).toMatchObject({ passed: true, sourceCoverage: 1 });

    expect(() =>
      finalizeWebGrounding(
        "What is current?",
        draft,
        [{ title: "Different", url: "https://example.org/other" }],
        1,
      ),
    ).toThrow(GroundingValidationError);
  });

  it("keeps supported facts when an optional item has no retrieved source", () => {
    const packet = finalizeWebGrounding(
      "Who is this player today?",
      {
        ...draft,
        sections: [
          {
            ...draft.sections[0],
            items: [
              ...draft.sections[0]!.items,
              {
                id: "unsupported-side-fact",
                label: "Optional side fact",
                value: "Unverified",
                detail:
                  "This item should be omitted without losing the answer.",
                sourceUrls: ["https://example.org/not-retrieved"],
              },
            ],
          },
        ],
      },
      [
        {
          title: "Provider-confirmed report",
          url: "https://example.com/report",
          cited: true,
        },
      ],
      1,
    );

    expect(packet.envelope.sections).toHaveLength(1);
    expect(packet.envelope.sections[0]?.items).toEqual([
      expect.objectContaining({ id: "verified-fact" }),
    ]);
    expect(
      evaluateGroundingPacket(packet, {
        now: new Date("2026-08-24T09:01:00.000Z"),
        maxAgeMs: 5 * 60_000,
      }),
    ).toMatchObject({ passed: true, sourceCoverage: 1 });
  });

  it("accepts a provider-confirmed item URL omitted from the draft source index", () => {
    const itemUrl = "https://example.com/player-profile";
    const packet = finalizeWebGrounding(
      "Who is this player today?",
      {
        ...draft,
        sections: [
          {
            ...draft.sections[0],
            items: [
              {
                ...draft.sections[0]!.items[0]!,
                sourceUrls: [itemUrl],
              },
            ],
          },
        ],
      },
      [
        { title: "Example report", url: "https://example.com/report" },
        { title: "Player profile", url: itemUrl },
      ],
      1,
    );

    expect(packet.envelope.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Player profile", url: itemUrl }),
      ]),
    );
    expect(packet.envelope.sections[0]?.items[0]?.sourceIds).toHaveLength(1);
  });

  it("adds trusted clickable source data without model-authored layout URLs", () => {
    const packet = finalizeWebGrounding(
      "What is current?",
      draft,
      [{ title: "Example report", url: "https://example.com/report" }],
      1,
    );
    const experience = attachGroundingSources(uiLanguageFixture, packet);
    const sources = experience.nodes.find((node) => node.type === "Sources");
    expect(sources).toMatchObject({
      slot: "web-sources",
      items: [
        {
          label: "Example report",
          detail: "https://example.com/report",
        },
      ],
    });
    expect(experience.nodes[0]?.children).toContain("web-sources");
  });
});
