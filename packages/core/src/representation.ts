import { z } from "zod";

export const informationShapeIds = [
  "narrative",
  "facts",
  "record",
  "metrics",
  "trend",
  "hierarchy",
  "sequence",
  "chronology",
  "comparison",
  "tasks-progress",
  "choice-input",
  "spatial",
  "media-artifact",
] as const;

export const responseBlueprintIds = [
  "direct-answer",
  "profile-reference",
  "explainer",
  "procedure",
  "compare-decide",
  "plan-schedule",
  "briefing",
  "analysis-evidence",
  "monitor-track",
  "explore-recommend",
  "interactive-tool",
  "workflow-action",
  "open-composition",
] as const;

export const layoutTopologyIds = [
  "editorial-stack",
  "focal-split",
  "responsive-grid",
  "horizontal-rail",
  "timeline-spine",
  "spatial-map",
  "form-result",
  "open-canvas",
] as const;

export const responseRoleIds = [
  "answer",
  "context",
  "evidence",
  "identity",
  "defining-facts",
  "portrait",
  "attributes",
  "chronology",
  "thesis",
  "explanation",
  "model",
  "example",
  "implication",
  "goal",
  "procedure",
  "prerequisites",
  "cautions",
  "completion",
  "recommendation",
  "alternatives",
  "criteria",
  "selection",
  "next-action",
  "plan",
  "schedule",
  "route",
  "preparation",
  "constraints",
  "headline",
  "findings",
  "implications",
  "decisions",
  "actions",
  "conclusion",
  "method",
  "trend",
  "breakdown",
  "caveat",
  "status",
  "progression",
  "alerts",
  "featured",
  "collection",
  "filters",
  "details",
  "inputs",
  "result",
  "assumptions",
  "work-items",
  "owners",
  "approval",
  "primary",
  "exploration",
  "action",
] as const;

export const representationModeSchema = z.enum(["blueprint", "hybrid", "open"]);
export const informationShapeSchema = z.enum(informationShapeIds);
export const responseBlueprintIdSchema = z.enum(responseBlueprintIds);
export const layoutTopologySchema = z.enum(layoutTopologyIds);
export const interactionLevelSchema = z.enum(["read", "select", "edit", "act"]);
export const responseScaleSchema = z.enum([
  "atomic",
  "compact",
  "compound",
  "workflow",
]);
export const responseRoleSchema = z.enum(responseRoleIds);

// InformationEnvelopeV1 permits up to eight grounded sections and four media
// records. Representation capacity must cover that full legal input surface.
export const maxRepresentationSlots = 12;

export const representationSlotSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(48)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    role: responseRoleSchema,
    shape: informationShapeSchema,
    priority: z.enum(["primary", "supporting", "optional"]),
    required: z.boolean(),
  })
  .strict();

export const representationPlanBaseSchema = z
  .object({
    version: z.literal("1.0"),
    mode: representationModeSchema,
    blueprintIds: z.array(responseBlueprintIdSchema).min(1).max(2),
    confidence: z.number().min(0).max(1),
    userJob: z.string().min(1).max(160),
    informationShapes: z.array(informationShapeSchema).min(1).max(7),
    interactionLevel: interactionLevelSchema,
    scale: responseScaleSchema,
    topology: layoutTopologySchema,
    noveltyBudget: z.number().min(0).max(1),
    slots: z
      .array(representationSlotSchema)
      .min(1)
      .max(maxRepresentationSlots),
  })
  .strict();

