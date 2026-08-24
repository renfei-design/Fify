import {
  generateOpenAIStructuredPlan,
  PlannerProviderError,
} from "./provider.js";
import {
  buildGroundedCompositionInstructions,
  buildGroundedCompositionJsonSchema,
  createInformationUI,
  defineInformationEnvelope,
  parseGroundedCompositionPlan,
  type GroundedCompositionPlan,
  type InformationUIResult,
} from "./index.js";

export { PlannerProviderError };

export interface GenerateOpenAIInformationUIOptions {
  apiKey: string;
  prompt: string;
  model?: string;
  locale?: string;
  signal?: AbortSignal;
  responseId?: string;
  surfaceId?: string;
}

export interface OpenAIInformationUIMeta {
  provider: "openai";
  model: string;
  responseIds: readonly [string, string];
  inputTokens: number;
  outputTokens: number;
}

export interface OpenAIInformationUIResult extends InformationUIResult {
  provider: OpenAIInformationUIMeta;
}

const semanticId = {
  type: "string",
  minLength: 1,
  maxLength: 64,
  pattern: "^[a-zA-Z0-9]+(?:[-_.:][a-zA-Z0-9]+)*$",
} as const;

/** Strict schema for the answer stage. This starter deliberately disallows invented sources. */
export const openAIInformationEnvelopeJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: { type: "string", const: "1.0" },
    originalRequest: { type: "string", minLength: 1, maxLength: 2_000 },
    groundedAnswer: { type: "string", minLength: 1, maxLength: 8_000 },
    locale: { type: "string", minLength: 2, maxLength: 35 },
    sections: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: semanticId,
          title: { type: "string", minLength: 1, maxLength: 110 },
          body: { type: "string", maxLength: 2_000 },
          items: {
            type: "array",
            maxItems: 10,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: semanticId,
                label: { type: "string", minLength: 1, maxLength: 90 },
                value: { type: "string", maxLength: 120 },
                detail: { type: "string", maxLength: 1_200 },
                sourceIds: { type: "array", maxItems: 0, items: semanticId },
              },
              required: ["id", "label", "value", "detail", "sourceIds"],
            },
          },
          sourceIds: { type: "array", maxItems: 0, items: semanticId },
        },
        required: ["id", "title", "body", "items", "sourceIds"],
      },
    },
    sources: { type: "array", maxItems: 0, items: { type: "object" } },
    suggestedRefinements: {
      type: "array",
      maxItems: 2,
      items: { type: "string", minLength: 1, maxLength: 140 },
    },
  },
  required: [
    "version",
    "originalRequest",
    "groundedAnswer",
    "locale",
    "sections",
    "sources",
    "suggestedRefinements",
  ],
} as const;

export function buildOpenAIInformationInstructions(locale = "en") {
  return `You are the answer stage of Fify, an information-interface compiler.
Answer the user's exact request, then organize the same answer into compact semantic sections and items for a later layout stage.
- Use locale ${locale} unless the user clearly asks for another language.
- Preserve the user's request verbatim in originalRequest.
- Keep groundedAnswer useful as an authoritative plain-text fallback.
- Use unique, stable kebab-case IDs.
- Do not design a UI and do not output HTML, JSX, CSS, Markdown tables, or executable code.
- This starter has no retrieval stage. Never invent citations or URLs; sources and every sourceIds array must be empty.
- Do not imply that current or time-sensitive facts were checked. Clearly qualify uncertainty when the request needs live information.`;
}

/**
 * Turn one prompt into validated information, a separately validated layout plan,
 * and catalog-only A2UI messages. The API key is used only for these two calls.
 */
export async function generateOpenAIInformationUI(
  options: GenerateOpenAIInformationUIOptions,
): Promise<OpenAIInformationUIResult> {
  const apiKey = options.apiKey.trim();
  const prompt = options.prompt.trim();
  if (!apiKey) throw new TypeError("An OpenAI API key is required.");
  if (prompt.length < 3 || prompt.length > 2_000)
    throw new TypeError("Prompt must contain between 3 and 2,000 characters.");

  const answer = await generateOpenAIStructuredPlan({
    apiKey,
    ...(options.model ? { model: options.model } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
    instructions: buildOpenAIInformationInstructions(options.locale),
    userInput: prompt,
    schemaName: "fify_information_envelope",
    jsonSchema: openAIInformationEnvelopeJsonSchema,
    parse: defineInformationEnvelope,
    maxOutputTokens: 6_000,
    reasoningEffort: "low",
  });
  const composition =
    await generateOpenAIStructuredPlan<GroundedCompositionPlan>({
      apiKey,
      model: options.model ?? answer.model,
      ...(options.signal ? { signal: options.signal } : {}),
      instructions: buildGroundedCompositionInstructions(answer.value),
      userInput: JSON.stringify(answer.value),
      schemaName: "fify_information_composition",
      jsonSchema: buildGroundedCompositionJsonSchema(answer.value),
      parse: (value) => parseGroundedCompositionPlan(answer.value, value),
      maxOutputTokens: 2_500,
      reasoningEffort: "low",
    });
  const compiled = createInformationUI(answer.value, {
    composition: composition.value,
    responseId: options.responseId ?? answer.responseId,
    ...(options.surfaceId ? { surfaceId: options.surfaceId } : {}),
  });

  return {
    ...compiled,
    provider: {
      provider: "openai",
      model: composition.model,
      responseIds: [answer.responseId, composition.responseId],
      inputTokens: answer.inputTokens + composition.inputTokens,
      outputTokens: answer.outputTokens + composition.outputTokens,
    },
  };
}
