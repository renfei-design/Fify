import { generateOpenAIStructuredPlan } from "@fify/core";
import {
  buildGroundedCompositionInstructions,
  buildGroundedCompositionJsonSchema,
  compileGroundedInformationUI,
  createDefaultGroundedCompositionPlan,
  parseGroundedCompositionPlan,
  uiExperienceToA2UI,
  type InformationEnvelopeV1,
} from "@fify/core";
import type { InformationUIRunStore } from "./run-store.js";

export async function compileInformationUIRun(
  store: InformationUIRunStore,
  runId: string,
  envelope: InformationEnvelopeV1,
) {
  store.append(runId, { type: "status", stage: "composition", message: "Choosing the clearest structure…" });
  let compilerMode: "model" | "deterministic-fallback" = "deterministic-fallback";
  let composition = createDefaultGroundedCompositionPlan(envelope);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (apiKey) {
    try {
      const result = await generateOpenAIStructuredPlan({
        apiKey,
        instructions: buildGroundedCompositionInstructions(envelope),
        userInput: JSON.stringify({ request: envelope.originalRequest, sections: envelope.sections }),
        schemaName: "grounded_information_composition_v1",
        jsonSchema: buildGroundedCompositionJsonSchema(envelope),
        parse: (value) => parseGroundedCompositionPlan(envelope, value),
        model: process.env.FIFY_COMPOSER_MODEL || "gpt-5-mini",
        maxAttempts: 2,
        maxOutputTokens: 2_000,
        reasoningEffort: "low",
      });
      composition = result.value;
      compilerMode = "model";
    } catch (error) {
      store.append(runId, {
        type: "status",
        stage: "fallback",
        message: "The adaptive layout was unavailable; using a safe grounded layout.",
      });
    }
  } else {
    store.append(runId, {
      type: "status",
      stage: "fallback",
      message: "Using the local grounded layout (no server model credential configured).",
    });
  }

  const compiled = compileGroundedInformationUI(envelope, composition, runId);
  for (const message of uiExperienceToA2UI(compiled.experience, { surfaceId: `fify-${runId}` }))
    store.append(runId, { type: "a2ui", message });
  store.append(runId, {
    type: "complete",
    experience: compiled.experience,
    envelope: compiled.envelope,
    compilerMode,
  });
  store.complete(runId);
}
