# ADR 0004: The model responds with a progressively rendered UI

- Status: accepted
- Date: 2026-08-21

## Context

The original proof generated one complete recipe behind a blocking HTTP request. The current interface stayed visible, but no model-selected UI appeared until planning, validation, and compilation had all finished. That made the product feel like a conventional prompt-to-dashboard generator rather than an AI whose response medium is the interface itself.

We researched the current protocol and implementation options before changing the runtime:

- [A2UI v1.0 protocol](https://github.com/a2ui-project/a2ui/blob/main/specification/v1_0/docs/a2ui_protocol.md) defines a UI as an ordered stream of JSON messages. It explicitly supports `createSurface`, `updateComponents`, and `updateDataModel`, and requires renderers to handle not-yet-arrived child references and data bindings gracefully for progressive rendering.
- [OpenAI Responses streaming](https://developers.openai.com/api/reference/typescript/resources/beta/subresources/responses/methods/create) emits `response.output_text.delta` events when `stream: true` and can emit provider-authored reasoning-summary deltas when a summary is requested. [Structured Outputs](https://openai.com/index/introducing-structured-outputs-in-the-api/) constrains the final output to a supplied JSON Schema, but semantic correctness still requires application validation.
- [AG-UI](https://docs.ag-ui.com/concepts/architecture) provides a broader event lifecycle, bidirectional state synchronization, tools, and long-running agent support. Fify currently has one short-lived request stream and no agent tool lifecycle, so adding that protocol now would duplicate the A2UI transport envelope without earning its extra machinery.
- [AI SDK generative UI](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces) maps model-selected tools to React components. Its RSC `streamUI` API can stream React nodes, but [the RSC API is experimental](https://ai-sdk.dev/docs/ai-sdk-rsc/streaming-react-components). More importantly, streaming React would couple the protocol to one renderer and weaken Fify's portable, catalog-validated A2UI boundary.

## Decision

Fify treats UI—not assistant prose—as the primary model response.

The model still emits a compact, strict Experience Director document. The server consumes the provider's Structured Output deltas and extracts only fully closed JSON values. Each completed recipe surface is independently validated against the product schema, deterministically compiled to a registered A2UI component, and sent to the browser immediately.

The browser receives ordered JSON Lines (`application/x-ndjson`) frames:

```text
status(accepted)
a2ui(createSurface)                 # initial request only
status(routing)                     # indeterminate activity
a2ui(updateDataModel: brief/screen/sources)
status(composing: 0/N regions)      # denominator comes from the validated plan
activity(provider summary delta)   # optional public reasoning summary
a2ui(updateComponents: first region)
status(composing: 1/N regions)      # advances only after visible structural content
a2ui(updateComponents: next region)
a2ui(updateDataModel: live data)    # may race safely with structure
a2ui(updateComponents: reconciled final tree)
a2ui(updateDataModel: final model)
complete(validated recipe + metadata)
```

For a follow-up, the existing surface remains usable during early planning. Progressive updates target the same surface ID, and compatible semantic component IDs continue to preserve local state. If generation fails, the client restores its pre-request surface snapshot.

Partial values are provisional. They may render only after their individual product schema passes, and they never cross the executable-code boundary. The complete document must still pass the strict directed-experience schema, domain completion rules, and deterministic coverage pass. Final A2UI messages reconcile the progressive tree with that validated result. A stream error never masquerades as a complete experience.

Weather queries start as soon as the `sources` array closes, in parallel with the remaining model generation. Their results enter through `updateDataModel`, so factual application data remains separate from model-authored composition.

## Transport and failure semantics

- JSONL provides explicit message framing and works with an ordinary streamed `fetch` response.
- Frames are applied in arrival order; no concurrent reducer writes are allowed.
- Provider transport retries are allowed before a successful response stream is opened. Universal UI semantic repair is governed separately by [ADR 0009](0009-bounded-semantic-repair.md): it explicitly resets the provisional root before a single regeneration instead of silently mixing attempts.
- The server disables response transformation and proxy buffering with `cache-control: no-transform` and `x-accel-buffering: no`.
- The existing 15-second planning deadline and request cancellation propagate to the upstream response.
- Cached and deterministic fast-path recipes use the same public stream contract. Small scheduling yields make their component-by-component behavior observable instead of collapsing into one paint.
- Missing references occupy only a minimal inline pending mark until catalog components arrive; the renderer does not reserve a large synthetic card for an unknown layout. Reduced-motion preferences disable spinner and pulse animation.
- Generation activity is a compact disclosure that stays open while work is active, streams real pipeline state and optional provider-authored reasoning summaries beside the arriving UI, and auto-collapses on completion. The user can reopen the completed trace.
- Progress is indeterminate until a validated representation plan provides a real unit count. Determinate activity counts visible planned regions, never inferred tokens, wall-clock guesses, or simulated percentages. Provider summaries are sanitized public summaries, not hidden chain-of-thought and not application-authored filler.
- Completion metadata records first-surface, first-representation, first-content, visible-frame-count, and maximum-visible-gap timings so perceived streaming can be evaluated independently of total latency.

## Consequences

The first UI frame can render before the final plan or weather data exists, and data fetching overlaps planning. The public protocol remains renderer-independent and safe by construction.

The server now has two validation layers: item-level provisional validation and final document validation. This is deliberate. The incremental JSON extractor is tested against arbitrary chunk boundaries and quoted property-like text, while the final strict parse remains the authority.

AG-UI remains a future transport option when Fify needs long-running runs, tool lifecycle events, reconnectable state snapshots, or bidirectional agent synchronization. It is not needed for this request/response UI stream.
