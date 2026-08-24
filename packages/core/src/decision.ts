import { z } from "zod";
import {
  informationShapeIds,
  representationPlanBaseSchema,
  repairRepresentationPlan,
  responseBlueprintRegistry,
  type InformationShape,
  type RepresentationPlan,
} from "./representation.js";

export const attentionModeSchema = z.enum([
  "glance",
  "read",
  "explore",
  "work",
]);
export const disclosureStrategySchema = z.enum([
  "none",
  "inline",
  "expandable",
  "drill-down",
]);
export const latencyTierSchema = z.enum(["instant", "standard", "deep"]);
export const contentPrioritySchema = z.enum([
  "primary",
  "supporting",
  "deferred",
]);

export const contentObligationSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(48)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    slotId: z
      .string()
      .min(1)
      .max(48)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    purpose: z.string().min(1).max(180),
    shape: z.enum(informationShapeIds),
    priority: contentPrioritySchema,
    mediaQuery: z.string().max(80),
    itemCount: z.number().int().min(2).max(50).nullable(),
  })
  .strict();

export const uxContentBudgetSchema = z
  .object({
    maxVisibleNodes: z.number().int().min(1).max(10),
    maxItemsPerNode: z.number().int().min(2).max(12),
    maxVisibleCopyCharacters: z.number().int().min(240).max(4_000),
  })
  .strict();

const uxDecisionBriefBaseSchema = z
  .object({
    version: z.literal("1.0"),
    userOutcome: z.string().min(1).max(180),
    primarySubject: z.string().max(80),
    audience: z.enum(["general", "informed", "expert"]),
    attentionMode: attentionModeSchema,
    disclosureStrategy: disclosureStrategySchema,
    latencyTier: latencyTierSchema,
    compositionIntent: z.string().min(1).max(180),
    confidence: z.number().min(0).max(1),
    representation: representationPlanBaseSchema,
    contentObligations: z.array(contentObligationSchema).min(1).max(8),
    contentBudget: uxContentBudgetSchema,
  })
  .strict();

export const uxDecisionBriefSchema = uxDecisionBriefBaseSchema.superRefine(
  (brief, context) => {
    const obligationIds = new Set<string>();
    let primaryCount = 0;
    brief.contentObligations.forEach((obligation, index) => {
      if (obligationIds.has(obligation.id))
        context.addIssue({
          code: "custom",
          path: ["contentObligations", index, "id"],
          message: `Duplicate obligation ID '${obligation.id}'.`,
        });
      obligationIds.add(obligation.id);
      if (obligation.priority === "primary") primaryCount += 1;
    });
    if (primaryCount !== 1)
      context.addIssue({
        code: "custom",
        path: ["contentObligations"],
        message:
          "A UX decision brief requires exactly one primary content obligation.",
      });
  },
);

export type AttentionMode = z.infer<typeof attentionModeSchema>;
export type ContentObligation = z.infer<typeof contentObligationSchema>;
export type UXDecisionBrief = z.infer<typeof uxDecisionBriefSchema>;

export const uxDecisionBriefJsonSchema = z.toJSONSchema(
  uxDecisionBriefBaseSchema,
);

const attentionBudgets: Readonly<
  Record<AttentionMode, UXDecisionBrief["contentBudget"]>
> = {
  glance: {
    maxVisibleNodes: 2,
    maxItemsPerNode: 5,
    maxVisibleCopyCharacters: 700,
  },
  read: {
    maxVisibleNodes: 4,
    maxItemsPerNode: 8,
    maxVisibleCopyCharacters: 1_400,
  },
  explore: {
    maxVisibleNodes: 6,
    maxItemsPerNode: 10,
    maxVisibleCopyCharacters: 2_200,
  },
  work: {
    maxVisibleNodes: 8,
    maxItemsPerNode: 12,
    maxVisibleCopyCharacters: 3_000,
  },
};

const scaleNodeCaps: Readonly<Record<RepresentationPlan["scale"], number>> = {
  atomic: 2,
  compact: 4,
  compound: 6,
  workflow: 8,
};

function uniqueId(base: string, used: Set<string>) {
  let id = base;
  let suffix = 2;
  while (used.has(id)) id = `${base}-${suffix++}`;
  used.add(id);
  return id;
}

const countWords: Readonly<Record<string, number>> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

