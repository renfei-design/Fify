import type {
  UniversalGenerationStreamFrame,
  UniversalGenerationStreamPayload,
} from "./universal-generation-stream";

export type UniversalRunState = "running" | "finished";

interface RunRecord {
  runId: string;
  fingerprint: string;
  frames: UniversalGenerationStreamFrame[];
  state: UniversalRunState;
  expiresAt: number;
  subscribers: Set<RunSubscription>;
}

class RunSubscription implements AsyncIterable<UniversalGenerationStreamFrame> {
  private queue: UniversalGenerationStreamFrame[] = [];
  private waiters: Array<
    (result: IteratorResult<UniversalGenerationStreamFrame>) => void
  > = [];
  private closed = false;
  private readonly detach: () => void;

  constructor(detach: () => void) {
    this.detach = detach;
  }

  push(frame: UniversalGenerationStreamFrame) {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter({ value: frame, done: false });
    else this.queue.push(frame);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.detach();
    for (const waiter of this.waiters.splice(0))
      waiter({ value: undefined, done: true });
  }

  [Symbol.asyncIterator](): AsyncIterator<UniversalGenerationStreamFrame> {
    return {
      next: () => {
        const frame = this.queue.shift();
        if (frame) return Promise.resolve({ value: frame, done: false });
        if (this.closed)
          return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve) => this.waiters.push(resolve));
      },
      return: () => {
        this.close();
        return Promise.resolve({ value: undefined, done: true });
      },
    };
  }
}

export class UniversalRunStore {
  private readonly runs = new Map<string, RunRecord>();
  private readonly ttlMs: number;
  private readonly maxRuns: number;

  constructor({ ttlMs = 10 * 60_000, maxRuns = 32 } = {}) {
    this.ttlMs = ttlMs;
    this.maxRuns = maxRuns;
  }

  open(runId: string, fingerprint: string) {
    this.prune();
    const existing = this.runs.get(runId);
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        return { created: false, conflict: true } as const;
      existing.expiresAt = Date.now() + this.ttlMs;
      return { created: false, conflict: false } as const;
    }
    if (this.runs.size >= this.maxRuns) {
      const removable = [...this.runs.entries()].find(
        ([, record]) => record.state === "finished",
      );
      if (removable) this.runs.delete(removable[0]);
      else
        return {
          created: false,
          conflict: false,
          saturated: true,
        } as const;
    }
    const record: RunRecord = {
      runId,
      fingerprint,
      frames: [],
      state: "running",
      expiresAt: Date.now() + this.ttlMs,
      subscribers: new Set(),
    };
    this.runs.set(runId, record);
    return { created: true, conflict: false } as const;
  }

  append(runId: string, payload: UniversalGenerationStreamPayload) {
    const record = this.require(runId);
    if (record.state !== "running")
      throw new Error(`Universal run '${runId}' is already finished.`);
    const frame = {
      ...payload,
      runId,
      sequence: record.frames.length + 1,
    } as UniversalGenerationStreamFrame;
    record.frames.push(frame);
    record.expiresAt = Date.now() + this.ttlMs;
    for (const subscriber of record.subscribers) subscriber.push(frame);
    return frame;
  }

  finish(runId: string) {
    const record = this.require(runId);
    if (record.state === "finished") return;
    record.state = "finished";
    record.expiresAt = Date.now() + this.ttlMs;
    for (const subscriber of [...record.subscribers]) subscriber.close();
  }

  subscribe(runId: string, afterSequence = 0) {
    const record = this.require(runId);
    let subscription: RunSubscription;
    subscription = new RunSubscription(() =>
      record.subscribers.delete(subscription),
    );
    for (const frame of record.frames)
      if (frame.sequence > afterSequence) subscription.push(frame);
    if (record.state === "finished") subscription.close();
    else record.subscribers.add(subscription);
    return subscription;
  }

  state(runId: string) {
    const record = this.runs.get(runId);
    return record
      ? {
          state: record.state,
          frameCount: record.frames.length,
          lastSequence: record.frames.at(-1)?.sequence ?? 0,
        }
      : null;
  }

  clear() {
    for (const record of this.runs.values())
      for (const subscriber of [...record.subscribers]) subscriber.close();
    this.runs.clear();
  }

  private require(runId: string) {
    const record = this.runs.get(runId);
    if (!record) throw new Error(`Unknown universal run '${runId}'.`);
    return record;
  }

  private prune() {
    const now = Date.now();
    for (const [runId, record] of this.runs)
      if (record.state === "finished" && record.expiresAt <= now)
        this.runs.delete(runId);
    while (this.runs.size > this.maxRuns) {
      const removable = [...this.runs.entries()].find(
        ([, record]) => record.state === "finished",
      );
      if (!removable) break;
      this.runs.delete(removable[0]);
    }
  }
}

const processGlobal = globalThis as typeof globalThis & {
  __fifyUniversalRunStoreV1?: UniversalRunStore;
};

export const universalRunStore =
  processGlobal.__fifyUniversalRunStoreV1 ?? new UniversalRunStore();
processGlobal.__fifyUniversalRunStoreV1 = universalRunStore;
