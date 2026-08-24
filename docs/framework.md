# Fify framework guide

The default path is:

```text
Any prompt + trusted catalog
  → UX decision brief
  → discriminated UI-language graph
  → validated A2UI stream
  → product-owned renderer
```

## 1. Define the representation space

`@fify/core` separates meaning from widgets. Information shapes describe what content is: narrative, facts, record, metrics, trend, hierarchy, sequence, chronology, comparison, tasks/progress, choice/input, spatial, or media/artifact.

Response blueprints describe what job the answer performs. The registry ships with twelve canonical blueprints plus `open-composition`. Each blueprint declares required and optional roles, compatible shapes and topologies, forbidden components, size bounds, and room for variation.

## 2. Direct before composing

Generate and validate a compact `UXDecisionBrief`:

```ts
const decision = repairUXDecisionBrief(modelOutput);
```

The brief identifies the concrete user outcome, attention mode, audience, primary/supporting/deferred content obligations, exact requested item counts, disclosure strategy, latency tier, and a conservative content budget. Trusted repair grounds optional regions and controls in explicit request signals; the model cannot turn a simple request into a workflow by selecting a larger attention mode. The brief contains a repaired representation plan, but does not author a competing factual answer. Use one canonical blueprint for a clear job, two for a genuinely compound job, or the open route for requests where a canonical structure would distort the answer.

Grounding includes capability-preserving exceptions. Profiles receive a supporting identity-media obligation unless the prompt explicitly opts out. Transformations that refer to missing source material stay interactive so the UI can ask for the material. Their budget includes the visible obligations plus one continuation, and trusted policy can supply a compact source input and prompt action when the composed graph omits the collection loop. These are deterministic policies, not extra model calls.

## 3. Compose UI language v4

Pass the validated brief back as an authoritative composer contract. The composer renders visible obligations only and must stay inside the brief's node, repeated-item, and copy budgets. The model writes type-discriminated nodes: a `Text` node exposes copy fields, a `Timeline` exposes items, a `Grid` exposes layout fields, and an `Image` exposes only search intent and accessible copy. It cannot smuggle renderer fields into unrelated node types.

Trusted code compiles authored nodes into the regular runtime `UINode` shape, supplies safe defaults, strips media authority, attaches the representation plan, and validates the full `UIExperience`. The authored language exposes semantic importance, relationship, and media role but deliberately hides palette, personality, visual tone, variant, span, and decorative icon controls.

The selected blueprint contributes its complete safe semantic vocabulary to compatibility checks. This permits adjacent but honest representations—for example, a comparison inside an explainer—without allowing an unrelated component. Images still require an explicit `media-artifact` slot and a trusted resolver.

## 4. Stream the chosen topology

Create one A2UI surface immediately. When direction finishes, add the brief and representation to the data model. As complete model nodes arrive, compile and append eligible nodes parent-first so real UI replaces the empty surface directly. Missing references render as a minimal inline pending mark rather than a reserved card or synthetic layout. Deferred and over-budget content is not streamed. Final full-document validation and deterministic subtraction are authoritative and reconcile provisional UI.

Expose truthful activity rather than an estimated completion percentage. Status frames name the current phase and remain indeterminate while routing has no measurable denominator. Once the validated representation plan identifies visible obligations, report completed and total regions; advance the count only when the first structural content for a planned region is emitted. Provider reasoning-summary events may add a public, sanitized description of the composition approach; never fabricate this text or expose hidden chain-of-thought. Show the activity as a compact disclosure beside the arriving UI, auto-collapse it after completion, and preserve manual re-opening. Preserve already arrived UI during validation or reconnect, and announce a quiet-period message only when no stream frame has arrived for a meaningful interval.

Record perceived-streaming telemetry separately from total generation latency: time to the first surface, first representation skeleton, and first real content; number of visible content frames; and the largest gap between visible frames. These timings describe what the client could observe and must not be presented as model certainty or a guessed percentage.

Treat streamed nodes as provisional until completion. If trusted semantic validation rejects a decision or composed graph, retry that stage once. Reset the root to the representation skeleton before composition retry so rejected nodes cannot remain visible. Keep the previous validated graph as the rollback target for follow-ups. Do not retry authentication or invalid-request failures, and do not add a speculative repair call to successful responses.

