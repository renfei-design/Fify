import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractCompleteJsonArrayItems,
  extractCompleteJsonProperty,
  findJsonPropertyValueStart,
  generateOpenAIStreamingStructuredPlan,
  generateOpenAIStructuredPlan,
  PlannerProviderError,
} from "./provider.js";

afterEach(() => vi.unstubAllGlobals());

describe("OpenAI structured planner gateway", () => {
  it("extracts complete values from partial structured output", () => {
    const partial =
      '{"brief":{"originalRequest":"show \\"surfaces\\""},"recipe":{"sources":[{"id":"a"}],"surfaces":[{"id":"one"},{"id":';
    const recipeStart = findJsonPropertyValueStart(partial, "recipe")!;
    expect(
      extractCompleteJsonProperty(partial, "sources", recipeStart),
    ).toEqual([{ id: "a" }]);
    expect(
      extractCompleteJsonArrayItems(partial, "surfaces", recipeStart),
    ).toEqual([{ id: "one" }]);
  });

  it("sends strict JSON Schema and validates the returned value", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.text.format.type).toBe("json_schema");
      expect(body.text.format.strict).toBe(true);
      expect(body.store).toBe(false);
      expect(body.max_output_tokens).toBe(1200);
      return new Response(
        JSON.stringify({
          id: "resp_test",
          model: "gpt-5.6-luna",
          output: [
            {
              content: [
                { type: "output_text", text: JSON.stringify({ answer: "ok" }) },
              ],
            },
          ],
          usage: { input_tokens: 12, output_tokens: 4 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateOpenAIStructuredPlan({
      apiKey: "test-key",
      instructions: "Return a plan.",
      userInput: "Test",
      schemaName: "test_plan",
      jsonSchema: { type: "object" },
      parse: (value) => value as { answer: string },
      maxOutputTokens: 1200,
    });
    expect(result.value.answer).toBe("ok");
    expect(result.inputTokens).toBe(12);
  });

  it("grounds structured output with bounded hosted web search and extracts sources", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        expect(body.tools).toEqual([{ type: "web_search" }]);
        expect(body.tool_choice).toBe("required");
        expect(body.max_tool_calls).toBe(1);
        expect(body.include).toEqual(["web_search_call.action.sources"]);
        return new Response(
          JSON.stringify({
            id: "resp_grounded",
            model: "gpt-5.6-luna",
            output: [
              {
                type: "web_search_call",
                action: {
                  type: "search",
                  sources: [
                    { title: "Official source", url: "https://example.com/a" },
                  ],
                },
              },
              {
                type: "message",
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({ answer: "grounded" }),
                    annotations: [
                      {
                        type: "url_citation",
                        title: "Official source",
                        url: "https://example.com/a",
                      },
                    ],
                  },
                ],
              },
            ],
            usage: { input_tokens: 20, output_tokens: 8 },
          }),
        );
      }),
    );

    const result = await generateOpenAIStructuredPlan({
      apiKey: "test-key",
      instructions: "Search first.",
      userInput: "What is current?",
      schemaName: "grounded_test",
      jsonSchema: { type: "object" },
      parse: (value) => value as { answer: string },
      webSearch: { toolChoice: "required", maxToolCalls: 1 },
    });

    expect(result.webSearch).toEqual({
      toolCalls: 1,
      sources: [
        {
          title: "Official source",
          url: "https://example.com/a",
          cited: true,
        },
      ],
    });
  });

  it("reports authentication failures without exposing the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: "Invalid key" } }), {
            status: 401,
          }),
      ),
    );
    await expect(
      generateOpenAIStructuredPlan({
        apiKey: "secret-value",
        instructions: "Return a plan.",
        userInput: "Test",
        schemaName: "test_plan",
        jsonSchema: { type: "object" },
        parse: (value) => value,
      }),
    ).rejects.toMatchObject({
      code: "authentication",
      status: 401,
    } satisfies Partial<PlannerProviderError>);
  });

  it("streams structured text deltas and validates only the completed value", async () => {
    const encoder = new TextEncoder();
    const events = [
      {
        type: "response.reasoning_summary_text.delta",
        delta: "Choosing ",
      },
      {
        type: "response.reasoning_summary_text.done",
        text: "Choosing a timeline.",
      },
      { type: "response.output_text.delta", delta: '{"answer":' },
      { type: "response.output_text.delta", delta: '"ready"}' },
      {
        type: "response.completed",
        response: {
          id: "resp_stream",
          model: "test-stream-model",
          usage: { input_tokens: 8, output_tokens: 3 },
        },
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));
        expect(body.stream).toBe(true);
        expect(body.reasoning.summary).toBe("concise");
        return new Response(
          new ReadableStream({
            start(controller) {
              for (const event of events)
                controller.enqueue(
                  encoder.encode(
                    `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
                  ),
                );
              controller.close();
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        );
      }),
    );
    const deltas: string[] = [];
    const summaries: string[] = [];

    const result = await generateOpenAIStreamingStructuredPlan({
      apiKey: "test-key",
      instructions: "Return a plan.",
      userInput: "Test",
      schemaName: "test_stream_plan",
      jsonSchema: { type: "object" },
      parse: (value) => value as { answer: string },
      reasoningSummary: "concise",
      onTextDelta: (delta) => {
        deltas.push(delta);
      },
      onReasoningSummaryDelta: (_delta, accumulated) => {
        summaries.push(accumulated);
      },
    });

    expect(deltas).toEqual(['{"answer":', '"ready"}']);
    expect(summaries).toEqual(["Choosing ", "Choosing a timeline."]);
    expect(result).toMatchObject({
      value: { answer: "ready" },
      responseId: "resp_stream",
      model: "test-stream-model",
    });
  });

  it("preserves completed stream usage when final semantic validation fails", async () => {
    const encoder = new TextEncoder();
    const events = [
      { type: "response.output_text.delta", delta: '{"answer":"wrong"}' },
      {
        type: "response.completed",
        response: {
          id: "resp_invalid_stream",
          model: "test-stream-model",
          usage: { input_tokens: 18, output_tokens: 6 },
        },
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                for (const event of events)
                  controller.enqueue(
                    encoder.encode(
                      `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
                    ),
                  );
                controller.close();
              },
            }),
            { status: 200, headers: { "content-type": "text/event-stream" } },
          ),
      ),
    );

    const result = generateOpenAIStreamingStructuredPlan({
      apiKey: "test-key",
      instructions: "Return a plan.",
      userInput: "Test",
      schemaName: "test_stream_plan",
      jsonSchema: { type: "object" },
      parse: () => {
        throw new Error("Semantic mismatch");
      },
    });

    await expect(result).rejects.toMatchObject({
      code: "invalid_output",
      usage: { inputTokens: 18, outputTokens: 6 },
    } satisfies Partial<PlannerProviderError>);
  });
});
