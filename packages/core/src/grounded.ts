import { z } from "zod";
import {
  uiExperienceSchema,
  uiNodeSchema,
  type UIExperience,
  type UINode,
} from "./language.js";
import {
  representationPlanSchema,
  type InformationShape,
  type RepresentationPlan,
} from "./representation.js";

const semanticIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:[-_.:][a-z0-9]+)*$/i);

const mediaSemanticIdSchema = z
  .string()
  .min(1)
  .max(48)
  .regex(/^[a-z0-9]+(?:[-_.:][a-z0-9]+)*$/i);

export const trustedInformationImageHosts = [
  "upload.wikimedia.org",
  "api.openverse.org",
  "www.apple.com",
  "www.oppo.com",
  "www.sony.com",
] as const;

function isSafePublicHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host === "0.0.0.0" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    )
      return false;
    return true;
  } catch {
    return false;
  }
}

export function isTrustedInformationImageUrl(value: string) {
  if (!isSafePublicHttpsUrl(value)) return false;
  try {
    return (trustedInformationImageHosts as readonly string[]).includes(
      new URL(value).hostname.toLowerCase(),
    );
  } catch {
    return false;
  }
}

export const informationSourceV1Schema = z
  .object({
    id: semanticIdSchema,
    title: z.string().min(1).max(180),
    url: z
      .string()
      .max(2_048)
      .refine(isSafePublicHttpsUrl, "Source URL must be a public HTTPS URL."),
  })
  .strict();

export const informationMediaV1Schema = z
  .object({
    id: mediaSemanticIdSchema,
    url: z
      .string()
      .max(2_048)
      .refine(
        isTrustedInformationImageUrl,
        "Media URL must use an approved public HTTPS image host.",
      ),
    alt: z.string().min(1).max(180),
    caption: z.string().max(400),
    role: z.enum(["identity", "evidence", "illustration"]),
    subject: z.string().min(1).max(90).optional(),
    sourceId: semanticIdSchema,
  })
  .strict();

export const informationItemV1Schema = z
  .object({
    id: semanticIdSchema,
    label: z.string().min(1).max(90),
    value: z.string().max(120),
    detail: z.string().max(2_048),
    sourceIds: z.array(semanticIdSchema).max(8),
  })
  .strict();

export const informationSectionV1Schema = z
  .object({
    id: semanticIdSchema,
    title: z.string().min(1).max(110),
    body: z.string().max(4_000),
    items: z.array(informationItemV1Schema).max(12),
    sourceIds: z.array(semanticIdSchema).max(8),
  })
  .strict();

export const informationContinuationStateV1Schema = z
  .object({
    priorRunId: z.string().min(1).max(96),
    checkedIds: z.array(semanticIdSchema).max(96),
    selectedIds: z.array(semanticIdSchema).max(24),
    inputs: z.record(semanticIdSchema, z.string().max(500)),
  })
  .strict();

const informationEnvelopeV1BaseSchema = z
  .object({
    version: z.literal("1.0"),
    originalRequest: z.string().min(1).max(2_000),
    groundedAnswer: z.string().min(1).max(16_000),
    locale: z.string().min(2).max(35),
    profileSubject: z.string().min(1).max(100).optional(),
    sections: z.array(informationSectionV1Schema).min(1).max(8),
    sources: z.array(informationSourceV1Schema).max(32),
    media: z.array(informationMediaV1Schema).max(4).optional(),
    suggestedRefinements: z.array(z.string().min(1).max(140)).max(2),
    continuationState: informationContinuationStateV1Schema.optional(),
  })
  .strict();

