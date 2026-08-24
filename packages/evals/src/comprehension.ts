export type BenchmarkAttentionMode = "glance" | "read" | "explore" | "work";
export type BenchmarkEvidenceLevel = "semantic" | "rendered";

export interface BenchmarkFact {
  id: string;
  description: string;
  /** Every term group must match. Terms within one group are alternatives. */
  termGroups: readonly (readonly string[])[];
}

export interface BenchmarkRelationship {
  id: string;
  description: string;
  leftTerms: readonly string[];
  rightTerms: readonly string[];
  maxDistanceWords?: number;
}

export interface ComprehensionBenchmarkCase {
  id: string;
  title: string;
  prompt: string;
  sourceContent: string;
  userTask: string;
  attentionMode: BenchmarkAttentionMode;
  essentialFacts: readonly BenchmarkFact[];
  primaryFactIds: readonly string[];
  requiredRelationships?: readonly BenchmarkRelationship[];
  deferrableFacts?: readonly BenchmarkFact[];
  forbiddenClaims?: readonly BenchmarkFact[];
  wordBudget?: number;
}

export type BenchmarkArtifactFormat = "text" | "ui";
export type BenchmarkGroupRole = "primary" | "supporting" | "deferred";

export type BenchmarkRenderPayload =
  | { kind: "markdown"; markdown: string }
  | { kind: "fify-ui"; experience: unknown };

export interface BenchmarkInteractionCheck {
  id: string;
  role: string;
  name: string;
  action: "click" | "fill" | "select" | "toggle";
  passed: boolean;
  evidence: string;
}

export interface BenchmarkContentGroup {
  label: string;
  text: string;
  role: BenchmarkGroupRole;
}

export interface BenchmarkRenderCapture {
  captureVersion: "1";
  captureSource: "browser";
  aboveFoldText: string;
  viewportWidth: number;
  viewportHeight: number;
  scrollHeight: number;
  accessibilityViolations: number;
  interactiveElements: number;
  deadInteractiveElements: number;
  runtimeErrors: number;
  consoleErrors: number;
  failedRequests: number;
  interactionChecks: readonly BenchmarkInteractionCheck[];
  screenshotPath: string;
}

