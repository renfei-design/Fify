export * from "./comprehension.js";
export * from "./comprehension-cases.js";

export interface PlanEvalCase<TPlan> {
  id: string;
  prompt: string;
  currentPlan?: TPlan;
  expectedComponents?: readonly string[];
  forbiddenComponents?: readonly string[];
  expectedStableIds?: readonly string[];
  assert?: (plan: TPlan) => string[] | void;
}

export interface PlanEvalAdapter<TPlan> {
  validate: (plan: unknown) => TPlan;
  components: (plan: TPlan) => readonly string[];
  semanticIds: (plan: TPlan) => readonly string[];
}

export interface PlanEvalResult<TPlan> {
  id: string;
  prompt: string;
  passed: boolean;
  failures: string[];
  latencyMs: number;
  plan?: TPlan;
}

export interface PlanEvalReport<TPlan> {
  passed: boolean;
  passedCases: number;
  totalCases: number;
  passRate: number;
  results: Array<PlanEvalResult<TPlan>>;
}

export async function runPlanEvalSuite<TPlan>(input: {
  cases: readonly PlanEvalCase<TPlan>[];
  generate: (evalCase: PlanEvalCase<TPlan>) => Promise<unknown>;
  adapter: PlanEvalAdapter<TPlan>;
}): Promise<PlanEvalReport<TPlan>> {
  const results: Array<PlanEvalResult<TPlan>> = [];

  for (const evalCase of input.cases) {
    const startedAt = performance.now();
    const failures: string[] = [];
    let plan: TPlan | undefined;
    try {
      plan = input.adapter.validate(await input.generate(evalCase));
      const components = input.adapter.components(plan);
      const semanticIds = input.adapter.semanticIds(plan);

      for (const component of evalCase.expectedComponents ?? []) {
        if (!components.includes(component))
          failures.push(`Missing expected component: ${component}`);
      }
      for (const component of evalCase.forbiddenComponents ?? []) {
        if (components.includes(component))
          failures.push(`Included forbidden component: ${component}`);
      }
      if (new Set(semanticIds).size !== semanticIds.length)
        failures.push("Semantic IDs are not unique");
      if (evalCase.currentPlan && evalCase.expectedStableIds?.length) {
        const previousIds = new Set(
          input.adapter.semanticIds(evalCase.currentPlan),
        );
        for (const id of evalCase.expectedStableIds) {
          if (!previousIds.has(id))
            failures.push(
              `Continuity fixture did not contain expected ID: ${id}`,
            );
          else if (!semanticIds.includes(id))
            failures.push(`Compatible semantic ID was not preserved: ${id}`);
        }
      }
      failures.push(...(evalCase.assert?.(plan) ?? []));
    } catch (error) {
      failures.push(
        `Plan failed validation: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    results.push({
      id: evalCase.id,
      prompt: evalCase.prompt,
      passed: failures.length === 0,
      failures,
      latencyMs: Math.round((performance.now() - startedAt) * 100) / 100,
      ...(plan ? { plan } : {}),
    });
  }

  const passedCases = results.filter((result) => result.passed).length;
  return {
    passed: passedCases === results.length,
    passedCases,
    totalCases: results.length,
    passRate: results.length === 0 ? 1 : passedCases / results.length,
    results,
  };
}

export function assertPlanEvalReport<TPlan>(
  report: PlanEvalReport<TPlan>,
): void {
  if (report.passed) return;
  const summary = report.results
    .filter((result) => !result.passed)
    .map((result) => `${result.id}: ${result.failures.join("; ")}`)
    .join("\n");
  throw new Error(
    `Plan evaluation failed (${report.passedCases}/${report.totalCases} passed)\n${summary}`,
  );
}
