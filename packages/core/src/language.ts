import { z } from "zod";
import type { A2UIComponent, A2UIMessage } from "@fify/a2ui";
import {
  representationPlanSchema,
  responseBlueprintRegistry,
  type InformationShape,
  type RepresentationPlan,
} from "./representation.js";
import { repairUXDecisionBrief, type UXDecisionBrief } from "./decision.js";

export const uiNodeTypes = [
  "Page",
  "Stack",
  "Row",
  "Grid",
  "Rail",
  "Card",
  "Hero",
  "Image",
  "SectionHeader",
  "Text",
  "FactList",
  "Sources",
  "ColorPalette",
  "Badge",
  "Metric",
  "Chart",
  "Donut",
  "Timeline",
  "Comparison",
  "Checklist",
  "Steps",
  "Table",
  "Progress",
  "Callout",
  "Quote",
  "Button",
  "Input",
  "ChoiceGroup",
  "Tabs",
  "MapPanel",
  "Calendar",
  "CodeBlock",
  "Visual",
  "Divider",
  "Spacer",
] as const;

export const uiNodeTypeSchema = z.enum(uiNodeTypes);
export const uiToneSchema = z.enum([
  "neutral",
  "accent",
  "positive",
  "caution",
  "critical",
  "info",
]);
export const uiImportanceSchema = z.enum(["primary", "supporting", "quiet"]);
export const uiRelationshipSchema = z.enum([
  "standalone",
  "grouped",
  "continuation",
]);
export const uiMediaRoleSchema = z.enum([
  "none",
  "identity",
  "evidence",
  "illustration",
]);
export const uiVariantSchema = z.enum([
  "default",
  "plain",
  "soft",
  "solid",
  "outline",
  "elevated",
  "glass",
  "editorial",
  "split",
  "immersive",
  "compact",
  "featured",
  "horizontal",
  "vertical",
  "minimal",
  "dense",
  "visual",
  "portrait",
  "landscape",
  "square",
]);

export const uiNoneActionSchema = z
  .object({
    type: z.literal("none"),
    prompt: z.literal(""),
    targetId: z.literal(""),
    value: z.literal(""),
  })
  .strict();
export const uiPromptActionSchema = z
  .object({
    type: z.literal("prompt"),
    prompt: z.string().min(3).max(180),
    targetId: z.string().max(64),
    value: z.string().max(120),
  })
  .strict();
export const uiToggleActionSchema = z
  .object({
    type: z.literal("toggle"),
    prompt: z.literal(""),
    targetId: z.string().max(64),
    value: z.string().max(120),
  })
  .strict();
export const uiSelectActionSchema = z
  .object({
    type: z.literal("select"),
    prompt: z.literal(""),
    targetId: z.string().max(64),
    value: z.string().max(120),
  })
  .strict();
export const uiActionSchema = z.discriminatedUnion("type", [
  uiNoneActionSchema,
  uiPromptActionSchema,
  uiToggleActionSchema,
  uiSelectActionSchema,
]);

export const uiItemSchema = z
  .object({
    id: z.string().min(1).max(64),
    label: z.string().min(1).max(90),
    value: z.string().max(120),
    detail: z.string().max(2_048),
    tone: uiToneSchema,
    progress: z.number().min(0).max(100).nullable(),
  })
  .strict();

/**
 * One deliberately regular node shape keeps Structured Output streaming cheap.
 * Type-specific product rules are applied after syntactic validation.
 */
export const uiNodeSchema = z
  .object({
    id: z.string().min(1).max(64),
    type: uiNodeTypeSchema,
    slot: z.string().max(48),
    importance: uiImportanceSchema,
    relationship: uiRelationshipSchema,
    mediaRole: uiMediaRoleSchema,
    /** Runtime-only presentation fields. The v4 model schema cannot author these. */
    variant: uiVariantSchema,
    tone: uiToneSchema,
    title: z.string().max(110),
    text: z.string().max(500),
    label: z.string().max(80),
    value: z.string().max(2_048),
    meta: z.string().max(100),
    icon: z.string().max(12),
    span: z.enum(["full", "half", "third", "two-thirds"]),
    align: z.enum(["start", "center", "end", "between", "stretch"]),
    columns: z.number().int().min(1).max(4),
    gap: z.enum(["none", "tight", "normal", "loose"]),
    progress: z.number().min(0).max(100).nullable(),
    action: uiActionSchema,
    items: z.array(uiItemSchema).max(12),
    children: z.array(z.string().min(1).max(64)).max(16),
  })
  .strict();

export const uiScreenSchema = z
  .object({
    title: z.string().min(1).max(72),
    contextLabel: z.string().min(1).max(42),
  })
  .strict();

const uiExperienceBaseSchema = z
  .object({
    version: z.literal("4.0"),
    responseId: z.string().min(1).max(80),
    goal: z.string().min(1).max(160),
    representation: representationPlanSchema,
    screen: uiScreenSchema,
    nodes: z.array(uiNodeSchema).min(2).max(24),
    suggestions: z.array(z.string().min(1).max(110)).max(2),
  })
  .strict();

const modelIdentityFields = {
  id: z.string().min(1).max(64),
  slot: z.string().max(48),
  importance: uiImportanceSchema,
  relationship: uiRelationshipSchema,
  mediaRole: uiMediaRoleSchema,
};
const modelCopyFields = {
  title: z.string().max(110),
  text: z.string().max(500),
  label: z.string().max(80),
  value: z.string().max(2_048),
  meta: z.string().max(100),
};
const modelLayoutFields = {
  align: z.enum(["start", "center", "end", "between", "stretch"]),
  columns: z.number().int().min(1).max(4),
  gap: z.enum(["none", "tight", "normal", "loose"]),
  children: z.array(z.string().min(1).max(64)).max(16),
};
const modelItemSchema = z
  .object({
    id: z.string().min(1).max(64),
    label: z.string().min(1).max(90),
    value: z.string().max(120),
    detail: z.string().max(2_048),
    progress: z.number().min(0).max(100).nullable(),
  })
  .strict();
const modelCollectionFields = {
  items: z.array(modelItemSchema).min(2).max(12),
};
const modelPromptActionFields = { action: uiPromptActionSchema };
const modelSelectActionFields = { action: uiSelectActionSchema };
const modelToggleActionFields = { action: uiToggleActionSchema };
const modelComparisonActionFields = {
  action: z.discriminatedUnion("type", [
    uiNoneActionSchema,
    uiSelectActionSchema,
  ]),
};
const modelProgressFields = { progress: z.number().min(0).max(100).nullable() };
const modelNode = <
  T extends (typeof uiNodeTypes)[number],
  F extends z.ZodRawShape,
>(
  type: T,
  fields: F,
) =>
  z
    .object({ ...modelIdentityFields, type: z.literal(type), ...fields })
    .strict();

/** The model writes a discriminated, type-specific language; the runtime receives normalized trusted nodes. */
export const uiModelNodeSchema = z.discriminatedUnion("type", [
  modelNode("Page", modelLayoutFields),
  modelNode("Stack", modelLayoutFields),
  modelNode("Row", modelLayoutFields),
  modelNode("Grid", modelLayoutFields),
  modelNode("Rail", modelLayoutFields),
  modelNode("Card", { ...modelCopyFields, ...modelLayoutFields }),
  modelNode("Hero", modelCopyFields),
  modelNode("Image", {
    title: modelCopyFields.title,
    text: modelCopyFields.text,
    label: modelCopyFields.label,
  }),
  modelNode("SectionHeader", { ...modelCopyFields, ...modelLayoutFields }),
  modelNode("Text", modelCopyFields),
  modelNode("FactList", { ...modelCopyFields, ...modelCollectionFields }),
  modelNode("ColorPalette", {
    ...modelCopyFields,
    ...modelCollectionFields,
  }),
  modelNode("Badge", {
    label: modelCopyFields.label,
    value: modelCopyFields.value,
  }),
  modelNode("Metric", modelCopyFields),
  modelNode("Chart", { ...modelCopyFields, ...modelCollectionFields }),
  modelNode("Donut", { ...modelCopyFields, ...modelProgressFields }),
  modelNode("Timeline", { ...modelCopyFields, ...modelCollectionFields }),
  modelNode("Comparison", {
    ...modelCopyFields,
    title: z.string().min(1).max(110),
    ...modelCollectionFields,
    ...modelComparisonActionFields,
  }),
  modelNode("Checklist", {
    ...modelCopyFields,
    title: z.string().min(1).max(110),
    ...modelCollectionFields,
    ...modelToggleActionFields,
  }),
  modelNode("Steps", { ...modelCopyFields, ...modelCollectionFields }),
  modelNode("Table", { ...modelCopyFields, ...modelCollectionFields }),
  modelNode("Progress", { ...modelCopyFields, ...modelProgressFields }),
  modelNode("Callout", modelCopyFields),
  modelNode("Quote", modelCopyFields),
  modelNode("Button", {
    ...modelCopyFields,
    label: z.string().min(1).max(80),
    ...modelPromptActionFields,
  }),
  modelNode("Input", { ...modelCopyFields, label: z.string().min(1).max(80) }),
  modelNode("ChoiceGroup", {
    ...modelCopyFields,
    title: z.string().min(1).max(110),
    ...modelCollectionFields,
    ...modelSelectActionFields,
  }),
  modelNode("Tabs", {
    ...modelCopyFields,
    label: z.string().min(1).max(80),
    ...modelCollectionFields,
    ...modelSelectActionFields,
  }),
  modelNode("MapPanel", { ...modelCopyFields, ...modelCollectionFields }),
  modelNode("Calendar", { ...modelCopyFields, ...modelCollectionFields }),
  modelNode("CodeBlock", modelCopyFields),
  modelNode("Visual", modelCopyFields),
  modelNode("Divider", { label: modelCopyFields.label }),
  modelNode("Spacer", { value: modelCopyFields.value }),
]);

