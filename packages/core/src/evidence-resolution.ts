import {
  evaluateGroundingPacket,
  groundingPolicyForPrompt,
  promptExplicitlyDisablesGrounding,
  type GroundingMode,
  type GroundingPacket,
} from "./web-grounding.js";

export const evidenceCapabilities = [
  "weather",
  "markets",
  "sports",
  "news",
  "general",
] as const;
export type EvidenceCapability = (typeof evidenceCapabilities)[number];
export type EvidenceProviderKind = "structured-data" | "web-search";

export interface EvidenceRoute {
  capability: EvidenceCapability;
  preferredKinds: readonly EvidenceProviderKind[];
}

export interface ContextualEvidenceRequest {
  prompt: string;
  inherited: boolean;
  context: readonly string[];
}

export interface EvidenceProviderResult {
  packet: GroundingPacket;
  inputTokens: number;
  outputTokens: number;
}

export interface EvidenceProvider {
  id: string;
  kind: EvidenceProviderKind;
  capabilities: readonly EvidenceCapability[];
  resolve(input: {
    prompt: string;
    signal?: AbortSignal;
  }): Promise<EvidenceProviderResult>;
}

export interface EvidenceResolutionAttempt {
  providerId: string;
  kind: EvidenceProviderKind;
  outcome: "failed" | "succeeded";
  error?: string;
}

export interface EvidenceResolution {
  packet: GroundingPacket | null;
  providerId: string | null;
  providerKind: EvidenceProviderKind | null;
  route: EvidenceRoute;
  attempts: EvidenceResolutionAttempt[];
  inputTokens: number;
  outputTokens: number;
  degraded: boolean;
}

const weatherPattern =
  /\b(?:weather|forecast|temperature|rain|snow|humidity|wind|uv|sunrise|sunset)\b/i;
const marketPattern =
  /\b(?:stock|share\s+price|market|bitcoin|ethereum|crypto|exchange\s+rate|ticker)\b/i;
const sportsPattern =
  /\b(?:score|standings?|fixture|match|game|nba|nfl|nhl|mlb|wnba|premier\s+league|champions\s+league)\b/i;
const newsPattern = /\b(?:news|headline|breaking|developments?)\b/i;

/**
 * Cheap semantic routing for evidence providers. The route names stable data
 * capabilities, never a vendor, so applications can add or replace adapters
 * without changing the generation pipeline.
 */
export function evidenceRouteForPrompt(prompt: string): EvidenceRoute {
  const capability: EvidenceCapability = weatherPattern.test(prompt)
    ? "weather"
    : marketPattern.test(prompt)
      ? "markets"
      : sportsPattern.test(prompt)
        ? "sports"
        : newsPattern.test(prompt)
          ? "news"
          : "general";
  return {
    capability,
    preferredKinds:
      capability === "general" || capability === "news"
        ? ["web-search", "structured-data"]
        : ["structured-data", "web-search"],
  };
}

const contextualFollowUpPattern =
  /^(?:(?:what|how)\s+about\b|(?:and|also)\b|(?:do\s+it|go\s+ahead|try\s+that|same(?:\s+thing)?(?:\s+for)?)\b|(?:in|for|at|near)\s+)|\b(?:that|those|these|there|them|it|instead)\b/i;

function isContextualEvidenceFollowUp(prompt: string) {
  return contextualFollowUpPattern.test(prompt.trim());
}

/**
 * Resolves an elliptical request against a contiguous chain of recent user
 * follow-ups. Evidence routing must see the same conversational intent as the
 * director and composer, but an unrelated intervening request must break
 * inheritance so stale capabilities do not leak into a new topic.
 */