/** A provider- and renderer-independent capture of what a person can consume. */
export interface ComprehensionArtifact {
  format: BenchmarkArtifactFormat;
  visibleText: string;
  primaryText: string;
  deferredText?: string;
  groups?: readonly BenchmarkContentGroup[];
  /** Serializable input used to replay this answer through the real renderer. */
  renderPayload?: BenchmarkRenderPayload;
  render?: BenchmarkRenderCapture;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export interface FactEvaluation {
  id: string;
  description: string;
  inPrimary: boolean;
  visible: boolean;
  anywhere: boolean;
}

export interface RelationshipEvaluation {
  id: string;
  description: string;
  preserved: boolean;
}

export interface ComprehensionMetrics {
  score: number;
  essentialCoverage: number;
  visibleCoverage: number;
  relationshipPreservation: number;
  primarySalience: number;
  conciseness: number;
  progressiveDisclosure: number;
  nonRedundancy: number;
  grounding: number;
  scannability: number;
  visibleWords: number;
  totalWords: number;
  wordBudget: number;
  repeatedSentenceCount: number;
  primaryAboveFold: boolean | null;
  scrollScreens: number | null;
  accessibilityViolations: number | null;
  runtimeErrors: number | null;
  consoleErrors: number | null;
  failedRequests: number | null;
  interactionPassRate: number | null;
  renderEvidence: boolean;
}

export interface ComprehensionArtifactResult {
  artifact: ComprehensionArtifact;
  metrics: ComprehensionMetrics;
  essentialFacts: FactEvaluation[];
  deferrableFacts: FactEvaluation[];
  forbiddenClaims: FactEvaluation[];
  relationships: RelationshipEvaluation[];
  failures: string[];
  hardFailures: string[];
}

export interface ComprehensionComparisonResult {
  id: string;
  title: string;
  baseline: ComprehensionArtifactResult;
  fify: ComprehensionArtifactResult;
  scoreDelta: number;
  eligible: boolean;
  winner: "baseline" | "fify" | "tie" | "invalid";
}

export interface ComprehensionBenchmarkReport {
  version: "1.2";
  comparisonMode: "end-to-end-product";
  evidenceLevel: BenchmarkEvidenceLevel;
  semanticPassed: boolean;
  releasePassed: boolean;
  completeCaseSet: boolean;
  /** `passed` is deliberately release-grade; semantic-only runs cannot pass it. */
  passed: boolean;
  minimumScoreDelta: number;
  summary: {
    totalCases: number;
    eligibleCases: number;
    fifyWins: number;
    baselineWins: number;
    ties: number;
    averageBaselineScore: number;
    averageFifyScore: number;
    averageScoreDelta: number;
    averageBaselineVisibleWords: number;
    averageFifyVisibleWords: number;
    averageBaselineLatencyMs: number | null;
    averageFifyLatencyMs: number | null;
    averageBaselineOutputTokens: number | null;
    averageFifyOutputTokens: number | null;
  };
  results: ComprehensionComparisonResult[];
}

const defaultWordBudgets: Readonly<Record<BenchmarkAttentionMode, number>> = {
  glance: 60,
  read: 160,
  explore: 300,
  work: 180,
};

const scoreWeights = {
  essentialCoverage: 0.25,
  visibleCoverage: 0.1,
  relationshipPreservation: 0.1,
  primarySalience: 0.15,
  conciseness: 0.1,
  progressiveDisclosure: 0.1,
  nonRedundancy: 0.05,
  grounding: 0.1,
  scannability: 0.05,
} as const;

const maxScrollScreens: Readonly<Record<BenchmarkAttentionMode, number>> = {
  glance: 1.5,
  read: 2.5,
  explore: 5,
  work: 3,
};

function round(value: number, digits = 3): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function normalize(input: string): string {
  return input
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\p{L}\p{N}%$+./'-]+/gu, " ")
    .replace(/(^|\s)[./'-]+|[./'-]+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countBenchmarkWords(input: string): number {
  const text = normalize(input);
  return text ? text.split(" ").length : 0;
}

function normalizedWords(input: string): string[] {
  const text = normalize(input);
  return text ? text.split(" ") : [];
}

function termPositions(input: string, term: string): number[] {
  const words = normalizedWords(input);
  const target = normalizedWords(term);
  if (!target.length) return [];
  const positions: number[] = [];
  for (let index = 0; index <= words.length - target.length; index += 1) {
    if (target.every((word, offset) => words[index + offset] === word))
      positions.push(index);
  }
  return positions;
}

function includesAny(input: string, terms: readonly string[]): boolean {
  return terms.some((term) => termPositions(input, term).length > 0);
}

function matchesFact(input: string, fact: BenchmarkFact): boolean {
  return fact.termGroups.every((terms) => includesAny(input, terms));
}

const negationWords = new Set([
  "no",
  "not",
  "never",
  "neither",
  "without",
  "isn't",
  "wasn't",
  "weren't",
  "don't",
  "doesn't",
  "didn't",
  "cannot",
  "can't",
]);

function hasAssertedTerm(input: string, terms: readonly string[]): boolean {
  const words = normalizedWords(input);
  return terms.some((term) =>
    termPositions(input, term).some((position) => {
      const prefix = words.slice(Math.max(0, position - 5), position);
      return !prefix.some((word) => negationWords.has(word));
    }),
  );
}

function matchesForbiddenClaim(input: string, fact: BenchmarkFact): boolean {
  return fact.termGroups.every((terms) => hasAssertedTerm(input, terms));
}

function evaluateFacts(
  facts: readonly BenchmarkFact[],
  primaryText: string,
  visibleText: string,
  allText: string,
): FactEvaluation[] {
  return facts.map((fact) => ({
    id: fact.id,
    description: fact.description,
    inPrimary: matchesFact(primaryText, fact),
    visible: matchesFact(visibleText, fact),
    anywhere: matchesFact(allText, fact),
  }));
}

function relationshipPreserved(
  text: string,
  relationship: BenchmarkRelationship,
): boolean {
  const leftPositions = relationship.leftTerms.flatMap((term) =>
    termPositions(text, term),
  );
  const rightPositions = relationship.rightTerms.flatMap((term) =>
    termPositions(text, term),
  );
  if (!leftPositions.length || !rightPositions.length) return false;
  return leftPositions.some((left) =>
    rightPositions.some(
      (right) =>
        Math.abs(left - right) <= (relationship.maxDistanceWords ?? 40),
    ),
  );
}

function repeatedSentenceCount(text: string): number {
  const sentences = text
    .split(/(?:[.!?]+\s+|\n+)/)
    .map(normalize)
    .filter((sentence) => countBenchmarkWords(sentence) >= 5);
  return sentences.length - new Set(sentences).size;
}

function ratio(count: number, total: number): number {
  return total === 0 ? 1 : count / total;
}

function concisenessScore(words: number, budget: number): number {
  if (words <= budget) return 1;
  return Math.max(0, 1 - (words - budget) / budget);
}

function inferStructuralCues(artifact: ComprehensionArtifact): number {
  const explicitGroups = artifact.groups?.length ?? 0;
  const markdownCues = artifact.visibleText
    .split("\n")
    .filter((line) => /^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s)/.test(line)).length;
  return explicitGroups + markdownCues;
}

function scannabilityScore(
  artifact: ComprehensionArtifact,
  visibleWords: number,
): number {
  if (visibleWords <= 35) return 1;
  const desiredCues = Math.max(2, Math.ceil(visibleWords / 80));
  return Math.min(1, inferStructuralCues(artifact) / desiredCues);
}

function progressiveDisclosureScore(
  deferrable: readonly FactEvaluation[],
  deferredText: string,
): number {
  if (deferrable.length === 0) return 1;
  const deferred = new Set(
    deferrable
      .filter((fact) => fact.anywhere && !fact.visible)
      .map((fact) => fact.id),
  );
  const scores = deferrable.map((fact) => {
    if (deferred.has(fact.id) && deferredText.trim()) return 1;
    return 0;
  });
  return scores.reduce<number>((sum, value) => sum + value, 0) / scores.length;
}

function factFailures(
  label: string,
  evaluations: readonly FactEvaluation[],
): string[] {
  return evaluations
    .filter((fact) => !fact.anywhere)
    .map((fact) => `${label}: ${fact.id} (${fact.description})`);
}

/** Scores one answer without relying on a model judge or component names. */
export function evaluateComprehensionArtifact(
  benchmarkCase: ComprehensionBenchmarkCase,
  artifact: ComprehensionArtifact,
): ComprehensionArtifactResult {
  const deferredText = artifact.deferredText ?? "";
  const allText = `${artifact.visibleText}\n${deferredText}`;
  const essentialFacts = evaluateFacts(
    benchmarkCase.essentialFacts,
    artifact.primaryText,
    artifact.visibleText,
    allText,
  );
  const deferrableFacts = evaluateFacts(
    benchmarkCase.deferrableFacts ?? [],
    artifact.primaryText,
    artifact.visibleText,
    allText,
  );
  const forbiddenClaims = (benchmarkCase.forbiddenClaims ?? []).map((fact) => ({
    id: fact.id,
    description: fact.description,
    inPrimary: matchesForbiddenClaim(artifact.primaryText, fact),
    visible: matchesForbiddenClaim(artifact.visibleText, fact),
    anywhere: matchesForbiddenClaim(allText, fact),
  }));
  const relationships = (benchmarkCase.requiredRelationships ?? []).map(
    (relationship) => ({
      id: relationship.id,
      description: relationship.description,
      preserved: relationshipPreserved(allText, relationship),
    }),
  );
  const primaryIds = new Set(benchmarkCase.primaryFactIds);
  const primaryFacts = essentialFacts.filter((fact) => primaryIds.has(fact.id));
  const visibleWords = countBenchmarkWords(artifact.visibleText);
  const totalWords = countBenchmarkWords(allText);
  const wordBudget =
    benchmarkCase.wordBudget ?? defaultWordBudgets[benchmarkCase.attentionMode];
  const repeats = repeatedSentenceCount(artifact.visibleText);
  const sentenceCount = artifact.visibleText
    .split(/(?:[.!?]+\s+|\n+)/)
    .filter((sentence) => countBenchmarkWords(sentence) >= 5).length;
  const aboveFoldText = artifact.render?.aboveFoldText ?? "";
  const primaryAboveFold = artifact.render
    ? primaryFacts.every((fact) => {
        const source = benchmarkCase.essentialFacts.find(
          (candidate) => candidate.id === fact.id,
        );
        return source ? matchesFact(aboveFoldText, source) : false;
      })
    : null;
  const scrollScreens = artifact.render
    ? round(
        artifact.render.scrollHeight /
          Math.max(1, artifact.render.viewportHeight),
        2,
      )
    : null;
  const renderEvidence = Boolean(
    artifact.render?.captureVersion === "1" &&
    artifact.render?.captureSource === "browser" &&
    artifact.render.screenshotPath.trim() &&
    artifact.render.viewportWidth > 0 &&
    artifact.render.viewportHeight > 0 &&
    artifact.render.scrollHeight > 0 &&
    artifact.render.interactiveElements ===
      artifact.render.interactionChecks.length &&
    artifact.render.deadInteractiveElements ===
      artifact.render.interactionChecks.filter((check) => !check.passed).length,
  );
  const interactionPassRate = artifact.render
    ? ratio(
        artifact.render.interactionChecks.filter((check) => check.passed)
          .length,
        artifact.render.interactionChecks.length,
      )
    : null;

  const metricValues = {
    essentialCoverage: ratio(
      essentialFacts.filter((fact) => fact.anywhere).length,
      essentialFacts.length,
    ),
    visibleCoverage: ratio(
      essentialFacts.filter((fact) => fact.visible).length,
      essentialFacts.length,
    ),
    relationshipPreservation: ratio(
      relationships.filter((relationship) => relationship.preserved).length,
      relationships.length,
    ),
    primarySalience: ratio(
      primaryFacts.filter((fact) => fact.inPrimary).length,
      primaryFacts.length,
    ),
    conciseness: concisenessScore(visibleWords, wordBudget),
    progressiveDisclosure: progressiveDisclosureScore(
      deferrableFacts,
      deferredText,
    ),
    nonRedundancy: sentenceCount === 0 ? 1 : 1 - repeats / sentenceCount,
    grounding: ratio(
      forbiddenClaims.filter((claim) => !claim.anywhere).length,
      forbiddenClaims.length,
    ),
    scannability: scannabilityScore(artifact, visibleWords),
  };
  const score = Object.entries(scoreWeights).reduce(
    (sum, [key, weight]) =>
      sum + metricValues[key as keyof typeof metricValues] * weight,
    0,
  );
  const failures = [
    ...factFailures("Missing essential fact", essentialFacts),
    ...relationships
      .filter((relationship) => !relationship.preserved)
      .map(
        (relationship) =>
          `Missing relationship: ${relationship.id} (${relationship.description})`,
      ),
    ...forbiddenClaims
      .filter((claim) => claim.anywhere)
      .map(
        (claim) =>
          `Matched forbidden claim: ${claim.id} (${claim.description})`,
      ),
    ...(visibleWords > wordBudget
      ? [`Visible word budget exceeded: ${visibleWords}/${wordBudget}`]
      : []),
    ...(primaryFacts.some((fact) => !fact.inPrimary)
      ? ["The primary region does not contain every primary fact"]
      : []),
    ...(artifact.render?.accessibilityViolations
      ? [
          `Rendered output has ${artifact.render.accessibilityViolations} accessibility violation(s)`,
        ]
      : []),
    ...(artifact.render?.deadInteractiveElements
      ? [
          `Rendered output has ${artifact.render.deadInteractiveElements} dead interactive element(s)`,
        ]
      : []),
    ...(artifact.render?.runtimeErrors
      ? [
          `Rendered output raised ${artifact.render.runtimeErrors} runtime error(s)`,
        ]
      : []),
    ...(artifact.render?.consoleErrors
      ? [
          `Rendered output logged ${artifact.render.consoleErrors} console error(s)`,
        ]
      : []),
    ...(artifact.render?.failedRequests
      ? [
          `Rendered output had ${artifact.render.failedRequests} failed request(s)`,
        ]
      : []),
    ...(artifact.render && !renderEvidence
      ? ["Rendered evidence is incomplete or internally inconsistent"]
      : []),
    ...(primaryAboveFold === false
      ? ["The primary facts are not above the fold"]
      : []),
    ...(scrollScreens !== null &&
    scrollScreens > maxScrollScreens[benchmarkCase.attentionMode]
      ? [
          `Rendered output exceeds the ${benchmarkCase.attentionMode} scroll budget: ${scrollScreens}/${maxScrollScreens[benchmarkCase.attentionMode]} screens`,
        ]
      : []),
  ];
  const hardFailures = [
    ...factFailures("Missing essential fact", essentialFacts),
    ...relationships
      .filter((relationship) => !relationship.preserved)
      .map(
        (relationship) =>
          `Missing relationship: ${relationship.id} (${relationship.description})`,
      ),
    ...forbiddenClaims
      .filter((claim) => claim.anywhere)
      .map(
        (claim) =>
          `Matched forbidden claim: ${claim.id} (${claim.description})`,
      ),
    ...(artifact.render?.accessibilityViolations
      ? [
          `Rendered output has ${artifact.render.accessibilityViolations} accessibility violation(s)`,
        ]
      : []),
    ...(artifact.render?.deadInteractiveElements
      ? [
          `Rendered output has ${artifact.render.deadInteractiveElements} dead interactive element(s)`,
        ]
      : []),
    ...(artifact.render?.runtimeErrors
      ? [
          `Rendered output raised ${artifact.render.runtimeErrors} runtime error(s)`,
        ]
      : []),
    ...(artifact.render?.consoleErrors
      ? [
          `Rendered output logged ${artifact.render.consoleErrors} console error(s)`,
        ]
      : []),
    ...(artifact.render?.failedRequests
      ? [
          `Rendered output had ${artifact.render.failedRequests} failed request(s)`,
        ]
      : []),
    ...(artifact.render && !renderEvidence
      ? ["Rendered evidence is incomplete or internally inconsistent"]
      : []),
    ...(primaryAboveFold === false
      ? ["The primary facts are not above the fold"]
      : []),
    ...(scrollScreens !== null &&
    scrollScreens > maxScrollScreens[benchmarkCase.attentionMode]
      ? [
          `Rendered output exceeds the ${benchmarkCase.attentionMode} scroll budget: ${scrollScreens}/${maxScrollScreens[benchmarkCase.attentionMode]} screens`,
        ]
      : []),
  ];

  return {
    artifact,
    metrics: {
      score: round(score * 100, 1),
      ...(Object.fromEntries(
        Object.entries(metricValues).map(([key, value]) => [key, round(value)]),
      ) as Omit<
        ComprehensionMetrics,
        | "score"
        | "visibleWords"
        | "totalWords"
        | "wordBudget"
        | "repeatedSentenceCount"
        | "primaryAboveFold"
        | "scrollScreens"
        | "accessibilityViolations"
        | "runtimeErrors"
        | "consoleErrors"
        | "failedRequests"
        | "interactionPassRate"
        | "renderEvidence"
      >),
      visibleWords,
      totalWords,
      wordBudget,
      repeatedSentenceCount: repeats,
      primaryAboveFold,
      scrollScreens,
      accessibilityViolations: artifact.render?.accessibilityViolations ?? null,
      runtimeErrors: artifact.render?.runtimeErrors ?? null,
      consoleErrors: artifact.render?.consoleErrors ?? null,
      failedRequests: artifact.render?.failedRequests ?? null,
      interactionPassRate,
      renderEvidence,
    },
    essentialFacts,
    deferrableFacts,
    forbiddenClaims,
    relationships,
    failures,
    hardFailures,
  };
}

function average(values: readonly number[]): number {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function optionalAverage(
  values: readonly (number | undefined)[],
): number | null {
  const present = values.filter(
    (value): value is number => typeof value === "number",
  );
  return present.length ? round(average(present), 1) : null;
}

export function compareComprehensionArtifacts(
  benchmarkCase: ComprehensionBenchmarkCase,
  baseline: ComprehensionArtifact,
  fify: ComprehensionArtifact,
  minimumScoreDelta = 5,
): ComprehensionComparisonResult {
  const baselineResult = evaluateComprehensionArtifact(benchmarkCase, baseline);
  const fifyResult = evaluateComprehensionArtifact(benchmarkCase, fify);
  const scoreDelta = round(
    fifyResult.metrics.score - baselineResult.metrics.score,
    1,
  );
  const eligible =
    baselineResult.hardFailures.length === 0 &&
    fifyResult.hardFailures.length === 0;
  return {
    id: benchmarkCase.id,
    title: benchmarkCase.title,
    baseline: baselineResult,
    fify: fifyResult,
    scoreDelta,
    eligible,
    winner: !eligible
      ? "invalid"
      : scoreDelta >= minimumScoreDelta
        ? "fify"
        : scoreDelta <= -minimumScoreDelta
          ? "baseline"
          : "tie",
  };
}

export async function runComprehensionBenchmark(input: {
  cases: readonly ComprehensionBenchmarkCase[];
  generateBaseline: (
    benchmarkCase: ComprehensionBenchmarkCase,
  ) => Promise<ComprehensionArtifact>;
  generateFify: (
    benchmarkCase: ComprehensionBenchmarkCase,
  ) => Promise<ComprehensionArtifact>;
  minimumScoreDelta?: number;
  releaseCaseIds?: readonly string[];
}): Promise<ComprehensionBenchmarkReport> {
  const minimumScoreDelta = input.minimumScoreDelta ?? 5;
  const results: ComprehensionComparisonResult[] = [];
  for (const benchmarkCase of input.cases) {
    const [baseline, fify] = await Promise.all([
      input.generateBaseline(benchmarkCase),
      input.generateFify(benchmarkCase),
    ]);
    results.push(
      compareComprehensionArtifacts(
        benchmarkCase,
        baseline,
        fify,
        minimumScoreDelta,
      ),
    );
  }
  const deltas = results.map((result) => result.scoreDelta);
  const averageScoreDelta = average(deltas);
  const fifyWins = results.filter(
    (result) => result.winner === "fify",
  ).length;
  const eligibleCases = results.filter((result) => result.eligible).length;
  const allPairsEligible = eligibleCases === results.length;
  const semanticPassed =
    results.length > 0 &&
    allPairsEligible &&
    averageScoreDelta >= minimumScoreDelta &&
    fifyWins >= Math.ceil(results.length * 0.6);
  const selectedIds = new Set(results.map((result) => result.id));
  const releaseIds = new Set(input.releaseCaseIds ?? selectedIds);
  const completeCaseSet =
    selectedIds.size === releaseIds.size &&
    [...releaseIds].every((id) => selectedIds.has(id));
  const renderedEvidence = results.every(
    (result) =>
      result.baseline.metrics.renderEvidence &&
      result.fify.metrics.renderEvidence,
  );
  const releasePassed = semanticPassed && completeCaseSet && renderedEvidence;
  return {
    version: "1.2",
    comparisonMode: "end-to-end-product",
    evidenceLevel: renderedEvidence ? "rendered" : "semantic",
    semanticPassed,
    releasePassed,
    completeCaseSet,
    passed: releasePassed,
    minimumScoreDelta,
    summary: {
      totalCases: results.length,
      eligibleCases,
      fifyWins,
      baselineWins: results.filter((result) => result.winner === "baseline")
        .length,
      ties: results.filter((result) => result.winner === "tie").length,
      averageBaselineScore: round(
        average(results.map((result) => result.baseline.metrics.score)),
        1,
      ),
      averageFifyScore: round(
        average(results.map((result) => result.fify.metrics.score)),
        1,
      ),
      averageScoreDelta: round(averageScoreDelta, 1),
      averageBaselineVisibleWords: round(
        average(results.map((result) => result.baseline.metrics.visibleWords)),
        1,
      ),
      averageFifyVisibleWords: round(
        average(results.map((result) => result.fify.metrics.visibleWords)),
        1,
      ),
      averageBaselineLatencyMs: optionalAverage(
        results.map((result) => result.baseline.artifact.latencyMs),
      ),
      averageFifyLatencyMs: optionalAverage(
        results.map((result) => result.fify.artifact.latencyMs),
      ),
      averageBaselineOutputTokens: optionalAverage(
        results.map((result) => result.baseline.artifact.outputTokens),
      ),
      averageFifyOutputTokens: optionalAverage(
        results.map((result) => result.fify.artifact.outputTokens),
      ),
    },
    results,
  };
}

/** Creates a minimal capture for a normal Markdown or plain-text answer. */
export function textComprehensionArtifact(text: string): ComprehensionArtifact {
  const blocks = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const firstSubstantiveBlock = blocks.find(
    (block) => !/^#{1,6}\s+[^\n]+$/.test(block),
  );
  const primaryText = firstSubstantiveBlock ?? blocks[0] ?? text;
  return {
    format: "text",
    renderPayload: { kind: "markdown", markdown: text },
    visibleText: text,
    primaryText,
    groups: blocks.map((block, index) => ({
      label: index === 0 ? "Opening" : `Block ${index + 1}`,
      text: block,
      role: index === 0 ? "primary" : "supporting",
    })),
  };
}