const uiModelExperienceBaseSchema = z
  .object({
    version: z.literal("4.0"),
    responseId: z.string().min(1).max(80),
    goal: z.string().min(1).max(160),
    screen: uiScreenSchema,
    nodes: z.array(uiModelNodeSchema).min(2).max(24),
    suggestions: z.array(z.string().min(1).max(110)).max(2),
  })
  .strict();

const leafTypes = new Set([
  "Image",
  "Text",
  "FactList",
  "Sources",
  "ColorPalette",
  "Badge",
  "Metric",
  "Donut",
  "Progress",
  "Callout",
  "Quote",
  "Button",
  "Input",
  "ChoiceGroup",
  "Tabs",
  "MapPanel",
  "Calendar",
  "CodeBlock",
  "Visual",
  "Divider",
  "Spacer",
]);
const itemTypes = new Set([
  "FactList",
  "ColorPalette",
  "Chart",
  "Timeline",
  "Comparison",
  "Checklist",
  "Steps",
  "Table",
  "ChoiceGroup",
  "Tabs",
  "MapPanel",
  "Calendar",
]);

function findCycle(
  nodes: ReadonlyMap<string, z.infer<typeof uiNodeSchema>>,
  nodeId: string,
  visiting: Set<string>,
  visited: Set<string>,
): string | null {
  if (visiting.has(nodeId)) return nodeId;
  if (visited.has(nodeId)) return null;
  visiting.add(nodeId);
  for (const child of nodes.get(nodeId)?.children ?? []) {
    const cycle = findCycle(nodes, child, visiting, visited);
    if (cycle) return cycle;
  }
  visiting.delete(nodeId);
  visited.add(nodeId);
  return null;
}

const structuralTypes = new Set(["Page", "Stack", "Row", "Grid", "Rail"]);
const decorativeTypes = new Set(["Divider", "Spacer"]);

function nodeShapes(node: z.infer<typeof uiNodeSchema>): InformationShape[] {
  const byType: Partial<Record<typeof node.type, InformationShape[]>> = {
    Hero: ["narrative"],
    Image: ["media-artifact"],
    SectionHeader: ["narrative"],
    Text: ["narrative"],
    FactList: ["facts"],
    Sources: ["facts"],
    ColorPalette: ["facts", "record", "comparison", "media-artifact"],
    Badge: ["facts"],
    Metric: ["metrics"],
    Chart: ["trend"],
    Donut: ["metrics", "trend"],
    Timeline: ["chronology"],
    Comparison: ["comparison"],
    Checklist: ["tasks-progress"],
    Steps: ["sequence"],
    Table: ["record"],
    Progress: ["tasks-progress", "metrics"],
    Callout: ["narrative", "facts"],
    Quote: ["narrative"],
    Button: ["choice-input"],
    Input: ["choice-input"],
    ChoiceGroup: ["choice-input"],
    Tabs: ["choice-input"],
    MapPanel: ["spatial"],
    Calendar: ["chronology", "tasks-progress"],
    CodeBlock: ["media-artifact"],
    Visual: ["media-artifact"],
    Card: ["hierarchy", "facts", "narrative"],
  };
  return byType[node.type] ?? [];
}

function safeRouteShapes(representation: RepresentationPlan) {
  return new Set<InformationShape>([
    ...representation.informationShapes,
    ...representation.blueprintIds.flatMap(
      (id) => responseBlueprintRegistry[id].allowedShapes,
    ),
  ]);
}

function validateRepresentationCompatibility(
  experience: z.infer<typeof uiExperienceBaseSchema>,
  context: z.RefinementCtx,
) {
  const slotMap = new Map(
    experience.representation.slots.map((slot) => [slot.id, slot]),
  );
  const routeShapes = safeRouteShapes(experience.representation);
  const fulfilled = new Set<string>();
  experience.nodes.forEach((node, index) => {
    if (structuralTypes.has(node.type)) {
      if (node.slot)
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "slot"],
          message: `${node.type} is structural and must use an empty slot.`,
        });
      return;
    }
    if (decorativeTypes.has(node.type)) return;
    const slot = slotMap.get(node.slot);
    if (!slot) {
      context.addIssue({
        code: "custom",
        path: ["nodes", index, "slot"],
        message: `Content node '${node.id}' must use a declared representation slot.`,
      });
      return;
    }
    fulfilled.add(slot.id);
    const supported = nodeShapes(node);
    if (node.type === "Image" && slot.shape !== "media-artifact") {
      context.addIssue({
        code: "custom",
        path: ["nodes", index, "slot"],
        message: "Image must use a media-artifact slot.",
      });
      return;
    }
    const isUniversalFallback =
      node.type === "Text" ||
      (node.type === "Button" && node.action.type === "prompt");
    if (
      !isUniversalFallback &&
      !supported.some((shape) => routeShapes.has(shape))
    )
      context.addIssue({
        code: "custom",
        path: ["nodes", index, "type"],
        message: `${node.type} does not represent any information shape declared by the route.`,
      });
  });
  for (const slot of experience.representation.slots) {
    if (slot.required && !fulfilled.has(slot.id))
      context.addIssue({
        code: "custom",
        path: ["representation", "slots"],
        message: `Required slot '${slot.id}' has no content node.`,
      });
  }
}

export const uiExperienceSchema = uiExperienceBaseSchema.superRefine(
  (experience, context) => {
    const nodeMap = new Map<string, z.infer<typeof uiNodeSchema>>();
    const allIds = new Set<string>();
    experience.nodes.forEach((node, index) => {
      if (allIds.has(node.id))
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "id"],
          message: `Duplicate UI ID '${node.id}'.`,
        });
      allIds.add(node.id);
      nodeMap.set(node.id, node);
      for (const item of node.items) {
        if (allIds.has(item.id))
          context.addIssue({
            code: "custom",
            path: ["nodes", index, "items"],
            message: `Duplicate UI ID '${item.id}'.`,
          });
        allIds.add(item.id);
      }
      if (leafTypes.has(node.type) && node.children.length) {
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "children"],
          message: `${node.type} cannot contain child nodes.`,
        });
      }
      if (itemTypes.has(node.type) && node.items.length < 2) {
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "items"],
          message: `${node.type} needs at least two items.`,
        });
      }
      if (node.type === "Page" && node.id !== "root") {
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "id"],
          message: "The Page node ID must be 'root'.",
        });
      }
      if (node.type === "Image" && (!node.label.trim() || !node.title.trim())) {
        context.addIssue({
          code: "custom",
          path: ["nodes", index],
          message:
            "Image nodes require a search query in label and accessible alt text in title.",
        });
      }
      if (
        node.type === "ColorPalette" &&
        node.items.some(
          (item) =>
            !/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(
              item.value.trim(),
            ),
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "items"],
          message:
            "ColorPalette item values must be visible CSS-safe hexadecimal colors.",
        });
      }
      if (node.type === "FactList" && node.action.type !== "none") {
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "action"],
          message: "FactList is descriptive and cannot have an action.",
        });
      }
      if (node.type === "ColorPalette" && node.action.type !== "none") {
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "action"],
          message: "ColorPalette is descriptive and cannot have an action.",
        });
      }
      if (node.type === "Checklist" && node.action.type !== "toggle") {
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "action"],
          message:
            "Checklist is only for user-completable tasks and requires a toggle action.",
        });
      }
      if (node.type === "Button" && node.action.type !== "prompt") {
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "action"],
          message: "Button must send a prompt to the AI.",
        });
      }
      if (
        (node.type === "ChoiceGroup" || node.type === "Tabs") &&
        node.action.type !== "select"
      ) {
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "action"],
          message: `${node.type} requires a select action.`,
        });
      }
      if (
        node.type === "Comparison" &&
        node.action.type !== "none" &&
        node.action.type !== "select"
      ) {
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "action"],
          message: "Comparison must be static or selectable.",
        });
      }
      if (node.action.type === "prompt" && !node.action.prompt) {
        context.addIssue({
          code: "custom",
          path: ["nodes", index, "action", "prompt"],
          message: "Prompt actions require prompt copy.",
        });
      }
    });

    const hasStatefulControl = experience.nodes.some(
      (node) =>
        node.type === "Input" ||
        node.type === "ChoiceGroup" ||
        node.type === "Tabs" ||
        (node.type === "Comparison" && node.action.type === "select"),
    );
    const hasAIContinuation = experience.nodes.some(
      (node) => node.type === "Button" && node.action.type === "prompt",
    );
    if (hasStatefulControl && !hasAIContinuation)
      context.addIssue({
        code: "custom",
        path: ["nodes"],
        message:
          "Stateful controls require one prompt Button that continues with the current interface state.",
      });

    const root = nodeMap.get("root");
    if (!root || root.type !== "Page" || experience.nodes[0]?.id !== "root") {
      context.addIssue({
        code: "custom",
        path: ["nodes"],
        message: "The first node must be the root Page.",
      });
      return;
    }
    if (experience.nodes.filter((node) => node.type === "Page").length !== 1) {
      context.addIssue({
        code: "custom",
        path: ["nodes"],
        message: "An experience must contain exactly one Page.",
      });
    }
    for (const node of experience.nodes) {
      for (const child of node.children) {
        if (!nodeMap.has(child))
          context.addIssue({
            code: "custom",
            path: ["nodes"],
            message: `Node '${node.id}' references missing child '${child}'.`,
          });
      }
    }
    const cycle = findCycle(nodeMap, "root", new Set(), new Set());
    if (cycle)
      context.addIssue({
        code: "custom",
        path: ["nodes"],
        message: `The UI graph contains a cycle at '${cycle}'.`,
      });
    const reachable = new Set<string>();
    const visit = (id: string) => {
      if (reachable.has(id)) return;
      reachable.add(id);
      for (const child of nodeMap.get(id)?.children ?? []) visit(child);
    };
    visit("root");
    const orphan = experience.nodes.find((node) => !reachable.has(node.id));
    if (orphan)
      context.addIssue({
        code: "custom",
        path: ["nodes"],
        message: `Node '${orphan.id}' is not reachable from root.`,
      });
    validateRepresentationCompatibility(experience, context);
  },
);

