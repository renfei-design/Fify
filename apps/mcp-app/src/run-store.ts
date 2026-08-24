import { createHash, randomUUID } from "node:crypto";
import type { A2UIMessage } from "@fify/a2ui";
import type { InformationEnvelopeV1, UIExperience } from "@fify/core";

export type InformationUIRunState = "running" | "complete" | "failed";

export type InformationUIRunFrame =
  | { sequence: number; type: "status"; message: string; stage: string }
  | { sequence: number; type: "a2ui"; message: A2UIMessage }
  | { sequence: number; type: "complete"; experience: UIExperience; envelope: InformationEnvelopeV1; compilerMode: "model" | "deterministic-fallback" }
  | { sequence: number; type: "error"; code: string; message: string };

type NewInformationUIRunFrame = InformationUIRunFrame extends infer Frame
  ? Frame extends InformationUIRunFrame
    ? Omit<Frame, "sequence">
    : never
  : never;

export interface InformationUIRun {
  id: string;
  fingerprint: string;
  bucket: string;
  state: InformationUIRunState;
  createdAt: number;
  updatedAt: number;
  frames: InformationUIRunFrame[];
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

interface QuotaState { day: number; successes: number; active: number }

export class InformationUIRunStore {
  private readonly runs = new Map<string, InformationUIRun>();
  private readonly fingerprints = new Map<string, string>();
  private readonly quotas = new Map<string, QuotaState>();

  constructor(
    private readonly limits = { successfulPerDay: 20, concurrent: 2, retentionMs: HOUR_MS },
  ) {}

  private sweep(now = Date.now()) {
    for (const [id, run] of this.runs) {
      if (now - run.updatedAt <= this.limits.retentionMs) continue;
      this.runs.delete(id);
      if (this.fingerprints.get(`${run.bucket}:${run.fingerprint}`) === id)
        this.fingerprints.delete(`${run.bucket}:${run.fingerprint}`);
    }
  }

  private quota(bucket: string, now = Date.now()) {
    const day = Math.floor(now / DAY_MS);
    const current = this.quotas.get(bucket);
    if (!current || current.day !== day) {
      const fresh = { day, successes: 0, active: 0 };
      this.quotas.set(bucket, fresh);
      return fresh;
    }
    return current;
  }

  findOrCreate(bucket: string, envelope: InformationEnvelopeV1) {
    this.sweep();
    const fingerprint = createHash("sha256").update(JSON.stringify(envelope)).digest("hex");
    const existing = this.fingerprints.get(`${bucket}:${fingerprint}`);
    if (existing) {
      const run = this.runs.get(existing);
      if (run) return { run, created: false as const };
    }
    const quota = this.quota(bucket);
    if (quota.successes >= this.limits.successfulPerDay)
      throw Object.assign(new Error("Daily Fify render quota reached."), { code: "QUOTA_EXHAUSTED" });
    if (quota.active >= this.limits.concurrent)
      throw Object.assign(new Error("Two Fify views are already compiling."), { code: "CONCURRENCY_LIMIT" });
    const now = Date.now();
    const run: InformationUIRun = {
      id: randomUUID(), fingerprint, bucket, state: "running", createdAt: now, updatedAt: now, frames: [],
    };
    this.runs.set(run.id, run);
    this.fingerprints.set(`${bucket}:${fingerprint}`, run.id);
    quota.active += 1;
    this.append(run.id, { type: "status", stage: "accepted", message: "Preparing an interactive view…" });
    return { run, created: true as const };
  }

  get(id: string) {
    this.sweep();
    return this.runs.get(id) ?? null;
  }

  append(id: string, frame: NewInformationUIRunFrame) {
    const run = this.runs.get(id);
    if (!run) throw new Error(`Unknown information UI run '${id}'.`);
    const next = { ...frame, sequence: run.frames.length + 1 } as InformationUIRunFrame;
    run.frames.push(next);
    run.updatedAt = Date.now();
    return next;
  }

  complete(id: string) {
    const run = this.runs.get(id);
    if (!run || run.state !== "running") return;
    run.state = "complete";
    run.updatedAt = Date.now();
    const quota = this.quota(run.bucket);
    quota.active = Math.max(0, quota.active - 1);
    quota.successes += 1;
  }

  fail(id: string) {
    const run = this.runs.get(id);
    if (!run || run.state !== "running") return;
    run.state = "failed";
    run.updatedAt = Date.now();
    const quota = this.quota(run.bucket);
    quota.active = Math.max(0, quota.active - 1);
  }

  read(id: string, afterSequence: number) {
    const run = this.get(id);
    if (!run) return null;
    return {
      runId: run.id,
      state: run.state,
      lastSequence: run.frames.length,
      frames: run.frames.filter((frame) => frame.sequence > afterSequence),
    };
  }
}

export function privacyBucket(hostMetadata: unknown) {
  const metadata = hostMetadata && typeof hostMetadata === "object"
    ? hostMetadata as Record<string, unknown>
    : {};
  const openai = metadata.openai && typeof metadata.openai === "object"
    ? metadata.openai as Record<string, unknown>
    : {};
  const stableHostId = openai.userId ?? openai.subject ?? metadata.userId ?? metadata.subject ?? metadata.clientId ?? "anonymous";
  const serialized = String(stableHostId).slice(0, 500);
  const salt = process.env.FIFY_QUOTA_SALT ?? "fify-local-alpha";
  return createHash("sha256").update(`${salt}:${serialized}`).digest("hex").slice(0, 24);
}
