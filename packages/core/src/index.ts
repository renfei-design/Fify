import type { A2UIMessage } from "@fify/a2ui";
import {
  buildGroundedCompositionInstructions,
  buildGroundedCompositionJsonSchema,
  compileGroundedInformationUI,
  createDefaultGroundedCompositionPlan,
  formatInformationEnvelopeFallback,
  groundedCompositionPlanSchema,
  informationEnvelopeV1Schema,
  parseGroundedCompositionPlan,
  type GroundedCompilation,
  type GroundedCompositionPlan,
  type InformationEnvelopeV1,
} from "./grounded.js";
import {
  uiExperienceToA2UI,
  uiLanguageCatalogId,
  type UIExperience,
} from "./language.js";

export * from "./decision.js";
export * from "./evidence-resolution.js";
export * from "./grounded.js";
export * from "./language.js";
export * from "./presentation.js";
export * from "./provider.js";
export * from "./representation.js";
export * from "./web-grounding.js";

export {
  buildGroundedCompositionInstructions,
  buildGroundedCompositionJsonSchema,
  formatInformationEnvelopeFallback,
  groundedCompositionPlanSchema,
  informationEnvelopeV1Schema,
  parseGroundedCompositionPlan,
};

export type {
  GroundedCompilation,
  GroundedCompositionPlan,
  InformationEnvelopeV1,
  UIExperience,
};

export const fifyCoreVersion = "0.1.0" as const;
export const fifyInformationCatalogId = uiLanguageCatalogId;

export interface CreateInformationUIOptions {
  /** Optional layout-only plan. When omitted, trusted deterministic composition is used. */
  composition?: GroundedCompositionPlan;
  /** Stable host-provided response ID used for replay and diagnostics. */
  responseId?: string;
  /** Stable surface ID used by the A2UI stream. */
  surfaceId?: string;
}

export interface InformationUIResult extends GroundedCompilation {
  messages: readonly A2UIMessage[];
  fallbackText: string;
  compositionSource: "deterministic" | "provided";
}

/** Validate a host-authored envelope without compiling a surface. */
export function defineInformationEnvelope(
  input: unknown,
): InformationEnvelopeV1 {
  return informationEnvelopeV1Schema.parse(input);
}

/**
 * Compile exact host-authored information into a catalog-constrained A2UI
 * surface. The optional composition can choose layout and component semantics;
 * it can never introduce or rewrite factual copy.
 */
export function createInformationUI(
  envelopeInput: unknown,
  options: CreateInformationUIOptions = {},
): InformationUIResult {
  const envelope = defineInformationEnvelope(envelopeInput);
  const composition = options.composition
    ? groundedCompositionPlanSchema.parse(options.composition)
    : createDefaultGroundedCompositionPlan(envelope);
  const compilation = compileGroundedInformationUI(
    envelope,
    composition,
    options.responseId,
  );
  const surfaceId =
    options.surfaceId ?? `${compilation.experience.responseId}-surface`;

  return {
    ...compilation,
    messages: uiExperienceToA2UI(compilation.experience, { surfaceId }),
    fallbackText: formatInformationEnvelopeFallback(envelope),
    compositionSource: options.composition ? "provided" : "deterministic",
  };
}