export const representationPlanSchema =
  representationPlanBaseSchema.superRefine((plan, context) => {
    const blueprintIds = new Set(plan.blueprintIds);
    if (blueprintIds.size !== plan.blueprintIds.length) {
      context.addIssue({
        code: "custom",
        path: ["blueprintIds"],
        message: "Blueprint IDs must be unique.",
      });
    }
    if (
      plan.mode === "blueprint" &&
      (plan.blueprintIds.length !== 1 ||
        plan.blueprintIds[0] === "open-composition")
    ) {
      context.addIssue({
        code: "custom",
        path: ["blueprintIds"],
        message: "Blueprint mode requires exactly one canonical blueprint.",
      });
    }
    if (
      plan.mode === "hybrid" &&
      (plan.blueprintIds.length !== 2 || blueprintIds.has("open-composition"))
    ) {
      context.addIssue({
        code: "custom",
        path: ["blueprintIds"],
        message: "Hybrid mode requires exactly two canonical blueprints.",
      });
    }
    if (
      plan.mode === "open" &&
      (plan.blueprintIds.length !== 1 ||
        plan.blueprintIds[0] !== "open-composition")
    ) {
      context.addIssue({
        code: "custom",
        path: ["blueprintIds"],
        message: "Open mode must route through open-composition.",
      });
    }
    if (plan.mode === "open" && plan.noveltyBudget < 0.5) {
      context.addIssue({
        code: "custom",
        path: ["noveltyBudget"],
        message: "Open composition requires a meaningful novelty budget.",
      });
    }
    if (plan.mode === "blueprint" && plan.noveltyBudget > 0.55) {
      context.addIssue({
        code: "custom",
        path: ["noveltyBudget"],
        message: "Strict blueprint mode cannot use a high novelty budget.",
      });
    }
    const shapes = new Set(plan.informationShapes);
    const slotIds = new Set<string>();
    let primaryCount = 0;
    plan.slots.forEach((slot, index) => {
      if (slotIds.has(slot.id))
        context.addIssue({
          code: "custom",
          path: ["slots", index, "id"],
          message: `Duplicate slot ID '${slot.id}'.`,
        });
      slotIds.add(slot.id);
      if (!shapes.has(slot.shape))
        context.addIssue({
          code: "custom",
          path: ["slots", index, "shape"],
          message: `Slot shape '${slot.shape}' is missing from informationShapes.`,
        });
      if (slot.priority === "primary") primaryCount += 1;
      if (slot.priority === "primary" && !slot.required)
        context.addIssue({
          code: "custom",
          path: ["slots", index, "required"],
          message: "The primary slot must be required.",
        });
      if (slot.required && slot.priority === "optional")
        context.addIssue({
          code: "custom",
          path: ["slots", index],
          message: "A required slot cannot have optional priority.",
        });
    });
    if (primaryCount !== 1)
      context.addIssue({
        code: "custom",
        path: ["slots"],
        message: "A representation plan requires exactly one primary slot.",
      });
  });

export type InformationShape = z.infer<typeof informationShapeSchema>;
export type ResponseBlueprintId = z.infer<typeof responseBlueprintIdSchema>;
export type LayoutTopology = z.infer<typeof layoutTopologySchema>;
export type RepresentationPlan = z.infer<typeof representationPlanSchema>;

export interface ResponseBlueprintDefinition {
  id: ResponseBlueprintId;
  label: string;
  jobs: readonly string[];
  requiredRoles: readonly string[];
  optionalRoles: readonly string[];
  allowedShapes: readonly InformationShape[];
  forbiddenComponents: readonly string[];
  topologies: readonly LayoutTopology[];
  minContentNodes: number;
  maxContentNodes: number;
  openSlots: number;
}

const blueprint = (definition: ResponseBlueprintDefinition) => definition;

export const responseBlueprintRegistry: Readonly<
  Record<ResponseBlueprintId, ResponseBlueprintDefinition>
