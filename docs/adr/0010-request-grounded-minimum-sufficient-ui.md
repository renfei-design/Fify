# ADR 0010: Request-grounded minimum-sufficient UI

## Status

Accepted

## Context

Schema-valid generative UI can still feel artificial. A model may interpret every possible supporting role as a visible section, select workflow attention for a read-only request, or spend a small node budget on a form container while pruning the controls it contains. Hybrid routes also combine blueprint constraints: treating every per-blueprint prohibition as global can erase one of the two requested jobs.

Those failures are not visual styling problems. They are failures of information, content, and interaction judgment at the trusted decision boundary.

## Decision

After the UX Director returns a brief, trusted policy applies request-grounded subtraction:

- interaction is reduced to read-only unless the prompt or selected workflow explicitly needs state;
- optional criteria, evidence, constraints, selection, next actions, preparation, routes, schedules, assumptions, and explanations require corresponding prompt intent;
- hybrid responses receive a conservative visible-region ceiling, while open composition retains its bounded creative allowance;
- an interactive tool reserves semantic capacity for a complete input → action → result loop before optional explanation;
- a `Card` with children is a grouping ancestor, not an independent semantic answer for policy accounting;
- the primary obligation keeps its semantic slot, and that slot becomes primary instead of rewriting the obligation into a different shape;
- hybrid forbidden-component rules are intersected across selected blueprints, so a component is globally prohibited only when every selected blueprint prohibits it;
- safe sequence/chronology mismatches are normalized (`Steps` ↔ `Timeline`) rather than dropping the requested content.
- a profile promotes one identity-media obligation unless the request explicitly opts out of images;
- a transformation referring to missing source material remains interactive so the renderer can collect that material;
- editable budgets reserve all visible obligations plus one continuation, and trusted policy supplies a source input and prompt action when composition omits that loop;
- a stateful control without one AI continuation button fails semantic validation;
- accidental controls in a read-only representation are converted to equivalent static information and their prompt actions are removed;
- a continuation may cross an otherwise deferred action-slot boundary, and the compiler reclaims nonessential graph capacity before dropping it;
- a selected blueprint contributes its safe information-shape vocabulary, allowing honest adjacent representations without weakening component or media-slot constraints.

The live evaluator checks required slots, concrete outcome families, exact cardinality, interaction-loop components, and deterministic taste. It reports provider failures separately from invalid semantic outputs and includes token usage from rejected attempts. The credentialed runner and sanitized-report replay import one versioned assertion definition, preventing duplicated expectations from drifting.

## Consequences

Ordinary answers contain fewer unrequested sections and controls. Interactive answers may use a slightly larger semantic budget because a complete loop is more important than an artificially small but dead form. Profiles can include a useful image without requiring the user to say “with a photo,” while explicit opt-out remains authoritative. Missing-source transformations ask for input rather than hallucinating content. Hybrid generation is less likely to lose one requested job. The trusted policy becomes more opinionated, so new optional roles need an explicit grounding rule or evaluation evidence before they are made visible by default.
