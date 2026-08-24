import { z } from "zod";
import {
  informationEnvelopeV1Schema,
  type InformationEnvelopeV1,
} from "./grounded.js";
import {
  uiExperienceSchema,
  uiNodeSchema,
  type UIExperience,
  type UINode,
} from "./language.js";

export const groundingModes = ["required", "helpful", "none"] as const;
export type GroundingMode = (typeof groundingModes)[number];

export interface GroundingPolicy {
  mode: GroundingMode;
  reason: string;
  ttlMs: number;
  failClosed: boolean;
}

export const webGroundingBenchmarkCasesV1 = [
  {
    id: "latest-news",
    prompt: "What is the latest AI news today?",
    expectedMode: "required",
  },
  {
    id: "live-score",
    prompt: "What is the live NBA score right now?",
    expectedMode: "required",
  },
  {
    id: "weather",
    prompt: "Will it rain tomorrow in Shanghai?",
    expectedMode: "required",
  },
  {
    id: "market-price",
    prompt: "What is the current price of Bitcoin?",
    expectedMode: "required",
  },
  {
    id: "office-holder",
    prompt: "Who is the CEO of Apple?",
    expectedMode: "required",
  },
  {
    id: "explicit-search",
    prompt: "Search the web for recent accessibility research",
    expectedMode: "required",
  },
  {
    id: "recommendation",
    prompt: "Recommend a laptop for a design student",
    expectedMode: "helpful",
  },
  {
    id: "travel",
    prompt: "Compare hotels for a Tokyo design trip",
    expectedMode: "helpful",
  },
  {
    id: "timeless",
    prompt: "Explain why the sky is blue",
    expectedMode: "none",
  },
  {
    id: "creative",
    prompt: "Create a calm color palette for my app",
    expectedMode: "none",
  },
  {
    id: "supplied-copy",
    prompt: "Rewrite this paragraph to be clearer",
    expectedMode: "none",
  },
  {
    id: "user-opt-out",
    prompt: "Without web search, explain gravity",
    expectedMode: "none",
  },
] as const satisfies readonly {
  id: string;
  prompt: string;
  expectedMode: GroundingMode;
}[];