export type UINode = z.infer<typeof uiNodeSchema>;
export type UIExperience = z.infer<typeof uiExperienceSchema>;
export type UIItem = z.infer<typeof uiItemSchema>;

/** Strip fields that only the trusted media resolver is allowed to populate. */
export function sanitizeModelAuthoredUINode(input: UINode): UINode {
  if (input.type !== "Image") return input;
  return { ...input, value: "", meta: "", items: [] };
}

/** Validate model output after removing any attempted media URLs or attribution. */
export function compileModelAuthoredUINode(input: unknown): UINode {
  const authored = uiModelNodeSchema.parse(input) as Record<string, unknown>;
  const items = Array.isArray(authored.items)
    ? authored.items.map((item) => ({
        tone: "neutral",
        ...(item as Record<string, unknown>),
      }))
    : [];
  const mediaRole = authored.mediaRole as z.infer<typeof uiMediaRoleSchema>;
  return sanitizeModelAuthoredUINode(
    uiNodeSchema.parse({
      importance: "supporting",
      relationship: "standalone",
      mediaRole: "none",
      variant: mediaRole === "identity" ? "portrait" : "default",
      tone: "neutral",
      title: "",
      text: "",
      label: "",
      value: "",
      meta: "",
      icon: "",
      span: "full",
      align: "start",
      columns: 1,
      gap: "normal",
      progress: null,
      action: { type: "none", prompt: "", targetId: "", value: "" },
      children: [],
      ...authored,
      items,
    }),
  );
}

const genericMetaLabels =
  /^(at a glance|key facts?|overview|why it matters|the bottom line|quick take|in summary)$/i;

export interface UITasteReport {
  score: number;
  issues: readonly string[];
}

