export interface OpenAIStructuredPlanRequest<T> {
  apiKey: string;
  instructions: string;
  userInput: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  parse: (value: unknown) => T;
  model?: string;
  signal?: AbortSignal;
  maxAttempts?: number;
  retryBaseDelayMs?: number;
  maxOutputTokens?: number;
  reasoningEffort?: "low" | "medium" | "high";
  /** Requests a provider-authored reasoning summary, never raw hidden reasoning. */
  reasoningSummary?: "auto" | "concise" | "detailed";
  /** Optional hosted web-search grounding for this structured response. */
  webSearch?: {
    toolChoice?: "auto" | "required";
    maxToolCalls?: number;
  };
}

export interface OpenAIWebSearchSource {
  url: string;
  title: string;
  /** True when the source was attached to a specific output citation. */
  cited: boolean;
}

export interface OpenAIWebSearchMeta {
  toolCalls: number;
  sources: OpenAIWebSearchSource[];
}

export interface OpenAIStructuredPlanResult<T> {
  value: T;
  responseId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  webSearch?: OpenAIWebSearchMeta;
}

export interface PlannerTokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface OpenAIStreamingStructuredPlanRequest<
  T,
> extends OpenAIStructuredPlanRequest<T> {
  /** Called for each provider text delta. Deltas are untrusted until the final parse succeeds. */
  onTextDelta?: (delta: string, accumulated: string) => void | Promise<void>;
  /** Called for provider-authored reasoning summary deltas when requested and supported. */
  onReasoningSummaryDelta?: (
    delta: string,
    accumulated: string,
  ) => void | Promise<void>;
}

export class PlannerProviderError extends Error {
  constructor(
    message: string,
    readonly code:
      "authentication" | "rate_limit" | "provider" | "invalid_output",
    readonly status: number,
    readonly usage?: PlannerTokenUsage,
  ) {
    super(message);
    this.name = "PlannerProviderError";
  }
}

function tokenUsage(payload: Record<string, any>): PlannerTokenUsage {
  return {
    inputTokens: Number(payload.usage?.input_tokens ?? 0),
    outputTokens: Number(payload.usage?.output_tokens ?? 0),
  };
}

function webSearchMeta(payload: Record<string, any>): OpenAIWebSearchMeta {
  const sources = new Map<string, OpenAIWebSearchSource>();
  let toolCalls = 0;
  const addSource = (value: unknown, cited: boolean) => {
    if (!value || typeof value !== "object") return;
    const source = value as Record<string, unknown>;
    if (typeof source.url !== "string") return;
    let url: URL;
    try {
      url = new URL(source.url);
    } catch {
      return;
    }
    if (url.protocol !== "https:") return;
    const canonical = url.toString();
    const existing = sources.get(canonical);
    const title =
      typeof source.title === "string" && source.title.trim()
        ? source.title.trim().slice(0, 180)
        : url.hostname;
    sources.set(canonical, {
      url: canonical,
      title:
        existing?.title && existing.title !== url.hostname
          ? existing.title
          : title,
      cited: Boolean(existing?.cited || cited),
    });
  };

  for (const item of Array.isArray(payload.output) ? payload.output : []) {
    if (!item || typeof item !== "object") continue;
    const output = item as Record<string, any>;
    if (output.type === "web_search_call") {
      toolCalls += 1;
      for (const source of Array.isArray(output.action?.sources)
        ? output.action.sources
        : [])
        addSource(source, false);
    }
    for (const part of Array.isArray(output.content) ? output.content : []) {
      if (!part || typeof part !== "object") continue;
      for (const annotation of Array.isArray(part.annotations)
        ? part.annotations
        : [])
        if (annotation?.type === "url_citation") addSource(annotation, true);
    }
  }
  return { toolCalls, sources: [...sources.values()] };
}

/** Finds a property value in an incomplete JSON document while respecting quoted strings. */
export function findJsonPropertyValueStart(
  input: string,
  propertyName: string,
  fromIndex = 0,
): number | null {
  for (let index = Math.max(0, fromIndex); index < input.length; index += 1) {
    if (input[index] !== '"') continue;
    const stringStart = index;
    let escaped = false;
    index += 1;
    for (; index < input.length; index += 1) {
      const character = input[index];
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') break;
    }
    if (index >= input.length) return null;
    let decoded: unknown;
    try {
      decoded = JSON.parse(input.slice(stringStart, index + 1));
    } catch {
      continue;
    }
    let cursor = index + 1;
    while (/\s/.test(input[cursor] ?? "")) cursor += 1;
    if (decoded !== propertyName || input[cursor] !== ":") continue;
    cursor += 1;
    while (/\s/.test(input[cursor] ?? "")) cursor += 1;
    return cursor < input.length ? cursor : null;
  }
  return null;
}