const noSearchPattern =
  /\b(?:do not|don't|dont|without|no)\s+(?:use\s+the\s+)?(?:web|internet|search|browse)\b/i;
const explicitSearchPattern =
  /\b(?:search|browse|look\s+up|find\s+online|from\s+the\s+web|internet|web[- ]?search)\b/i;
const currentPattern =
  /\b(?:latest|today|tonight|tomorrow|now|right\s+now|real[- ]?time|live|recent|this\s+(?:week|month|year|season)|breaking|updated?)\b/i;
const volatileSubjectPattern =
  /\b(?:news|weather|forecast|price|stock|market|score|standings?|fixture|election|president|prime\s+minister|governor|mayor|ceo|law|regulation|availability|release\s+date|traffic|exchange\s+rate)\b/i;
const recommendationPattern =
  /\b(?:best|recommend|recommendation|compare|versus|\bvs\b|buy|purchase|restaurant|hotel|trip|travel|visit|near\s+me|research|review|options?)\b/i;
const suppliedContentPattern =
  /\b(?:rewrite|rephrase|proofread|translate|summarize\s+(?:this|the\s+following)|turn\s+(?:this|these)\s+into)\b/i;
const creativePattern =
  /\b(?:brainstorm|invent|write\s+(?:a|an|me)|draft\s+(?:a|an)|create\s+(?:a|an)|color\s+palette|poem|story|tagline)\b/i;

export function promptExplicitlyDisablesGrounding(prompt: string) {
  return noSearchPattern.test(prompt.trim());
}

/** Fast, deterministic search policy. It never spends a model call to decide whether to search. */
export function groundingPolicyForPrompt(prompt: string): GroundingPolicy {
  const normalized = prompt.trim();
  if (promptExplicitlyDisablesGrounding(normalized))
    return {
      mode: "none",
      reason: "The user explicitly disabled internet retrieval.",
      ttlMs: 0,
      failClosed: false,
    };
  if (explicitSearchPattern.test(normalized))
    return {
      mode: "required",
      reason: "The user explicitly requested web retrieval.",
      ttlMs: 5 * 60_000,
      failClosed: true,
    };
  if (
    currentPattern.test(normalized) ||
    volatileSubjectPattern.test(normalized)
  ) {
    const veryVolatile =
      /\b(?:news|weather|forecast|price|score|live|right\s+now|today|tonight)\b/i.test(
        normalized,
      );
    return {
      mode: "required",
      reason: "The answer depends on time-sensitive public information.",
      ttlMs: veryVolatile ? 3 * 60_000 : 15 * 60_000,
      failClosed: true,
    };
  }
  if (
    recommendationPattern.test(normalized) &&
    !suppliedContentPattern.test(normalized) &&
    !creativePattern.test(normalized)
  )
    return {
      mode: "helpful",
      reason: "Fresh external evidence could materially improve the answer.",
      ttlMs: 60 * 60_000,
      failClosed: false,
    };
  return {
    mode: "none",
    reason: "The request can be answered without external retrieval.",
    ttlMs: 0,
    failClosed: false,
  };
}

const draftItemSchema = z
  .object({
    id: z.string().min(1).max(64),
    label: z.string().min(1).max(90),
    value: z.string().max(120),
    detail: z.string().max(800),
    sourceUrls: z.array(z.string().url()).min(1).max(4),
  })
  .strict();

const draftSectionSchema = z
  .object({
    id: z.string().min(1).max(64),
    title: z.string().min(1).max(110),
    body: z.string().max(1_600),
    sourceUrls: z.array(z.string().url()).min(1).max(6),
    items: z.array(draftItemSchema).max(10),
  })
  .strict();

export const webGroundingDraftSchema = z
  .object({
    version: z.literal("1.0"),
    asOf: z.string().min(10).max(40),
    answer: z.string().min(1).max(6_000),
    locale: z.string().min(2).max(35),
    sections: z.array(draftSectionSchema).min(1).max(6),
    sources: z
      .array(
        z
          .object({
            title: z.string().min(1).max(180),
            url: z.string().url().max(2_048),
          })
          .strict(),
      )
      .min(1)
      .max(16),
  })
  .strict();

export type WebGroundingDraft = z.infer<typeof webGroundingDraftSchema>;

const sourceShape = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 180 },
    url: { type: "string", maxLength: 2_048 },
  },
  required: ["title", "url"],
} as const;
const itemShape = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1, maxLength: 64 },
    label: { type: "string", minLength: 1, maxLength: 90 },
    value: { type: "string", maxLength: 120 },
    detail: { type: "string", maxLength: 800 },
    sourceUrls: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string" },
    },
  },
  required: ["id", "label", "value", "detail", "sourceUrls"],
} as const;

export const webGroundingDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: { type: "string", const: "1.0" },
    asOf: { type: "string", minLength: 10, maxLength: 40 },
    answer: { type: "string", minLength: 1, maxLength: 6_000 },
    locale: { type: "string", minLength: 2, maxLength: 35 },
    sections: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1, maxLength: 64 },
          title: { type: "string", minLength: 1, maxLength: 110 },
          body: { type: "string", maxLength: 1_600 },
          sourceUrls: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: { type: "string" },
          },
          items: { type: "array", maxItems: 10, items: itemShape },
        },
        required: ["id", "title", "body", "sourceUrls", "items"],
      },
    },
    sources: {
      type: "array",
      minItems: 1,
      maxItems: 16,
      items: sourceShape,
    },
  },
  required: ["version", "asOf", "answer", "locale", "sections", "sources"],
} as const;

export function buildWebGroundingInstructions(now = new Date()) {
  return `You are the Fify web grounding stage. Search the public web before answering.
Current time: ${now.toISOString()}.

Return a compact, factual research packet for a later UI composer.
- Answer the exact current user request. Do not design UI.
- Prefer primary, official, and recent sources. Cross-check rankings, recommendations, or disputed facts.
- Keep only information that materially helps answer the request.
- Every section and every item must list the exact HTTPS source URLs that support it.
- The sources array must contain those same URLs with accurate titles.
- Never invent a URL, citation, date, score, price, office holder, schedule, or quote.
- asOf is the ISO-8601 time at which the facts were checked.
- Use stable kebab-case IDs and concise copy suitable for an information interface.`;
}