/** Deterministic editorial feedback used by tests, live evals, and future model feedback loops. */
export function evaluateUITaste(experience: UIExperience): UITasteReport {
  const content = experience.nodes.filter(
    (node) =>
      !structuralTypes.has(node.type) && !decorativeTypes.has(node.type),
  );
  const issues: string[] = [];
  const cards = content.filter((node) => node.type === "Card").length;
  const heroes = content.filter((node) => node.type === "Hero").length;
  const buttons = content.filter((node) => node.type === "Button").length;
  const labels = content.filter((node) =>
    genericMetaLabels.test(node.label.trim()),
  );
  const maximumCards = { atomic: 0, compact: 2, compound: 4, workflow: 6 }[
    experience.representation.scale
  ];
  if (experience.representation.scale === "atomic" && heroes)
    issues.push("Atomic answers must not use Hero.");
  if (cards > maximumCards)
    issues.push(
      `${experience.representation.scale} answers may use at most ${maximumCards} Card nodes.`,
    );
  if (labels.length)
    issues.push(
      "Generic meta headings should be removed or replaced with subject-specific copy.",
    );
  if (experience.representation.interactionLevel === "read" && buttons)
    issues.push("Read-only answers must not add prompt buttons.");
  const hasStatefulControl = content.some(
    (node) =>
      node.type === "Input" ||
      node.type === "ChoiceGroup" ||
      node.type === "Tabs" ||
      (node.type === "Comparison" && node.action.type === "select"),
  );
  if (hasStatefulControl && !buttons)
    issues.push("Stateful controls require an AI continuation action.");
  if (buttons > 1)
    issues.push("A response may expose at most one primary prompt action.");
  if (content.filter((node) => node.importance === "primary").length !== 1)
    issues.push("A response needs exactly one primary content element.");
  const textualColorValues = content.some(
    (node) =>
      node.type !== "ColorPalette" &&
      (node.items.some((item) => /^#[0-9a-f]{3,8}$/i.test(item.value.trim())) ||
        /^#[0-9a-f]{3,8}$/i.test(node.value.trim())),
  );
  if (textualColorValues)
    issues.push(
      "Color values must be encoded as visible ColorPalette swatches.",
    );
  return { score: Math.max(0, 100 - issues.length * 16), issues };
}

export function parseModelAuthoredUIExperience(
  input: unknown,
  representation: RepresentationPlan,
  requestText = representation.userJob,
): UIExperience {
  const authored = uiModelExperienceBaseSchema.parse(input);
  const slotMap = new Map(representation.slots.map((slot) => [slot.id, slot]));
  const compiled = authored.nodes
    .map(compileModelAuthoredUINode)
    .map((node) => ({
      ...node,
      label: genericMetaLabels.test(node.label.trim()) ? "" : node.label,
      type:
        representation.scale === "atomic" && node.type === "Hero"
          ? ("Text" as const)
          : node.type,
      children: leafTypes.has(node.type) ? [] : node.children,
      ...(node.type === "Image"
        ? {
            label:
              node.label.trim() ||
              node.title.trim() ||
              node.text.trim() ||
              "Relevant image",
            title:
              node.title.trim() ||
              node.label.trim() ||
              node.text.trim() ||
              "Relevant image",
          }
        : {}),
    }))
    .map((node) => {
      const slotShape = slotMap.get(node.slot)?.shape;
      if (slotShape === "chronology" && node.type === "Steps")
        return uiNodeSchema.parse({ ...node, type: "Timeline" });
      if (slotShape === "sequence" && node.type === "Timeline")
        return uiNodeSchema.parse({ ...node, type: "Steps" });
      return node;
    });
  const routeShapes = safeRouteShapes(representation);
  const blueprintForbidden = representation.blueprintIds.map(
    (id) => responseBlueprintRegistry[id].forbiddenComponents,
  );
  const forbidden = new Set(
    (blueprintForbidden[0] ?? []).filter((component) =>
      blueprintForbidden.every((list) => list.includes(component)),
    ),
  );
  const incompatibleIds = new Set(
    compiled
      .filter((node) => {
        if (structuralTypes.has(node.type) || decorativeTypes.has(node.type))
          return false;
        if (
          node.type === "Text" ||
          (node.type === "Button" && node.action.type === "prompt")
        )
          return false;
        if (
          node.type === "Image" &&
          slotMap.get(node.slot)?.shape !== "media-artifact"
        )
          return true;
        return (
          forbidden.has(node.type) ||
          !nodeShapes(node).some((shape) => routeShapes.has(shape))
        );
      })
      .map((node) => node.id),
  );
  const uniqueIds = new Set<string>();
  const compatible = compiled
    .filter((node) => {
      if (incompatibleIds.has(node.id) || uniqueIds.has(node.id)) return false;
      uniqueIds.add(node.id);
      return true;
    })
    .map((node) => ({
      ...node,
      children: node.children.flatMap((childId) =>
        incompatibleIds.has(childId)
          ? (compiled.find((candidate) => candidate.id === childId)?.children ??
            [])
          : [childId],
      ),
    }));
  if (
    !compatible.some(
      (node) =>
        !structuralTypes.has(node.type) && !decorativeTypes.has(node.type),
    )
  ) {
    const source = compiled.find(
      (node) =>
        !structuralTypes.has(node.type) && !decorativeTypes.has(node.type),
    );
    compatible.push(
      uiNodeSchema.parse({
        id: "answer",
        type: "Text",
        slot: "",
        importance: "primary",
        relationship: "standalone",
        mediaRole: "none",
        variant: "plain",
        tone: "neutral",
        title: source?.title || authored.screen.title,
        text:
          source?.text ||
          source?.items
            .map((item) => `${item.label}: ${item.detail || item.value}`)
            .join(" · ") ||
          authored.goal,
        label: "",
        value: "",
        meta: "",
        icon: "",
        span: "full",
        align: "start",
        columns: 1,
        gap: "normal",
        progress: null,
        action: { type: "none", prompt: "", targetId: "", value: "" },
        items: [],
        children: [],
      }),
    );
  }
  const primarySlot =
    representation.slots.find((slot) => slot.priority === "primary") ??
    representation.slots[0]!;
  const assigned = compatible.map((node) => {
    if (structuralTypes.has(node.type)) return { ...node, slot: "" };
    if (decorativeTypes.has(node.type)) return node;
    const shapes = nodeShapes(node);
    const authoredSlot = slotMap.get(node.slot);
    const isUniversalFallback =
      node.type === "Text" ||
      (node.type === "Button" && node.action.type === "prompt");
    const requiresRoleShape = authoredSlot?.role === "recommendation";
    if (
      authoredSlot &&
      (!requiresRoleShape ||
        isUniversalFallback ||
        shapes.includes(authoredSlot.shape))
    )
      return node;
    const matchingSlot =
      representation.slots.find((slot) => shapes.includes(slot.shape)) ??
      primarySlot;
    return { ...node, slot: matchingSlot.id };
  });
  const fulfilled = new Set(
    assigned
      .filter(
        (node) =>
          !structuralTypes.has(node.type) && !decorativeTypes.has(node.type),
      )
      .map((node) => node.slot),
  );
  if (!fulfilled.has(primarySlot.id)) {
    const primaryDonor = assigned.findIndex(
      (node) =>
        !structuralTypes.has(node.type) &&
        !decorativeTypes.has(node.type) &&
        (node.type === "Text" ||
          nodeShapes(node).includes(primarySlot.shape)) &&
        (!slotMap.get(node.slot)?.required ||
          assigned.filter((candidate) => candidate.slot === node.slot).length >
            1),
    );
    if (primaryDonor >= 0) {
      assigned[primaryDonor] = {
        ...assigned[primaryDonor]!,
        slot: primarySlot.id,
      };
      fulfilled.add(primarySlot.id);
    } else {
      const source = assigned.find(
        (node) =>
          !structuralTypes.has(node.type) && !decorativeTypes.has(node.type),
      );
      let summaryId = "primary-summary";
      let suffix = 2;
      while (assigned.some((node) => node.id === summaryId))
        summaryId = `primary-summary-${suffix++}`;
      assigned.push(
        uiNodeSchema.parse({
          id: summaryId,
          type: "Text",
          slot: primarySlot.id,
          importance: "primary",
          relationship: "standalone",
          mediaRole: "none",
          variant: "plain",
          tone: "neutral",
          title: source?.title || authored.screen.title,
          text:
            source?.text ||
            source?.items
              .slice(0, 2)
              .map((item) => item.label)
              .filter(Boolean)
              .join(" · ") ||
            authored.goal,
          label: "",
          value: "",
          meta: "",
          icon: "",
          span: "full",
          align: "start",
          columns: 1,
          gap: "normal",
          progress: null,
          action: { type: "none", prompt: "", targetId: "", value: "" },
          items: [],
          children: [],
        }),
      );
      fulfilled.add(primarySlot.id);
    }
  }
  for (const requiredSlot of representation.slots.filter(
    (slot) => slot.required && !fulfilled.has(slot.id),
  )) {
    const candidates = assigned
      .map((node, index) => ({ node, index }))
      .filter(
        ({ node }) =>
          !structuralTypes.has(node.type) &&
          !decorativeTypes.has(node.type) &&
          node.slot !== primarySlot.id &&
          (!slotMap.get(node.slot)?.required ||
            assigned.filter((candidate) => candidate.slot === node.slot)
              .length > 1),
      );
    const donorIndex =
      candidates.find(({ node }) =>
        nodeShapes(node).includes(requiredSlot.shape),
      )?.index ?? -1;
    if (donorIndex >= 0) {
      assigned[donorIndex] = {
        ...assigned[donorIndex]!,
        slot: requiredSlot.id,
      };
      fulfilled.add(requiredSlot.id);
    }
  }
  for (const mediaSlot of representation.slots.filter(
    (slot) =>
      slot.required &&
      slot.shape === "media-artifact" &&
      !fulfilled.has(slot.id),
  )) {
    const identityMedia =
      /(?:identity|person|portrait|profile)/i.test(mediaSlot.role) ||
      representation.blueprintIds.includes("profile-reference");
    const subject =
      requestText
        .replace(/^\s*(?:who|what)\s+(?:is|was|are)\s+/i, "")
        .replace(/\b(?:include|show|with|and keep)\b.*$/i, "")
        .replace(/[?.!]+\s*$/, "")
        .trim() || representation.userJob;
    let imageId = identityMedia ? "person-portrait" : "supporting-visual";
    let suffix = 2;
    while (assigned.some((node) => node.id === imageId))
      imageId = `${identityMedia ? "person-portrait" : "supporting-visual"}-${suffix++}`;
    assigned.push(
      uiNodeSchema.parse({
        id: imageId,
        type: "Image",
        slot: mediaSlot.id,
        importance: mediaSlot.priority === "primary" ? "primary" : "supporting",
        relationship: "grouped",
        mediaRole: identityMedia ? "identity" : "illustration",
        variant: identityMedia ? "portrait" : "default",
        tone: "neutral",
        title: identityMedia ? `Portrait of ${subject}` : subject,
        text: "",
        label: subject,
        value: "",
        meta: "",
        icon: "",
        span: "full",
        align: "start",
        columns: 1,
        gap: "normal",
        progress: null,
        action: { type: "none", prompt: "", targetId: "", value: "" },
        items: [],
        children: [],
      }),
    );
    fulfilled.add(mediaSlot.id);
  }
  const pageIndex = assigned.findIndex((node) => node.type === "Page");
  const rootSource =
    pageIndex >= 0
      ? assigned[pageIndex]!
      : uiNodeSchema.parse({
          id: "root",
          type: "Page",
          slot: "",
          importance: "supporting",
          relationship: "standalone",
          mediaRole: "none",
          variant: "default",
          tone: "neutral",
          title: "",
          text: "",
          label: "",
          value: "",
          meta: "",
          icon: "",
          span: "full",
          align: "start",
          columns: 1,
          gap: "normal",
          progress: null,
          action: { type: "none", prompt: "", targetId: "", value: "" },
          items: [],
          children: [],
        });
  const oldRootId = rootSource.id;
  const withoutExtraPages = assigned.filter(
    (node, index) => node.type !== "Page" || index === pageIndex,
  );
  const renamed = withoutExtraPages.map((node) => ({
    ...node,
    id: node === rootSource ? "root" : node.id,
    children: node.children.map((child) =>
      child === oldRootId ? "root" : child,
    ),
  }));
  if (pageIndex < 0) renamed.unshift(rootSource);
  const knownIds = new Set(renamed.map((node) => node.id));
  let graph = renamed.map((node) => ({
    ...node,
    children: [
      ...new Set(
        node.children.filter(
          (child) => knownIds.has(child) && child !== node.id,
        ),
      ),
    ],
  }));
  graph = [
    graph.find((node) => node.id === "root")!,
    ...graph.filter((node) => node.id !== "root"),
  ];
  const reachable = new Set<string>();
  const active = new Set<string>();
  const graphMap = new Map(graph.map((node) => [node.id, node]));
  const visit = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    active.add(id);
    const current = graphMap.get(id);
    if (current)
      current.children = current.children.filter((child) => {
        if (active.has(child)) return false;
        visit(child);
        return true;
      });
    active.delete(id);
  };
  visit("root");
  const root = graph[0]!;
  const orphanRoots = graph
    .filter((node) => node.id !== "root" && !reachable.has(node.id))
    .map((node) => node.id);
  for (const orphanId of orphanRoots) visit(orphanId);
  root.children = [...root.children, ...orphanRoots];
  const usedItemIds = new Set(graph.map((node) => node.id));
  graph = graph.map((node) => ({
    ...node,
    items: node.items.map((item) => {
      let id = item.id;
      let suffix = 2;
      while (usedItemIds.has(id)) id = `${item.id}-${suffix++}`;
      usedItemIds.add(id);
      return { ...item, id };
    }),
  }));
  const hasStatefulControls = graph.some(
    (node) =>
      node.type === "Input" ||
      node.type === "ChoiceGroup" ||
      node.type === "Tabs" ||
      (node.type === "Comparison" && node.action.type === "select"),
  );
  const hasAIContinuation = graph.some(
    (node) => node.type === "Button" && node.action.type === "prompt",
  );
  if (hasStatefulControls && !hasAIContinuation) {
    if (graph.length >= 24) {
      const contentPerSlot = new Map<string, number>();
      for (const node of graph)
        if (!structuralTypes.has(node.type) && !decorativeTypes.has(node.type))
          contentPerSlot.set(
            node.slot,
            (contentPerSlot.get(node.slot) ?? 0) + 1,
          );
      const stateful = (node: UINode) =>
        node.type === "Input" ||
        node.type === "ChoiceGroup" ||
        node.type === "Tabs" ||
        (node.type === "Comparison" && node.action.type === "select");
      const safeToRemove = (node: UINode) => {
        if (
          node.id === "root" ||
          stateful(node) ||
          node.type === "Button" ||
          node.importance === "primary"
        )
          return false;
        if (structuralTypes.has(node.type) || decorativeTypes.has(node.type))
          return true;
        const slot = slotMap.get(node.slot);
        return !slot?.required || (contentPerSlot.get(node.slot) ?? 0) > 1;
      };
      let removableIndex = -1;
      for (let index = graph.length - 1; index > 0; index -= 1)
        if (safeToRemove(graph[index]!)) {
          removableIndex = index;
          break;
        }
      if (removableIndex > 0) {
        const removed = graph[removableIndex]!;
        graph.splice(removableIndex, 1);
        graph = graph.map((node) => ({
          ...node,
          children: node.children.flatMap((child) =>
            child === removed.id ? removed.children : [child],
          ),
        }));
      }
    }
    if (graph.length < 24) {
      const actionId = graph.some((node) => node.id === "continue-with-inputs")
        ? "continue-with-inputs-2"
        : "continue-with-inputs";
      const actionSlot =
        representation.slots.find(
          (slot) =>
            slot.role === "next-action" ||
            slot.role === "action" ||
            slot.role === "selection",
        ) ?? primarySlot;
      const isCalculation =
        /\b(?:estimate|calculate|calculator|budget)\b/i.test(requestText);
      graph.push(
        uiNodeSchema.parse({
          id: actionId,
          type: "Button",
          slot: actionSlot.id,
          importance: "supporting",
          relationship: "continuation",
          mediaRole: "none",
          variant: "default",
          tone: "neutral",
          title: "",
          text: "",
          label: isCalculation
            ? "Calculate with these inputs"
            : "Continue with these choices",
          value: "",
          meta: "",
          icon: "",
          span: "full",
          align: "start",
          columns: 1,
          gap: "normal",
          progress: null,
          action: {
            type: "prompt",
            prompt: isCalculation
              ? `Calculate ${representation.userJob} using my current interface inputs.`
              : `Continue ${representation.userJob} using my current interface choices.`,
            targetId: "",
            value: "",
          },
          items: [],
          children: [],
        }),
      );
      graph[0] = { ...graph[0]!, children: [...graph[0]!.children, actionId] };
    }
  }
  const primarySlotIds = new Set(
    representation.slots
      .filter((slot) => slot.priority === "primary")
      .map((slot) => slot.id),
  );
  const primaryId =
    graph.find(
      (node) =>
        !structuralTypes.has(node.type) && primarySlotIds.has(node.slot),
    )?.id ??
    graph.find(
      (node) =>
        !structuralTypes.has(node.type) && !decorativeTypes.has(node.type),
    )?.id;
  const nodes = graph.map((node) => ({
    ...node,
    importance:
      structuralTypes.has(node.type) || decorativeTypes.has(node.type)
        ? ("supporting" as const)
        : node.id === primaryId
          ? ("primary" as const)
          : node.importance === "primary"
            ? ("supporting" as const)
            : node.importance,
  }));
  const requestedRankCount = /\btop\s+(\d{1,2})\b/i.exec(requestText)?.[1];
  if (requestedRankCount) {
    const expectedCount = Math.min(12, Number(requestedRankCount));
    const collectionSlotIds = new Set(
      representation.slots
        .filter((slot) => slot.role === "collection")
        .map((slot) => slot.id),
    );
    const representedCount = nodes
      .filter((candidate) => collectionSlotIds.has(candidate.slot))
      .reduce(
        (total, candidate) => total + Math.max(1, candidate.items.length),
        0,
      );
    if (representedCount < expectedCount) {
      throw new Error(
        `The ranked collection contains ${representedCount} of ${expectedCount} requested entries.`,
      );
    }
  }
  return uiExperienceSchema.parse({ ...authored, representation, nodes });
}

function nodeCopyCharacters(node: UINode) {
  return [
    node.title,
    node.text,
    node.label,
    node.value,
    node.meta,
    ...node.items.flatMap((item) => [item.label, item.value, item.detail]),
  ].reduce((total, value) => total + value.length, 0);
}

export function isUIContentNode(node: UINode) {
  return (
    !structuralTypes.has(node.type) &&
    !decorativeTypes.has(node.type) &&
    !(node.type === "Card" && node.children.length > 0)
  );
}

export interface UXDecisionPolicyReport {
  visibleContentNodes: number;
  prunedContentNodes: number;
  visibleCopyCharacters: number;
  truncatedItemCount: number;
}

/** Enforces subtraction and attention budgets after semantic graph repair. */
export function applyUXDecisionPolicy(
  input: UIExperience,
  decisionInput: UXDecisionBrief,
): { experience: UIExperience; report: UXDecisionPolicyReport } {
  let experience = uiExperienceSchema.parse(input);
  const decision = repairUXDecisionBrief(decisionInput);
  const visibleSlots = new Set(
    decision.contentObligations
      .filter((obligation) => obligation.priority !== "deferred")
      .map((obligation) => obligation.slotId),
  );
  const primarySlots = new Set(
    decision.contentObligations
      .filter((obligation) => obligation.priority === "primary")
      .map((obligation) => obligation.slotId),
  );
  const mediaObligation = decision.contentObligations.find(
    (obligation) =>
      obligation.priority !== "deferred" &&
      obligation.shape === "media-artifact" &&
      obligation.mediaQuery.trim(),
  );
  if (
    mediaObligation &&
    !experience.nodes.some(
      (candidate) =>
        candidate.type === "Image" && candidate.slot === mediaObligation.slotId,
    )
  ) {
    const usedIds = new Set(experience.nodes.map((candidate) => candidate.id));
    let imageId = "identity-image";
    let suffix = 2;
    while (usedIds.has(imageId)) imageId = `identity-image-${suffix++}`;
    const image = uiNodeSchema.parse({
      id: imageId,
      type: "Image",
      slot: mediaObligation.slotId,
      importance:
        mediaObligation.priority === "primary" ? "primary" : "supporting",
      relationship: "grouped",
      mediaRole: decision.representation.blueprintIds.includes(
        "profile-reference",
      )
        ? "identity"
        : "illustration",
      variant: decision.representation.blueprintIds.includes(
        "profile-reference",
      )
        ? "portrait"
        : "default",
      tone: "neutral",
      title: mediaObligation.mediaQuery,
      text: "",
      label: mediaObligation.mediaQuery,
      value: "",
      meta: "",
      icon: "",
      span: "full",
      align: "start",
      columns: 1,
      gap: "normal",
      progress: null,
      action: { type: "none", prompt: "", targetId: "", value: "" },
      items: [],
      children: [],
    });
    const nodes = experience.nodes.map((candidate) =>
      candidate.id === "root"
        ? { ...candidate, children: [imageId, ...candidate.children] }
        : candidate,
    );
    nodes.splice(1, 0, image);
    experience = uiExperienceSchema.parse({
      ...experience,
      representation: decision.representation,
      nodes,
    });
  }
  if (decision.representation.interactionLevel === "read") {
    experience = uiExperienceSchema.parse({
      ...experience,
      representation: decision.representation,
      nodes: experience.nodes.map((node) => {
        if (node.type === "ChoiceGroup" || node.type === "Tabs")
          return uiNodeSchema.parse({
            ...node,
            type: "FactList",
            action: { type: "none", prompt: "", targetId: "", value: "" },
          });
        if (node.type === "Comparison" && node.action.type === "select")
          return uiNodeSchema.parse({
            ...node,
            action: { type: "none", prompt: "", targetId: "", value: "" },
          });
        if (node.type === "Input")
          return uiNodeSchema.parse({
            ...node,
            type: "Text",
            text: node.text || node.label || node.title,
            action: { type: "none", prompt: "", targetId: "", value: "" },
          });
        return node;
      }),
    });
  }
  const existingStatefulControl = experience.nodes.find(
    (node) =>
      node.type === "Input" ||
      node.type === "ChoiceGroup" ||
      node.type === "Tabs" ||
      (node.type === "Comparison" && node.action.type === "select"),
  );
  const existingContinuation = experience.nodes.find(
    (node) => node.type === "Button" && node.action.type === "prompt",
  );
  if (
    decision.representation.interactionLevel === "edit" &&
    !existingStatefulControl
  ) {
    const usedIds = new Set(experience.nodes.map((candidate) => candidate.id));
    const uniqueId = (base: string) => {
      let id = base;
      let suffix = 2;
      while (usedIds.has(id)) id = `${base}-${suffix++}`;
      usedIds.add(id);
      return id;
    };
    const inputId = uniqueId("source-input");
    const buttonId = existingContinuation
      ? null
      : uniqueId("continue-with-inputs");
    const sourceMatch =
      /\b(meeting notes?|notes?|text|data|document|transcript|content)\b/i.exec(
        `${decision.userOutcome} ${decision.representation.userJob}`,
      )?.[1];
    const sourceLabel = sourceMatch
      ? sourceMatch.replace(/^./, (character) => character.toUpperCase())
      : "Source material";
    const inputSlot =
      decision.representation.slots.find((slot) =>
        ["inputs", "input", "source", "work-items"].includes(slot.role),
      ) ??
      decision.representation.slots.find(
        (slot) => slot.priority === "primary",
      ) ??
      decision.representation.slots[0]!;
    const additions: UINode[] = [
      uiNodeSchema.parse({
        id: inputId,
        type: "Input",
        slot: inputSlot.id,
        importance: "supporting",
        relationship: "continuation",
        mediaRole: "none",
        variant: "default",
        tone: "neutral",
        title: "",
        text: `Paste or enter the ${sourceLabel.toLocaleLowerCase("en")} here.`,
        label: sourceLabel,
        value: "",
        meta: "",
        icon: "",
        span: "full",
        align: "start",
        columns: 1,
        gap: "normal",
        progress: null,
        action: { type: "none", prompt: "", targetId: "", value: "" },
        items: [],
        children: [],
      }),
    ];
    if (buttonId)
      additions.push(
        uiNodeSchema.parse({
          id: buttonId,
          type: "Button",
          slot: inputSlot.id,
          importance: "supporting",
          relationship: "continuation",
          mediaRole: "none",
          variant: "default",
          tone: "neutral",
          title: "",
          text: "",
          label: /\b(?:meeting notes?|action room)\b/i.test(
            `${decision.userOutcome} ${decision.representation.userJob}`,
          )
            ? "Create action room"
            : "Continue with this input",
          value: "",
          meta: "",
          icon: "",
          span: "full",
          align: "start",
          columns: 1,
          gap: "normal",
          progress: null,
          action: {
            type: "prompt",
            prompt: `Use my current interface inputs to ${decision.representation.userJob}.`,
            targetId: "",
            value: "",
          },
          items: [],
          children: [],
        }),
      );
    const additionIds = additions.map((node) => node.id);
    const nodes = experience.nodes.map((candidate) =>
      candidate.id === "root"
        ? {
            ...candidate,
            children: [...additionIds, ...candidate.children],
          }
        : candidate,
    );
    nodes.splice(1, 0, ...additions);
    experience = uiExperienceSchema.parse({
      ...experience,
      representation: decision.representation,
      nodes,
    });
  }
  const candidates = experience.nodes.filter(
    (node) =>
      isUIContentNode(node) &&
      !(
        decision.representation.interactionLevel === "read" &&
        node.type === "Button"
      ) &&
      (visibleSlots.has(node.slot) ||
        (decision.representation.interactionLevel !== "read" &&
          node.type === "Button" &&
          node.action.type === "prompt")),
  );
  const selected = new Set<string>();
  let visibleCopyCharacters = 0;
  const select = (node: UINode, force = false) => {
    if (
      selected.has(node.id) ||
      selected.size >= decision.contentBudget.maxVisibleNodes
    )
      return;
    const labels = new Set(
      node.items
        .map((item) => item.label.trim().toLocaleLowerCase("en"))
        .filter(Boolean),
    );
    const duplicatesSelectedData =
      labels.size >= 2 &&
      [...selected].some((selectedId) => {
        const selectedNode = experience.nodes.find(
          (candidate) => candidate.id === selectedId,
        );
        if (!selectedNode) return false;
        const selectedLabels = new Set(
          selectedNode.items
            .map((item) => item.label.trim().toLocaleLowerCase("en"))
            .filter(Boolean),
        );
        if (selectedLabels.size < 2) return false;
        const overlap = [...labels].filter((label) =>
          selectedLabels.has(label),
        ).length;
        return overlap / Math.min(labels.size, selectedLabels.size) >= 0.6;
      });
    if (duplicatesSelectedData) return;
    const copyCharacters = nodeCopyCharacters(node);
    if (
      !force &&
      visibleCopyCharacters + copyCharacters >
        decision.contentBudget.maxVisibleCopyCharacters
    )
      return;
    selected.add(node.id);
    visibleCopyCharacters += copyCharacters;
  };
  let statefulControls: UINode[] = [];
  let continuation: UINode | undefined;
  if (decision.representation.interactionLevel !== "read") {
    statefulControls = candidates.filter(
      (candidate) =>
        candidate.type === "Input" ||
        candidate.type === "ChoiceGroup" ||
        candidate.type === "Tabs" ||
        candidate.type === "Comparison",
    );
    continuation = candidates.find(
      (candidate) =>
        candidate.type === "Button" && candidate.action.type === "prompt",
    );
    if (statefulControls[0]) select(statefulControls[0], true);
    if (continuation) select(continuation, true);
    for (const control of statefulControls.slice(1)) select(control, true);
  }
  const primary =
    candidates.find((node) => primarySlots.has(node.slot)) ?? candidates[0];
  if (primary) select(primary, true);
  if (mediaObligation) {
    const mediaNode = candidates.find(
      (candidate) =>
        candidate.type === "Image" && candidate.slot === mediaObligation.slotId,
    );
    if (mediaNode) select(mediaNode, true);
  }
  for (const obligation of decision.contentObligations.filter(
    (candidate) => candidate.priority !== "deferred",
  )) {
    const committedNode = candidates.find(
      (candidate) => candidate.slot === obligation.slotId,
    );
    if (committedNode) select(committedNode, true);
  }
  for (const node of candidates) select(node);

  const nodeMap = new Map(experience.nodes.map((node) => [node.id, node]));
  const parentMap = new Map<string, string[]>();
  for (const node of experience.nodes) {
    for (const child of node.children)
      parentMap.set(child, [...(parentMap.get(child) ?? []), node.id]);
  }
  const kept = new Set<string>(["root", ...selected]);
  const keepAncestors = (id: string) => {
    for (const parentId of parentMap.get(id) ?? []) {
      if (kept.has(parentId)) continue;
      kept.add(parentId);
      keepAncestors(parentId);
    }
  };
  for (const id of selected) keepAncestors(id);

  let truncatedItemCount = 0;
  const nodes = experience.nodes
    .filter((node) => kept.has(node.id))
    .map((node) => {
      const items = node.items.slice(0, decision.contentBudget.maxItemsPerNode);
      truncatedItemCount += node.items.length - items.length;
      return {
        ...node,
        items,
        children: node.children.filter((child) => kept.has(child)),
      };
    });
  const result = uiExperienceSchema.parse({
    ...experience,
    representation: decision.representation,
    nodes,
  });
  for (const obligation of decision.contentObligations.filter(
    (candidate) =>
      candidate.priority !== "deferred" && candidate.itemCount !== null,
  )) {
    const slotNodes = result.nodes.filter(
      (node) => isUIContentNode(node) && node.slot === obligation.slotId,
    );
    const repeatedNodes = slotNodes.filter((node) => node.items.length > 0);
    const representedCount = repeatedNodes.length
      ? repeatedNodes.reduce((total, node) => total + node.items.length, 0)
      : slotNodes.length;
    if (representedCount !== obligation.itemCount) {
      throw new Error(
        `Content obligation '${obligation.id}' contains ${representedCount} of exactly ${obligation.itemCount} requested entries.`,
      );
    }
  }
  return {
    experience: result,
    report: {
      visibleContentNodes: selected.size,
      prunedContentNodes:
        experience.nodes.filter(isUIContentNode).length - selected.size,
      visibleCopyCharacters,
      truncatedItemCount,
    },
  };
}

export function shouldStreamNodeForUXDecision(
  node: UINode,
  decisionInput: UXDecisionBrief,
  visibleNodeCount: number,
) {
  if (!isUIContentNode(node)) return true;
  const decision = repairUXDecisionBrief(decisionInput);
  const visibleSlots = new Set(
    decision.contentObligations
      .filter((obligation) => obligation.priority !== "deferred")
      .map((obligation) => obligation.slotId),
  );
  return (
    visibleSlots.has(node.slot) &&
    visibleNodeCount < decision.contentBudget.maxVisibleNodes
  );
}

function providerCompatibleJsonSchema(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(providerCompatibleJsonSchema);
  if (!input || typeof input !== "object") return input;
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>).map(([key, value]) => [
      key === "oneOf" ? "anyOf" : key,
      providerCompatibleJsonSchema(value),
    ]),
  );
}