> = {
  "direct-answer": blueprint({
    id: "direct-answer",
    label: "Direct answer",
    jobs: ["answer a focused question", "define, distinguish, or resolve"],
    requiredRoles: ["answer"],
    optionalRoles: ["context", "evidence"],
    allowedShapes: [
      "narrative",
      "facts",
      "record",
      "metrics",
      "comparison",
      "media-artifact",
    ],
    forbiddenComponents: ["Checklist", "Calendar"],
    topologies: ["editorial-stack", "focal-split"],
    minContentNodes: 1,
    maxContentNodes: 5,
    openSlots: 1,
  }),
  "profile-reference": blueprint({
    id: "profile-reference",
    label: "Profile or reference",
    jobs: ["identify a person, place, product, organism, artwork, or concept"],
    requiredRoles: ["identity", "defining-facts"],
    optionalRoles: ["portrait", "attributes", "chronology", "context"],
    allowedShapes: [
      "narrative",
      "facts",
      "record",
      "chronology",
      "media-artifact",
    ],
    forbiddenComponents: ["Checklist", "Progress", "Input"],
    topologies: ["focal-split", "editorial-stack", "responsive-grid"],
    minContentNodes: 2,
    maxContentNodes: 7,
    openSlots: 1,
  }),
  explainer: blueprint({
    id: "explainer",
    label: "Explainer",
    jobs: ["teach how or why something works"],
    requiredRoles: ["thesis", "explanation"],
    optionalRoles: ["model", "example", "evidence", "implication"],
    allowedShapes: [
      "narrative",
      "sequence",
      "facts",
      "hierarchy",
      "metrics",
      "trend",
      "comparison",
      "record",
      "media-artifact",
    ],
    forbiddenComponents: ["Checklist"],
    topologies: ["editorial-stack", "focal-split", "responsive-grid"],
    minContentNodes: 2,
    maxContentNodes: 8,
    openSlots: 2,
  }),
  procedure: blueprint({
    id: "procedure",
    label: "Procedure",
    jobs: ["complete a process", "follow instructions"],
    requiredRoles: ["goal", "procedure"],
    optionalRoles: ["prerequisites", "cautions", "completion"],
    allowedShapes: [
      "sequence",
      "tasks-progress",
      "facts",
      "record",
      "media-artifact",
    ],
    forbiddenComponents: ["Comparison", "Chart"],
    topologies: ["editorial-stack", "responsive-grid"],
    minContentNodes: 2,
    maxContentNodes: 8,
    openSlots: 1,
  }),
  "compare-decide": blueprint({
    id: "compare-decide",
    label: "Compare and decide",
    jobs: ["evaluate alternatives", "make a choice"],
    requiredRoles: ["recommendation", "alternatives"],
    optionalRoles: ["criteria", "evidence", "selection", "next-action"],
    allowedShapes: [
      "comparison",
      "record",
      "metrics",
      "trend",
      "choice-input",
      "narrative",
      "facts",
    ],
    forbiddenComponents: ["Timeline", "Checklist"],
    topologies: ["focal-split", "responsive-grid", "horizontal-rail"],
    minContentNodes: 2,
    maxContentNodes: 8,
    openSlots: 1,
  }),
  "plan-schedule": blueprint({
    id: "plan-schedule",
    label: "Plan and schedule",
    jobs: ["organize future activity", "build an itinerary"],
    requiredRoles: ["plan"],
    optionalRoles: [
      "schedule",
      "route",
      "preparation",
      "constraints",
      "next-action",
    ],
    allowedShapes: [
      "chronology",
      "spatial",
      "tasks-progress",
      "record",
      "facts",
      "choice-input",
    ],
    forbiddenComponents: ["Donut"],
    topologies: [
      "timeline-spine",
      "spatial-map",
      "editorial-stack",
      "responsive-grid",
    ],
    minContentNodes: 2,
    maxContentNodes: 10,
    openSlots: 2,
  }),
  briefing: blueprint({
    id: "briefing",
    label: "Briefing",
    jobs: [
      "understand a situation quickly",
      "summarize findings and implications",
    ],
    requiredRoles: ["headline", "findings"],
    optionalRoles: ["context", "implications", "decisions", "actions"],
    allowedShapes: [
      "facts",
      "record",
      "narrative",
      "metrics",
      "chronology",
      "tasks-progress",
      "sequence",
    ],
    forbiddenComponents: ["ChoiceGroup"],
    topologies: ["editorial-stack", "responsive-grid", "focal-split"],
    minContentNodes: 2,
    maxContentNodes: 8,
    openSlots: 1,
  }),
  "analysis-evidence": blueprint({
    id: "analysis-evidence",
    label: "Analysis and evidence",
    jobs: ["interpret evidence", "explain a pattern"],
    requiredRoles: ["conclusion", "evidence"],
    optionalRoles: ["method", "trend", "breakdown", "caveat"],
    allowedShapes: [
      "metrics",
      "trend",
      "record",
      "comparison",
      "narrative",
      "facts",
    ],
    forbiddenComponents: ["Checklist", "Calendar"],
    topologies: ["responsive-grid", "editorial-stack", "focal-split"],
    minContentNodes: 2,
    maxContentNodes: 9,
    openSlots: 1,
  }),
  "monitor-track": blueprint({
    id: "monitor-track",
    label: "Monitor and track",
    jobs: ["observe changing state", "track progress"],
    requiredRoles: ["status", "progression"],
    optionalRoles: ["trend", "breakdown", "alerts", "actions"],
    allowedShapes: [
      "metrics",
      "trend",
      "tasks-progress",
      "chronology",
      "record",
      "facts",
    ],
    forbiddenComponents: ["Quote"],
    topologies: ["responsive-grid", "horizontal-rail", "timeline-spine"],
    minContentNodes: 2,
    maxContentNodes: 10,
    openSlots: 1,
  }),
  "explore-recommend": blueprint({
    id: "explore-recommend",
    label: "Explore and recommend",
    jobs: ["browse possibilities", "discover recommendations"],
    requiredRoles: ["featured", "collection"],
    optionalRoles: ["filters", "comparison", "details"],
    allowedShapes: [
      "hierarchy",
      "media-artifact",
      "facts",
      "choice-input",
      "comparison",
      "record",
    ],
    forbiddenComponents: ["Timeline", "Progress"],
    topologies: ["horizontal-rail", "responsive-grid", "focal-split"],
    minContentNodes: 2,
    maxContentNodes: 10,
    openSlots: 2,
  }),
  "interactive-tool": blueprint({
    id: "interactive-tool",
    label: "Interactive tool",
    jobs: ["calculate", "configure", "estimate"],
    requiredRoles: ["inputs", "result"],
    optionalRoles: ["assumptions", "explanation", "next-action"],
    allowedShapes: ["choice-input", "metrics", "record", "narrative", "facts"],
    forbiddenComponents: ["Timeline", "Quote"],
    topologies: ["form-result", "focal-split", "editorial-stack"],
    minContentNodes: 3,
    maxContentNodes: 9,
    openSlots: 1,
  }),
  "workflow-action": blueprint({
    id: "workflow-action",
    label: "Workflow and action",
    jobs: ["manage work across states", "review and act"],
    requiredRoles: ["work-items", "status"],
    optionalRoles: ["owners", "filters", "approval", "actions"],
    allowedShapes: [
      "tasks-progress",
      "record",
      "choice-input",
      "metrics",
      "chronology",
      "sequence",
      "facts",
    ],
    forbiddenComponents: ["Quote"],
    topologies: ["responsive-grid", "form-result", "horizontal-rail"],
    minContentNodes: 3,
    maxContentNodes: 12,
    openSlots: 1,
  }),
  "open-composition": blueprint({
    id: "open-composition",
    label: "Open composition",
    jobs: ["handle novel, expressive, ambiguous, or metaphorical requests"],
    requiredRoles: [],
    optionalRoles: ["context", "evidence", "exploration", "action"],
    allowedShapes: [...informationShapeIds],
    forbiddenComponents: [],
    topologies: [...layoutTopologyIds],
    minContentNodes: 1,
    maxContentNodes: 12,
    openSlots: 5,
  }),
};