export interface ProviderGroundingSource {
  url: string;
  title: string;
  cited?: boolean;
}

function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
    return url.toString();
  } catch {
    return "";
  }
}

export class GroundingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroundingValidationError";
  }
}

export interface GroundingPacket {
  envelope: InformationEnvelopeV1;
  asOf: string;
  toolCalls: number;
}

export interface GroundingQualityReport {
  passed: boolean;
  issues: string[];
  sourceCoverage: number;
}

/** Deterministic release check for freshness, citation coverage, safe links, and cost bounds. */
export function evaluateGroundingPacket(
  packet: GroundingPacket,
  options: { now?: Date; maxAgeMs?: number; maxToolCalls?: number } = {},
): GroundingQualityReport {
  const issues: string[] = [];
  const knownSources = new Set(
    packet.envelope.sources.map((source) => source.id),
  );
  const claims = packet.envelope.sections.flatMap((section) => [
    section.sourceIds,
    ...section.items.map((item) => item.sourceIds),
  ]);
  const supportedClaims = claims.filter(
    (sourceIds) =>
      sourceIds.length > 0 && sourceIds.every((id) => knownSources.has(id)),
  ).length;
  const sourceCoverage = claims.length ? supportedClaims / claims.length : 0;
  if (sourceCoverage < 1)
    issues.push(
      "Every grounded section and item must reference a known source.",
    );
  if (
    packet.envelope.sources.some((source) => {
      try {
        return new URL(source.url).protocol !== "https:";
      } catch {
        return true;
      }
    })
  )
    issues.push("Every visible source link must be a valid HTTPS URL.");
  const asOf = Date.parse(packet.asOf);
  const now = (options.now ?? new Date()).getTime();
  const maxAgeMs = options.maxAgeMs ?? 24 * 60 * 60_000;
  if (!Number.isFinite(asOf) || asOf > now + 60_000 || now - asOf > maxAgeMs)
    issues.push("The grounding packet is outside its freshness budget.");
  if (packet.toolCalls < 1 || packet.toolCalls > (options.maxToolCalls ?? 2))
    issues.push("Web-search tool usage is outside the configured cost bound.");
  return { passed: issues.length === 0, issues, sourceCoverage };
}

