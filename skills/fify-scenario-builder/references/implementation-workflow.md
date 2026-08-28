# Fify scenario implementation workflow

Use this reference while changing the Fify repository. Reconfirm paths and scripts from the active checkout before acting.

## Repository map

| Concern                                                                               | Current location                                                                                  |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Intent detection, component selection, topology, representation blueprint, slot roles | `packages/core/src/grounded.ts`                                                                   |
| Compiler regression coverage                                                          | `packages/core/src/grounded.test.ts`                                                              |
| Tool/server input and terminal state                                                  | `apps/mcp-app/src/server.ts`, `apps/mcp-app/src/server.integration.test.ts`                       |
| Widget DOM and scenario-specific grouping                                             | `apps/mcp-app/src/widget-client.ts`                                                               |
| Fify tokens, blueprint styling, wide/compact behavior                                 | `apps/mcp-app/src/widget-theme.ts`                                                                |
| Widget contract tests                                                                 | `apps/mcp-app/src/widget.test.ts`                                                                 |
| Deterministic scenario preview                                                        | `apps/mcp-app/scripts/*-preview.mjs` and `apps/mcp-app/package.json`                              |
| Portable MCP entry and smoke test                                                     | `apps/mcp-app/src/plugin-entry.ts`, `apps/mcp-app/scripts/smoke-plugin-bundle.mjs`                |
| End-user envelope instructions                                                        | `plugins/fify/skills/information-ui/SKILL.md`                                                     |
| Activation and reviewer cases                                                         | `plugins/fify/evals/activation.json`, `plugins/fify/evals/reviewer-cases.json`                    |
| Scenario contract, fixtures, quality source, and generated matrix                     | `scenarios/<id>/scenario.json`, `scenarios/<id>/fixtures.json`, `docs/scenario-quality-matrix.md` |
| Cross-domain comprehension benchmark                                                  | `packages/evals/src/comprehension-cases.ts`                                                       |
| Plugin metadata and starter prompts                                                   | `plugins/fify/.codex-plugin/plugin.json`, `plugins/fify/submission/`                              |
| Packaging and validation                                                              | `scripts/install-codex-plugin.mjs`, `scripts/validate-codex-plugin.mjs`                           |

## Implementation sequence

### 1. Route semantics

- Add or refine an intent predicate with both positive and negative coverage.
- Select topology and components from the scenario contract.
- Add a named representation blueprint only when the hierarchy needs one.
- Map sections to semantic slot roles. Keep internal slots deterministic and hyphen-delimited.
- Set an accurate screen context label and interaction level.

### 2. Render with Fify components

- Reuse generic Hero, FactList, Comparison, Steps, Timeline, Table, or other catalog components where they satisfy the contract.
- Add custom grouping in `widget-client.ts` only for a reusable structural need, such as a comparison matrix spanning repeated criteria.
- Expose semantic roles to the DOM through stable data attributes rather than matching displayed copy in CSS.
- Scope scenario styles under its blueprint class. Reuse Fify variables and avoid hard-coded sample-specific styling.
- Define compact behavior next to wide behavior. Verify source order remains meaningful without CSS.

### 3. Preserve runtime truth

- Return complete frames in the initial tool result and keep the plain answer in tool content.
- Preserve the first specific compiler or mount diagnostic; do not overwrite it with a generic fallback.
- Keep the MCP bundle independent of workspace `node_modules` and cwd assumptions.
- If media is part of the contract, keep lookup bounded, attributable, optional, and honest when unavailable.

### 4. Add tests and evals

- Compiler tests: exact blueprint, topology, component choices, role order, slot validity, fact preservation, and max-scale data.
- Widget tests: semantic attributes, component grouping, compact ordering, overflow containment, and fallback states.
- Integration tests: valid tool result reaches `complete`; invalid input yields the specific diagnostic; no duplicate retry path.
- Activation evals: explicit Fify phrasing is positive; equivalent untagged phrasing is negative.
- Reviewer case: include canonical facts, expected layout, scalability expectation, and fallback requirement.
- Comprehension case: add when the scenario must preserve relationships such as decision plus deadline, metric plus risk, or owner plus action.
- Preview: render deterministic grounded data at wide and compact widths. Include the minimum and maximum supported scale when layout behavior changes with count.

### 5. Update scenario quality evidence

- Update the canonical `scenarios/<id>/scenario.json` quality entry after verification, never before it.
- Score contract, visual parity, canvas behavior, interaction fit, and runtime separately from 0 to 4.
- Keep automated, deterministic-preview, installed-Codex, and human evidence separate.
- A scenario can move to `candidate` only after automated, preview, and installed evidence pass.
- A scenario can move to `verified` only after every quality dimension is at least 3 and human review passes.
- Record concrete gaps and one next action. Do not erase known gaps merely because the average would look acceptable.
- Run `pnpm scenario:check -- --write` and `pnpm scenario:check`; commit the scenario files and generated matrix together.

## Verification ladder

Run the narrowest affected tests first, then use the current package scripts. At the time this skill was created, the relevant commands were:

```bash
env COREPACK_HOME=/private/tmp/fify-corepack corepack pnpm --filter @fify/core test
env COREPACK_HOME=/private/tmp/fify-corepack corepack pnpm --filter @fify/mcp-app test
env COREPACK_HOME=/private/tmp/fify-corepack corepack pnpm --filter @fify/evals eval
env COREPACK_HOME=/private/tmp/fify-corepack corepack pnpm scenario:check
env COREPACK_HOME=/private/tmp/fify-corepack corepack pnpm plugin:test
env COREPACK_HOME=/private/tmp/fify-corepack corepack pnpm plugin:bundle
```

Then:

1. Run the scenario preview and inspect wide and compact canvases.
2. Confirm no relevant runtime, console, network, accessibility, clipping, or page-overflow errors.
3. Update the local plugin cachebuster using the available plugin-creation workflow and validate the bundle.
4. Fully quit ChatGPT/Codex before reinstalling from `fify@personal`; the installer must refuse replacement while the long-lived desktop MCP host is running.
5. Reopen ChatGPT/Codex and run `pnpm codex:verify-host` to reject a stale desktop process and validate the nine-slot comparison in a separate fresh process.
6. Create a brand-new tagged desktop task. Never resume a task created before installation because its MCP tool snapshot remains stale. Record installed-Codex evidence as passing only after the native widget mounts.
7. Run the canonical prompt, paraphrase, follow-up, negative prompt, and scale cases.
8. Record the selected tool, arguments, terminal state, blueprint, visible facts, startup/render timing, and any fallback.

Do not present source previews as proof that the installed Codex widget works.

## Release gate

Only after explicit authorization:

1. Inspect the complete intended diff and exclude credentials, local runtime files, caches, and generated bundles that are intentionally ignored.
2. Fetch the target branch and compare local/remote history.
3. Preserve remote commits through a fast-forward-compatible rebase or merge; never silently force-push.
4. Rerun relevant tests after integration.
5. Commit with a scenario-level message and report exact file count and commit.
6. Push the explicitly authorized commit, destination, branch, and payload.
7. Verify remote `main` using `git ls-remote`, matching local and remote SHAs, a clean working tree, and zero ahead/behind count.