function completeJsonValueEnd(input: string, start: number): number | null {
  const opener = input[start];
  if (opener !== "{" && opener !== "[") return null;
  const stack = [opener];
  let inString = false;
  let escaped = false;
  for (let index = start + 1; index < input.length; index += 1) {
    const character = input[index]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{" || character === "[") stack.push(character);
    else if (character === "}" || character === "]") {
      const expected = character === "}" ? "{" : "[";
      if (stack.pop() !== expected) return null;
      if (stack.length === 0) return index + 1;
    }
  }
  return null;
}

export function extractCompleteJsonProperty(
  input: string,
  propertyName: string,
  fromIndex = 0,
): unknown | undefined {
  const start = findJsonPropertyValueStart(input, propertyName, fromIndex);
  if (start === null) return undefined;
  const end = completeJsonValueEnd(input, start);
  if (end === null) return undefined;
  try {
    return JSON.parse(input.slice(start, end)) as unknown;
  } catch {
    return undefined;
  }
}

/** Returns every fully closed item currently available in a streamed JSON array property. */
export function extractCompleteJsonArrayItems(
  input: string,
  propertyName: string,
  fromIndex = 0,
): unknown[] {
  const arrayStart = findJsonPropertyValueStart(input, propertyName, fromIndex);
  if (arrayStart === null || input[arrayStart] !== "[") return [];
  const items: unknown[] = [];
  let cursor = arrayStart + 1;
  while (cursor < input.length) {
    while (/\s|,/.test(input[cursor] ?? "")) cursor += 1;
    if (input[cursor] === "]" || cursor >= input.length) break;
    const end = completeJsonValueEnd(input, cursor);
    if (end === null) break;
    try {
      items.push(JSON.parse(input.slice(cursor, end)) as unknown);
    } catch {
      break;
    }
    cursor = end;
  }
  return items;
}

function extractOutputText(response: Record<string, unknown>): string | null {
  if (typeof response.output_text === "string") return response.output_text;
  if (!Array.isArray(response.output)) return null;
  for (const item of response.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        (part as { type?: unknown }).type === "output_text"
      ) {
        const text = (part as { text?: unknown }).text;
        if (typeof text === "string") return text;
      }
    }
  }
  return null;
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function openAIRequestBody<T>(
  request: OpenAIStructuredPlanRequest<T>,
  model: string,
  stream: boolean,
) {
  return JSON.stringify({
    model,
    store: false,
    ...(stream ? { stream: true } : {}),
    reasoning: {
      effort: request.reasoningEffort ?? "low",
      ...(request.reasoningSummary
        ? { summary: request.reasoningSummary }
        : {}),
    },
    max_output_tokens: request.maxOutputTokens ?? 5000,
    input: [
      { role: "system", content: request.instructions },
      { role: "user", content: request.userInput },
    ],
    text: {
      format: {
        type: "json_schema",
        name: request.schemaName,
        strict: true,
        schema: request.jsonSchema,
      },
    },
    ...(request.webSearch
      ? {
          tools: [{ type: "web_search" }],
          tool_choice: request.webSearch.toolChoice ?? "auto",
          max_tool_calls: Math.max(
            1,
            Math.min(2, request.webSearch.maxToolCalls ?? 1),
          ),
          include: ["web_search_call.action.sources"],
        }
      : {}),
  });
}

async function fetchOpenAIResponse<T>(
  request: OpenAIStructuredPlanRequest<T>,
  model: string,
  stream: boolean,
): Promise<Response> {
  const maxAttempts = Math.max(1, request.maxAttempts ?? 3);
  const retryBaseDelayMs = Math.max(0, request.retryBaseDelayMs ?? 250);
  let response: Response | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        ...(request.signal ? { signal: request.signal } : {}),
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${request.apiKey}`,
        },
        body: openAIRequestBody(request, model, stream),
      });
    } catch (error) {
      if (request.signal?.aborted) throw error;
      if (attempt + 1 < maxAttempts) {
        await retryDelay(attempt, retryBaseDelayMs, request.signal);
        continue;
      }
      const message =
        error instanceof Error ? error.message : "Network request failed";
      throw new PlannerProviderError(
        `The model provider could not be reached after ${maxAttempts} attempts: ${message}`,
        "provider",
        503,
      );
    }

    if (
      response.ok ||
      !shouldRetryStatus(response.status) ||
      attempt + 1 >= maxAttempts
    )
      break;
    await response.body?.cancel().catch(() => undefined);
    await retryDelay(attempt, retryBaseDelayMs, request.signal);
  }

  if (!response)
    throw new PlannerProviderError(
      "The model provider returned no response.",
      "provider",
      503,
    );
  return response;
}

async function providerError(
  response: Response,
): Promise<PlannerProviderError> {
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    any
  >;
  const message =
    payload.error?.message ?? "The model provider rejected the request.";
  const code =
    response.status === 401
      ? "authentication"
      : response.status === 429
        ? "rate_limit"
        : "provider";
  return new PlannerProviderError(message, code, response.status);
}

async function retryDelay(
  attempt: number,
  baseDelayMs: number,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted)
    throw signal.reason ?? new Error("The model request was aborted.");
  const delayMs = baseDelayMs * 2 ** attempt;
  if (delayMs <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  if (signal?.aborted)
    throw signal.reason ?? new Error("The model request was aborted.");
}

export async function generateOpenAIStructuredPlan<T>(
  request: OpenAIStructuredPlanRequest<T>,
): Promise<OpenAIStructuredPlanResult<T>> {
  const model = request.model ?? "gpt-5.6-luna";
  const response = await fetchOpenAIResponse(request, model, false);

  if (!response.ok) throw await providerError(response);
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    any
  >;

  const outputText = extractOutputText(payload);
  const usage = tokenUsage(payload);
  if (!outputText)
    throw new PlannerProviderError(
      "The model returned no structured plan.",
      "invalid_output",
      502,
      usage,
    );

  try {
    return {
      value: request.parse(JSON.parse(outputText)),
      responseId: typeof payload.id === "string" ? payload.id : "unknown",
      model: typeof payload.model === "string" ? payload.model : model,
      ...usage,
      ...(request.webSearch ? { webSearch: webSearchMeta(payload) } : {}),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid structured output";
    throw new PlannerProviderError(
      `The generated plan failed validation: ${message}`,
      "invalid_output",
      502,
      usage,
    );
  }
}

/**
 * Streams strict Structured Output text while retaining the same fail-closed
 * final validation boundary as generateOpenAIStructuredPlan.
 */
export async function generateOpenAIStreamingStructuredPlan<T>(
  request: OpenAIStreamingStructuredPlanRequest<T>,
): Promise<OpenAIStructuredPlanResult<T>> {
  const model = request.model ?? "gpt-5.6-luna";
  const response = await fetchOpenAIResponse(request, model, true);
  if (!response.ok) throw await providerError(response);
  if (!response.body)
    throw new PlannerProviderError(
      "The model provider returned no response stream.",
      "provider",
      502,
    );

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let outputText = "";
  let reasoningSummary = "";
  let completedResponse: Record<string, any> | null = null;

  async function consumeBlock(block: string) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") return;
    let event: Record<string, any>;
    try {
      event = JSON.parse(data) as Record<string, any>;
    } catch {
      throw new PlannerProviderError(
        "The model provider returned a malformed stream event.",
        "provider",
        502,
      );
    }
    if (
      event.type === "response.output_text.delta" &&
      typeof event.delta === "string"
    ) {
      outputText += event.delta;
      await request.onTextDelta?.(event.delta, outputText);
      return;
    }
    if (
      event.type === "response.reasoning_summary_text.delta" &&
      typeof event.delta === "string"
    ) {
      reasoningSummary += event.delta;
      await request.onReasoningSummaryDelta?.(event.delta, reasoningSummary);
      return;
    }
    if (
      event.type === "response.reasoning_summary_text.done" &&
      typeof event.text === "string" &&
      event.text !== reasoningSummary
    ) {
      const delta = event.text.startsWith(reasoningSummary)
        ? event.text.slice(reasoningSummary.length)
        : event.text;
      reasoningSummary = event.text;
      await request.onReasoningSummaryDelta?.(delta, reasoningSummary);
      return;
    }
    if (
      event.type === "response.completed" &&
      event.response &&
      typeof event.response === "object"
    ) {
      completedResponse = event.response as Record<string, any>;
      return;
    }
    if (
      event.type === "response.failed" ||
      event.type === "response.incomplete" ||
      event.type === "error"
    ) {
      const message =
        event.response?.error?.message ??
        event.error?.message ??
        event.message ??
        "The model stream did not complete.";
      throw new PlannerProviderError(String(message), "provider", 502);
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";
    for (const block of blocks) await consumeBlock(block);
    if (done) break;
  }
  if (buffer.trim()) await consumeBlock(buffer);
  const payload = (completedResponse ?? {}) as Record<string, any>;
  const usage = tokenUsage(payload);
  if (!outputText)
    throw new PlannerProviderError(
      "The model returned no structured plan.",
      "invalid_output",
      502,
      usage,
    );

  try {
    return {
      value: request.parse(JSON.parse(outputText)),
      responseId: typeof payload.id === "string" ? payload.id : "unknown",
      model: typeof payload.model === "string" ? payload.model : model,
      ...usage,
      ...(request.webSearch ? { webSearch: webSearchMeta(payload) } : {}),
    };
  } catch (error) {
    if (error instanceof PlannerProviderError)
      throw new PlannerProviderError(
        error.message,
        error.code,
        error.status,
        error.usage ?? usage,
      );
    const message =
      error instanceof Error ? error.message : "Invalid structured output";
    throw new PlannerProviderError(
      `The generated plan failed validation: ${message}`,
      "invalid_output",
      502,
      usage,
    );
  }
}