Treat delivery as a checkpointed run rather than a response-bound byte stream. Give every frame the same run ID and an increasing sequence number. Persist the last reduced A2UI surface and sequence on the client, then reconnect with that cursor after a transport interruption or page reload. The server replays only unseen frames and continues the live subscription; subscriber cancellation must not abort the underlying model work. If the server explicitly reports an expired checkpoint, discard the provisional surface and begin a new run. Never merge frames from different run IDs.

The demo's bounded process-local run store is a reference adapter, not a production durability claim. Multi-instance deployments need a shared frame log, TTL policy, coordinated run ownership, and the same fingerprint-conflict guarantees. Persist browser-entered credentials only for the browser session and independently from durable conversation data.

## 5. Render through a trusted registry

The renderer resolves only catalogued components. The default conversation UI and every generated component are implemented with shadcn/ui-backed application components. A composition-aware visual constitution interprets the full response scale and topology, so an atomic answer, profile, comparison, and workflow share a coherent product language without sharing a fixed screen. Unknown types, arbitrary code, event handlers, and untrusted image URLs fail closed.

Controls keep ordinary application state. `FactList` is descriptive, `Steps` is ordered, `Timeline` is chronological, `Table` is field-oriented, and `Checklist` is reserved for genuinely completable user work.

The interaction level is a commit-time contract. Read-only answers convert accidental selection controls into static information and remove prompt actions. Interactive answers retain one AI continuation even when its authored action slot was optional or deferred; a full graph reclaims a nonessential node rather than dropping that continuation.

## 6. Add trusted data and capabilities

Use a domain adapter when answers require current/private facts, permissions, or consequential mutations. The included Open-Meteo evidence provider demonstrates product-owned data binding; host applications must implement their own permissions and consequential actions. The semantic graph does not fabricate those authorities.

## Safety and quality gates

1. Models select registered semantics; they never emit executable UI code.
2. The UX decision brief and nested representation plan are validated independently and attached by trusted code.
3. Every visible obligation and required job must be represented by compatible reachable content; request-grounded subtraction removes unrequested auxiliary regions before composition.
4. Graph integrity, blueprint constraints, topology, and interaction honesty fail closed.
5. Images are resolved and attributed by trusted Wikimedia/Openverse adapters.
6. Deterministic evals cover all canonical blueprints, hybrid routing, open composition, and route compatibility.
7. Credentialed evals call both model stages and record routing and composition separately.
8. The deterministic policy enforces attention-mode ceilings, visible obligations, item limits, primary emphasis, container budgets, generic headings, and interaction restraint.
9. Route integration tests inject malformed decisions and graphs, prove a single bounded repair, and prove follow-up rollback without an error frame.
10. Explicit cardinality is extracted conservatively, attached to the relevant obligation, and revalidated after subtraction so content budgets cannot erase requested entries.
11. Interactive answers reserve enough semantic budget for inputs, a working AI continuation, and a result; explanatory extras cannot displace that loop.
12. Semantic repair telemetry includes tokens consumed by rejected attempts, and hybrid forbidden-component rules use route-wide intersection so one selected job cannot invalidate another.
13. Live outcome assertions are shared by generation and sanitized-report replay; assertion versions can change without rewriting historical model evidence.
14. Stateful controls require one prompt action, and generated editable responses cannot commit without an input → AI continuation loop.
15. Route and store tests prove monotonic frame cursors, unseen-only replay, no model regeneration on reconnect, fingerprint conflicts, and explicit expired or out-of-range checkpoints.

## Adding a specialized domain

1. Reuse the universal information shapes and routing modes where possible.
2. Add a blueprint only when it represents a stable, recurring user job.
3. Add components only when the existing catalog cannot honestly express the shape.
4. Define product-owned data bindings and actions separately from model copy.
5. Add deterministic routing, forbidden-component, topology, and continuity evals.

Public projects that informed the boundary choices include [A2UI catalogs](https://a2ui.org/concepts/catalogs/), [A2UI progressive rendering](https://a2ui.org/concepts/overview/), [json-render](https://github.com/vercel-labs/json-render), and [AI SDK routing patterns](https://v5.ai-sdk.dev/docs/advanced/model-as-router). Fify's two-stage representation contract and slot compatibility validator are project-specific.
