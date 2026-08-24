import {
  generateOpenAIInformationUI,
  PlannerProviderError,
} from "@fify/core/openai";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  const browserKey = request.headers.get("x-openai-api-key")?.trim();
  const apiKey = browserKey || process.env.OPENAI_API_KEY?.trim();
  if (!apiKey)
    return json(
      {
        code: "MODEL_NOT_CONFIGURED",
        error: "Add an OpenAI API key to generate an interface.",
      },
      428,
    );

  let body: { prompt?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json(
      { code: "INVALID_REQUEST", error: "Send a valid JSON request." },
      400,
    );
  }
  if (
    typeof body.prompt !== "string" ||
    body.prompt.trim().length < 3 ||
    body.prompt.length > 2_000
  )
    return json(
      {
        code: "INVALID_PROMPT",
        error: "Prompt must contain between 3 and 2,000 characters.",
      },
      400,
    );

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Timed out", "AbortError")),
    45_000,
  );
  try {
    const result = await generateOpenAIInformationUI({
      apiKey,
      prompt: body.prompt,
      signal: controller.signal,
    });
    return json({
      messages: result.messages,
      fallbackText: result.fallbackText,
      compositionSource: result.compositionSource,
      provider: result.provider,
    });
  } catch (error) {
    if (error instanceof PlannerProviderError)
      return json(
        {
          code: error.code.toUpperCase(),
          error:
            error.code === "authentication"
              ? "The OpenAI API key was rejected. Check it and try again."
              : error.message,
        },
        error.status,
      );
    if (controller.signal.aborted)
      return json(
        { code: "TIMEOUT", error: "Generation took too long. Try again." },
        504,
      );
    return json(
      {
        code: "GENERATION_FAILED",
        error: "Fify could not generate a valid interface.",
      },
      500,
    );
  } finally {
    clearTimeout(timeout);
  }
}