export const representationPlanJsonSchema = z.toJSONSchema(
  representationPlanBaseSchema,
);

export function buildRepresentationPlannerInstructions() {
  const registry = Object.values(responseBlueprintRegistry).map((entry) => ({
    id: entry.id,
    jobs: entry.jobs,
    requiredRoles: entry.requiredRoles,
    optionalRoles: entry.optionalRoles,
    allowedShapes: entry.allowedShapes,
    topologies: entry.topologies,
  }));
  return `You are the Fify representation architect. Decide how an AI answer should become an interface before any UI components are composed.

Return a compact representation plan, not UI and not prose. Classify the user's actual job, the semantic information shapes needed, the interaction level, response scale, and layout topology.

ROUTING MODES
- blueprint: reserve a canonical blueprint for jobs where its constraints materially improve correctness: procedures, schedules, decisions, monitoring, tools, and workflows. A recognizable topic alone is not enough. Confidence should normally be at least 0.72 and noveltyBudget at most 0.55.
- hybrid: exactly two canonical blueprints are both necessary for a coherent compound job. Do not use hybrid merely to add supporting content.
- open: this is the default for read-only answers, profiles, explainers, recommendations, briefings, and analysis where bespoke hierarchy improves comprehension. Also use it for novel, expressive, metaphorical, or intentionally creative requests. Across an ordinary mixed workload, approximately 60% of answers should use open composition. Open mode is a first-class path, not an error fallback; noveltyBudget must be at least 0.5.

INFORMATION SHAPES
${informationShapeIds.join(", ")}

BLUEPRINT REGISTRY
${JSON.stringify(registry)}

PLAN RULES
1. Prefer the smallest sufficient representation. A focused answer should not become a dashboard.
2. Create exactly one primary slot. Add only slots that materially help complete the user job.
3. Slot IDs are stable kebab-case semantics. Each slot shape must appear in informationShapes.
4. Use interactionLevel read unless the user genuinely needs to select, edit, or act.
5. Prefer open composition for read-only information unless a blueprint's structural constraints materially help. Do not route to a blueprint merely because its job label sounds related.
6. Select a topology supported by every selected canonical blueprint. For open mode, any topology is allowed.
7. Confidence measures blueprint fit, not factual certainty.
8. A named real-person identity request requires a media-artifact portrait slot unless the user explicitly asks for no image.
9. Every role listed in a selected blueprint's requiredRoles must have a slot with required=true. The single primary slot must also have required=true.
10. A ranked list or “top N” request is an explore-recommend collection, not compare-decide, unless the user explicitly asks to compare alternatives or make a choice.
11. Populate every field required by the schema.`;
}

