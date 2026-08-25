import { describe, expect, it } from "vitest";
import { comprehensionBenchmarkCasesV1 } from "./comprehension-cases.js";
import type { ComprehensionBenchmarkCase } from "./comprehension.js";

describe("comprehension benchmark v1 cases", () => {
  it("covers distinct user jobs with internally valid scoring requirements", () => {
    expect(comprehensionBenchmarkCasesV1).toHaveLength(9);
    const ids = comprehensionBenchmarkCasesV1.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      new Set(
        comprehensionBenchmarkCasesV1.map(({ attentionMode }) => attentionMode),
      ),
    ).toEqual(new Set(["glance", "read", "explore", "work"]));

    for (const benchmarkCase of comprehensionBenchmarkCasesV1 as readonly ComprehensionBenchmarkCase[]) {
      const factIds = new Set(benchmarkCase.essentialFacts.map(({ id }) => id));
      expect(benchmarkCase.primaryFactIds.length).toBeGreaterThan(0);
      for (const id of benchmarkCase.primaryFactIds)
        expect(
          factIds.has(id),
          `${benchmarkCase.id}: unknown primary ${id}`,
        ).toBe(true);
      for (const fact of [
        ...benchmarkCase.essentialFacts,
        ...(benchmarkCase.deferrableFacts ?? []),
        ...(benchmarkCase.forbiddenClaims ?? []),
      ]) {
        expect(fact.termGroups.length).toBeGreaterThan(0);
        expect(fact.termGroups.every((group) => group.length > 0)).toBe(true);
      }
    }
  });
});
