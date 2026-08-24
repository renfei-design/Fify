import { describe, expect, it } from "vitest";
import { UniversalRunStore } from "./universal-run-store";

describe("UniversalRunStore", () => {
  it("replays only unseen frames and continues live without duplication", async () => {
    const store = new UniversalRunStore();
    expect(store.open("run-12345678", "same-request")).toEqual({
      created: true,
      conflict: false,
    });
    store.append("run-12345678", {
      type: "status",
      phase: "accepted",
      elapsedMs: 0,
    });
    store.append("run-12345678", {
      type: "status",
      phase: "routing",
      elapsedMs: 2,
    });
    const subscription = store.subscribe("run-12345678", 1);
    const iterator = subscription[Symbol.asyncIterator]();
    await expect(iterator.next()).resolves.toMatchObject({
      value: { runId: "run-12345678", sequence: 2, phase: "routing" },
      done: false,
    });
    store.append("run-12345678", {
      type: "status",
      phase: "composing",
      elapsedMs: 4,
    });
    await expect(iterator.next()).resolves.toMatchObject({
      value: { sequence: 3, phase: "composing" },
      done: false,
    });
    store.finish("run-12345678");
    await expect(iterator.next()).resolves.toEqual({
      value: undefined,
      done: true,
    });
  });

  it("rejects reuse of a run ID for a different request", () => {
    const store = new UniversalRunStore();
    store.open("run-abcdefgh", "first-request");
    expect(store.open("run-abcdefgh", "different-request")).toEqual({
      created: false,
      conflict: true,
    });
  });

  it("bounds concurrent active runs and reuses finished capacity", () => {
    const store = new UniversalRunStore({ maxRuns: 2 });
    expect(store.open("run-active-0001", "first")).toMatchObject({
      created: true,
    });
    expect(store.open("run-active-0002", "second")).toMatchObject({
      created: true,
    });
    expect(store.open("run-active-0003", "third")).toEqual({
      created: false,
      conflict: false,
      saturated: true,
    });

    store.finish("run-active-0001");
    expect(store.open("run-active-0003", "third")).toMatchObject({
      created: true,
    });
    expect(store.state("run-active-0001")).toBeNull();
  });
});
