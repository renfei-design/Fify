# Package boundaries

Fify exposes three public prerelease packages. The browser app, MCP host integration, and minimal example use these same boundaries.

| Package | Supported use |
| --- | --- |
| `@fify/core` | Semantic planning, evidence policy, strict provider calls, validation, and compilation to A2UI with a text fallback |
| `@fify/react` | Rendering a trusted A2UI catalog with application-owned React components |
| `@fify/a2ui` | Parsing and reducing A2UI messages or implementing another host renderer |

Most applications should start with `@fify/core` and `@fify/react`. Protocol adapters may also use `@fify/a2ui` directly.

`@fify/core/openai` is the supported server integration for a two-stage structured-output flow. `@fify/core/provider` exposes the lower-level strict Responses API gateway for advanced adapters. Neither path accepts model-authored executable UI code.

## Private tooling

`@fify/evals` is workspace-private release tooling. It is not part of the initial registry surface and may change without package-level migration guidance.

The browser demo and MCP application are reference hosts, not reusable framework packages. Generated plugin deployment output is ignored; `apps/mcp-app` is its canonical source.

## Stability rules

- A public-package breaking change requires release notes and migration guidance.
- Model-authored executable code is never part of a package contract.
- Layout composition may arrange validated information but cannot silently rewrite its factual content.
- Registry publication requires package-consumer verification and explicit release approval.