export function representationPlanSummary(plan: RepresentationPlan) {
  return `${plan.mode}:${plan.blueprintIds.join("+")} · ${plan.topology} · ${plan.scale}`;
}

export function parseRepresentationPlan(input: unknown): RepresentationPlan {
  const plan = representationPlanSchema.parse(input);
  const definitions = plan.blueprintIds.map(
    (id) => responseBlueprintRegistry[id],
  );
  if (
    definitions.some(
      (definition) => !definition.topologies.includes(plan.topology),
    )
  ) {
    throw new Error(
      `Topology '${plan.topology}' is not supported by every selected blueprint.`,
    );
  }
  const allowedShapes = new Set(
    definitions.flatMap((definition) => [...definition.allowedShapes]),
  );
  const unsupportedShape = plan.informationShapes.find(
    (shape) => !allowedShapes.has(shape),
  );
  if (unsupportedShape)
    throw new Error(
      `Information shape '${unsupportedShape}' is not supported by the selected blueprint route.`,
    );
  const normalizeRole = (role: string) =>
    role
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, "-");
  const roles = new Set(plan.slots.map((slot) => normalizeRole(slot.role)));
  for (const definition of definitions) {
    for (const role of definition.requiredRoles) {
      if (!roles.has(normalizeRole(role)))
        throw new Error(
          `Blueprint '${definition.id}' requires the '${role}' slot.`,
        );
    }
  }
  const maxContentNodes = Math.min(
    12,
    definitions.reduce(
      (total, definition) => total + definition.maxContentNodes,
      0,
    ),
  );
  const estimatedSlots = plan.slots.filter((slot) => slot.required).length;
  if (estimatedSlots > maxContentNodes) {
    throw new Error(
      "The representation slot count is incompatible with the selected blueprint route.",
    );
  }
  return plan;
}

