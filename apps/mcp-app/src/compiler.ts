import { generateOpenAIStructuredPlan } from "@fify/core";
import {
  buildGroundedCompositionInstructions,
  buildGroundedCompositionJsonSchema,
  compileGroundedInformationUI,
  createDefaultGroundedCompositionPlan,
  parseGroundedCompositionPlan,
  uiExperienceToA2UI,
  type InformationEnvelopeV1,
  type GroundedCompositionPlan,
  type GroundedCompilation,
} from "@fify/core";
import type { InformationUIRunStore } from "./run-store.js";
import {
  enrichInformationEnvelopeWithProfileMedia,
  profileSubjectForEnvelope,
  type ProfileMediaLookupOptions,
} from "./profile-media.js";

export async function compileInformationUIRun(
  store: InformationUIRunStore,
  runId: string,
  envelope: InformationEnvelopeV1,
  options: {
    profileMedia?: ProfileMediaLookupOptions;
    compile?: (
      envelope: InformationEnvelopeV1,
      composition: GroundedCompositionPlan,
      responseId: string,
    ) => GroundedCompilation;
  } = {},
) {
  let groundedEnvelope = envelope;
  const profileSubject = profileSubjectForEnvelope(envelope);
  if (
    profileSubject &&
    !(envelope.media ?? []).some((item) => item.role === "identity")
  ) {
    store.append(runId, {
      type: "status",
      stage: "media",
      message: `Finding an attributed portrait of ${profileSubject}…`,
    });
    groundedEnvelope = await enrichInformationEnvelopeWithProfileMedia(
      envelope,
      options.profileMedia,
    );
    store.append(runId, {
      type: "status",
      stage: "media",
      message: (groundedEnvelope.media ?? []).some(
        (item) => item.role === "identity",
      )
        ? "Attributed portrait ready."
        : "No trusted portrait was available; continuing without one.",
    });
  }
  store.append(runId, {
    type: "status",
    stage: "composition",
    message: "Choosing the clearest structure…",
  });
  let compilerMode: "model" | "deterministic-fallback" =
    "deterministic-fallback";
  let composition = createDefaultGroundedCompositionPlan(groundedEnvelope);
  // The installed plugin must render immediately and must not inherit an
  // unrelated shell API key as permission to add a second model round trip.
  // Hosted operators can explicitly opt into model-selected composition.
  const modelComposerEnabled = process.env.FIFY_ENABLE_MODEL_COMPOSER === "1";
  const apiKey = modelComposerEnabled
    ? process.env.OPENAI_API_KEY?.trim()
    : undefined;
  if (apiKey) {
    try {
      const result = await generateOpenAIStructuredPlan({
        apiKey,
        instructions: buildGroundedCompositionInstructions(groundedEnvelope),
        userInput: JSON.stringify({
          request: groundedEnvelope.originalRequest,
          sections: groundedEnvelope.sections,
        }),
        schemaName: "grounded_information_composition_v1",
        jsonSchema: buildGroundedCompositionJsonSchema(groundedEnvelope),
        parse: (value) => parseGroundedCompositionPlan(groundedEnvelope, value),
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
        message:
          "The adaptive layout was unavailable; using a safe grounded layout.",
      });
    }
  } else if (modelComposerEnabled) {
    store.append(runId, {
      type: "status",
      stage: "fallback",
      message:
        "Using the local grounded layout (no server model credential configured).",
    });
  } else {
    store.append(runId, {
      type: "status",
      stage: "fallback",
      message: "Using the immediate local grounded layout.",
    });
  }

  const compile = options.compile ?? compileGroundedInformationUI;
  let compiled: GroundedCompilation;
  try {
    compiled = compile(groundedEnvelope, composition, runId);
  } catch (error) {
    if (!(groundedEnvelope.media ?? []).length) throw error;
    store.append(runId, {
      type: "status",
      stage: "fallback",
      message:
        "Optional media was incompatible with the layout; continuing with the complete interactive view without imagery.",
    });
    groundedEnvelope = { ...groundedEnvelope, media: [] };
    composition = createDefaultGroundedCompositionPlan(groundedEnvelope);
    compilerMode = "deterministic-fallback";
    compiled = compile(groundedEnvelope, composition, runId);
  }
  for (const message of uiExperienceToA2UI(compiled.experience, {
    surfaceId: `fify-${runId}`,
  }))
    store.append(runId, { type: "a2ui", message });
  store.append(runId, {
    type: "complete",
    experience: compiled.experience,
    envelope: compiled.envelope,
    compilerMode,
  });
  store.complete(runId);
}
