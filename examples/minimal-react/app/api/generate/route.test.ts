import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("minimal starter generation route", () => {
  it("asks for a key without making a provider call", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "Compare two launch strategies" }),
      }),
    );

    expect(response.status).toBe(428);
    await expect(response.json()).resolves.toMatchObject({
      code: "MODEL_NOT_CONFIGURED",
    });
  });

  it("rejects an invalid prompt before model generation", async () => {
    const response = await POST(
      new Request("http://localhost/api/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-openai-api-key": "test-key",
        },
        body: JSON.stringify({ prompt: "x" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_PROMPT",
    });
  });
});
