import { parseA2UIMessage, type A2UIMessage } from "@fify/a2ui";
import { uiExperienceSchema, type UIExperience } from "@fify/core";

export interface UniversalGenerationMeta {
  provider: string;
  model: string;
  responseId: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
  timings: {
    routingMs: number;
    groundingMs?: number;
    compositionMs: number;
    validationMs: number;
  };
  grounding?: {
    mode: "required" | "helpful" | "none";
    searched: boolean;
    degraded: boolean;
    providerId?: string | null;
    providerKind?: "structured-data" | "web-search" | null;
    fallbackUsed?: boolean;
    attempts?: Array<{
      providerId: string;
      kind: "structured-data" | "web-search";
      outcome: "failed" | "succeeded";
      error?: string;
    }>;
    asOf: string | null;
    sourceCount: number;
    toolCalls: number;
  };
  decision: {
    attentionMode: "glance" | "read" | "explore" | "work";
    disclosureStrategy: "none" | "inline" | "expandable" | "drill-down";
    visibleObligations: number;
    deferredObligations: number;
    maxVisibleNodes: number;
  };
  policy: {
    visibleContentNodes: number;
    prunedContentNodes: number;
    visibleCopyCharacters: number;
    truncatedItemCount: number;
  };
  recovery: {
    directionAttempts: number;
    compositionAttempts: number;
    semanticRepairs: number;
    fallbackUsed: boolean;
    repairInputTokens: number;
    repairOutputTokens: number;
  };
  streaming?: {
    firstSurfaceFrameMs: number;
    firstRepresentationFrameMs: number | null;
    firstContentFrameMs: number | null;
    visibleContentFrames: number;
    maxVisibleFrameGapMs: number;
  };
}

export const universalGenerationPhases = [
  "accepted",
  "routing",
  "grounding",
  "composing",
  "validating",
  "repairing",
  "media",
  "rendering",
] as const;

export type UniversalGenerationPhase =
  (typeof universalGenerationPhases)[number];

export interface UniversalGenerationStatus {
  type: "status";
  phase: UniversalGenerationPhase;
  elapsedMs: number;
  state?: "started" | "advanced" | "completed";
  completedUnits?: number;
  totalUnits?: number;
  unit?: "regions" | "items";
  activeSlotId?: string;
  attempt?: number;
}

export interface UniversalGenerationActivity {
  type: "activity";
  id: string;
  phase: UniversalGenerationPhase;
  label: string;
  detail?: string;
  state: "active" | "complete";
  source: "pipeline" | "provider";
  elapsedMs: number;
}

export type UniversalGenerationStreamPayload =
  | UniversalGenerationStatus
  | UniversalGenerationActivity
  | { type: "a2ui"; message: A2UIMessage }
  | {
      type: "complete";
      experience: UIExperience;
      meta: UniversalGenerationMeta;
    }
  | { type: "error"; error: string; code: string };

export type UniversalGenerationStreamFrame =
  UniversalGenerationStreamPayload & {
    runId: string;
    sequence: number;
  };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function parseUniversalGenerationStatus(
  value: unknown,
): UniversalGenerationStatus {
  if (
    !isObject(value) ||
    value.type !== "status" ||
    !universalGenerationPhases.includes(value.phase as never) ||
    typeof value.elapsedMs !== "number" ||
    !Number.isFinite(value.elapsedMs) ||
    value.elapsedMs < 0
  ) {
    throw new Error("Invalid generation status frame.");
  }
  if (
    value.state !== undefined &&
    !(["started", "advanced", "completed"] as const).includes(
      value.state as never,
    )
  )
    throw new Error("Invalid generation progress state.");
  if (
    value.unit !== undefined &&
    !(["regions", "items"] as const).includes(value.unit as never)
  )
    throw new Error("Invalid generation progress unit.");
  for (const key of ["completedUnits", "totalUnits", "attempt"] as const) {
    const candidate = value[key];
    if (
      candidate !== undefined &&
      (!Number.isInteger(candidate) || Number(candidate) < 0)
    )
      throw new Error(`Invalid generation progress field '${key}'.`);
  }
  if (
    value.completedUnits !== undefined &&
    value.totalUnits !== undefined &&
    Number(value.completedUnits) > Number(value.totalUnits)
  )
    throw new Error("Generation progress exceeds its total.");
  if (
    value.activeSlotId !== undefined &&
    (typeof value.activeSlotId !== "string" || value.activeSlotId.length > 80)
  )
    throw new Error("Invalid active generation slot.");
  return value as unknown as UniversalGenerationStatus;
}

export function parseUniversalGenerationActivity(
  value: unknown,
): UniversalGenerationActivity {
  if (
    !isObject(value) ||
    value.type !== "activity" ||
    typeof value.id !== "string" ||
    value.id.length < 1 ||
    value.id.length > 80 ||
    !universalGenerationPhases.includes(value.phase as never) ||
    typeof value.label !== "string" ||
    value.label.trim().length < 1 ||
    value.label.length > 180 ||
    !(value.state === "active" || value.state === "complete") ||
    !(value.source === "pipeline" || value.source === "provider") ||
    typeof value.elapsedMs !== "number" ||
    !Number.isFinite(value.elapsedMs) ||
    value.elapsedMs < 0
  )
    throw new Error("Invalid generation activity frame.");
  if (
    value.detail !== undefined &&
    (typeof value.detail !== "string" || value.detail.length > 1_200)
  )
    throw new Error("Invalid generation activity detail.");
  return value as unknown as UniversalGenerationActivity;
}

export function parseUniversalGenerationStreamFrame(
  value: unknown,
): UniversalGenerationStreamFrame {
  if (!isObject(value) || typeof value.type !== "string")
    throw new Error("Invalid universal generation stream frame.");
  if (
    typeof value.runId !== "string" ||
    value.runId.length < 8 ||
    !Number.isInteger(value.sequence) ||
    Number(value.sequence) < 1
  )
    throw new Error("Invalid universal generation run cursor.");
  if (value.type === "activity")
    return {
      ...parseUniversalGenerationActivity(value),
      runId: value.runId,
      sequence: Number(value.sequence),
    };
  if (value.type === "a2ui")
    return {
      type: "a2ui",
      runId: value.runId,
      sequence: Number(value.sequence),
      message: parseA2UIMessage(value.message),
    };
  if (value.type === "error") {
    if (typeof value.error !== "string" || typeof value.code !== "string")
      throw new Error("Invalid generation error frame.");
    return {
      type: "error",
      runId: value.runId,
      sequence: Number(value.sequence),
      error: value.error,
      code: value.code,
    };
  }
  if (value.type === "status") {
    return {
      ...parseUniversalGenerationStatus(value),
      runId: value.runId,
      sequence: Number(value.sequence),
    };
  }
  if (value.type === "complete") {
    if (!isObject(value.meta))
      throw new Error("Invalid generation completion frame.");
    return {
      type: "complete",
      runId: value.runId,
      sequence: Number(value.sequence),
      experience: uiExperienceSchema.parse(value.experience),
      meta: value.meta as unknown as UniversalGenerationMeta,
    };
  }
  throw new Error(`Unknown generation stream frame '${value.type}'.`);
}
