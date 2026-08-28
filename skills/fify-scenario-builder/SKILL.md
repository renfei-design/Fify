---
name: fify-scenario-builder
description: Design, implement, and verify one Fify information-view scenario end to end while preserving the web product as the design North Star, grounded fallback behavior, Codex canvas responsiveness, and portable-plugin reliability. Use for adding, redesigning, or hardening a Fify scenario such as comparison, profile, timeline, itinerary, or executive briefing. Do not use for ordinary Fify answers or unrelated UI work.
---

# Fify Scenario Builder

Build one scenario at a time as a complete product slice. Do not broaden the task to other weak scenarios until the selected scenario passes its own release gates.

## Non-negotiable invariants

- Treat the Fify web experience as the design North Star. Do not change it unless the user explicitly asks; bring the plugin toward it.
- Keep facts and presentation separate. The renderer may choose topology, components, emphasis, and interaction, but it must not invent or rewrite grounded facts.
- Preserve the complete authoritative plain answer as fallback. A mounted text-fallback card is a product failure to diagnose, not a successful UI result.
- Use Fify's existing tokens, typography, spacing, dividers, surfaces, and interaction language. Avoid generic dashboard chrome or a one-off visual system.
- Design for the real Codex canvas: inline, expanded, and compact widths. Prevent page-level horizontal overflow; contain intentional comparison scrolling inside the component.
- Keep representation slot IDs in Fify's internal hyphen-delimited namespace. Never copy permissive envelope IDs directly into representation slots.
- Maintain explicit activation. Ordinary untagged structured requests must not invoke Fify merely because they could benefit from UI.
- Do not claim completion from source tests alone. Verify the portable bundle and the freshly installed plugin in a new Codex task.

## Required workflow

1. Inspect the active Fify checkout and current behavior. Confirm the branch, working tree, relevant package scripts, installed plugin version, and the actual failing or North-Star screenshots. Do not rely on stale GenUX paths, ports, or cached plugin copies.
2. Define the scenario contract before editing code. Use [references/scenario-contract.md](references/scenario-contract.md). Resolve the user job, trigger boundary, semantic roles, content mapping, wide and compact layouts, scale behavior, interactions, fallback, and observable success criteria.
3. Present the contract and feasibility to the user when design direction is still open. Once approved, implement the agreed scenario without reopening unrelated design decisions.
4. Implement the smallest complete vertical slice. Read [references/implementation-workflow.md](references/implementation-workflow.md) for the current repository map and gates. Prefer a named blueprint and semantic slot roles over request-specific CSS or copied prose.
5. Add evidence at every layer:
   - compiler routing, topology, blueprint, roles, components, and stable IDs;
   - widget structure and responsive styling;
   - server/tool completion without generic fallback;
   - positive and negative activation behavior;
   - reviewer case with exact facts and visual expectations;
   - a comprehension benchmark when the scenario carries decision-critical information;
   - a deterministic preview for wide and compact inspection.
6. Verify in increasing scope: focused tests, plugin tests, evals, portable bundle smoke, visual preview, cache-busted reinstall, then a new-task Codex test. Diagnose the first failing layer instead of hiding it with a generic fallback.
7. Update the scenario's canonical `scenarios/<id>/scenario.json` using only observed evidence, keep canonical prompts in its adjacent `fixtures.json`, and run `pnpm scenario:check -- --write`. Do not raise a score or stage from implementation alone: installed Codex evidence and human acceptance are separate gates.
8. Hand off exact evidence: scenario behavior, affected files, test counts, preview result, installed version, matrix changes, a copy-paste test prompt, known limitations, and commit/push status.

## Decision rules

- Create a dedicated blueprint when the scenario has a stable information hierarchy that generic open composition repeatedly loses. Keep novelty low and styling blueprint-scoped.
- Extend a generic component when the structure is reusable across scenarios. Add scenario-only rendering only when the generic component cannot express the approved interaction or scale behavior.
- Prefer semantic role mapping over section-position styling. Position may seed a default, but titles and roles must preserve meaning as optional sections appear or disappear.
- Support two through five comparison options in one model; do not build separate two-item and multi-item UIs. For larger sets, preserve scanability through contained scrolling or progressive disclosure.
- Omit unsupported sections instead of generating empty cards. Preserve uncertainty, ownership, deadlines, and citations when present.
- If the native render tool is unavailable, stop with a precise availability diagnosis. Do not create an HTTP, file, or prose substitute and call it plugin verification.
- If the UI returns text fallback, capture the exact compiler or mount error, add a regression test for that input shape, fix the earliest invalid transformation, and rerun the installed-plugin path.

## Authorization boundary

Implementation and local verification do not authorize committing, pushing, publishing, or changing marketplace state. Obtain or rely on explicit user authorization immediately before each external mutation. Preserve remote history and never force-push unless the user explicitly requests it and the exact consequences are understood.
