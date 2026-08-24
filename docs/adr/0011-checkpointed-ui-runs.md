# ADR 0011: Checkpointed UI runs

## Status

Accepted

## Context

A progressive UI response can outlive one HTTP connection. Navigation, mobile network changes, development reloads, and intermediary timeouts can detach the browser after useful A2UI nodes have rendered. Restarting the model wastes time and tokens, while replaying from the beginning can duplicate nodes or actions. Coupling generation to the request abort signal also turns an ordinary subscriber disconnect into a failed agent run.

Conversation continuity has two distinct durability needs: the browser must retain validated UI and ordinary interaction state, and the server must retain an ordered frame history long enough for a subscriber to resume. Credentials must not be stored with durable conversation data.

## Decision

- The client assigns each generation a unique run ID and the server binds that ID to a fingerprint of the request and current response context.
- Every status, A2UI, completion, and error frame carries that run ID plus a positive monotonic sequence number.
- A reconnect supplies `afterSequence`; the server emits only frames with a greater sequence and then follows the live run.
- Reusing a run ID with a different fingerprint fails with an explicit conflict. Missing expired checkpoints and cursors ahead of stored state also fail explicitly.
- Subscriber cancellation detaches only that subscriber. Generation keeps its own bounded timeout and commits terminal state to the run log.
- The browser persists schema-validated turns, partial surfaces, committed experiences, checkpoints, and interaction state. It ignores duplicated or foreign frames and resumes unfinished turns after hydration.
- An expired run restarts with a new ID and an empty provisional surface. Frames from two runs are never merged.
- A browser-provided API key uses session storage and is excluded from serialized conversation data.
- The demo uses a bounded process-local reference store with a ten-minute TTL and a maximum of 32 recent or concurrent runs. It rejects new work explicitly when every slot is active. Production adapters must preserve the protocol while providing shared persistence and coordinated execution.

## Consequences

Ordinary reconnects and page reloads do not regenerate an interface or repeat already reduced messages. Conversation UI and local control state survive reloads. Generation is no longer accidentally cancelled when one response reader disappears.

The process-local adapter cannot resume across process loss or route work across independent instances. Continuing work after an HTTP response may also require platform-specific background execution guarantees. Those are explicit production-adapter responsibilities rather than hidden claims of the reference implementation.
