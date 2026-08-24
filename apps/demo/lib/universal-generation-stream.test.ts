import { describe, expect, it } from "vitest";
import {
  parseUniversalGenerationActivity,
  parseUniversalGenerationStatus,
  parseUniversalGenerationStreamFrame,
} from "./universal-generation-stream";

describe("universal generation progress contract", () => {
  it("accepts truthful determinate region progress", () => {
    expect(
      parseUniversalGenerationStreamFrame({
        type: "status",
        phase: "composing",
        elapsedMs: 1_240,
        state: "advanced",
        completedUnits: 2,
        totalUnits: 4,
        unit: "regions",
        activeSlotId: "recommendation",
        attempt: 1,
        runId: "run-progress-1234",
        sequence: 8,
      }),
    ).toMatchObject({
      phase: "composing",
      completedUnits: 2,
      totalUnits: 4,
      activeSlotId: "recommendation",
    });
  });

  it("keeps unknown-duration stages indeterminate", () => {
    expect(
      parseUniversalGenerationStatus({
        type: "status",
        phase: "routing",
        elapsedMs: 18,
        state: "started",
      }),
    ).not.toHaveProperty("completedUnits");
  });

  it("accepts provider summaries as bounded public activity", () => {
    expect(
      parseUniversalGenerationActivity({
        type: "activity",
        id: "composition-summary",
        phase: "composing",
        label: "Thinking through the interface",
        detail: "A timeline keeps the seven study days easy to scan.",
        state: "active",
        source: "provider",
        elapsedMs: 480,
      }),
    ).toMatchObject({ source: "provider", phase: "composing" });
  });

  it("rejects fabricated or internally inconsistent progress", () => {
    expect(() =>
      parseUniversalGenerationStatus({
        type: "status",
        phase: "composing",
        elapsedMs: 90,
        completedUnits: 5,
        totalUnits: 3,
        unit: "regions",
      }),
    ).toThrow(/exceeds/);
    expect(() =>
      parseUniversalGenerationStatus({
        type: "status",
        phase: "routing",
        elapsedMs: -1,
      }),
    ).toThrow(/status/);
  });
});
