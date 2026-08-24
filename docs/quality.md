# Fify quality system

Generative UI quality is not one score. Fify gates the model decision, semantic graph, trusted renderer, visual tokens, interactions, transport, and human judgment separately so one green layer cannot hide another layer's failure.

## Automated layers

1. **Decision and graph semantics** — representation, obligation, exact-cardinality, minimum-sufficient-content, interaction-loop, and deterministic taste tests run in `@fify/core`.
2. **Renderer accessibility contract** — server-rendered component tests assert one stable page heading, honest heading levels inside response regions, labelled fields, named progress indicators, exposed checkbox/selection state, a working skip target, and no tab semantics without tab panels.
3. **Theme contrast** — the test reads the shipped CSS tokens, converts OKLCH through linear sRGB, and requires at least WCAG AA 4.5:1 contrast for normal foreground, muted, primary, secondary, accent, and destructive text pairs.
4. **Interaction truth** — semantic validation rejects stateful output without an AI continuation; renderer tests expose native keyboard-operable buttons and fields; live browser checks verify that actions change local state or produce a new AI turn.
5. **Durable delivery** — store, route, persistence, and production-browser checks cover monotonic checkpoints, unseen-only replay, reload restoration, mid-stream resume, expiry, conflicts, capacity, and duplicate prevention.

Run the deterministic suite with:

```bash
pnpm typecheck
pnpm test
pnpm eval
```

## Responsive quality fixtures

The test suite renders three stable, network-free UI-language surfaces at desktop and mobile widths:

- an atomic answer that should remain typographic and unboxed;
- a static comparison that should scan cleanly without implying selection;
- an input → selection → prompt action → checklist workflow whose controls update a live status.

Use the same surfaces for desktop and mobile screenshots so layout changes are compared against identical content rather than stochastic model output. The minimum release viewport matrix is 1440×900, 768×1024, and 390×844. Review horizontal overflow, clipped focus rings, line length, hierarchy, touch targets, sticky content, and content that changes meaning when stacked.

## Browser release check

For the browser conversation and deterministic fixtures:

1. Tab from the document start; the first focus target is “Skip to message composer.”
2. Activate the skip link and confirm focus reaches the labelled composer.
3. Traverse every visible control without a pointer. Focus remains visible and order follows reading order.
4. Activate generated checkboxes, choices, and prompt actions with the keyboard. Each produces state or a conversational continuation.
5. Generate one response, reload, and confirm the committed UI and local state remain.
6. Start a slow response, reload during routing or composition, and confirm one response completes without duplicated content.
7. Enable reduced motion. Streaming, scrolling, image reveal, spinners, and focus remain understandable without animation.
8. Inspect the accessibility tree for names, roles, values, landmarks, headings, and status announcements.

## Human judgment gate

Automation can reject invalid or predictably artificial UI; it cannot prove taste. A release candidate still needs blinded comparison by designers or representative users across the canonical prompt set. Reviewers score comprehension speed, information sufficiency, hierarchy, layout appropriateness, interaction honesty, visual restraint, and preference against a text answer and the prior Fify release.

This human-preference study and stored screenshot baselines remain release work. The current deterministic fixture and criteria make that work repeatable; they do not claim it has already happened.
