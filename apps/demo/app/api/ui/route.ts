import { NextRequest, NextResponse } from "next/server";
import {
  extractCompleteJsonArrayItems,
  extractCompleteJsonProperty,
  generateOpenAIStructuredPlan,
  generateOpenAIStreamingStructuredPlan,
  PlannerProviderError,
} from "@fify/core";
import {
  appendUILanguageNode,
  buildBlueprintCompositionInstructions,
  buildUXDecisionCompositionInstructions,
  buildUXDirectorInstructions,
  buildUILanguageInstructions,
  applyUXDecisionPolicy,
  attachGroundingSources,
  buildWebGroundingInstructions,
  compileModelAuthoredUINode,
  createRepresentationSkeleton,
  createUILanguageStream,
  finalizeUILanguageStream,
  finalizeWebGrounding,
  groundingContextForComposer,
  groundingPolicyForPrompt,
  resolveContextualEvidenceRequest,
  resolveEvidence,
  parseModelAuthoredUIExperience,
  repairUXDecisionBrief,
  shouldStreamNodeForUXDecision,
  sanitizeModelAuthoredUINode,
  uxDecisionBriefJsonSchema,
  uiExperienceJsonSchema,
  uiExperienceSchema,
  uiModelNodeSchema,
  webGroundingDraftJsonSchema,
  webGroundingDraftSchema,
  uiScreenSchema,
  type UIExperience,
  type UINode,
  type EvidenceProvider,
  type EvidenceProviderKind,
  type EvidenceResolutionAttempt,
  type GroundingPacket,
  type UXDecisionBrief,
  type UXDecisionPolicyReport,
} from "@fify/core";
import type {
  UniversalGenerationMeta,
  UniversalGenerationStreamPayload,
} from "../../../lib/universal-generation-stream";
import { enrichExperienceImages } from "../../../lib/image-search";
import { createOpenMeteoEvidenceProvider } from "../../../lib/weather-grounding";
import { universalRunStore } from "../../../lib/universal-run-store";

export const dynamic = "force-dynamic";

const cache = new Map<
  string,
  {
    expiresAt: number;
    experience: UIExperience;
    result: Pick<
      UniversalGenerationMeta,
      | "model"
      | "responseId"
      | "inputTokens"
      | "outputTokens"
      | "decision"
      | "policy"
      | "recovery"
      | "grounding"
    >;
  }
>();
const cacheTtlMs = 5 * 60_000;
const groundingCache = new Map<
  string,
  {
    expiresAt: number;
    packet: GroundingPacket;
    inputTokens: number;
    outputTokens: number;
    providerId: string;
    providerKind: EvidenceProviderKind;
    attempts: EvidenceResolutionAttempt[];
  }
>();
const structuralNodeTypes = new Set<UINode["type"]>([
  "Page",
  "Stack",
  "Row",
  "Grid",
  "Rail",
  "Divider",
  "Spacer",
]);

function isVisibleContentNode(node: UINode) {
  return !structuralNodeTypes.has(node.type);
}

function cacheKey(prompt: string) {
  return prompt.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

function readCache(key: string) {
  const value = cache.get(key);
  if (!value || value.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function writeCache(
  key: string,
  value: Omit<NonNullable<ReturnType<typeof readCache>>, "expiresAt">,
  ttlMs = cacheTtlMs,
) {
  cache.set(key, { ...value, expiresAt: Date.now() + ttlMs });
  while (cache.size > 32) {
    const oldest = cache.keys().next().value;
    if (typeof oldest !== "string") break;
    cache.delete(oldest);
  }
}

function readGroundingCache(key: string) {
  const value = groundingCache.get(key);
  if (!value || value.expiresAt <= Date.now()) {
    groundingCache.delete(key);
    return null;
  }
  groundingCache.delete(key);
  groundingCache.set(key, value);
  return value;
}

function writeGroundingCache(
  key: string,
  value: Omit<NonNullable<ReturnType<typeof readGroundingCache>>, "expiresAt">,
  ttlMs: number,
) {
  groundingCache.set(key, { ...value, expiresAt: Date.now() + ttlMs });
  while (groundingCache.size > 32) {
    const oldest = groundingCache.keys().next().value;
    if (typeof oldest !== "string") break;
    groundingCache.delete(oldest);
  }
}

function noStore<T>(body: T, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function GET() {
  return noStore({
    provider: "openai",
    configured: Boolean(process.env.OPENAI_API_KEY),
    defaultModel: "gpt-5.6-luna",
    medium: "ui-language-v4",
    transport: "a2ui",
    reconnectableRuns: true,
    webSearch: process.env.FIFY_WEB_SEARCH !== "0",
  });
}

function replayRunResponse(runId: string, afterSequence: number) {
  const encoder = new TextEncoder();
  const subscription = universalRunStore.subscribe(runId, afterSequence);
  const iterator = subscription[Symbol.asyncIterator]();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        void (async () => {
          try {
            while (true) {
              const result = await iterator.next();
              if (result.done) break;
              controller.enqueue(
                encoder.encode(`${JSON.stringify(result.value)}\n`),
              );
            }
            controller.close();
          } catch (error) {
            try {
              controller.error(error);
            } catch {
              // The browser may have disconnected while the run continues.
            }
          }
        })();
      },
      cancel() {
        void iterator.return?.();
      },
    }),
    {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store, no-transform",
        "x-accel-buffering": "no",
        "x-fify-run-id": runId,
      },
    },
  );
}

