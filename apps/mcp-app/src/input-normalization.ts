type PresentationItem = { id: string; [key: string]: unknown };
type PresentationSection = {
  id: string;
  items: PresentationItem[];
  [key: string]: unknown;
};

export type InformationEnvelopeInput = {
  sources: Array<{ id: string; [key: string]: unknown }>;
  media?: Array<{ id: string; [key: string]: unknown }>;
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
): { value: T; repairs: PresentationIdRepair[] } {
  const suggestedRefinements = input.suggestedRefinements.slice(0, 2);
  const refinementsChanged =
    suggestedRefinements.length !== input.suggestedRefinements.length;
  if (input.continuationState) {
    return {
      value: refinementsChanged
        ? ({ ...input, suggestedRefinements } as T)
        : input,
      repairs: [],
    };
  }

  const repairs: PresentationIdRepair[] = [];
  const reserved = new Set([
    ...input.sources.map((source) => source.id),
    ...(input.media ?? []).map((media) => media.id),
  ]);
  const originalItemIds = new Set(
    input.sections.flatMap((section) => section.items.map((item) => item.id)),
  );

  const sectionIds = new Set(reserved);
  const sections = input.sections.map((section, sectionIndex) => {
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

  if (repairs.length === 0 && !refinementsChanged) {
    return { value: input, repairs };
  }
  return {
    value: {
      ...input,
      sections: normalizedSections,
      suggestedRefinements,
    } as T,
    repairs,
  };
}