function envelopeContentLength(
  value: z.infer<typeof informationEnvelopeV1BaseSchema>,
) {
  const strings = [
    value.originalRequest,
    value.groundedAnswer,
    value.locale,
    value.profileSubject ?? "",
    ...value.suggestedRefinements,
    ...value.sources.flatMap((source) => [source.id, source.title, source.url]),
    ...(value.media ?? []).flatMap((media) => [
      media.id,
      media.url,
      media.alt,
      media.caption,
      media.role,
      media.subject ?? "",
      media.sourceId,
    ]),
    ...value.sections.flatMap((section) => [
      section.id,
      section.title,
      section.body,
      ...section.sourceIds,
      ...section.items.flatMap((item) => [
        item.id,
        item.label,
        item.value,
        item.detail,
        ...item.sourceIds,
      ]),
    ]),
  ];
  return strings.reduce((sum, item) => sum + item.length, 0);
}

/** Host-authored factual payload. Unknown fields and unresolved provenance are rejected. */
export const informationEnvelopeV1Schema =
  informationEnvelopeV1BaseSchema.superRefine((envelope, context) => {
    const ids = new Set<string>();
    const itemIds = new Set<string>();
    const inputIds = new Set<string>();
    envelope.sources.forEach((source, index) => {
      if (ids.has(source.id))
        context.addIssue({
          code: "custom",
          path: ["sources", index, "id"],
          message: `Duplicate ID '${source.id}'.`,
        });
      ids.add(source.id);
    });
    const sourceIds = new Set(envelope.sources.map((source) => source.id));
    (envelope.media ?? []).forEach((media, index) => {
      if (ids.has(media.id))
        context.addIssue({
          code: "custom",
          path: ["media", index, "id"],
          message: `Duplicate ID '${media.id}'.`,
        });
      ids.add(media.id);
      if (!sourceIds.has(media.sourceId))
        context.addIssue({
          code: "custom",
          path: ["media", index, "sourceId"],
          message: `Unknown source '${media.sourceId}'.`,
        });
    });
    envelope.sections.forEach((section, sectionIndex) => {
      if (ids.has(section.id))
        context.addIssue({
          code: "custom",
          path: ["sections", sectionIndex, "id"],
          message: `Duplicate ID '${section.id}'.`,
        });
      ids.add(section.id);
      inputIds.add(section.id);
      section.sourceIds.forEach((sourceId) => {
        if (!sourceIds.has(sourceId))
          context.addIssue({
            code: "custom",
            path: ["sections", sectionIndex, "sourceIds"],
            message: `Unknown source '${sourceId}'.`,
          });
      });
      section.items.forEach((item, itemIndex) => {
        if (ids.has(item.id))
          context.addIssue({
            code: "custom",
            path: ["sections", sectionIndex, "items", itemIndex, "id"],
            message: `Duplicate ID '${item.id}'.`,
          });
        ids.add(item.id);
        itemIds.add(item.id);
        item.sourceIds.forEach((sourceId) => {
          if (!sourceIds.has(sourceId))
            context.addIssue({
              code: "custom",
              path: ["sections", sectionIndex, "items", itemIndex, "sourceIds"],
              message: `Unknown source '${sourceId}'.`,
            });
        });
      });
    });
    if (envelopeContentLength(envelope) > 24_000)
      context.addIssue({
        code: "custom",
        path: [],
        message:
          "InformationEnvelopeV1 exceeds the 24,000-character content limit.",
      });
    const continuation = envelope.continuationState;
    if (continuation) {
      for (const id of [
        ...continuation.checkedIds,
        ...continuation.selectedIds,
      ]) {
        if (!itemIds.has(id))
          context.addIssue({
            code: "custom",
            path: ["continuationState"],
            message: `Continuation state references unknown item '${id}'.`,
          });
      }
      for (const id of Object.keys(continuation.inputs)) {
        if (!inputIds.has(id) && !itemIds.has(id))
          context.addIssue({
            code: "custom",
            path: ["continuationState"],
            message: `Continuation state references unknown input '${id}'.`,
          });
      }
    }
  });

export type InformationEnvelopeV1 = z.infer<typeof informationEnvelopeV1Schema>;