/** OpenAI Structured Outputs supports anyOf branches but rejects Zod's equivalent oneOf encoding. */
export const uiExperienceJsonSchema = providerCompatibleJsonSchema(
  z.toJSONSchema(uiModelExperienceBaseSchema),
) as Record<string, unknown>;

export function buildUILanguageInstructions() {
  return `You are Fify, an AI whose native language is user interface—not prose.

Your entire answer is a declarative UI graph inside a conversation. You own meaning, information structure, and honest interaction. The Fify design system—not you—owns palette, typography, radii, shadows, decorative treatment, and component styling.

CORE BEHAVIOR
1. Infer what the user is trying to accomplish, not merely what topic they mentioned.
2. Treat the supplied representation plan as authoritative; compose its semantic slots and topology. Never simulate visual styling through ornamental copy.
3. Compose only enough UI to answer the request. This is an assistant turn inside a conversation, not a full application or mobile phone screen.
4. Make the first element communicate the answer or primary affordance. Do not add navigation, status chrome, decorative sections, summaries, or follow-up material the user did not need.
5. Use layout nodes—Stack, Row, Grid, Rail, Card—only when the information relationship requires them. A simple answer should usually be Page → one excellent semantic component.
6. Include controls only when the task benefits from choosing, checking, filtering, entering, or continuing. Actions may only be prompt, toggle, select, or none.
7. Make different jobs look and behave different: a trip is not a dashboard; an explanation is not a comparison table; a decision is not a generic list.
8. Use 1–3 content nodes for atomic answers, 2–5 for compact answers, and 6–12 only for genuinely compound tasks. Every node must earn its place.
9. Honor explicit cardinality. “Top 10,” “three options,” and similar requests must render the requested number of meaningful entries; a featured item never replaces the complete collection.
10. Stateful controls must complete a loop. Any Input, ChoiceGroup, selectable Comparison, or editable group must include one concise Button with a prompt action so the current interface state can be sent back to the AI.
11. Set importance to primary only for the one element carrying the answer or main affordance. Use supporting for necessary context and quiet for provenance or caveats. Set relationship to grouped or continuation only when that semantic relationship is real.

COMPOSITION VOCABULARY
- Structure: Page, Stack, Row, Grid, Rail, Card.
- Hierarchy: Hero, SectionHeader, Text, FactList, Badge, Divider, Spacer.
- Visual values: ColorPalette. Use it whenever actual colors are part of the answer; hex strings alone are not an understandable palette.
- Media: Image. Use it when a real-world person, place, object, artwork, product, or scene materially improves the answer.
- Evidence: Metric, Chart, Donut, Table, Progress.
- Narrative: Timeline, Steps, Quote, Callout, Visual.
- Decisions: Comparison, ChoiceGroup, Tabs.
- Action and progress: Checklist, Progress, Calendar.
- Tasks: Input, Button, Calendar, MapPanel, CodeBlock.

MEDIA DECISION POLICY
- Include exactly one Image for identity or visual-recognition requests about a named real-world person, landmark, artwork, product, animal, plant, or other physical subject. A question such as “Who is [real person]?” requires a portrait unless the user explicitly asks for no image.
- Include an Image when seeing a place, object, product, artwork, or scene is part of answering well—not as generic decoration.
- Omit images for abstract concepts, routine productivity tasks, or data answers where a visual would not improve recognition or understanding.
- Prefer one strong, contextually placed image over a gallery. A second image is justified only for an explicit comparison or before/after request.

BLUEPRINT EXPRESSION GUIDANCE—not fixed templates
- biography/profile: one identity image, concise identity framing, FactList for unordered defining facts, and Timeline only when chronology explains the subject.
- explanation/story: a direct thesis, progressive Steps when sequence matters, and at most one useful Callout, Quote, or Visual.
- decision/comparison: a concise recommendation, one Comparison or Table, and a selectable next action only when the user needs to choose.
- plan/itinerary: Calendar, Timeline, MapPanel, Checklist, contextual controls.
- dashboard/track: compact hierarchy, Metrics in a Grid, Chart/Donut, Progress, a Rail for drill-down.
- tool/form: Input and ChoiceGroup in purposeful Cards with a clear Button and result area.

INFORMATION-SHAPE SELECTION
Before choosing a component, classify each content group by what its structure means:
- Continuous explanation or synthesis → Text. Preserve prose when ideas depend on one another.
- Unordered facts, findings, traits, or highlights → FactList. Facts are not tasks and never receive checkboxes.
- Label/value attributes that users scan by field → Table. Use for specifications, definitions, owners, dates, or compact records—not narrative paragraphs.
- Dated events whose temporal progression matters → Timeline. Do not use it merely because facts mention years.
- Ordered instructions, stages, or a causal sequence where order matters → Steps.
- User-owned tasks that can genuinely be completed → Checklist. Labels begin with clear action verbs; every item can be toggled by the user.
- Parallel alternatives or tradeoffs → Comparison. Use ChoiceGroup instead when the primary job is selecting one option.
- Quantities → Metric for one value, Grid of Metrics for several peers, Chart for a pattern, Donut for part-to-whole, Progress for advancement toward a goal.
- Heterogeneous peer concepts that need independent hierarchy → Cards in a Grid or Rail. Do not wrap every repeated fact in a large card.
- Colors, palettes, brand tokens, or theme recommendations → ColorPalette. Each item.value is a CSS-safe hexadecimal color, item.label is the human name, and item.detail explains its role or use. Never present a requested palette as hex text alone.

VISUAL UTILITY TEST
- Prefer a semantic visual encoding whenever seeing structure is faster than reading it: ColorPalette for colors, Chart/Donut/Progress for quantities, Timeline/Calendar for time, MapPanel for space, Steps for process, Comparison for tradeoffs, CodeBlock for code, and Image for recognition.
- Add an Image only when it carries information: recognizing a real subject, comparing appearance, or understanding a scene. Decorative imagery that merely fills space is a failure.
- Search real-world identity and evidence imagery; never ask the product to synthesize a factual portrait or evidence. Use generated illustration only for abstract or explanatory concepts where it cannot be mistaken for a real record.

Silently verify the semantics before emitting: if reordering items changes the meaning, use Steps or Timeline; if clicking an item cannot honestly mean “I completed this,” never use Checklist; if rows answer different named fields, use Table; otherwise use FactList for concise independent facts.

GRAPH RULES
- Emit nodes in parent-first order. The first node is always { id: "root", type: "Page" }.
- Every child ID must resolve to exactly one later or earlier node. Every node must be reachable from root. No cycles.
- Page is used exactly once. Leaf content nodes have no children. SectionHeader may group the content belonging to that section.
- Use stable kebab-case semantic IDs. Preserve compatible IDs on follow-up, but redesign when the job changes.
- Populate every field exposed by the selected node type. The v4 schema exposes semantic intent while the runtime decides presentation.
- Page is an invisible structural root in the conversation. Do not spend nodes recreating app or phone chrome.
- items carry repeated data for FactList, ColorPalette, Chart, Timeline, Comparison, Checklist, Steps, Table, ChoiceGroup, Tabs, MapPanel, and Calendar.
- FactList is non-interactive. Use item.label as the fact headline, item.detail as its explanation, and item.value only for a short qualifier such as a year or category.
- ColorPalette is non-interactive. Use two to twelve items. item.value must be a 3, 6, or 8 digit hexadecimal color such as #2563EB; item.label names it and item.detail says how it should be used.
- Checklist is interactive task state, never decorative presentation. Set action.type to "toggle", action.targetId to the node ID, and write imperative item labels such as “Confirm the venue” or “Pack a charger”. Never use Checklist for biography, summaries, characteristics, benefits, evidence, or key facts.
- Image is resolved by the product, never by the model. Set label to a concise search query, title to accurate accessible alt text, text to an optional caption, and mediaRole to identity, evidence, or illustration. For people, use only the canonical name and mediaRole identity. Use at most two Image nodes.
- progress is 0–100. Never invent precise current facts, citations, live prices, links, or schedules; visibly qualify uncertainty.
- Button prompt actions contain the natural-language follow-up the interface should send.
- Never imply clickability without behavior. Button always uses prompt and sends a meaningful follow-up to the AI. Checklist always toggles. ChoiceGroup and Tabs always select. Comparison uses select when interactive and none when it should render as static evidence.
- Every interactive label must be visible and specific. Do not emit blank buttons, unlabeled inputs, decorative links, or controls whose action is none.

EDITORIAL CONSTITUTION
- Prefer typography and whitespace over containers. Never request a Hero for an atomic answer.
- Do not use generic meta headings such as “At a glance”, “Key facts”, “Overview”, “Why it matters”, or “The bottom line”. Write the actual subject instead, or omit the heading.
- Do not repeat the same conclusion in a title, subtitle, fact list, and callout.
- Use labels only for real categories, fields, states, dates, or units—not as decorative eyebrows.
- Do not add an action merely to make the answer feel interactive. A read-only answer can end naturally.
- Card means a genuinely grouped object with its own identity or state. It is not a universal wrapper.

SUGGESTIONS
Return [] unless one or two follow-up prompts are clearly useful to completing the user's current job. Do not generate generic engagement suggestions.

The output is not a description of an interface. It is the interface.`;
}