/** Rejects model-authored URLs unless the provider confirms they were retrieved. */
export function finalizeWebGrounding(
  originalRequest: string,
  draftInput: unknown,
  providerSourcesInput: readonly ProviderGroundingSource[],
  toolCalls = 1,
): GroundingPacket {
  const draft = webGroundingDraftSchema.parse(draftInput);
  const providerSources = new Map(
    providerSourcesInput
      .map((source) => [canonicalUrl(source.url), source] as const)
      .filter(([url]) => Boolean(url)),
  );
  if (!toolCalls || providerSources.size === 0)
    throw new GroundingValidationError(
      "Web search returned no verifiable public sources.",
    );
  const authoredSources = new Map(
    draft.sources.map((source) => [canonicalUrl(source.url), source]),
  );
  const referencedUrls = new Set([
    ...authoredSources.keys(),
    ...draft.sections.flatMap((section) => [
      ...section.sourceUrls.map(canonicalUrl),
      ...section.items.flatMap((item) => item.sourceUrls.map(canonicalUrl)),
    ]),
  ]);
  const accepted = [...referencedUrls]
    .filter((url) => Boolean(url) && providerSources.has(url))
    .map(
      (url) =>
        [
          url,
          authoredSources.get(url) ?? {
            title: providerSources.get(url)?.title ?? new URL(url).hostname,
            url,
          },
        ] as const,
    );
  if (!accepted.length)
    throw new GroundingValidationError(
      "The grounded answer did not reference any retrieved source.",
    );
  const idByUrl = new Map(
    accepted.map(([url], index) => [url, `source-${index + 1}`]),
  );
  const sourceIds = (urls: readonly string[]) => [
    ...new Set(
      urls
        .map((url) => idByUrl.get(canonicalUrl(url)))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const sections = draft.sections.flatMap((section) => {
    const sectionSources = sourceIds(section.sourceUrls);
    const items = section.items.flatMap((item) => {
      const itemSources = sourceIds(item.sourceUrls);
      return itemSources.length
        ? [
            {
              id: item.id,
              label: item.label,
              value: item.value,
              detail: item.detail,
              sourceIds: itemSources,
            },
          ]
        : [];
    });
    const resolvedSectionSources = [
      ...new Set([
        ...sectionSources,
        ...items.flatMap((item) => item.sourceIds),
      ]),
    ];
    if (!resolvedSectionSources.length) return [];
    return [
      {
        id: section.id,
        title: section.title,
        body: sectionSources.length ? section.body : "",
        sourceIds: resolvedSectionSources,
        items,
      },
    ];
  });
  if (!sections.length)
    throw new GroundingValidationError(
      "The grounded answer contained no supported sections or items.",
    );
  const envelope = informationEnvelopeV1Schema.parse({
    version: "1.0",
    originalRequest,
    groundedAnswer: draft.answer,
    locale: draft.locale,
    sections,
    sources: accepted.map(([url, authored], index) => {
      const provider = providerSources.get(url)!;
      const hostname = new URL(provider.url).hostname;
      return {
        id: `source-${index + 1}`,
        title:
          provider.title && provider.title !== hostname
            ? provider.title
            : authored.title,
        url: provider.url,
      };
    }),
    suggestedRefinements: [],
  });
  return { envelope, asOf: draft.asOf, toolCalls };
}

export function groundingContextForComposer(packet: GroundingPacket) {
  const { envelope } = packet;
  return `TRUSTED WEB GROUNDING — factual authority for this answer:
Checked at: ${packet.asOf}
Answer: ${envelope.groundedAnswer}

Grounded sections:
${envelope.sections
  .map(
    (section) =>
      `- ${section.title} [${section.sourceIds.join(", ")}]: ${section.body}${section.items.length ? `\n${section.items.map((item) => `  - ${item.label}${item.value ? ` — ${item.value}` : ""}: ${item.detail} [${item.sourceIds.join(", ")}]`).join("\n")}` : ""}`,
  )
  .join("\n")}

Use only these grounded facts for time-sensitive claims. Preserve source IDs in the meta field of the factual node they support (for example: "Sources 1, 2"). Do not output URLs or invent additional current facts. The product will append visible, clickable sources.`;
}

function blankNode(input: Partial<UINode> & Pick<UINode, "id" | "type">) {
  return uiNodeSchema.parse({
    slot: "",
    importance: "quiet",
    relationship: "continuation",
    mediaRole: "none",
    variant: "plain",
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

/** Adds provider-confirmed, clickable provenance after model composition. */
export function attachGroundingSources(
  experienceInput: UIExperience,
  packet: GroundingPacket,
): UIExperience {
  const experience = uiExperienceSchema.parse(experienceInput);
  if (!packet.envelope.sources.length) return experience;
  const slotId = "web-sources";
  const sourceNode = blankNode({
    id: "web-sources",
    type: "Sources",
    slot: slotId,
    title: "Sources",
    text: "Live information checked on the web.",
    meta: `As of ${packet.asOf}`.slice(0, 100),
    items: packet.envelope.sources.slice(0, 8).map((source, index) => ({
      id: `web-source-${index + 1}`,
      label: source.title,
      value: new URL(source.url).hostname.replace(/^www\./, ""),
      detail: source.url,
      tone: "neutral",
      progress: null,
    })),
  });
  const root = experience.nodes[0]!;
  return uiExperienceSchema.parse({
    ...experience,
    representation: {
      ...experience.representation,
      informationShapes: [
        ...new Set([...experience.representation.informationShapes, "facts"]),
      ],
      slots: [
        ...experience.representation.slots,
        {
          id: slotId,
          role: "evidence",
          shape: "facts",
          priority: "optional",
          required: false,
        },
      ],
    },
    nodes: [
      { ...root, children: [...root.children, sourceNode.id] },
      ...experience.nodes.slice(1),
      sourceNode,
    ],
  });
}
