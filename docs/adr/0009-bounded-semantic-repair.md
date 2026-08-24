# ADR 0009: Repair semantic generation before commit

## Status

Accepted

## Context

Strict Structured Outputs guarantee JSON shape, not application semantics. A response can satisfy the provider schema and still violate blueprint compatibility, slot fulfillment, graph reachability, component semantics, content budgets, or interaction rules. Transport retries do not cover these failures because trusted parsing and validation happen after the provider returns successfully.

Progressive rendering makes this harder: individually valid nodes may already be visible when the completed document reveals a graph-level failure. Surfacing that validator message leaves a broken skeleton, and blindly replaying another generation can mix two incompatible provisional graphs.

## Decision

The universal route gives each model stage at most two semantic attempts: the original and one repair. Only `invalid_output` is eligible. Authentication, rate limiting after transport retry, cancellation, and provider failures are not semantic problems and do not trigger regeneration.

The UX Director repair receives the same user input with an explicit instruction to produce a fresh, invariant-complete brief. A composition repair receives the validated brief again with a stricter graph contract. Before the second composition begins, trusted code republishes the representation skeleton at `root`. Previously streamed nodes may remain in the reducer registry, but they are unreachable and therefore invisible; fresh parent-first nodes replace the skeleton normally.

Only a fully validated experience emits `complete`. If a follow-up exhausts repair, the server republishes and completes the previous validated experience on the same surface. An initial request with no prior experience still fails closed. Completion metadata exposes attempt counts, repair count, and whether rollback was used.

## Performance policy

The valid path remains two model calls: one direction call and one composition call. Semantic regeneration adds a call only after failure and remains inside the route's single deadline. Caches store only committed experiences. This bounds tail cost while materially improving completion rate.

## Consequences

Users do not need to understand internal schema errors, and a failed follow-up cannot destroy a useful answer. The application gains a small amount of route orchestration and tests must cover attempt ordering, provisional reset, and rollback. A single repair cannot guarantee literal 100% model success, so measured live evaluation remains a release gate and persistent failures still fail closed.
