import { afterEach, describe, expect, it, vi } from "vitest";
import { reduceA2UIStream } from "@fify/a2ui";
import { generateOpenAIInformationUI } from "./openai.js";

function providerResponse(id: string, value: unknown) {
  return new Response(
    JSON.stringify({
      id,
      model: "gpt-test",
      output_text: JSON.stringify(value),
      usage: { input_tokens: 10, output_tokens: 5 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

afterEach(() => vi.restoreAllMocks());

describe("@fify/core/openai", () => {
  it("keeps answer and layout generation behind validated catalog boundaries", async () => {
    const request = "Compare a focused launch with a broad launch.";
    const envelope = {
      version: "1.0",
      originalRequest: request,
      groundedAnswer:
        "A focused launch validates faster; a broad launch covers more use cases.",
      locale: "en",
      sections: [
        {
          id: "launch-options",
          title: "Launch options",
          body: "Choose based on validation speed and coverage.",
          items: [
            {
              id: "focused",
              label: "Focused",
              value: "Faster",
              detail: "One workflow first.",
              sourceIds: [],
            },
            {
              id: "broad",
              label: "Broad",
              value: "More coverage",
              detail: "More workflows first.",
              sourceIds: [],
            },
          ],
          sourceIds: [],
        },
      ],
      sources: [],
      suggestedRefinements: [],
    };
    const composition = {
      version: "1.0",
      topology: "responsive-grid",
      placements: [
        {
          sectionId: "launch-options",
          component: "Comparison",
          itemIds: ["focused", "broad"],
          importance: "primary",
        },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(providerResponse("answer-1", envelope))
      .mockResolvedValueOnce(providerResponse("layout-1", composition));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateOpenAIInformationUI({
      apiKey: "test-key",
      prompt: request,
      surfaceId: "test-surface",
    });
    const surface = reduceA2UIStream(result.messages);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.compositionSource).toBe("provided");
    expect(result.provider.responseIds).toEqual(["answer-1", "layout-1"]);
    expect(result.provider.inputTokens).toBe(20);
    expect(surface?.components.root?.component).toBe("Page");
    expect(
      Object.values(surface?.components ?? {}).some(
        (component) => component.component === "Comparison",
      ),
    ).toBe(true);
  });
});