const requiredRoleShapePreference: Readonly<
  Record<string, readonly InformationShape[]>
> = {
  answer: ["narrative", "facts", "record"],
  identity: ["narrative", "record"],
  "defining-facts": ["facts", "record"],
  thesis: ["narrative"],
  explanation: ["narrative", "sequence", "facts"],
  goal: ["narrative", "record"],
  procedure: ["sequence", "tasks-progress"],
  recommendation: ["narrative", "record"],
  alternatives: ["comparison", "record"],
  plan: ["chronology", "tasks-progress", "record"],
  headline: ["narrative", "record"],
  findings: ["facts", "record"],
  conclusion: ["narrative", "record"],
  evidence: ["facts", "record", "metrics"],
  status: ["record", "metrics", "facts"],
  progression: ["tasks-progress", "trend", "chronology"],
  featured: ["record", "media-artifact", "facts"],
  collection: ["hierarchy", "record", "facts"],
  inputs: ["choice-input", "record"],
  result: ["metrics", "record", "narrative"],
  "work-items": ["tasks-progress", "record"],
  primary: ["narrative", "record", "facts"],
};

const openFirstBlueprints = new Set<ResponseBlueprintId>([
  "direct-answer",
  "profile-reference",
  "explainer",
  "explore-recommend",
  "briefing",
  "analysis-evidence",
]);

const explicitStructureRequest =
  /\b(?:as (?:a |an )?(?:table|timeline|checklist|calendar|dashboard|form)|use (?:a |an )?(?:table|timeline|checklist|calendar|dashboard|form)|step[- ]by[- ]step|compare (?:these|the following|between)|choose between|build (?:a |an )?(?:calculator|tracker|form)|interactive (?:tool|calculator|form))\b/i;

/**
 * Read-only information should normally be composed for the specific answer,
 * not forced through a recognizable template. Six of the twelve canonical
 * routes are open-first; workflow and decision grammars remain constrained.
 */
export function shouldPreferOpenComposition(
  plan: z.infer<typeof representationPlanBaseSchema>,
  requestText: string,
) {
  if (!requestText.trim() || plan.mode !== "blueprint") return false;
  const selected = [...new Set(plan.blueprintIds)].filter(
    (id): id is ResponseBlueprintId => id !== "open-composition",
  );
  return (
    selected.length === 1 &&
    openFirstBlueprints.has(selected[0]!) &&
    plan.interactionLevel === "read" &&
    !explicitStructureRequest.test(requestText)
  );
}

