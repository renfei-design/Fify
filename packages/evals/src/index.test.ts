import { describe, expect, it } from "vitest";
import { assertPlanEvalReport, runPlanEvalSuite } from "./index.js";

interface TestPlan { components: string[]; ids: string[] }
const adapter = {
  validate: (value: unknown): TestPlan => {
    if (!value || typeof value !== "object" || !("components" in value) || !("ids" in value)) throw new Error("invalid");
    return value as TestPlan;
  },
  components: (plan: TestPlan) => plan.components,
  semanticIds: (plan: TestPlan) => plan.ids,
};

describe("plan eval runner", () => {
  it("scores semantic selection and continuity", async () => {
    const currentPlan = { components: ["Hero", "Queue"], ids: ["hero", "queue"] };
    const report = await runPlanEvalSuite({
      cases: [{
        id: "adapt",
        prompt: "Focus on the queue",
        currentPlan,
        expectedComponents: ["Queue"],
        forbiddenComponents: ["Mutation"],
        expectedStableIds: ["queue"],
      }],
      generate: async () => ({ components: ["Hero", "Queue"], ids: ["hero", "queue"] }),
      adapter,
    });

    expect(report).toMatchObject({ passed: true, passRate: 1 });
    expect(() => assertPlanEvalReport(report)).not.toThrow();
  });

  it("reports actionable semantic failures", async () => {
    const report = await runPlanEvalSuite({
      cases: [{ id: "unsafe", prompt: "Read only", forbiddenComponents: ["Mutation"] }],
      generate: async () => ({ components: ["Mutation"], ids: ["action"] }),
      adapter,
    });

    expect(report.results[0]?.failures).toContain("Included forbidden component: Mutation");
    expect(() => assertPlanEvalReport(report)).toThrow("unsafe");
  });
});