export const uiLanguageCatalogId = "https://fify.dev/catalogs/ui-language/4.0";

export const uiLanguageCatalog = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: uiLanguageCatalogId,
  protocolVersion: "1.0",
  title: "Fify UI Language",
  description:
    "A safe, compositional vocabulary for model-authored, progressively rendered application surfaces.",
  catalogId: uiLanguageCatalogId,
  components: Object.fromEntries(
    uiNodeTypes.map((type) => [
      type,
      { description: `Trusted ${type} UI-language component.` },
    ]),
  ),
  functions: { prompt: {}, toggle: {}, select: {} },
} as const;

export function uiNodeToA2UIComponent(input: UINode): A2UIComponent {
  const node = uiNodeSchema.parse(input);
  return { ...node, component: node.type };
}

function experienceDataModel(experience: UIExperience) {
  return {
    responseId: experience.responseId,
    goal: experience.goal,
    representation: experience.representation,
    screen: experience.screen,
    suggestions: experience.suggestions,
  };
}

export function uiExperienceToA2UI(
  input: UIExperience,
  options: { surfaceId?: string } = {},
): A2UIMessage[] {
  const experience = uiExperienceSchema.parse(input);
  return [
    {
      version: "v1.0",
      createSurface: {
        surfaceId: options.surfaceId ?? `ui-${experience.responseId}`,
        catalogId: uiLanguageCatalogId,
        sendDataModel: false,
        components: experience.nodes.map(uiNodeToA2UIComponent),
        dataModel: experienceDataModel(experience),
      },
    },
  ];
}

