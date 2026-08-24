import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateOpenAIStructuredPlan,
  PlannerProviderError,
} from "./provider.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

const request = {
  apiKey: "test-key",
  instructions: "Return a test plan.",
  userInput: "Create it.",
  schemaName: "test_plan",
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: { ok: { type: "boolean" } },
    required: ["ok"],
  },
  parse: (value: unknown) => value as { ok: boolean },
  retryBaseDelayMs: 0,
};

describe("generateOpenAIStructuredPlan", () => {
  it("retries a transient network failure and returns the structured plan", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "response-1",
            model: "test-model",
            output_text: JSON.stringify({ ok: true }),
            usage: { input_tokens: 12, output_tokens: 4 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateOpenAIStructuredPlan({
      ...request,
      maxAttempts: 2,
    });

    expect(result.value).toEqual({ ok: true });
    expect(result.inputTokens).toBe(12);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a transient provider status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "try again" } }), {
          status: 429,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "response-2",
            model: "test-model",
            output_text: JSON.stringify({ ok: true }),
            usage: { input_tokens: 8, output_tokens: 3 },
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateOpenAIStructuredPlan({ ...request, maxAttempts: 2 }),
    ).resolves.toMatchObject({
      value: { ok: true },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-transient provider rejection", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "invalid request" },
        }),
        { status: 400 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = generateOpenAIStructuredPlan({ ...request, maxAttempts: 3 });

    await expect(result).rejects.toBeInstanceOf(PlannerProviderError);
    await expect(result).rejects.toMatchObject({
      code: "provider",
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("preserves token usage when semantic validation rejects an otherwise successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            id: "response-invalid",
            model: "test-model",
            output_text: JSON.stringify({ ok: false }),
            usage: { input_tokens: 21, output_tokens: 9 },
          }),
          { status: 200 },
        ),
      ),
    );

    const result = generateOpenAIStructuredPlan({
      ...request,
      parse: () => {
        throw new Error("Too small");
      },
    });

    await expect(result).rejects.toMatchObject({
      code: "invalid_output",
      usage: { inputTokens: 21, outputTokens: 9 },
    } satisfies Partial<PlannerProviderError>);
  });
});