export const groundedComponentTypes = [
  "Hero",
  "Card",
  "Text",
  "FactList",
  "ColorPalette",
  "Badge",
  "Metric",
  "Chart",
  "Donut",
  "Comparison",
  "Checklist",
  "Steps",
  "Table",
  "Timeline",
  "Progress",
  "Callout",
  "Quote",
  "Input",
  "ChoiceGroup",
  "Tabs",
  "MapPanel",
  "Calendar",
  "CodeBlock",
  "Visual",
] as const;

export const groundedCompositionPlacementSchema = z
  .object({
    sectionId: semanticIdSchema,
    component: z.enum(groundedComponentTypes),
    itemIds: z.array(semanticIdSchema).max(12),
    importance: z.enum(["primary", "supporting", "quiet"]),
  })
  .strict();

export const groundedCompositionPlanSchema = z
  .object({
    version: z.literal("1.0"),
    topology: z.enum([
      "editorial-stack",
      "responsive-grid",
      "focal-split",
      "horizontal-rail",
      "timeline-spine",
    ]),
    placements: z.array(groundedCompositionPlacementSchema).min(1).max(8),
  })
  .strict();

export type GroundedCompositionPlan = z.infer<
  typeof groundedCompositionPlanSchema
>;

const collectionComponents = new Set([
  "FactList",
  "ColorPalette",
  "Chart",
  "Comparison",
  "Checklist",
  "Steps",
  "Table",
  "Timeline",
  "ChoiceGroup",
  "Tabs",
  "MapPanel",
  "Calendar",
]);
const singleItemComponents = new Set([
  "Hero",
  "Card",
  "Badge",
  "Metric",
  "Donut",
  "Progress",
  "Quote",
  "Input",
  "CodeBlock",
  "Visual",
]);

