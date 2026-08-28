import { informationMediaV1Schema } from "@fify/core";

type PresentationItem = { id: string; [key: string]: unknown };
type PresentationSection = {
  id: string;
  items: PresentationItem[];
  [key: string]: unknown;
};

export type InformationEnvelopeInput = {
  sources: Array<{ id: string; [key: string]: unknown }>;
  media?: Array<Record<string, unknown>>;
  sections: PresentationSection[];
  suggestedRefinements: string[];
  continuationState?: unknown;
  [key: string]: unknown;
};

export type PresentationIdRepair = {
  path: Array<string | number>;
  from: string;
  to: string;
};

export type OptionalMediaDiagnostic = {
  path: Array<string | number>;
  action: "dropped" | "repaired";
  message: string;
};

function normalizeOptionalMedia(input: InformationEnvelopeInput): {
  media: Array<{ id: string; [key: string]: unknown }> | undefined;
  diagnostics: OptionalMediaDiagnostic[];
} {
  if (!input.media) return { media: undefined, diagnostics: [] };

  const diagnostics: OptionalMediaDiagnostic[] = [];
  const sourceIds = new Set(input.sources.map((source) => source.id));
  const authoritativeIds = new Set([
    ...sourceIds,
    ...input.sections.map((section) => section.id),
    ...input.sections.flatMap((section) =>
      section.items.map((item) => item.id),
    ),
  ]);
  const acceptedMediaIds = new Set<string>();
  const media: Array<{ id: string; [key: string]: unknown }> = [];

  input.media.forEach((rawMedia, index) => {
    if (media.length >= 4) {
      diagnostics.push({
        path: ["media", index],
        action: "dropped",
        message: "Optional media exceeds the four-item display limit.",
      });
      return;
    }

    const candidate =
      rawMedia.role === "product"
        ? { ...rawMedia, role: "illustration" }
        : rawMedia;
    if (candidate !== rawMedia) {
      diagnostics.push({
        path: ["media", index, "role"],
        action: "repaired",
        message: "Mapped presentation role 'product' to 'illustration'.",
      });
    }

    const parsed = informationMediaV1Schema.safeParse(candidate);
    if (!parsed.success) {
      diagnostics.push({
        path: ["media", index],
        action: "dropped",
        message: parsed.error.issues
          .slice(0, 2)
          .map((issue) => issue.message)
          .join(" "),
      });
      return;
    }

    if (!sourceIds.has(parsed.data.sourceId)) {
      diagnostics.push({
        path: ["media", index, "sourceId"],
        action: "dropped",
        message: `Optional media references unknown source '${parsed.data.sourceId}'.`,
      });
      return;
    }

    if (
      authoritativeIds.has(parsed.data.id) ||
      acceptedMediaIds.has(parsed.data.id)
    ) {
      diagnostics.push({
        path: ["media", index, "id"],
        action: "dropped",
        message: `Optional media ID '${parsed.data.id}' is not globally unique.`,
      });
      return;
    }

    acceptedMediaIds.add(parsed.data.id);
    media.push(parsed.data);
  });

  return { media, diagnostics };
}

function suffixedSemanticId(
  original: string,
  suffix: string,
  unavailable: Set<string>,
) {
  for (let index = 1; index < 100; index += 1) {
    const ending = index === 1 ? `-${suffix}` : `-${suffix}-${index}`;
    const prefix = original.slice(0, Math.max(1, 64 - ending.length));
    const candidate = `${prefix}${ending}`;
    if (!unavailable.has(candidate)) return candidate;
  }
  throw new Error(`Unable to repair duplicate semantic ID '${original}'.`);
}

/**
 * Normalize safe presentation-only fields before the strict provenance schema
 * runs. Source and media IDs are never rewritten. Continuations are left
 * untouched because their state references make an ambiguous duplicate unsafe
 * to remap automatically.
 */
export function normalizePresentationInput<T extends InformationEnvelopeInput>(
  input: T,
): {
  value: T;
  repairs: PresentationIdRepair[];
  mediaDiagnostics: OptionalMediaDiagnostic[];
} {
  const normalizedMedia = normalizeOptionalMedia(input);
  const suggestedRefinements = input.suggestedRefinements.slice(0, 2);
  const refinementsChanged =
    suggestedRefinements.length !== input.suggestedRefinements.length;
  const mediaChanged =
    input.media !== undefined &&
    (normalizedMedia.diagnostics.length > 0 ||
      normalizedMedia.media?.length !== input.media.length);
  const presentationInput = (
    mediaChanged
      ? { ...input, media: normalizedMedia.media }
      : input
  ) as T;
  if (input.continuationState) {
    return {
      value:
        refinementsChanged || mediaChanged
          ? ({ ...presentationInput, suggestedRefinements } as T)
          : input,
      repairs: [],
      mediaDiagnostics: normalizedMedia.diagnostics,
    };
  }

  const repairs: PresentationIdRepair[] = [];
  const reserved = new Set([
    ...presentationInput.sources.map((source) => source.id),
    ...(presentationInput.media ?? []).flatMap((media) =>
      typeof media.id === "string" ? [media.id] : [],
    ),
  ]);
  const originalItemIds = new Set(
    presentationInput.sections.flatMap((section) =>
      section.items.map((item) => item.id),
    ),
  );

  const sectionIds = new Set(reserved);
  const sections = presentationInput.sections.map((section, sectionIndex) => {
    let id = section.id;
    const unavailable = new Set([...sectionIds, ...originalItemIds]);
    if (unavailable.has(id)) {
      const repaired = suffixedSemanticId(id, "section", unavailable);
      repairs.push({
        path: ["sections", sectionIndex, "id"],
        from: id,
        to: repaired,
      });
      id = repaired;
    }
    sectionIds.add(id);
    return { ...section, id };
  });

  const used = new Set(sectionIds);
  const normalizedSections = sections.map((section, sectionIndex) => ({
    ...section,
    items: section.items.map((item, itemIndex) => {
      let id = item.id;
      if (used.has(id)) {
        const repaired = suffixedSemanticId(id, "item", used);
        repairs.push({
          path: ["sections", sectionIndex, "items", itemIndex, "id"],
          from: id,
          to: repaired,
        });
        id = repaired;
      }
      used.add(id);
      return { ...item, id };
    }),
  }));

  if (repairs.length === 0 && !refinementsChanged && !mediaChanged) {
    return {
      value: input,
      repairs,
      mediaDiagnostics: normalizedMedia.diagnostics,
    };
  }
  return {
    value: {
      ...presentationInput,
      sections: normalizedSections,
      suggestedRefinements,
    } as T,
    repairs,
    mediaDiagnostics: normalizedMedia.diagnostics,
  };
}
