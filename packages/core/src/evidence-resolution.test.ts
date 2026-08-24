import { describe, expect, it, vi } from "vitest";
import {
  evidenceRouteForPrompt,
  EvidenceResolutionError,
  resolveContextualEvidenceRequest,
  resolveEvidence,
  type EvidenceProvider,
} from "./evidence-resolution.js";
import { informationEnvelopeV1Schema } from "./grounded.js";
import { groundingPolicyForPrompt } from "./web-grounding.js";

function packet(label: string) {
  return {
    asOf: new Date().toISOString(),
    toolCalls: 1,
    envelope: informationEnvelopeV1Schema.parse({
      version: "1.0",
      originalRequest: label,
      groundedAnswer: label,
      locale: "en-US",
      sections: [
        {
          id: "answer",
          title: "Answer",
          body: label,
          sourceIds: ["source-1"],
          items: [],
        },
      ],
      sources: [
        {
          id: "source-1",
          title: "Source",
          url: "https://example.com/source",
        },
      ],
      suggestedRefinements: [],
    }),
  };
}

function provider(
  id: string,
  kind: EvidenceProvider["kind"],
  capabilities: EvidenceProvider["capabilities"],
  implementation: EvidenceProvider["resolve"],
): EvidenceProvider {
  return { id, kind, capabilities, resolve: implementation };
}

describe("evidence resolution", () => {
  it("inherits evidence intent through a contiguous follow-up chain", () => {
    const shanghai = resolveContextualEvidenceRequest("What about Shanghai?", [
      "Tell me about the weather in Beijing right now",
    ]);
    expect(shanghai.inherited).toBe(true);
    expect(evidenceRouteForPrompt(shanghai.prompt).capability).toBe("weather");
    expect(groundingPolicyForPrompt(shanghai.prompt).mode).toBe("required");

    const confirmed = resolveContextualEvidenceRequest("Do it", [
      "Tell me about the weather in Beijing right now",
      "What about Shanghai?",
    ]);
    expect(confirmed.inherited).toBe(true);
    expect(confirmed.context).toEqual([
      "What about Shanghai?",
      "Tell me about the weather in Beijing right now",
    ]);
    expect(evidenceRouteForPrompt(confirmed.prompt).capability).toBe("weather");
  });

  it("breaks evidence inheritance when the topic changes", () => {
    const request = resolveContextualEvidenceRequest("Do it", [
      "Tell me about the weather in Beijing right now",
      "Write a limerick about cats",
    ]);
    expect(request).toEqual({
      prompt: "Do it",
      inherited: false,
      context: [],
    });
  });

  it("keeps an explicit no-search follow-up authoritative", () => {
    const request = resolveContextualEvidenceRequest(
      "Do it without web search",
      ["What is the Bitcoin price right now?"],
    );
    expect(request.inherited).toBe(false);
    expect(groundingPolicyForPrompt(request.prompt).mode).toBe("none");
  });

  it("routes stable capability names without choosing vendors", () => {
    expect(
      evidenceRouteForPrompt("What's the weather now in Shanghai?"),
    ).toMatchObject({
      capability: "weather",
      preferredKinds: ["structured-data", "web-search"],
    });
    expect(
      evidenceRouteForPrompt("What's the current Bitcoin price?").capability,
    ).toBe("markets");
    expect(evidenceRouteForPrompt("Latest accessibility news").capability).toBe(
      "news",
    );
  });

  it("prefers a matching structured provider and avoids unnecessary search", async () => {
    const structured = vi.fn(async () => ({
      packet: packet("structured"),
      inputTokens: 0,
      outputTokens: 0,
    }));
    const search = vi.fn(async () => ({
      packet: packet("search"),
      inputTokens: 10,
      outputTokens: 20,
    }));
    const result = await resolveEvidence({
      prompt: "What's the weather now in Shanghai?",
      mode: "required",
      providers: [
        provider("web", "web-search", ["general"], search),
        provider("weather", "structured-data", ["weather"], structured),
      ],
    });

    expect(result.providerId).toBe("weather");
    expect(structured).toHaveBeenCalledOnce();
    expect(search).not.toHaveBeenCalled();
  });

  it("falls back to web search when a structured provider fails", async () => {
    const result = await resolveEvidence({
      prompt: "What's the weather now in Shanghai?",
      mode: "required",
      providers: [
        provider("weather", "structured-data", ["weather"], async () => {
          throw new Error("weather API unavailable");
        }),
        provider("web", "web-search", ["general"], async () => ({
          packet: packet("search fallback"),
          inputTokens: 10,
          outputTokens: 20,
        })),
      ],
    });

    expect(result.providerId).toBe("web");
    expect(result.attempts.map((attempt) => attempt.outcome)).toEqual([
      "failed",
      "succeeded",
    ]);
  });

  it("rejects a provider that violates the shared evidence quality gate", async () => {
    const result = await resolveEvidence({
      prompt: "What's the weather now in Shanghai?",
      mode: "required",
      providers: [
        provider("weather", "structured-data", ["weather"], async () => ({
          packet: { ...packet("unsafe"), toolCalls: 9 },
          inputTokens: 0,
          outputTokens: 0,
        })),
        provider("web", "web-search", ["general"], async () => ({
          packet: packet("safe fallback"),
          inputTokens: 10,
          outputTokens: 20,
        })),
      ],
    });

    expect(result.providerId).toBe("web");
    expect(result.attempts[0]?.error).toContain("quality gate");
  });

  it("fails required evidence only after all compatible routes fail", async () => {
    await expect(
      resolveEvidence({
        prompt: "What's the weather now in Shanghai?",
        mode: "required",
        providers: [
          provider("weather", "structured-data", ["weather"], async () => {
            throw new Error("offline");
          }),
          provider("web", "web-search", ["general"], async () => {
            throw new Error("no sources");
          }),
        ],
      }),
    ).rejects.toBeInstanceOf(EvidenceResolutionError);
  });
});