export function createUILanguageStream(surfaceId: string): A2UIMessage {
  return {
    version: "v1.0",
    createSurface: {
      surfaceId,
      catalogId: uiLanguageCatalogId,
      sendDataModel: false,
      components: [],
      dataModel: {},
    },
  };
}

export function createRepresentationSkeleton(
  planInput: RepresentationPlan,
  visibleSlotIds?: readonly string[],
): UINode[] {
  const plan = representationPlanSchema.parse(planInput);
  const layoutType: UINode["type"] =
    plan.topology === "horizontal-rail"
      ? "Rail"
      : plan.topology === "responsive-grid" ||
          plan.topology === "focal-split" ||
          plan.topology === "spatial-map" ||
          plan.topology === "form-result"
        ? "Grid"
        : "Stack";
  const requestedSlots = visibleSlotIds ? new Set(visibleSlotIds) : null;
  const plannedSlots = plan.slots.filter((slot) =>
    requestedSlots ? requestedSlots.has(slot.id) : slot.priority === "primary",
  );
  const slotNodes = (
    plannedSlots.length
      ? plannedSlots
      : plan.slots.filter((slot) => slot.priority === "primary")
  ).map((slot) =>
    node({
      id: `pending-${slot.id}`,
      type: "Card",
      slot: slot.id,
      importance: slot.priority === "primary" ? "primary" : "supporting",
      relationship: "grouped",
      label: "",
      title: "",
      text: "",
    }),
  );
  const layout = node({
    id: "representation-layout",
    type: layoutType,
    slot: "",
    gap: "normal",
    columns:
      plan.topology === "responsive-grid" || plan.topology === "form-result"
        ? 2
        : plan.topology === "focal-split"
          ? 2
          : 1,
    children: slotNodes.map((item) => item.id),
  });
  return [
    node({
      id: "root",
      type: "Page",
      slot: "",
      gap: "normal",
      children: [layout.id],
    }),
    layout,
    ...slotNodes,
  ];
}

export function appendUILanguageNode(
  surfaceId: string,
  input: UINode,
): A2UIMessage {
  return {
    version: "v1.0",
    updateComponents: { surfaceId, components: [uiNodeToA2UIComponent(input)] },
  };
}

export function finalizeUILanguageStream(
  surfaceId: string,
  input: UIExperience,
): A2UIMessage[] {
  const experience = uiExperienceSchema.parse(input);
  return [
    {
      version: "v1.0",
      updateComponents: {
        surfaceId,
        components: experience.nodes.map(uiNodeToA2UIComponent),
      },
    },
    {
      version: "v1.0",
      updateDataModel: {
        surfaceId,
        path: "/",
        value: experienceDataModel(experience),
      },
    },
  ];
}

const none = { type: "none", prompt: "", targetId: "", value: "" } as const;
const node = (value: Partial<UINode> & Pick<UINode, "id" | "type">): UINode =>
  uiNodeSchema.parse({
    slot: "primary",
    importance: "supporting",
    relationship: "standalone",
    mediaRole: "none",
    variant: "default",
    tone: "neutral",
    title: "",
    text: "",
    label: "",
    value: "",
    meta: "",
    icon: "",
    span: "full",
    align: "start",
    columns: 1,
    gap: "normal",
    progress: null,
    action: none,
    items: [],
    children: [],
    ...value,
  });