function groundedProgress(value: string) {
  const match = value.trim().match(/^(100(?:\.0+)?|\d{1,2}(?:\.\d+)?)\s*%?$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
    ? parsed
    : null;
}

function isExecutiveBriefingRequest(value: string) {
  return /\b(?:executive|leadership|board|decision)\s+brief(?:ing)?\b/i.test(
    value,
  );
}

function executiveBriefingRole(
  section: InformationEnvelopeV1["sections"][number],
  index: number,
) {
  if (index === 0) return "headline" as const;
  const text = `${section.title} ${section.body}`.toLowerCase();
  if (/\b(signal|status|snapshot|outlook|metric|health)\b/.test(text))
    return "status" as const;
  if (/\b(actions?|next steps?|owner|commitment|follow-up)\b/.test(text))
    return "actions" as const;
  if (/\b(decision|recommend|approval|approve)\b/.test(text))
    return "decisions" as const;
  if (/\b(risk|watch|caveat|exposure|constraint)\b/.test(text))
    return "alerts" as const;
  if (/\b(chang(?:e|ed|es|ing)|findings?|developments?|evidence)\b/.test(text))
    return "findings" as const;
  return "context" as const;
}

export function parseGroundedCompositionPlan(
  envelopeInput: InformationEnvelopeV1,
  planInput: unknown,
): GroundedCompositionPlan {
  const envelope = informationEnvelopeV1Schema.parse(envelopeInput);
  const plan = groundedCompositionPlanSchema.parse(planInput);
  const sections = new Map(
    envelope.sections.map((section) => [section.id, section]),
  );
  const seenSections = new Set<string>();
  for (const placement of plan.placements) {
    const section = sections.get(placement.sectionId);
    if (!section)
      throw new Error(
        `Grounded composition references unknown section '${placement.sectionId}'.`,
      );
    if (seenSections.has(placement.sectionId))
      throw new Error(
        `Grounded composition repeats section '${placement.sectionId}'.`,
      );
    seenSections.add(placement.sectionId);
    const expected = new Set(section.items.map((item) => item.id));
    const actual = new Set(placement.itemIds);
    if (actual.size !== placement.itemIds.length)
      throw new Error(
        `Grounded composition repeats an item in section '${section.id}'.`,
      );
    if (
      expected.size !== actual.size ||
      [...expected].some((id) => !actual.has(id))
    )
      throw new Error(
        `Grounded composition must reference every item in section '${section.id}' exactly once.`,
      );
    if (placement.component === "Input" && section.items.length !== 1)
      throw new Error(`Input requires exactly one grounded item.`);
    if (
      section.items.length < 2 &&
      collectionComponents.has(placement.component)
    )
      throw new Error(
        `${placement.component} requires at least two grounded items.`,
      );
    if (
      section.items.length > 1 &&
      singleItemComponents.has(placement.component)
    )
      throw new Error(
        `${placement.component} supports at most one grounded item.`,
      );
    if (
      placement.component === "ColorPalette" &&
      section.items.some(
        (item) =>
          !/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(
            item.value.trim(),
          ),
      )
    )
      throw new Error(
        `ColorPalette requires hexadecimal grounded item values.`,
      );
    if (
      placement.component === "Chart" &&
      section.items.some((item) => groundedProgress(item.value) === null)
    )
      throw new Error(
        `Chart requires numeric grounded item values between 0 and 100.`,
      );
    if (
      ["Donut", "Progress"].includes(placement.component) &&
      groundedProgress(section.items[0]?.value ?? "") === null
    )
      throw new Error(
        `${placement.component} requires one numeric grounded value between 0 and 100.`,
      );
  }
  if (seenSections.size !== sections.size)
    throw new Error(
      "Grounded composition must place every section exactly once.",
    );
  if (
    plan.placements.filter((placement) => placement.importance === "primary")
      .length !== 1
  )
    throw new Error(
      "Grounded composition requires exactly one primary placement.",
    );
  return plan;
}

function comparisonItemLabelSignature(
  section: InformationEnvelopeV1["sections"][number],
) {
  if (section.items.length < 2 || section.items.length > 5) return "";
  const labels = section.items.map((item) =>
    item.label.trim().replace(/\s+/g, " ").toLocaleLowerCase(),
  );
  if (new Set(labels).size !== labels.length) return "";
  return labels.join("|");
}

function defaultComponent(
  envelope: InformationEnvelopeV1,
  section: InformationEnvelopeV1["sections"][number],
  index: number,
) {
  const requestText = envelope.originalRequest.toLowerCase();
  const sectionText = section.title.toLowerCase();
  const text = `${requestText} ${sectionText}`;
  const comparisonRequest = /compar|versus|\bvs\b|trade-?off/.test(requestText);
  const sectionComparisonSignature = comparisonItemLabelSignature(section);
  const repeatedComparisonSignature =
    comparisonRequest &&
    sectionComparisonSignature &&
    (envelope.sections.length === 1 ||
      envelope.sections.filter(
        (candidate) =>
          comparisonItemLabelSignature(candidate) ===
          sectionComparisonSignature,
      ).length >= 2);
  if (isExecutiveBriefingRequest(envelope.originalRequest)) {
    if (index === 0 && section.items.length <= 1) return "Hero";
    if (
      /\b(actions?|next steps?|owner|commitment|follow-up)\b/.test(text) &&
      section.items.length >= 2
    )
      return "Steps";
    if (section.items.length >= 2) return "FactList";
    return section.body ? "Text" : "Callout";
  }
  if (
    comparisonRequest &&
    section.items.length >= 2 &&
    /assumption|disambiguat|interpret|correction|recommend|verdict|guidance|which.*buy/.test(
      sectionText,
    )
  )
    return "FactList";
  if (
    section.items.length === 1 &&
    /\b(input|enter|field|editable)\b/.test(text)
  )
    return "Input";
  if (section.items.length <= 1 && /\b(code|snippet|schema|query)\b/.test(text))
    return "CodeBlock";
  if (section.items.length <= 1 && /\b(quote|testimonial)\b/.test(text))
    return "Quote";
  if (
    section.items.length === 1 &&
    /\b(progress|completion|readiness)\b/.test(text) &&
    groundedProgress(section.items[0]!.value) !== null
  )
    return "Progress";
  if (section.items.length === 1 && /\b(metric|kpi|score|rate)\b/.test(text))
    return "Metric";
  if (section.items.length < 2) return section.body ? "Text" : "Callout";
  if (
    /\b(colors?|palette|swatches?)\b/.test(text) &&
    section.items.every((item) =>
      /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(item.value.trim()),
    )
  )
    return "ColorPalette";
  if (
    /\b(chart|trend|distribution)\b/.test(text) &&
    section.items.every((item) => groundedProgress(item.value) !== null)
  )
    return "Chart";
  if (/\b(map|locations?|places?|route)\b/.test(text)) return "MapPanel";
  if (/\b(calendar|schedule|agenda)\b/.test(text)) return "Calendar";
  if (
    repeatedComparisonSignature ||
    /compar|versus|\bvs\b|trade-?off/.test(sectionText)
  )
    return "Comparison";
  if (/decision tool|choose|select|pick one|preference/.test(text))
    return "ChoiceGroup";
  if (/tabs?|categories|views?/.test(text)) return "Tabs";
  if (/checklist|to-?do|tasks?|track/.test(text)) return "Checklist";
  if (/timeline|history|chronolog|milestone/.test(text)) return "Timeline";
  if (/steps?|how to|itinerary|day \d|plan/.test(text)) return "Steps";
  if (section.items.every((item) => item.value.trim())) return "Table";
  return "FactList";
}

/** Trusted, deterministic fallback. It never claims to be model-authored. */
export function createDefaultGroundedCompositionPlan(
  envelopeInput: InformationEnvelopeV1,
): GroundedCompositionPlan {
  const envelope = informationEnvelopeV1Schema.parse(envelopeInput);
  const hasIdentityMedia = (envelope.media ?? []).some(
    (item) => item.role === "identity",
  );
  const topology = hasIdentityMedia
    ? "focal-split"
    : isExecutiveBriefingRequest(envelope.originalRequest)
      ? "responsive-grid"
      : /compar|versus|\bvs\b/.test(envelope.originalRequest.toLowerCase())
        ? "responsive-grid"
        : /timeline|chronolog/.test(envelope.originalRequest.toLowerCase())
          ? "timeline-spine"
          : "editorial-stack";
  return parseGroundedCompositionPlan(envelope, {
    version: "1.0",
    topology,
    placements: envelope.sections.map((section, index) => ({
      sectionId: section.id,
      component: defaultComponent(envelope, section, index),
      itemIds: section.items.map((item) => item.id),
      importance: index === 0 ? "primary" : "supporting",
    })),
  });
}

function shapeForComponent(
  component: GroundedCompositionPlan["placements"][number]["component"],
): InformationShape {
  return {
    Hero: "narrative",
    Card: "hierarchy",
    Text: "narrative",
    FactList: "facts",
    ColorPalette: "media-artifact",
    Badge: "facts",
    Metric: "metrics",
    Chart: "trend",
    Donut: "metrics",
    Comparison: "comparison",
    Checklist: "tasks-progress",
    Steps: "sequence",
    Table: "record",
    Timeline: "chronology",
    Progress: "tasks-progress",
    Callout: "narrative",
    Quote: "narrative",
    Input: "choice-input",
    ChoiceGroup: "choice-input",
    Tabs: "choice-input",
    MapPanel: "spatial",
    Calendar: "chronology",
    CodeBlock: "media-artifact",
    Visual: "media-artifact",
  }[component] as InformationShape;
}

function placementIsSelectable(
  envelope: InformationEnvelopeV1,
  placement: GroundedCompositionPlan["placements"][number],
) {
  if (["ChoiceGroup", "Tabs"].includes(placement.component)) return true;
  return (
    placement.component === "Comparison" &&
    /\b(choose|select|decide|decision|pick)\b/i.test(envelope.originalRequest)
  );
}

function makeNode(
  input: Partial<UINode> & Pick<UINode, "id" | "type">,
): UINode {
  return uiNodeSchema.parse({
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
    ...input,
  });
}

/**
 * Envelope IDs identify grounded facts and intentionally allow separators such
 * as `_`, `.`, and `:`. Representation slots are a separate internal namespace
 * with a stricter hyphen-only contract, so never copy envelope IDs into it.
 */
function groundedSectionSlotId(index: number) {
  return `section-${index + 1}`;
}

function createRepresentation(
  envelope: InformationEnvelopeV1,
  plan: GroundedCompositionPlan,
): RepresentationPlan {
  const media = envelope.media ?? [];
  const hasIdentityMedia = media.some((item) => item.role === "identity");
  const isExecutiveBriefing =
    !hasIdentityMedia && isExecutiveBriefingRequest(envelope.originalRequest);
  const isComparison =
    !hasIdentityMedia &&
    !isExecutiveBriefing &&
    plan.placements.some((placement) => placement.component === "Comparison");
  return representationPlanSchema.parse({
    version: "1.0",
    mode:
      hasIdentityMedia || isExecutiveBriefing || isComparison
        ? "blueprint"
        : "open",
    blueprintIds: [
      hasIdentityMedia
        ? "profile-reference"
        : isExecutiveBriefing
          ? "briefing"
          : isComparison
            ? "compare-decide"
            : "open-composition",
    ],
    confidence: 1,
    userJob: envelope.originalRequest.slice(0, 160),
    informationShapes: [
      ...new Set([
        ...plan.placements.map((placement) =>
          shapeForComponent(placement.component),
        ),
        ...(media.length ? ["media-artifact" as const] : []),
      ]),
    ],
    interactionLevel: plan.placements.some((placement) =>
      ["Checklist", "Input"].includes(placement.component),
    )
      ? "edit"
      : plan.placements.some((placement) =>
            placementIsSelectable(envelope, placement),
          )
        ? "select"
        : "read",
    scale:
      envelope.sections.length <= 2
        ? "compact"
        : envelope.sections.length <= 5
          ? "compound"
          : "workflow",
    topology: plan.topology,
    noveltyBudget: isExecutiveBriefing || isComparison ? 0.35 : 0.5,
    slots: [
      ...media.map((item, index) => ({
        id: `media-${index + 1}`,
        role:
          item.role === "identity"
            ? "identity"
            : item.role === "evidence"
              ? "evidence"
              : "featured",
        shape: "media-artifact" as const,
        priority: "supporting" as const,
        required: false,
      })),
      ...plan.placements.map((placement, index) => ({
        id: groundedSectionSlotId(index),
        role: isExecutiveBriefing
          ? executiveBriefingRole(envelope.sections[index]!, index)
          : isComparison
            ? placement.component === "Comparison"
              ? "criteria"
              : placement.component === "ChoiceGroup"
                ? "selection"
                : /recommend|verdict|answer|summary/i.test(
                      envelope.sections[index]!.title,
                    )
                  ? "recommendation"
                  : index <= 1
                    ? "context"
                    : "evidence"
            : index === 0
              ? "primary"
              : index === 1
                ? "context"
                : index === 2
                  ? "evidence"
                  : "exploration",
        shape: shapeForComponent(placement.component),
        priority: placement.importance,
        required: placement.importance === "primary",
      })),
    ],
  });
}

export interface GroundedCompilation {
  experience: UIExperience;
  envelope: InformationEnvelopeV1;
  composition: GroundedCompositionPlan;
}

/** Bind a layout-only plan to exact host copy. No factual string is accepted from the layout plan. */
export function compileGroundedInformationUI(
  envelopeInput: InformationEnvelopeV1,
  planInput: GroundedCompositionPlan,
  responseId = `grounded-${Date.now().toString(36)}`,
): GroundedCompilation {
  const envelope = informationEnvelopeV1Schema.parse(envelopeInput);
  const composition = parseGroundedCompositionPlan(envelope, planInput);
  const representation = createRepresentation(envelope, composition);
  const sectionMap = new Map(
    envelope.sections.map((section) => [section.id, section]),
  );
  const mediaNodes = (envelope.media ?? []).map((media, index) =>
    makeNode({
      id: `media-${media.id}`,
      type: "Image",
      slot: `media-${index + 1}`,
      importance: media.role === "identity" ? "primary" : "supporting",
      relationship: "grouped",
      mediaRole: media.role,
      variant: media.role === "identity" ? "portrait" : "landscape",
      title: media.alt.slice(0, 110),
      text: media.caption,
      label: (media.subject ?? media.alt).slice(0, 80),
      value: media.url,
      meta: media.sourceId,
    }),
  );
  const contentNodes = composition.placements.map((placement, index) => {
    const section = sectionMap.get(placement.sectionId)!;
    const itemMap = new Map(section.items.map((item) => [item.id, item]));
    const inputItem =
      placement.component === "Input"
        ? itemMap.get(placement.itemIds[0]!)
        : undefined;
    const singleItem = singleItemComponents.has(placement.component)
      ? itemMap.get(placement.itemIds[0]!)
      : undefined;
    const isProgressSurface =
      placement.component === "Donut" || placement.component === "Progress";
    const copyDetail = singleItem?.detail ?? "";
    return makeNode({
      id: `section-${section.id}`,
      type: placement.component,
      slot: groundedSectionSlotId(index),
      importance: placement.importance,
      relationship: "grouped",
      title: section.title,
      text: inputItem
        ? [section.body, inputItem.detail]
            .filter(Boolean)
            .join(" ")
            .slice(0, 500)
        : [section.body, copyDetail].filter(Boolean).join(" ").slice(0, 500),
      label: singleItem?.label.slice(0, 80) ?? "",
      value:
        singleItem?.value.slice(0, 120) ??
        (section.body.length > 500 ? section.body : ""),
      meta: [singleItem?.sourceIds.join(","), section.sourceIds.join(",")]
        .filter(Boolean)
        .join(",")
        .slice(0, 100),
      progress: isProgressSurface
        ? groundedProgress(singleItem?.value ?? "")
        : null,
      action:
        placement.component === "Checklist"
          ? { type: "toggle", prompt: "", targetId: section.id, value: "" }
          : placementIsSelectable(envelope, placement)
            ? { type: "select", prompt: "", targetId: section.id, value: "" }
            : { type: "none", prompt: "", targetId: "", value: "" },
      items: placement.itemIds.map((id) => {
        const item = itemMap.get(id)!;
        return {
          id: item.id,
          label: item.label.slice(0, 90),
          value: item.value.slice(0, 120),
          detail: item.detail,
          tone: "neutral" as const,
          progress:
            placement.component === "Chart"
              ? groundedProgress(item.value)
              : null,
        };
      }),
    });
  });
  const continuationPlacement = composition.placements.find(
    (placement) =>
      placement.component === "Input" ||
      placementIsSelectable(envelope, placement),
  );
  const continuationPlacementIndex = continuationPlacement
    ? composition.placements.indexOf(continuationPlacement)
    : -1;
  const continuationNode = continuationPlacement
    ? makeNode({
        id: "continue-with-state",
        type: "Button",
        slot: groundedSectionSlotId(continuationPlacementIndex),
        importance: "supporting",
        relationship: "continuation",
        label: "Continue with this view",
        action: {
          type: "prompt",
          prompt:
            envelope.suggestedRefinements[0] ??
            "Refine this view using my current selections and inputs.",
          targetId: continuationPlacement.sectionId,
          value: "",
        },
      })
    : null;
  const layoutType =
    composition.topology === "horizontal-rail"
      ? "Rail"
      : composition.topology === "responsive-grid" ||
          composition.topology === "focal-split"
        ? "Grid"
        : "Stack";
  const layout = makeNode({
    id: "grounded-layout",
    type: layoutType,
    columns: layoutType === "Grid" ? 2 : 1,
    children: [
      ...mediaNodes.map((node) => node.id),
      ...contentNodes.map((node) => node.id),
      ...(continuationNode ? [continuationNode.id] : []),
    ],
  });
  const root = makeNode({ id: "root", type: "Page", children: [layout.id] });
  const isComparisonRepresentation =
    representation.blueprintIds[0] === "compare-decide";
  const experience = uiExperienceSchema.parse({
    version: "4.0",
    responseId,
    goal: envelope.originalRequest.slice(0, 160),
    representation,
    screen: {
      title: envelope.sections[0]!.title.slice(0, 72),
      contextLabel: isExecutiveBriefingRequest(envelope.originalRequest)
        ? "Executive briefing"
        : isComparisonRepresentation
          ? "Comparison"
          : "Interactive answer",
    },
    nodes: [
      root,
      layout,
      ...mediaNodes,
      ...contentNodes,
      ...(continuationNode ? [continuationNode] : []),
    ],
    suggestions: envelope.suggestedRefinements,
  });
  return { experience, envelope, composition };
}

export function formatInformationEnvelopeFallback(
  envelopeInput: InformationEnvelopeV1,
) {
  const envelope = informationEnvelopeV1Schema.parse(envelopeInput);
  if (!envelope.sources.length) return envelope.groundedAnswer;
  const sources = envelope.sources
    .map((source) => `- ${source.title}: ${source.url}`)
    .join("\n");
  return `${envelope.groundedAnswer}\n\nSources\n${sources}`;
}

export function buildGroundedCompositionInstructions(
  envelopeInput: InformationEnvelopeV1,
) {
  const envelope = informationEnvelopeV1Schema.parse(envelopeInput);
  return `You are the Fify grounded composition stage. Choose only topology, component type, order, and importance.\nNever write, rewrite, infer, summarize, or add factual copy, links, dates, prices, or citations.\nReference every section and every item exactly once using these IDs:\n${envelope.sections.map((section) => `- ${section.id}: ${section.items.map((item) => item.id).join(", ") || "no items"}`).join("\n")}\nUse Text or Callout for sections with fewer than two items unless a single-value semantic surface fits.\nUse ColorPalette only for hexadecimal values; Chart, Donut, and Progress only for explicit numeric values from 0 to 100.\nMapPanel, Calendar, Chart, ColorPalette, and other collection surfaces require at least two items. Never choose a component that would hide a referenced item.`;
}

export function buildGroundedCompositionJsonSchema(
  envelopeInput: InformationEnvelopeV1,
): Record<string, unknown> {
  const envelope = informationEnvelopeV1Schema.parse(envelopeInput);
  const sectionIds = envelope.sections.map((section) => section.id);
  const itemIds = envelope.sections.flatMap((section) =>
    section.items.map((item) => item.id),
  );
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      version: { type: "string", const: "1.0" },
      topology: {
        type: "string",
        enum: [
          "editorial-stack",
          "responsive-grid",
          "focal-split",
          "horizontal-rail",
          "timeline-spine",
        ],
      },
      placements: {
        type: "array",
        minItems: envelope.sections.length,
        maxItems: envelope.sections.length,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            sectionId: { type: "string", enum: sectionIds },
            component: { type: "string", enum: [...groundedComponentTypes] },
            itemIds: {
              type: "array",
              items: { type: "string", enum: itemIds },
              maxItems: 12,
            },
            importance: {
              type: "string",
              enum: ["primary", "supporting", "quiet"],
            },
          },
          required: ["sectionId", "component", "itemIds", "importance"],
        },
      },
    },
    required: ["version", "topology", "placements"],
  };
}