/** Extracts an explicit collection size without mistaking ages or years for item counts. */
export function extractRequestedItemCount(input: string): number | null {
  const number =
    "(?:[2-9]|[1-4][0-9]|50|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
  const subject =
    "(?:ideas?|points?|reasons?|steps?|options?|choices?|examples?|facts?|items?|players?|recommendations?|tips?|takeaways?|candidates?|alternatives?|places?|venues?|offers?|restaurants?|books?|movies?|tools?|products?|entries?|days?)";
  const patterns = [
    new RegExp(`\\btop\\s+(?:the\\s+)?(${number})\\b`, "i"),
    new RegExp(`\\b(?:first|best)\\s+(${number})\\b`, "i"),
    new RegExp(
      `\\b(?:give|show|list|name|suggest|recommend|provide)\\s+(?:me\\s+)?(?:the\\s+)?(${number})\\b`,
      "i",
    ),
    new RegExp(
      `\\b(?:compare|between|choose\\s+between)\\s+(?:[a-z]+\\s+){0,3}(${number})\\b`,
      "i",
    ),
    new RegExp(`\\b(${number})\\s+(?:[a-z]+\\s+){0,2}${subject}\\b`, "i"),
  ];
  for (const pattern of patterns) {
    const value = pattern.exec(input)?.[1]?.toLocaleLowerCase("en");
    if (!value) continue;
    const count = countWords[value] ?? Number(value);
    if (Number.isInteger(count) && count >= 2 && count <= 50) return count;
  }
  return null;
}

/**
 * Repairs model-authored design judgment into a bounded, internally consistent brief.
 * The model may request less content than the policy allows, never more.
 */