/** Repairs structurally valid model routing output at the semantic boundary. */
export function repairRepresentationPlan(
  input: unknown,
  requestText = "",
): RepresentationPlan {
  const raw = representationPlanBaseSchema.parse(input);
  const requestedBlueprintIds = [...new Set(raw.blueprintIds)];
  const promoteToOpen = shouldPreferOpenComposition(raw, requestText);
  const blueprintIds: ResponseBlueprintId[] =
    promoteToOpen ||
    raw.mode === "open" ||
    requestedBlueprintIds.includes("open-composition")
      ? ["open-composition"]
      : requestedBlueprintIds
          .filter((id) => id !== "open-composition")
          .slice(0, 2);
  if (!blueprintIds.length) blueprintIds.push("direct-answer");
  let definitions = blueprintIds.map((id) => responseBlueprintRegistry[id]);
  let commonTopologies = layoutTopologyIds.filter((topology) =>
    definitions.every((definition) => definition.topologies.includes(topology)),
  );
  if (!commonTopologies.length) {
    blueprintIds.splice(1);
    definitions = blueprintIds.map((id) => responseBlueprintRegistry[id]);
    commonTopologies = [...definitions[0]!.topologies];
  }
  const normalizedMode: RepresentationPlan["mode"] =
    blueprintIds[0] === "open-composition"
      ? "open"
      : blueprintIds.length === 2
        ? "hybrid"
        : "blueprint";
  const topology = commonTopologies.includes(raw.topology)
    ? raw.topology
    : commonTopologies[0]!;
  const allowedShapeList = [
    ...new Set(
      definitions.flatMap((definition) => [...definition.allowedShapes]),
    ),
  ];
  const allowedShapes = new Set(allowedShapeList);
  const requiredRoles =
    blueprintIds[0] === "open-composition"
      ? [
          raw.slots.find((slot) => slot.priority === "primary")?.role ??
            raw.slots[0]?.role ??
            "primary",
        ]
      : [
          ...new Set(
            definitions.flatMap((definition) => [
              ...definition.requiredRoles,
            ]),
          ),
        ];
  const normalizeRole = (role: string) =>
    role
      .toLowerCase()
      .trim()
      .replace(/[\s_]+/g, "-");
  const authoredPrimaryRole = normalizeRole(
    raw.slots.find((slot) => slot.priority === "primary")?.role ?? "",
  );
  const preferredShape = (role: string) =>
    requiredRoleShapePreference[normalizeRole(role)]?.find((candidate) =>
      allowedShapes.has(candidate),
    ) ??
    raw.informationShapes.find((candidate) => allowedShapes.has(candidate)) ??
    allowedShapeList[0] ??
    "narrative";
  const slots = raw.slots.map((slot) => {
    const rolePreferences =
      requiredRoleShapePreference[normalizeRole(slot.role)]?.filter(
        (candidate) => allowedShapes.has(candidate),
      ) ?? [];
    return {
      ...slot,
      shape:
        slot.shape === "media-artifact" && allowedShapes.has(slot.shape)
          ? slot.shape
          : rolePreferences.length && !rolePreferences.includes(slot.shape)
          ? rolePreferences[0]!
          : allowedShapes.has(slot.shape)
            ? slot.shape
            : preferredShape(slot.role),
    };
  });

  const missingRoleCount = () =>
    requiredRoles.filter(
      (role) =>
        !slots.some((slot) => normalizeRole(slot.role) === normalizeRole(role)),
    ).length;
  while (slots.length + missingRoleCount() > 8) {
    let optionalIndex = -1;
    for (let index = slots.length - 1; index >= 0; index -= 1) {
      if (!slots[index]?.required) {
        optionalIndex = index;
        break;
      }
    }
    if (optionalIndex < 0) break;
    slots.splice(optionalIndex, 1);
  }

  for (const role of requiredRoles) {
    const existing = slots.find(
      (slot) => normalizeRole(slot.role) === normalizeRole(role),
    );
    if (existing) {
      existing.required = true;
      existing.priority = "supporting";
      continue;
    }
    const shape = preferredShape(role);
    slots.push({
      id: role,
      role: role as RepresentationPlan["slots"][number]["role"],
      shape,
      priority: "supporting",
      required: true,
    });
  }

  const primaryRole = requiredRoles
    .map(normalizeRole)
    .includes(authoredPrimaryRole)
    ? authoredPrimaryRole
    : normalizeRole(requiredRoles[0] ?? slots[0]?.role ?? "primary");
  const requiredRoleSet = new Set(requiredRoles.map(normalizeRole));
  const claimedRequiredRoles = new Set<string>();
  for (const slot of slots) {
    const role = normalizeRole(slot.role);
    const isCanonicalRequired =
      requiredRoleSet.has(role) && !claimedRequiredRoles.has(role);
    slot.required = isCanonicalRequired;
    if (isCanonicalRequired) claimedRequiredRoles.add(role);
    if (role === primaryRole && isCanonicalRequired) {
      slot.priority = "primary";
      slot.required = true;
    } else if (slot.priority === "primary") {
      slot.priority = isCanonicalRequired ? "supporting" : "optional";
    } else if (isCanonicalRequired) {
      slot.priority = "supporting";
    }
  }

  const usedIds = new Set<string>();
  for (const slot of slots) {
    const baseId = slot.id;
    let candidate = baseId;
    let suffix = 2;
    while (usedIds.has(candidate)) candidate = `${baseId}-${suffix++}`;
    slot.id = candidate;
    usedIds.add(candidate);
  }

  const shapePalette: InformationShape[] = [];
  for (const slot of slots) {
    if (!shapePalette.includes(slot.shape) && shapePalette.length >= 7)
      slot.shape = shapePalette[0] ?? allowedShapeList[0] ?? "narrative";
    if (!shapePalette.includes(slot.shape)) shapePalette.push(slot.shape);
  }
  const informationShapes = [
    ...new Set([
      ...raw.informationShapes.filter((shape) => allowedShapes.has(shape)),
      ...shapePalette,
    ]),
  ].slice(0, 7);
  for (const slot of slots) {
    if (!informationShapes.includes(slot.shape))
      slot.shape = informationShapes[0] ?? allowedShapeList[0] ?? "narrative";
  }

  const noveltyBudget =
    normalizedMode === "open"
      ? Math.max(0.5, raw.noveltyBudget)
      : normalizedMode === "blueprint"
        ? Math.min(0.55, raw.noveltyBudget)
        : raw.noveltyBudget;
  return parseRepresentationPlan({
    ...raw,
    mode: normalizedMode,
    blueprintIds,
    topology,
    noveltyBudget,
    informationShapes,
    slots,
  });
}