export const uiLanguageFixtureRepresentation: RepresentationPlan =
  representationPlanSchema.parse({
    version: "1.0",
    mode: "open",
    blueprintIds: ["open-composition"],
    confidence: 0.91,
    userJob: "understand the Fify response medium",
    informationShapes: [
      "narrative",
      "hierarchy",
      "tasks-progress",
      "comparison",
      "choice-input",
    ],
    interactionLevel: "act",
    scale: "compound",
    topology: "open-canvas",
    noveltyBudget: 0.82,
    slots: [
      {
        id: "primary",
        role: "primary",
        shape: "narrative",
        priority: "primary",
        required: true,
      },
      {
        id: "system",
        role: "evidence",
        shape: "hierarchy",
        priority: "supporting",
        required: false,
      },
      {
        id: "streaming",
        role: "context",
        shape: "tasks-progress",
        priority: "supporting",
        required: false,
      },
      {
        id: "comparison",
        role: "exploration",
        shape: "comparison",
        priority: "supporting",
        required: false,
      },
      {
        id: "actions",
        role: "action",
        shape: "choice-input",
        priority: "optional",
        required: false,
      },
    ],
  });

export const uiLanguageFixture: UIExperience = uiExperienceSchema.parse({
  version: "4.0",
  responseId: "ui-language-welcome",
  goal: "Demonstrate AI that composes interfaces instead of decorating text",
  representation: uiLanguageFixtureRepresentation,
  screen: { title: "Fify", contextLabel: "UI-native intelligence" },
  nodes: [
    node({
      id: "root",
      type: "Page",
      slot: "",
      gap: "loose",
      children: ["opening", "proof-grid", "different-by-design", "try-rail"],
    }),
    node({
      id: "opening",
      type: "Hero",
      importance: "primary",
      variant: "immersive",
      tone: "accent",
      label: "A new response medium",
      title: "The answer is an interface.",
      text: "Fify gives the model a visual language—layout, hierarchy, state, and interaction—then streams the result into trusted native components.",
      value: "UI / 02",
      icon: "✦",
    }),
    node({
      id: "proof-grid",
      type: "Grid",
      slot: "",
      columns: 2,
      gap: "tight",
      children: ["model-owns", "product-owns", "stream-proof"],
    }),
    node({
      id: "model-owns",
      type: "Card",
      slot: "system",
      variant: "solid",
      tone: "neutral",
      span: "two-thirds",
      label: "The model owns",
      title: "Composition",
      text: "Information architecture, hierarchy, visual rhythm, and useful controls.",
      icon: "01",
    }),
    node({
      id: "product-owns",
      type: "Card",
      slot: "system",
      variant: "soft",
      tone: "accent",
      span: "third",
      label: "The product owns",
      title: "Trust",
      text: "Code, accessibility, permissions, data, and every rendered component.",
      icon: "02",
    }),
    node({
      id: "stream-proof",
      type: "Progress",
      slot: "streaming",
      variant: "compact",
      tone: "positive",
      label: "Progressive surface",
      value: "Live",
      text: "Parents arrive first. Children resolve as the agent speaks UI.",
      progress: 84,
    }),
    node({
      id: "different-by-design",
      type: "Stack",
      slot: "",
      gap: "tight",
      children: ["different-heading", "shape-comparison"],
    }),
    node({
      id: "different-heading",
      type: "SectionHeader",
      label: "Prompt-native",
      title: "Different jobs deserve different screens",
      text: "The graph changes—not just the copy inside a fixed stack.",
    }),
    node({
      id: "shape-comparison",
      type: "Comparison",
      slot: "comparison",
      variant: "horizontal",
      tone: "neutral",
      items: [
        {
          id: "shape-plan",
          label: "Plan",
          value: "Calendar + map",
          detail: "Time, place, and readiness become the structure.",
          tone: "positive",
          progress: null,
        },
        {
          id: "shape-learn",
          label: "Learn",
          value: "Story + visual",
          detail: "The explanation unfolds with deliberate pacing.",
          tone: "info",
          progress: null,
        },
        {
          id: "shape-decide",
          label: "Decide",
          value: "Evidence + action",
          detail: "Tradeoffs lead to a concrete next move.",
          tone: "caution",
          progress: null,
        },
      ],
    }),
    node({
      id: "try-rail",
      type: "Rail",
      slot: "",
      gap: "tight",
      children: ["try-plan", "try-explain", "try-decide"],
    }),
    node({
      id: "try-plan",
      type: "Button",
      slot: "actions",
      variant: "solid",
      tone: "accent",
      label: "Build a Tokyo design weekend",
      icon: "↗",
      action: {
        type: "prompt",
        prompt: "Plan a three-day Tokyo trip focused on food and design",
        targetId: "",
        value: "",
      },
    }),
    node({
      id: "try-explain",
      type: "Button",
      slot: "actions",
      variant: "soft",
      tone: "info",
      label: "Teach me compound interest",
      icon: "↗",
      action: {
        type: "prompt",
        prompt: "Explain compound interest to a curious 12-year-old",
        targetId: "",
        value: "",
      },
    }),
    node({
      id: "try-decide",
      type: "Button",
      slot: "actions",
      variant: "outline",
      tone: "neutral",
      label: "Compare two job offers",
      icon: "↗",
      action: {
        type: "prompt",
        prompt:
          "Help me decide between two job offers with different pay, growth, and commute",
        targetId: "",
        value: "",
      },
    }),
  ],
  suggestions: [
    "Design a focused study sprint",
    "Compare electric and hybrid cars",
  ],
});

export const uiLanguageEvalCases = [
  {
    id: "direct-answer",
    prompt: "What is the difference between mass and weight?",
    expected: ["Text"],
    mode: "blueprint",
    blueprints: ["direct-answer"],
  },
  {
    id: "person-profile",
    prompt: "Who is Steve Jobs?",
    expected: ["Image", "FactList"],
    mode: "blueprint",
    blueprints: ["profile-reference"],
  },
  {
    id: "learning-story",
    prompt: "Explain compound interest to a curious 12-year-old",
    expected: ["Steps"],
    mode: "blueprint",
    blueprints: ["explainer"],
  },
  {
    id: "procedure",
    prompt: "Show me how to dial in espresso step by step",
    expected: ["Steps"],
    mode: "blueprint",
    blueprints: ["procedure"],
  },
  {
    id: "decision-tool",
    prompt:
      "Compare electric and hybrid cars for my commute and help me choose",
    expected: ["Comparison"],
    mode: "blueprint",
    blueprints: ["compare-decide"],
  },
  {
    id: "travel-planner",
    prompt: "Plan a three-day Tokyo trip focused on food and design",
    expected: ["Timeline"],
    mode: "blueprint",
    blueprints: ["plan-schedule"],
  },
  {
    id: "meeting-briefing",
    prompt: "Turn these meeting notes into decisions, owners, and next actions",
    expected: ["Table"],
    mode: "blueprint",
    blueprints: ["briefing"],
  },
  {
    id: "evidence-analysis",
    prompt: "Analyze this quarter's sales pattern and explain what changed",
    expected: ["Chart", "Metric"],
    mode: "blueprint",
    blueprints: ["analysis-evidence"],
  },
  {
    id: "habit-dashboard",
    prompt: "Create a seven-day calculus study tracker",
    expected: ["Progress", "Calendar"],
    mode: "blueprint",
    blueprints: ["monitor-track"],
  },
  {
    id: "explore-recommend",
    prompt:
      "Recommend three architecture books and help me explore their differences",
    expected: ["Card"],
    mode: "blueprint",
    blueprints: ["explore-recommend"],
  },
  {
    id: "ranked-collection",
    prompt: "Who are the top 10 NBA players right now in the league?",
    expected: ["FactList"],
    mode: "blueprint",
    blueprints: ["explore-recommend"],
  },
  {
    id: "interactive-estimator",
    prompt: "Help me estimate how much emergency fund I need",
    expected: ["Input", "Metric"],
    mode: "blueprint",
    blueprints: ["interactive-tool"],
  },
  {
    id: "workflow-action",
    prompt:
      "Turn this product launch into owned work items with status and next actions",
    expected: ["Checklist", "Progress"],
    mode: "blueprint",
    blueprints: ["workflow-action"],
  },
  {
    id: "hybrid-plan-decision",
    prompt: "Plan our offsite and compare the two shortlisted venues",
    expected: ["Comparison", "Calendar"],
    mode: "hybrid",
    blueprints: ["compare-decide", "plan-schedule"],
  },
  {
    id: "open-metaphor",
    prompt:
      "Turn my uncertainty about changing careers into a visual garden I can explore",
    expected: ["Visual"],
    mode: "open",
    blueprints: ["open-composition"],
  },
  {
    id: "exact-cardinality",
    prompt: "Give me three concise reasons the sky appears blue during the day",
    expected: ["FactList"],
    mode: "blueprint",
    blueprints: ["explainer"],
  },
  {
    id: "concise-no-actions",
    prompt:
      "Define opportunity cost in one sentence. Do not add controls or follow-up actions.",
    expected: ["Text"],
    mode: "blueprint",
    blueprints: ["direct-answer"],
  },
  {
    id: "chronology-cardinality",
    prompt: "Summarize Apollo 11 in four chronological milestones",
    expected: ["Timeline"],
    mode: "blueprint",
    blueprints: ["explainer"],
  },
  {
    id: "structured-reference",
    prompt:
      "Show the key specifications of the original iPhone as a compact reference",
    expected: ["Image", "Table"],
    mode: "blueprint",
    blueprints: ["profile-reference"],
  },
] as const;
