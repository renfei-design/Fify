import { describe, expect, it } from "vitest";
import type { InformationEnvelopeV1 } from "@fify/core";
import { InformationUIRunStore, privacyBucket } from "./run-store.js";

const envelope: InformationEnvelopeV1 = {
  version: "1.0",
  originalRequest: "Make this a checklist",
  groundedAnswer: "Complete A, then B.",
  locale: "en-US",
  sections: [{
    id: "tasks", title: "Tasks", body: "Complete both tasks.", sourceIds: [],
    items: [
      { id: "a", label: "A", value: "", detail: "First", sourceIds: [] },
      { id: "b", label: "B", value: "", detail: "Second", sourceIds: [] },
    ],
  }],
  sources: [],
  suggestedRefinements: [],
};

describe("InformationUIRunStore", () => {
  it("reuses idempotent runs and returns only unseen frames", () => {
    const store = new InformationUIRunStore();
    const first = store.findOrCreate("bucket", envelope);
    const again = store.findOrCreate("bucket", envelope);
    expect(first.created).toBe(true);
    expect(again.created).toBe(false);
    expect(again.run.id).toBe(first.run.id);

    store.append(first.run.id, { type: "status", stage: "test", message: "second" });
    expect(store.read(first.run.id, 1)?.frames.map((frame) => frame.sequence)).toEqual([2]);
  });

  it("counts successful renders but not failed runs", () => {
    const store = new InformationUIRunStore({ successfulPerDay: 1, concurrent: 2, retentionMs: 3_600_000 });
    const failed = store.findOrCreate("bucket", envelope).run;
    store.fail(failed.id);
    const secondEnvelope = { ...envelope, originalRequest: "Make this another checklist" };
    const succeeded = store.findOrCreate("bucket", secondEnvelope).run;
    store.complete(succeeded.id);
    expect(() => store.findOrCreate("bucket", { ...envelope, originalRequest: "A third view" })).toThrow(/quota/i);
  });

  it("derives a non-identifying stable quota bucket", () => {
    expect(privacyBucket({ user: "host-user-123" })).toBe(privacyBucket({ user: "host-user-123" }));
    expect(privacyBucket({ user: "host-user-123" })).not.toContain("host-user-123");
  });
});