export function buildBlueprintCompositionInstructions(
  input: RepresentationPlan,
) {
  const plan = parseRepresentationPlan(input);
  const definitions = plan.blueprintIds.map(
    (id) => responseBlueprintRegistry[id],
  );
  const constraints = definitions.map((definition) => ({
    id: definition.id,
    requiredRoles: definition.requiredRoles,
    optionalRoles: definition.optionalRoles,
    allowedShapes: definition.allowedShapes,
    forbiddenComponents: definition.forbiddenComponents,
    contentNodeRange: [definition.minContentNodes, definition.maxContentNodes],
    openSlots: definition.openSlots,
  }));
  const effectiveForbiddenComponents = (
    definitions[0]?.forbiddenComponents ?? []
  ).filter((component) =>
    definitions.every((definition) =>
      definition.forbiddenComponents.includes(component),
    ),
  );
  return `AUTHORITATIVE REPRESENTATION PLAN
${JSON.stringify(plan)}

SELECTED BLUEPRINT CONSTRAINTS
${JSON.stringify(constraints)}

EFFECTIVE ROUTE-WIDE FORBIDDEN COMPONENTS
${JSON.stringify(effectiveForbiddenComponents)}

COMPOSITION CONTRACT
1. Follow this representation plan. Do not change its mode, blueprints, topology, slots, or information-shape meanings.
2. Every content node must set slot to one declared slot ID. Structural Page, Stack, Row, Grid, and Rail nodes set slot to "".
3. Every required slot must receive at least one reachable content node. Optional slots may be omitted when they would add little value.
4. A node assigned to a slot must represent that slot's declared information shape. Layout wrappers do not change semantic shape.
5. In a hybrid route, a component forbidden by one blueprint remains available when it is needed by the other blueprint. Only EFFECTIVE ROUTE-WIDE FORBIDDEN COMPONENTS are globally prohibited.
6. The topology is ${plan.topology}. Express it using trusted layout primitives; it is a spatial grammar, not a fixed DOM template.
7. The novelty budget is ${plan.noveltyBudget}. In blueprint mode, vary hierarchy and visual rhythm inside the constraints. In hybrid mode, make one blueprint primary and the second a coherent region. In open mode, invent the composition while preserving slot semantics and interaction honesty.
8. The primary slot must become meaningful first in parent-first streaming order.
9. Before emitting, audit exact slot coverage: every required slot ID must appear on a content node whose component can express that slot's declared shape.
10. In hybrid mode, render at least one distinct, meaningful content region for each selected blueprint. Never let the comparison region stand in for the plan, the plan stand in for the decision, or one required job silently disappear.`;
}
