# Contributing to Fify

Fify welcomes focused contributions to semantic contracts, provider adapters, renderers, evaluation, accessibility, documentation, and examples.

## Development setup

Requirements: Node.js 22+ and pnpm 11+.

```bash
corepack enable
pnpm install
pnpm check
pnpm --filter @fify/demo dev
```

No API key is required for development. Tests mock provider calls, and deterministic previews are explicitly labeled.

## Design rules

- Models return semantics, never executable renderer code.
- New generated values require runtime validation.
- Component and capability types must be registered.
- Model-facing capability declarations do not grant authorization.
- Mutations remain distinct from queries and may require confirmation.
- Interaction state must not be stored inside generated layout.
- Semantic IDs should remain stable when meaning remains compatible.
- Fixtures must never be presented as real model output or live application data.

## Proposing a new information pattern

Start with [docs/framework.md](docs/framework.md). A new pattern should normally include a strict semantic schema, compiler mapping, trusted renderer implementation, semantic evaluation cases, invalid-plan tests, accessibility behavior, and documentation of its capability boundary. Open a feature proposal before adding a new public package or expanding the trusted catalog.

## Pull request checklist

- `pnpm check` passes.
- `pnpm test:e2e` passes for user-facing changes.
- New behavior has tests or semantic eval cases.
- Public contract changes are documented and versioned deliberately.
- Accessibility and keyboard behavior have been considered.
- No credentials, customer data, or generated build artifacts are committed.
- The change does not introduce a keyword or fixture fallback that can be mistaken for model generation.

Keep changes small enough to review and explain the product invariant they protect.

Use the repository's issue forms for bugs and feature proposals. Use GitHub's private **Report a vulnerability** flow for security issues; never put a suspected vulnerability or credential in a public issue.