async function paintDelay() {
  await new Promise<void>((resolve) => setTimeout(resolve, 24));
}

function repairFeedback(error: PlannerProviderError) {
  return error.message
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

function publicReasoningSummary(value: string) {
  return value
    .replace(/[`*_#>]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_100);
}

function compactExperienceContext(experience: UIExperience) {
  const lines = [
    `Screen: ${experience.screen.title}`,
    `Goal: ${experience.goal}`,
  ];
  const seen = new Set(lines);
  for (const node of experience.nodes) {
    const copy = [node.title, node.text, node.label, node.value, node.meta]
      .map((value) => value.trim())
      .filter(Boolean);
    for (const item of node.items)
      copy.push(
        [item.label, item.value, item.detail]
          .map((value) => value.trim())
          .filter(Boolean)
          .join(" — "),
      );
    const line = copy.filter(Boolean).join(" · ");
    if (!line || seen.has(line)) continue;
    seen.add(line);
    lines.push(`${node.type}: ${line}`);
  }
  return lines.join("\n").slice(0, 4_000);
}

function generationUserInput(
  prompt: string,
  currentExperience: UIExperience | null,
  conversation: readonly string[],
  currentSurfaceId: string | null,
) {
  if (!currentExperience) return `Request: ${prompt}`;
  const surfaceInstruction = currentSurfaceId
    ? "Update the currently displayed response surface."
    : "Create a new assistant response for this conversation turn.";
  return `CURRENT USER REQUEST — answer this request, not an earlier one:
${prompt}

${surfaceInstruction}
The prior answer below is context only. Do not return, paraphrase, or preserve its interface unless the current request explicitly asks for the same information. When the user's job changes, choose a new representation and new graph structure. Preserve semantic IDs only for concepts that are genuinely unchanged.

Recent user requests:
${conversation.map((request) => `- ${request}`).join("\n") || "- None"}

Prior answer context:
${compactExperienceContext(currentExperience)}`;
}

export async function POST(request: NextRequest) {
  const browserKey = request.headers.get("x-openai-api-key")?.trim();
  const apiKey = browserKey || process.env.OPENAI_API_KEY;
  if (!apiKey)
    return noStore(
      {
        error: "No model credential is configured.",
        code: "MODEL_NOT_CONFIGURED",
      },
      428,
    );

  let body: {
    prompt?: unknown;
    currentExperience?: unknown;
    currentSurfaceId?: unknown;
    conversation?: unknown;
    runId?: unknown;
    afterSequence?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return noStore(
      {
        error: "The request body must be valid JSON.",
        code: "INVALID_REQUEST",
      },
      400,
    );
  }
  if (
    typeof body.prompt !== "string" ||
    body.prompt.trim().length < 3 ||
    body.prompt.length > 2_000
  ) {
    return noStore(
      {
        error: "Prompt must contain between 3 and 2,000 characters.",
        code: "INVALID_PROMPT",
      },
      400,
    );
  }
  let currentExperience: UIExperience | null = null;
  if (body.currentExperience != null) {
    const parsed = uiExperienceSchema.safeParse(body.currentExperience);
    if (!parsed.success)
      return noStore(
        {
          error: "The current UI experience is invalid.",
          code: "INVALID_CURRENT_EXPERIENCE",
        },
        400,
      );
    currentExperience = parsed.data;
  }
  const currentSurfaceId =
    typeof body.currentSurfaceId === "string" &&
    body.currentSurfaceId.length <= 160
      ? body.currentSurfaceId
      : null;
  if (body.currentSurfaceId != null && !currentSurfaceId)
    return noStore(
      {
        error: "The current surface ID is invalid.",
        code: "INVALID_CURRENT_SURFACE",
      },
      400,
    );
  if (currentSurfaceId && !currentExperience)
    return noStore(
      {
        error: "A current surface requires its validated experience.",
        code: "INVALID_CURRENT_SURFACE",
      },
      400,
    );

  const prompt = body.prompt.trim();
  const conversation = Array.isArray(body.conversation)
    ? body.conversation
        .filter((item): item is string => typeof item === "string")
        .slice(-4)
    : [];
  const evidenceRequest = resolveContextualEvidenceRequest(
    prompt,
    conversation,
  );
  const groundingPolicy = groundingPolicyForPrompt(evidenceRequest.prompt);
  const webSearchEnabled = process.env.FIFY_WEB_SEARCH !== "0";
  const runId =
    body.runId === undefined
      ? `run-${crypto.randomUUID()}`
      : typeof body.runId === "string" &&
          /^[a-zA-Z0-9_-]{8,100}$/.test(body.runId)
        ? body.runId
        : null;
  if (!runId)
    return noStore(
      { error: "A valid run ID is required.", code: "INVALID_RUN_ID" },
      400,
    );
  const afterSequence =
    body.afterSequence === undefined
      ? 0
      : Number.isInteger(body.afterSequence) &&
          Number(body.afterSequence) >= 0 &&
          Number(body.afterSequence) <= 10_000
        ? Number(body.afterSequence)
        : null;
  if (afterSequence === null)
    return noStore(
      {
        error: "The resume sequence is invalid.",
        code: "INVALID_RUN_CURSOR",
      },
      400,
    );
  const userInput = generationUserInput(
    prompt,
    currentExperience,
    conversation,
    currentSurfaceId,
  );
  const canCache = !browserKey && !currentExperience;
  const cached = canCache ? readCache(cacheKey(prompt)) : null;
  const fingerprint = JSON.stringify({
    prompt,
    currentResponseId: currentExperience?.responseId ?? null,
    currentSurfaceId,
    conversation,
  });
  const existingRun = universalRunStore.state(runId);
  if (afterSequence > 0 && !existingRun)
    return noStore(
      {
        error: "This run checkpoint has expired. Start a fresh run.",
        code: "RUN_EXPIRED",
      },
      410,
    );
  if (existingRun && afterSequence > existingRun.lastSequence)
    return noStore(
      {
        error: "The resume cursor is ahead of the stored run.",
        code: "RUN_CURSOR_AHEAD",
      },
      416,
    );
  const opened = universalRunStore.open(runId, fingerprint);
  if (opened.conflict)
    return noStore(
      {
        error: "This run ID belongs to a different request.",
        code: "RUN_ID_CONFLICT",
      },
      409,
    );
  if ("saturated" in opened && opened.saturated)
    return noStore(
      {
        error:
          "The generation service is at its active-run limit. Try again shortly.",
        code: "RUN_CAPACITY_REACHED",
      },
      503,
    );

  const execute = async (
    send: (frame: UniversalGenerationStreamPayload) => void,
  ) => {
    const startedAt = performance.now();
    const elapsed = () => Math.round(performance.now() - startedAt);
    const surfaceId = currentSurfaceId ?? `response-${crypto.randomUUID()}`;
    let firstSurfaceFrameMs = 0;
    let firstRepresentationFrameMs: number | null = null;
    let firstContentFrameMs: number | null = null;
    let lastVisibleFrameMs: number | null = null;
    let maxVisibleFrameGapMs = 0;
    const visibleContentNodeIds = new Set<string>();
    const recordRepresentationFrame = () => {
      if (firstRepresentationFrameMs === null)
        firstRepresentationFrameMs = elapsed();
      lastVisibleFrameMs = firstRepresentationFrameMs;
    };
    const recordContentFrame = (nodeId: string) => {
      if (visibleContentNodeIds.has(nodeId)) return;
      visibleContentNodeIds.add(nodeId);
      const now = elapsed();
      if (firstContentFrameMs === null) firstContentFrameMs = now;
      if (lastVisibleFrameMs !== null)
        maxVisibleFrameGapMs = Math.max(
          maxVisibleFrameGapMs,
          now - lastVisibleFrameMs,
        );
      lastVisibleFrameMs = now;
    };
    const streamingMeta = () => ({
      firstSurfaceFrameMs,
      firstRepresentationFrameMs,
      firstContentFrameMs,
      visibleContentFrames: visibleContentNodeIds.size,
      maxVisibleFrameGapMs,
    });
    send({
      type: "status",
      phase: "accepted",
      elapsedMs: elapsed(),
      state: "started",
    });
    if (!currentSurfaceId) {
      send({ type: "a2ui", message: createUILanguageStream(surfaceId) });
      firstSurfaceFrameMs = elapsed();
    }

    const complete = async (
      experience: UIExperience,
      meta: UniversalGenerationMeta,
    ) => {
      const progressSlots = [
        ...new Set(
          experience.nodes
            .filter(isVisibleContentNode)
            .map((node) => node.slot || node.id),
        ),
      ];
      const completedSlots = new Set<string>();
      send({
        type: "status",
        phase: "composing",
        elapsedMs: elapsed(),
        state: "started",
        completedUnits: 0,
        totalUnits: progressSlots.length,
        unit: "regions",
      });
      send({
        type: "a2ui",
        message: {
          version: "v1.0",
          updateDataModel: {
            surfaceId,
            path: "/screen",
            value: experience.screen,
          },
        },
      });
      recordRepresentationFrame();
      for (const node of experience.nodes) {
        send({ type: "a2ui", message: appendUILanguageNode(surfaceId, node) });
        if (isVisibleContentNode(node)) {
          recordContentFrame(node.id);
          const slotId = node.slot || node.id;
          if (!completedSlots.has(slotId)) {
            completedSlots.add(slotId);
            send({
              type: "status",
              phase: "composing",
              elapsedMs: elapsed(),
              state: "advanced",
              completedUnits: completedSlots.size,
              totalUnits: progressSlots.length,
              unit: "regions",
              activeSlotId: slotId,
            });
          }
        }
        await paintDelay();
      }
      send({
        type: "status",
        phase: "validating",
        elapsedMs: elapsed(),
        state: "started",
        completedUnits: completedSlots.size,
        totalUnits: progressSlots.length,
        unit: "regions",
      });
      send({
        type: "status",
        phase: "rendering",
        elapsedMs: elapsed(),
        state: "completed",
        completedUnits: progressSlots.length,
        totalUnits: progressSlots.length,
        unit: "regions",
      });
      for (const message of finalizeUILanguageStream(surfaceId, experience))
        send({ type: "a2ui", message });
      send({
        type: "complete",
        experience,
        meta: {
          ...meta,
          latencyMs: elapsed(),
          streaming: streamingMeta(),
        },
      });
    };

    if (cached) {
      await complete(cached.experience, {
        provider: "openai",
        ...cached.result,
        latencyMs: elapsed(),
        cached: true,
        timings: { routingMs: 0, compositionMs: 0, validationMs: 0 },
      });
      return;
    }

    send({
      type: "status",
      phase: "routing",
      elapsedMs: elapsed(),
      state: "started",
    });
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new DOMException("Timed out", "AbortError")),
      90_000,
    );
    let validationMs = 0;
    let routingMs = 0;
    let compositionMs = 0;
    let groundingMs = 0;
    let groundingInputTokens = 0;
    let groundingOutputTokens = 0;
    let groundingPacket: GroundingPacket | null = null;
    let groundingDegraded = false;
    let groundingProviderId: string | null = null;
    let groundingProviderKind: EvidenceProviderKind | null = null;
    let groundingAttempts: EvidenceResolutionAttempt[] = [];
    let directionAttempts = 0;
    let compositionAttempts = 0;
    let semanticRepairs = 0;
    let repairInputTokens = 0;
    let repairOutputTokens = 0;
    let directionRepairFeedback = "";
    let compositionRepairFeedback = "";
    let direction: {
      value: UXDecisionBrief;
      responseId: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
    } | null = null;
    let decision: UXDecisionBrief | null = null;
    let policyReport: UXDecisionPolicyReport = {
      visibleContentNodes: 0,
      prunedContentNodes: 0,
      visibleCopyCharacters: 0,
      truncatedItemCount: 0,
    };
    try {
      const shouldGround = groundingPolicy.mode !== "none";
      const groundingStarted = performance.now();
      const groundingPromise = shouldGround
        ? (async () => {
            send({
              type: "status",
              phase: "grounding",
              elapsedMs: elapsed(),
              state: "started",
            });
            const key = cacheKey(evidenceRequest.prompt);
            const cachedGrounding = !browserKey
              ? readGroundingCache(key)
              : null;
            if (cachedGrounding) {
              groundingInputTokens = cachedGrounding.inputTokens;
              groundingOutputTokens = cachedGrounding.outputTokens;
              groundingProviderId = cachedGrounding.providerId;
              groundingProviderKind = cachedGrounding.providerKind;
              groundingAttempts = cachedGrounding.attempts;
              return cachedGrounding.packet;
            }
            try {
              const providers: EvidenceProvider[] = [
                createOpenMeteoEvidenceProvider(fetch),
              ];
              if (webSearchEnabled)
                providers.push({
                  id: "openai-web-search",
                  kind: "web-search",
                  capabilities: ["general"],
                  resolve: async ({ prompt: request, signal }) => {
                    const grounded = await generateOpenAIStructuredPlan({
                      apiKey,
                      model:
                        process.env.FIFY_SEARCH_MODEL ||
                        process.env.FIFY_PLANNER_MODEL ||
                        "gpt-5.6-luna",
                      instructions: buildWebGroundingInstructions(),
                      userInput: `Current user request: ${request}`,
                      schemaName: "fify_web_grounding_v1",
                      jsonSchema:
                        webGroundingDraftJsonSchema as unknown as Record<
                          string,
                          unknown
                        >,
                      parse: (value) => webGroundingDraftSchema.parse(value),
                      ...(signal ? { signal } : {}),
                      maxOutputTokens: 3_200,
                      reasoningEffort: "low",
                      maxAttempts: 2,
                      retryBaseDelayMs: 120,
                      webSearch: { toolChoice: "required", maxToolCalls: 1 },
                    });
                    return {
                      packet: finalizeWebGrounding(
                        request,
                        grounded.value,
                        grounded.webSearch?.sources ?? [],
                        grounded.webSearch?.toolCalls ?? 0,
                      ),
                      inputTokens: grounded.inputTokens,
                      outputTokens: grounded.outputTokens,
                    };
                  },
                });
              const resolution = await resolveEvidence({
                prompt: evidenceRequest.prompt,
                mode:
                  groundingPolicy.mode === "required" ? "required" : "helpful",
                providers,
                signal: controller.signal,
                maxAgeMs: groundingPolicy.ttlMs,
              });
              groundingInputTokens = resolution.inputTokens;
              groundingOutputTokens = resolution.outputTokens;
              groundingProviderId = resolution.providerId;
              groundingProviderKind = resolution.providerKind;
              groundingAttempts = resolution.attempts;
              groundingDegraded = resolution.degraded;
              const packet = resolution.packet;
              if (
                !browserKey &&
                packet &&
                groundingProviderId &&
                groundingProviderKind
              )
                writeGroundingCache(
                  key,
                  {
                    packet,
                    inputTokens: resolution.inputTokens,
                    outputTokens: resolution.outputTokens,
                    providerId: groundingProviderId,
                    providerKind: groundingProviderKind,
                    attempts: resolution.attempts,
                  },
                  groundingPolicy.ttlMs,
                );
              return packet;
            } catch (error) {
              if (!groundingPolicy.failClosed) {
                groundingDegraded = true;
                return null;
              }
              if (error instanceof PlannerProviderError) throw error;
              throw new PlannerProviderError(
                "Current information could not be verified from the available sources. Please try again.",
                "invalid_output",
                502,
              );
            }
          })()
        : Promise.resolve(null);
      void groundingPromise.catch(() => undefined);
      const routingStarted = performance.now();
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        directionAttempts = attempt;
        try {
          direction = await generateOpenAIStructuredPlan({
            apiKey,
            model: process.env.FIFY_PLANNER_MODEL || "gpt-5.6-luna",
            instructions: `${buildUXDirectorInstructions()}${attempt > 1 ? `\n\nREPAIR ATTEMPT: The previous decision failed strict semantic validation. Return a fresh, complete decision brief that obeys every schema and decision invariant. Trusted validator feedback: ${directionRepairFeedback}` : ""}`,
            userInput,
            schemaName: "fify_ux_decision_brief_v1",
            jsonSchema: uxDecisionBriefJsonSchema as unknown as Record<
              string,
              unknown
            >,
            parse: (value) => repairUXDecisionBrief(value, prompt),
            signal: controller.signal,
            maxOutputTokens: 1_600,
            reasoningEffort: "medium",
            maxAttempts: 2,
            retryBaseDelayMs: 120,
          });
          break;
        } catch (error) {
          if (
            error instanceof PlannerProviderError &&
            error.code === "invalid_output" &&
            error.usage
          ) {
            repairInputTokens += error.usage.inputTokens;
            repairOutputTokens += error.usage.outputTokens;
          }
          if (
            !(error instanceof PlannerProviderError) ||
            error.code !== "invalid_output" ||
            attempt >= 2
          )
            throw error;
          directionRepairFeedback = repairFeedback(error);
          semanticRepairs += 1;
          send({
            type: "status",
            phase: "repairing",
            elapsedMs: elapsed(),
            state: "started",
            attempt: attempt + 1,
          });
        }
      }
      if (!direction)
        throw new PlannerProviderError(
          "The UX decision could not be repaired.",
          "invalid_output",
          502,
        );
      routingMs = performance.now() - routingStarted;
      const selectedDirection = direction;
      const selectedDecision = selectedDirection.value;
      const visibleProgressSlots = [
        ...new Set(
          selectedDecision.contentObligations
            .filter((obligation) => obligation.priority !== "deferred")
            .map((obligation) => obligation.slotId),
        ),
      ];
      const visibleProgressSlotSet = new Set(visibleProgressSlots);
      const draftedProgressSlots = new Set<string>();
      decision = selectedDecision;
      send({
        type: "a2ui",
        message: {
          version: "v1.0",
          updateDataModel: {
            surfaceId,
            path: "/decision",
            value: selectedDecision,
          },
        },
      });
      send({
        type: "a2ui",
        message: {
          version: "v1.0",
          updateDataModel: {
            surfaceId,
            path: "/representation",
            value: selectedDecision.representation,
          },
        },
      });
      for (const skeletonNode of createRepresentationSkeleton(
        selectedDecision.representation,
        visibleProgressSlots,
      ))
        send({
          type: "a2ui",
          message: appendUILanguageNode(surfaceId, skeletonNode),
        });
      recordRepresentationFrame();
      groundingPacket = await groundingPromise;
      groundingMs = shouldGround ? performance.now() - groundingStarted : 0;
      if (shouldGround)
        send({
          type: "status",
          phase: "grounding",
          elapsedMs: elapsed(),
          state: "completed",
        });
      const groundedUserInput = groundingPacket
        ? `${userInput}\n\n${groundingContextForComposer(groundingPacket)}`
        : groundingDegraded
          ? `${userInput}\n\nWeb retrieval was unavailable for this recommendation. Do not present volatile facts as current; visibly qualify any claim that may have changed.`
          : userInput;
      const compositionStarted = performance.now();
      let result: {
        value: UIExperience;
        responseId: string;
        model: string;
        inputTokens: number;
        outputTokens: number;
      } | null = null;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        compositionAttempts = attempt;
        draftedProgressSlots.clear();
        let screenSent = false;
        let processedNodeCount = 0;
        let streamedVisibleNodeCount = 0;
        let providerReasoningSummary = "";
        let lastPublishedReasoningSummary = "";
        send({
          type: "status",
          phase: "composing",
          elapsedMs: elapsed(),
          state: "started",
          completedUnits: 0,
          totalUnits: visibleProgressSlots.length,
          unit: "regions",
          attempt,
        });
        send({
          type: "a2ui",
          message: {
            version: "v1.0",
            updateDataModel: {
              surfaceId,
              path: "/generationAttempt",
              value: { attempt, state: "composing" },
            },
          },
        });
        try {
          result = await generateOpenAIStreamingStructuredPlan({
            apiKey,
            model: process.env.FIFY_PLANNER_MODEL || "gpt-5.6-luna",
            instructions: `${buildUILanguageInstructions()}\n\n${buildBlueprintCompositionInstructions(selectedDecision.representation)}\n\n${buildUXDecisionCompositionInstructions(selectedDecision)}${attempt > 1 ? `\n\nSEMANTIC REPAIR ATTEMPT: The previous graph failed final validation. Return a fresh, complete graph. Do not repeat the previous structure blindly; satisfy every graph, obligation, cardinality, media, and interaction invariant. Trusted validator feedback: ${compositionRepairFeedback}` : ""}`,
            userInput: groundedUserInput,
            schemaName: "fify_ui_experience_v4",
            jsonSchema: uiExperienceJsonSchema as unknown as Record<
              string,
              unknown
            >,
            parse: (value) => {
              if (providerReasoningSummary)
                send({
                  type: "activity",
                  id: `composition-reasoning-${attempt}`,
                  phase: "composing",
                  label: "Thought through the interface",
                  detail: providerReasoningSummary,
                  state: "complete",
                  source: "provider",
                  elapsedMs: elapsed(),
                });
              send({
                type: "status",
                phase: "validating",
                elapsedMs: elapsed(),
                state: "started",
                completedUnits: draftedProgressSlots.size,
                totalUnits: visibleProgressSlots.length,
                unit: "regions",
                attempt,
              });
              const validationStarted = performance.now();
              const authoredExperience = parseModelAuthoredUIExperience(
                value,
                selectedDecision.representation,
                prompt,
              );
              const applied = applyUXDecisionPolicy(
                authoredExperience,
                selectedDecision,
              );
              policyReport = applied.report;
              validationMs += performance.now() - validationStarted;
              return applied.experience;
            },
            reasoningSummary: "concise",
            onReasoningSummaryDelta: (_delta, accumulated) => {
              const summary = publicReasoningSummary(accumulated);
              if (!summary) return;
              providerReasoningSummary = summary;
              const meaningfulAdvance =
                summary.length - lastPublishedReasoningSummary.length >= 18 ||
                /[.!?]$/.test(summary);
              if (!meaningfulAdvance) return;
              lastPublishedReasoningSummary = summary;
              send({
                type: "activity",
                id: `composition-reasoning-${attempt}`,
                phase: "composing",
                label: "Thinking through the interface",
                detail: summary,
                state: "active",
                source: "provider",
                elapsedMs: elapsed(),
              });
            },
            onTextDelta: (_delta, accumulated) => {
              if (!screenSent) {
                const parsed = uiScreenSchema.safeParse(
                  extractCompleteJsonProperty(accumulated, "screen"),
                );
                if (parsed.success) {
                  screenSent = true;
                  send({
                    type: "a2ui",
                    message: {
                      version: "v1.0",
                      updateDataModel: {
                        surfaceId,
                        path: "/screen",
                        value: parsed.data,
                      },
                    },
                  });
                }
              }
              const available = extractCompleteJsonArrayItems(
                accumulated,
                "nodes",
              );
              while (processedNodeCount < available.length) {
                const parsed = uiModelNodeSchema.safeParse(
                  available[processedNodeCount],
                );
                if (!parsed.success) break;
                processedNodeCount += 1;
                let node = sanitizeModelAuthoredUINode(
                  compileModelAuthoredUINode(parsed.data),
                );
                if (
                  !shouldStreamNodeForUXDecision(
                    node,
                    selectedDecision,
                    streamedVisibleNodeCount,
                  )
                )
                  continue;
                if (
                  node.items.length >
                  selectedDecision.contentBudget.maxItemsPerNode
                )
                  node = {
                    ...node,
                    items: node.items.slice(
                      0,
                      selectedDecision.contentBudget.maxItemsPerNode,
                    ),
                  };
                if (isVisibleContentNode(node)) streamedVisibleNodeCount += 1;
                send({
                  type: "a2ui",
                  message: appendUILanguageNode(surfaceId, node),
                });
                if (isVisibleContentNode(node)) {
                  recordContentFrame(node.id);
                  if (
                    visibleProgressSlotSet.has(node.slot) &&
                    !draftedProgressSlots.has(node.slot)
                  ) {
                    draftedProgressSlots.add(node.slot);
                    send({
                      type: "status",
                      phase: "composing",
                      elapsedMs: elapsed(),
                      state: "advanced",
                      completedUnits: draftedProgressSlots.size,
                      totalUnits: visibleProgressSlots.length,
                      unit: "regions",
                      activeSlotId: node.slot,
                      attempt,
                    });
                  }
                }
              }
            },
            signal: controller.signal,
            maxOutputTokens: Math.min(
              4_500,
              1_400 + selectedDecision.contentBudget.maxVisibleNodes * 500,
            ),
            reasoningEffort:
              selectedDecision.latencyTier === "deep" ? "medium" : "low",
            maxAttempts: 3,
            retryBaseDelayMs: 120,
          });
          break;
        } catch (error) {
          if (
            error instanceof PlannerProviderError &&
            error.code === "invalid_output" &&
            error.usage
          ) {
            repairInputTokens += error.usage.inputTokens;
            repairOutputTokens += error.usage.outputTokens;
          }
          if (
            !(error instanceof PlannerProviderError) ||
            error.code !== "invalid_output" ||
            attempt >= 2
          )
            throw error;
          compositionRepairFeedback = repairFeedback(error);
          semanticRepairs += 1;
          send({
            type: "status",
            phase: "repairing",
            elapsedMs: elapsed(),
            state: "started",
            completedUnits: draftedProgressSlots.size,
            totalUnits: visibleProgressSlots.length,
            unit: "regions",
            attempt: attempt + 1,
          });
          send({
            type: "a2ui",
            message: {
              version: "v1.0",
              updateDataModel: {
                surfaceId,
                path: "/generationAttempt",
                value: { attempt: attempt + 1, state: "repairing" },
              },
            },
          });
          for (const skeletonNode of createRepresentationSkeleton(
            selectedDecision.representation,
            visibleProgressSlots,
          ))
            send({
              type: "a2ui",
              message: appendUILanguageNode(surfaceId, skeletonNode),
            });
        }
      }
      if (!result)
        throw new PlannerProviderError(
          "The UI graph could not be repaired.",
          "invalid_output",
          502,
        );
      compositionMs = performance.now() - compositionStarted;
      let experience = result.value;
      if (experience.nodes.some((node) => node.type === "Image")) {
        send({
          type: "status",
          phase: "media",
          elapsedMs: elapsed(),
          state: "started",
          completedUnits: draftedProgressSlots.size,
          totalUnits: visibleProgressSlots.length,
          unit: "regions",
        });
        experience = await enrichExperienceImages(experience, {
          signal: controller.signal,
          apiKey,
          onResolved: async (node) => {
            send({
              type: "a2ui",
              message: appendUILanguageNode(surfaceId, node),
            });
            await paintDelay();
          },
        });
      }
      if (groundingPacket) {
        experience = attachGroundingSources(experience, groundingPacket);
        send({
          type: "a2ui",
          message: {
            version: "v1.0",
            updateDataModel: {
              surfaceId,
              path: "/representation",
              value: experience.representation,
            },
          },
        });
        const sourcesNode = experience.nodes.find(
          (node) => node.type === "Sources",
        );
        if (sourcesNode)
          send({
            type: "a2ui",
            message: appendUILanguageNode(surfaceId, sourcesNode),
          });
      }
      if (canCache)
        writeCache(
          cacheKey(prompt),
          {
            experience,
            result: {
              model: result.model,
              responseId: result.responseId,
              inputTokens:
                repairInputTokens +
                groundingInputTokens +
                selectedDirection.inputTokens +
                result.inputTokens,
              outputTokens:
                repairOutputTokens +
                groundingOutputTokens +
                selectedDirection.outputTokens +
                result.outputTokens,
              grounding: {
                mode: groundingPolicy.mode,
                searched: Boolean(groundingPacket),
                degraded: groundingDegraded,
                providerId: groundingProviderId,
                providerKind: groundingProviderKind,
                fallbackUsed: groundingAttempts.some(
                  (attempt) => attempt.outcome === "failed",
                ),
                attempts: groundingAttempts,
                asOf: groundingPacket?.asOf ?? null,
                sourceCount: groundingPacket?.envelope.sources.length ?? 0,
                toolCalls: groundingPacket?.toolCalls ?? 0,
              },
              decision: {
                attentionMode: selectedDecision.attentionMode,
                disclosureStrategy: selectedDecision.disclosureStrategy,
                visibleObligations: selectedDecision.contentObligations.filter(
                  (obligation) => obligation.priority !== "deferred",
                ).length,
                deferredObligations: selectedDecision.contentObligations.filter(
                  (obligation) => obligation.priority === "deferred",
                ).length,
                maxVisibleNodes: selectedDecision.contentBudget.maxVisibleNodes,
              },
              policy: policyReport,
              recovery: {
                directionAttempts,
                compositionAttempts,
                semanticRepairs,
                fallbackUsed: false,
                repairInputTokens,
                repairOutputTokens,
              },
            },
          },
          groundingPolicy.mode === "none"
            ? cacheTtlMs
            : Math.min(cacheTtlMs, groundingPolicy.ttlMs),
        );
      send({
        type: "status",
        phase: "rendering",
        elapsedMs: elapsed(),
        state: "completed",
        completedUnits: visibleProgressSlots.length,
        totalUnits: visibleProgressSlots.length,
        unit: "regions",
      });
      for (const message of finalizeUILanguageStream(surfaceId, experience))
        send({ type: "a2ui", message });
      send({
        type: "complete",
        experience,
        meta: {
          provider: "openai",
          model: result.model,
          responseId: result.responseId,
          latencyMs: elapsed(),
          inputTokens:
            repairInputTokens +
            groundingInputTokens +
            selectedDirection.inputTokens +
            result.inputTokens,
          outputTokens:
            repairOutputTokens +
            groundingOutputTokens +
            selectedDirection.outputTokens +
            result.outputTokens,
          cached: false,
          timings: { routingMs, groundingMs, compositionMs, validationMs },
          grounding: {
            mode: groundingPolicy.mode,
            searched: Boolean(groundingPacket),
            degraded: groundingDegraded,
            providerId: groundingProviderId,
            providerKind: groundingProviderKind,
            fallbackUsed: groundingAttempts.some(
              (attempt) => attempt.outcome === "failed",
            ),
            attempts: groundingAttempts,
            asOf: groundingPacket?.asOf ?? null,
            sourceCount: groundingPacket?.envelope.sources.length ?? 0,
            toolCalls: groundingPacket?.toolCalls ?? 0,
          },
          decision: {
            attentionMode: selectedDecision.attentionMode,
            disclosureStrategy: selectedDecision.disclosureStrategy,
            visibleObligations: selectedDecision.contentObligations.filter(
              (obligation) => obligation.priority !== "deferred",
            ).length,
            deferredObligations: selectedDecision.contentObligations.filter(
              (obligation) => obligation.priority === "deferred",
            ).length,
            maxVisibleNodes: selectedDecision.contentBudget.maxVisibleNodes,
          },
          policy: policyReport,
          recovery: {
            directionAttempts,
            compositionAttempts,
            semanticRepairs,
            fallbackUsed: false,
            repairInputTokens,
            repairOutputTokens,
          },
          streaming: streamingMeta(),
        },
      });
    } catch (error) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      const provider = error instanceof PlannerProviderError ? error : null;
      if (
        currentExperience &&
        currentSurfaceId &&
        provider?.code === "invalid_output"
      ) {
        const fallbackDecision = decision
          ? {
              attentionMode: decision.attentionMode,
              disclosureStrategy: decision.disclosureStrategy,
              visibleObligations: decision.contentObligations.filter(
                (obligation) => obligation.priority !== "deferred",
              ).length,
              deferredObligations: decision.contentObligations.filter(
                (obligation) => obligation.priority === "deferred",
              ).length,
              maxVisibleNodes: decision.contentBudget.maxVisibleNodes,
            }
          : {
              attentionMode: "read" as const,
              disclosureStrategy: "none" as const,
              visibleObligations: 1,
              deferredObligations: 0,
              maxVisibleNodes: 4,
            };
        send({
          type: "status",
          phase: "repairing",
          elapsedMs: elapsed(),
          state: "started",
        });
        await complete(currentExperience, {
          provider: "openai",
          model:
            direction?.model ??
            process.env.FIFY_PLANNER_MODEL ??
            "gpt-5.6-luna",
          responseId: currentExperience.responseId,
          latencyMs: elapsed(),
          inputTokens: repairInputTokens + (direction?.inputTokens ?? 0),
          outputTokens: repairOutputTokens + (direction?.outputTokens ?? 0),
          cached: false,
          timings: { routingMs, compositionMs, validationMs },
          decision: fallbackDecision,
          policy: policyReport,
          recovery: {
            directionAttempts,
            compositionAttempts,
            semanticRepairs,
            fallbackUsed: true,
            repairInputTokens,
            repairOutputTokens,
          },
        });
        return;
      }
      send({
        type: "error",
        error: isAbort
          ? "The interface took too long to compose."
          : (provider?.message ??
            (error instanceof Error
              ? error.message
              : "The interface could not be generated.")),
        code:
          provider?.code.toUpperCase() ??
          (isAbort ? "MODEL_TIMEOUT" : "MODEL_REQUEST_FAILED"),
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  if (opened.created)
    void execute((frame) => universalRunStore.append(runId, frame))
      .catch((error) => {
        if (universalRunStore.state(runId)?.state !== "running") return;
        universalRunStore.append(runId, {
          type: "error",
          error:
            error instanceof Error
              ? error.message
              : "The interface run stopped unexpectedly.",
          code: "RUN_FAILED",
        });
      })
      .finally(() => universalRunStore.finish(runId));

  return replayRunResponse(runId, afterSequence);
}