export function repairUXDecisionBrief(
  input: unknown,
  requestText = "",
): UXDecisionBrief {
  const raw = uxDecisionBriefBaseSchema.parse(input);
  let representation = repairRepresentationPlan(raw.representation, requestText);
  const requestContext = `${requestText} ${raw.userOutcome} ${representation.userJob}`;
  const requestedItemCount = extractRequestedItemCount(requestContext);
  const isProfile =
    raw.representation.blueprintIds.includes("profile-reference") ||
    representation.blueprintIds.includes("profile-reference");
  const rejectsIdentityMedia =
    /\b(?:without|omit|exclude|no|do not include|don't include)\s+(?:an?\s+)?(?:image|photo|portrait|picture)\b/i.test(
      requestText,
    );
  const primarySubject =
    raw.primarySubject.trim() ||
    (isProfile
      ? raw.userOutcome
          .replace(
            /^(?:identify|understand|learn about|know|explain who|show who)\s+/i,
            "",
          )
          .replace(/[?.!]+$/, "")
          .trim()
          .slice(0, 80)
      : "");
  if (
    isProfile &&
    !rejectsIdentityMedia &&
    primarySubject &&
    !representation.slots.some((slot) => slot.shape === "media-artifact")
  ) {
    const portraitId = representation.slots.some(
      (slot) => slot.id === "portrait",
    )
      ? "identity-portrait"
      : "portrait";
    representation = repairRepresentationPlan({
      ...representation,
      informationShapes: [
        ...new Set([
          ...representation.informationShapes,
          "media-artifact" as const,
        ]),
      ].slice(0, 7),
      slots: [
        ...representation.slots.slice(0, 7),
        {
          id: portraitId,
          role: "portrait",
          shape: "media-artifact",
          priority: "optional",
          required: false,
        },
      ],
    });
  }
  const authoredObligations = raw.contentObligations.map((obligation) => ({
    ...obligation,
    itemCount:
      obligation.shape === "media-artifact" && obligation.mediaQuery.trim()
        ? null
        : obligation.itemCount,
  }));
  if (
    isProfile &&
    !rejectsIdentityMedia &&
    primarySubject &&
    !authoredObligations.some(
      (obligation) => obligation.shape === "media-artifact",
    )
  ) {
    const portraitSlot = representation.slots.find(
      (slot) => slot.shape === "media-artifact",
    );
    if (portraitSlot)
      authoredObligations.push({
        id: "identity-portrait",
        slotId: portraitSlot.id,
        purpose: `Make ${primarySubject} visually recognizable.`,
        shape: "media-artifact",
        priority: "supporting",
        mediaQuery: primarySubject,
        itemCount: null,
      });
  }
  if (isProfile) {
    for (const obligation of authoredObligations) {
      if (obligation.shape !== "media-artifact") continue;
      if (rejectsIdentityMedia) {
        obligation.priority = "deferred";
        continue;
      }
      obligation.priority = "supporting";
      if (!obligation.mediaQuery.trim() && primarySubject)
        obligation.mediaQuery = primarySubject;
    }
  }
  const requiresIdentityMedia =
    isProfile &&
    !rejectsIdentityMedia &&
    authoredObligations.some(
      (obligation) =>
        obligation.shape === "media-artifact" &&
        obligation.priority !== "deferred",
    );
  const isInteractiveTool =
    raw.representation.blueprintIds.includes("interactive-tool") ||
    representation.blueprintIds.includes("interactive-tool");
  const requestOnly = requestText.trim() || raw.userOutcome;
  const requiresSourceMaterial =
    /\b(?:turn|convert|summari[sz]e|analy[sz]e|extract)\b.*\b(?:this|these|the following|my)(?:\s+[a-z'-]+){0,2}\s+(?:notes?|text|data|document|transcript|content)\b/i.test(
      requestOnly,
    );
  const explicitInteractionIntent =
    isInteractiveTool ||
    requiresSourceMaterial ||
    /\b(?:interactive|calculator|estimate|input|select|filter|adjust|toggle|check\s*off|fill\s+in|let me|help me (?:choose|decide)|choose between|track(?:er|ing)?|manage|update)\b/i.test(
      requestOnly,
    );
  const explicitWorkflowIntent =
    representation.blueprintIds.some((id) =>
      ["workflow-action", "monitor-track"].includes(id),
    ) ||
    /\b(?:workflow|work items?|owned tasks?|assign|status|next actions?|checklist|tracker|tracking|manage|update)\b/i.test(
      requestOnly,
    );
  if (requiresSourceMaterial && representation.interactionLevel === "read")
    representation = { ...representation, interactionLevel: "edit" };
  else if (
    !explicitInteractionIntent &&
    !explicitWorkflowIntent &&
    representation.interactionLevel !== "read"
  )
    representation = { ...representation, interactionLevel: "read" };
  const authoredAttentionMode: AttentionMode =
    raw.attentionMode === "work" &&
    !isInteractiveTool &&
    !explicitWorkflowIntent
      ? representation.mode === "hybrid"
        ? "explore"
        : "read"
      : raw.attentionMode;
  const attentionMode: AttentionMode = isInteractiveTool
    ? "work"
    : requestedItemCount &&
        requestedItemCount >
          attentionBudgets[authoredAttentionMode].maxItemsPerNode &&
        authoredAttentionMode !== "explore"
      ? "explore"
      : requiresIdentityMedia && authoredAttentionMode === "glance"
        ? "read"
        : authoredAttentionMode;
  const attentionCap = attentionBudgets[attentionMode];
  const visibleObligationCount = authoredObligations.filter(
    (obligation) => obligation.priority !== "deferred",
  ).length;
  const minimumVisibleNodes = isInteractiveTool
    ? Math.max(5, visibleObligationCount + 1)
    : representation.interactionLevel !== "read"
      ? Math.max(3, visibleObligationCount + 1)
      : requiresIdentityMedia
        ? 3
        : 1;
  const sufficiencyCap = isInteractiveTool
    ? 5
    : requiresIdentityMedia
      ? 3
      : explicitWorkflowIntent
        ? 5
        : representation.mode === "hybrid"
          ? 3
          : representation.mode === "open"
            ? scaleNodeCaps[representation.scale]
            : { atomic: 2, compact: 3, compound: 4, workflow: 5 }[
                representation.scale
              ];
  const maxVisibleNodes = Math.max(
    minimumVisibleNodes,
    Math.min(
      raw.contentBudget.maxVisibleNodes,
      attentionCap.maxVisibleNodes,
      scaleNodeCaps[representation.scale],
      sufficiencyCap,
    ),
  );
  const contentBudget = {
    maxVisibleNodes,
    maxItemsPerNode: Math.min(
      raw.contentBudget.maxItemsPerNode,
      attentionCap.maxItemsPerNode,
    ),
    maxVisibleCopyCharacters: Math.max(
      isInteractiveTool ? 900 : requiresIdentityMedia ? 700 : 240,
      Math.min(
        raw.contentBudget.maxVisibleCopyCharacters,
        attentionCap.maxVisibleCopyCharacters,
      ),
    ),
  };
  const slotMap = new Map(representation.slots.map((slot) => [slot.id, slot]));
  let primarySlot =
    representation.slots.find((slot) => slot.priority === "primary") ??
    representation.slots[0]!;
  const usedIds = new Set<string>();
  const obligations = authoredObligations.map((obligation) => {
    const matchingSlot =
      slotMap.get(obligation.slotId) ??
      representation.slots.find((slot) => slot.shape === obligation.shape) ??
      primarySlot;
    return {
      ...obligation,
      id: uniqueId(obligation.id, usedIds),
      slotId: matchingSlot.id,
      shape: matchingSlot.shape,
    };
  });
  const aggregatableShapes = new Set<InformationShape>([
    "narrative",
    "facts",
    "record",
    "hierarchy",
    "sequence",
    "chronology",
    "comparison",
  ]);
  for (const obligation of obligations) {
    const sourceSlot = slotMap.get(obligation.slotId);
    if (
      !sourceSlot ||
      sourceSlot.required ||
      !aggregatableShapes.has(obligation.shape)
    )
      continue;
    const anchor = obligations.find((candidate) => {
      if (candidate === obligation || candidate.shape !== obligation.shape)
        return false;
      return slotMap.get(candidate.slotId)?.required === true;
    });
    if (anchor) obligation.slotId = anchor.slotId;
  }
  if (representation.mode !== "open") {
    const optionalRoleSignals: Readonly<Record<string, RegExp>> = {
      criteria: /\b(?:criteria|factors?|tradeoffs?|pros? and cons?)\b/i,
      evidence: /\b(?:evidence|data|proof|sources?|research)\b/i,
      constraints:
        /\b(?:constraints?|requirements?|budget|deadline|limits?)\b/i,
      selection: /\b(?:choose|select|decide|pick)\b/i,
      "next-action": /\b(?:next actions?|next steps?|what should I do)\b/i,
      preparation: /\b(?:prepar|pack|prerequisites?)\b/i,
      route: /\b(?:route|map|directions?|where)\b/i,
      schedule: /\b(?:schedule|itinerary|agenda|calendar|timeline|days?)\b/i,
      assumptions:
        /\b(?:assumptions?|how (?:is|was) .*calculated|calculation basis)\b/i,
      explanation: /\b(?:explain|how .*works?|why)\b/i,
    };
    for (const obligation of obligations) {
      if (obligation.priority === "primary") continue;
      const slot = slotMap.get(obligation.slotId);
      if (!slot || slot.required || obligation.shape === "media-artifact")
        continue;
      const roleSignal = optionalRoleSignals[slot.role];
      const ungroundedControl =
        obligation.shape === "choice-input" && !explicitInteractionIntent;
      const ungroundedAuxiliary =
        Boolean(roleSignal) && !roleSignal!.test(requestOnly);
      if (ungroundedControl || ungroundedAuxiliary)
        obligation.priority = "deferred";
    }
  }
  if (requestedItemCount) {
    const repeatedShapes = new Set<InformationShape>([
      "facts",
      "record",
      "hierarchy",
      "sequence",
      "chronology",
      "comparison",
      "tasks-progress",
    ]);
    const preferredRoles = /\b(?:top|rank(?:ed|ing)?)\b/i.test(requestContext)
      ? ["collection"]
      : /\b(?:compare|versus|shortlist(?:ed)?|alternatives?|options?|choices?)\b/i.test(
            requestContext,
          )
        ? ["alternatives", "collection"]
        : /\b(?:milestones?|chronolog(?:y|ical)|history)\b/i.test(
              requestContext,
            )
          ? ["chronology", "schedule"]
          : /\b(?:days?|itinerary|trip)\b/i.test(requestContext)
            ? ["schedule", "plan"]
            : /\b(?:reasons?|ideas?|points?|facts?|tips?|takeaways?)\b/i.test(
                  requestContext,
                )
              ? ["explanation", "findings", "evidence", "collection"]
              : [];
    const preferred = obligations.findIndex((obligation) =>
      preferredRoles.includes(slotMap.get(obligation.slotId)?.role ?? ""),
    );
    const authoredExact = obligations.findIndex(
      (obligation) =>
        obligation.itemCount !== null && repeatedShapes.has(obligation.shape),
    );
    const repeated = obligations.findIndex((obligation) =>
      repeatedShapes.has(obligation.shape),
    );
    const primary = obligations.findIndex(
      (obligation) => obligation.priority === "primary",
    );
    const targetIndex =
      preferred >= 0
        ? preferred
        : authoredExact >= 0
          ? authoredExact
          : repeated >= 0
            ? repeated
            : primary;
    obligations.forEach((obligation, index) => {
      obligation.itemCount = index === targetIndex ? requestedItemCount : null;
    });
    if (
      targetIndex >= 0 &&
      /\b(?:top|rank(?:ed|ing)?)\b/i.test(requestContext)
    ) {
      const targetSlot = slotMap.get(obligations[targetIndex]!.slotId);
      if (targetSlot) targetSlot.role = "collection";
    }
  }
  const authoredPrimary = obligations.findIndex(
    (obligation) => obligation.priority === "primary",
  );
  const primaryIndex = authoredPrimary >= 0 ? authoredPrimary : 0;
  const authoredPrimarySlot = slotMap.get(obligations[primaryIndex]!.slotId);
  if (authoredPrimarySlot) primarySlot = authoredPrimarySlot;
  obligations.forEach((obligation, index) => {
    obligation.priority =
      index === primaryIndex
        ? "primary"
        : obligation.priority === "primary"
          ? "supporting"
          : obligation.priority;
  });
  obligations[primaryIndex] = {
    ...obligations[primaryIndex]!,
    priority: "primary",
  };

  const rankedCollection =
    /\b(?:top|rank(?:ed|ing)?)\s+(?:the\s+)?\d{1,2}\b/i.test(requestContext);
  if (rankedCollection) {
    const redundantSlotIds = new Set(
      representation.slots
        .filter((slot) => slot.role === "featured" || slot.role === "details")
        .map((slot) => slot.id),
    );
    for (const obligation of obligations) {
      if (
        obligation.priority !== "primary" &&
        redundantSlotIds.has(obligation.slotId)
      )
        obligation.priority = "deferred";
    }
  }

  let visibleCount = 0;
  for (const obligation of obligations) {
    if (obligation.priority === "deferred") continue;
    visibleCount += 1;
    if (
      visibleCount > maxVisibleNodes &&
      obligation.priority !== "primary" &&
      obligation.itemCount === null &&
      obligation.shape !== "media-artifact"
    )
      obligation.priority = "deferred";
  }
  const visibleSlots = new Set(
    obligations
      .filter((obligation) => obligation.priority !== "deferred")
      .map((obligation) => obligation.slotId),
  );
  const normalizedSlots = representation.slots.map((slot) => ({
    ...slot,
    priority:
      slot.id === primarySlot.id
        ? ("primary" as const)
        : visibleSlots.has(slot.id)
          ? ("supporting" as const)
          : ("optional" as const),
    required: slot.id === primarySlot.id || visibleSlots.has(slot.id),
  }));
  const normalizedContentBudget = {
    ...contentBudget,
    maxVisibleNodes: Math.max(
      contentBudget.maxVisibleNodes,
      visibleSlots.size,
    ),
  };

  return uxDecisionBriefSchema.parse({
    ...raw,
    primarySubject,
    attentionMode,
    representation: { ...representation, slots: normalizedSlots },
    contentObligations: obligations,
    contentBudget: normalizedContentBudget,
  });
}

export function buildUXDirectorInstructions() {
  const registry = Object.values(responseBlueprintRegistry).map((entry) => ({
    id: entry.id,
    jobs: entry.jobs,
    requiredRoles: entry.requiredRoles,
    optionalRoles: entry.optionalRoles,
    allowedShapes: entry.allowedShapes,
    topologies: entry.topologies,
  }));
  return `You are the Fify UX director. Decide what an AI answer must communicate and how much interface it deserves before components are composed.

Return a UX decision brief, not the answer, UI copy, or components. The brief must make explicit what is primary, what supports it, and what should be deferred or omitted.

BLUEPRINT REGISTRY
${JSON.stringify(registry)}

DECISION RULES
1. Identify the user's concrete outcome, not merely the topic. Set primarySubject to the canonical name of the main real-world person, place, object, artwork, or product; otherwise use an empty string.
2. Use glance for focused facts and definitions, read for explanations, explore for collections/comparisons, and work for interactive tools or workflows.
3. Create the smallest sufficient set of content obligations. Exactly one is primary. Supporting obligations must materially improve comprehension or action. Mark nice-to-know content deferred.
4. Each obligation describes WHAT must be communicated, not the final wording or factual answer. Never author competing answer prose in this stage. Set mediaQuery to the canonical person, place, object, artwork, or product name for media-artifact obligations; otherwise use an empty string. Set itemCount to the exact requested collection size for “top N,” “three ideas,” and similar constraints; otherwise set it to null.
5. Use disclosure none when the complete useful answer is already compact. Use inline for short supporting context, expandable for optional depth, and drill-down for complex exploration.
6. Set conservative content budgets. A glance answer normally uses 1–2 visible content nodes; read 2–4; explore 3–6; work 3–8.
7. Use open-composition by default for read-only answers, profiles, explainers, recommendations, briefings, and analysis. Reserve canonical blueprints for procedures, schedules, decisions, monitoring, tools, and workflows where constraints materially improve correctness. Across a mixed workload, target roughly 60% open composition. Use hybrid only when two distinct user jobs are both necessary.
8. The representation has exactly one primary slot. Stable obligation slotId values must refer to declared representation slots, and obligation shape must match that slot.
9. Use read interaction unless selection, input, or action changes the usefulness of the answer. Every proposed interaction must have an honest outcome.
10. Named real-person identity requests include a media-artifact portrait obligation unless the user requests no image. Ranked “top N” prompts use explore-recommend rather than compare-decide unless a decision is requested.
11. Confidence measures decision fit, not factual certainty. Populate every schema field.`;
}

export function buildUXDecisionCompositionInstructions(input: UXDecisionBrief) {
  const brief = repairUXDecisionBrief(input);
  const visible = brief.contentObligations.filter(
    (obligation) => obligation.priority !== "deferred",
  );
  return `AUTHORITATIVE UX DECISION BRIEF
${JSON.stringify(brief)}

CONTENT CONTRACT
1. Directly answer the request. The primary obligation must become the first meaningful content in parent-first streaming order.
2. Render only the ${visible.length} visible obligations. Do not render deferred obligations, extra background sections, generic overviews, or a summary that repeats the primary answer.
3. Every content node must use the slotId of the obligation it fulfills. One well-designed node may fulfill multiple closely related obligations that share a slot. Every visible media-artifact obligation with a non-empty mediaQuery requires an Image node using that exact query. An obligation with itemCount must contain exactly that many meaningful entries; use a semantic repeated component instead of compressing entries into prose.
4. Use at most ${brief.contentBudget.maxVisibleNodes} visible content nodes and ${brief.contentBudget.maxItemsPerNode} items per node. Keep visible copy near ${brief.contentBudget.maxVisibleCopyCharacters} characters total.
5. The attention mode is ${brief.attentionMode}; the disclosure strategy is ${brief.disclosureStrategy}. Let those choices control density and visible depth.
6. The composition intent is: ${brief.compositionIntent}
7. Do not add clickable styling or controls unless the interaction works through a supported action. Read-only answers expose no prompt buttons.
8. Prefer typography, grouping, whitespace, and one strong information shape over repeated cards. The interface should feel edited, not exhaustively generated.
9. A complete ranked collection already contains its featured item. Do not repeat rank #1 in a separate feature, summary, or recommendation unless a visible obligation explicitly requires analysis of that item.`;
}

export function uxDecisionSummary(brief: UXDecisionBrief) {
  const visible = brief.contentObligations.filter(
    (obligation) => obligation.priority !== "deferred",
  ).length;
  const deferred = brief.contentObligations.length - visible;
  return `${brief.attentionMode} · ${visible} visible · ${deferred} deferred · ${brief.disclosureStrategy}`;
}

export function obligationForSlot(brief: UXDecisionBrief, slotId: string) {
  return brief.contentObligations.find(
    (obligation) =>
      obligation.slotId === slotId && obligation.priority !== "deferred",
  );
}

export function shapeForObligation(
  obligation: ContentObligation,
): InformationShape {
  return obligation.shape;
}