export function resolveContextualEvidenceRequest(
  prompt: string,
  conversation: readonly string[],
): ContextualEvidenceRequest {
  const current = prompt.trim();
  if (
    !current ||
    promptExplicitlyDisablesGrounding(current) ||
    !isContextualEvidenceFollowUp(current)
  )
    return { prompt: current, inherited: false, context: [] };

  const context: string[] = [];
  let foundEvidenceAnchor = false;
  for (let index = conversation.length - 1; index >= 0; index -= 1) {
    const candidate = conversation[index]?.trim();
    if (!candidate) continue;
    const route = evidenceRouteForPrompt(candidate);
    const policy = groundingPolicyForPrompt(candidate);
    if (route.capability !== "general" || policy.mode !== "none") {
      context.push(candidate);
      foundEvidenceAnchor = true;
      break;
    }
    if (!isContextualEvidenceFollowUp(candidate)) break;
    context.push(candidate);
  }

  if (!foundEvidenceAnchor)
    return { prompt: current, inherited: false, context: [] };

  return {
    prompt: [
      `Current request: ${current}`,
      "Relevant recent requests, newest first:",
      ...context.map((request) => `- ${request}`),
    ].join("\n"),
    inherited: true,
    context,
  };
}

export class EvidenceResolutionError extends Error {
  readonly attempts: EvidenceResolutionAttempt[];

  constructor(attempts: EvidenceResolutionAttempt[]) {
    const detail = attempts.length
      ? attempts
          .map(
            (attempt) => `${attempt.providerId}: ${attempt.error ?? "failed"}`,
          )
          .join("; ")
      : "no compatible evidence provider is configured";
    super(`Every eligible evidence route failed (${detail}).`);
    this.name = "EvidenceResolutionError";
    this.attempts = attempts;
  }
}

function providersForRoute(
  route: EvidenceRoute,
  providers: readonly EvidenceProvider[],
) {
  return [...providers]
    .filter(
      (provider) =>
        provider.capabilities.includes(route.capability) ||
        provider.capabilities.includes("general"),
    )
    .sort((left, right) => {
      const leftKind = route.preferredKinds.indexOf(left.kind);
      const rightKind = route.preferredKinds.indexOf(right.kind);
      return leftKind - rightKind;
    });
}

/**
 * Runs an ordered fallback ladder and normalizes every provider into the same
 * GroundingPacket contract consumed by the UI composer.
 */
export async function resolveEvidence(input: {
  prompt: string;
  mode: Exclude<GroundingMode, "none">;
  providers: readonly EvidenceProvider[];
  signal?: AbortSignal;
  maxAgeMs?: number;
}): Promise<EvidenceResolution> {
  const route = evidenceRouteForPrompt(input.prompt);
  const attempts: EvidenceResolutionAttempt[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for (const provider of providersForRoute(route, input.providers)) {
    try {
      const result = await provider.resolve(
        input.signal
          ? { prompt: input.prompt, signal: input.signal }
          : { prompt: input.prompt },
      );
      const quality = evaluateGroundingPacket(result.packet, {
        ...(input.maxAgeMs ? { maxAgeMs: input.maxAgeMs } : {}),
        maxToolCalls: 2,
      });
      if (!quality.passed)
        throw new Error(
          `Evidence quality gate failed: ${quality.issues.join(" ")}`,
        );
      inputTokens += result.inputTokens;
      outputTokens += result.outputTokens;
      attempts.push({
        providerId: provider.id,
        kind: provider.kind,
        outcome: "succeeded",
      });
      return {
        packet: result.packet,
        providerId: provider.id,
        providerKind: provider.kind,
        route,
        attempts,
        inputTokens,
        outputTokens,
        degraded: false,
      };
    } catch (error) {
      attempts.push({
        providerId: provider.id,
        kind: provider.kind,
        outcome: "failed",
        error: error instanceof Error ? error.message : "Unknown failure",
      });
    }
  }

  if (input.mode === "required") throw new EvidenceResolutionError(attempts);
  return {
    packet: null,
    providerId: null,
    providerKind: null,
    route,
    attempts,
    inputTokens,
    outputTokens,
    degraded: true,
  };
}
