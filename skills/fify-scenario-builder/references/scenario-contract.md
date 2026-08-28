# Fify scenario contract

Complete this contract before implementation. Store it in `scenarios/<id>/scenario.json` and keep it concise enough to review with the user. Store canonical prompts in the adjacent `fixtures.json` rather than duplicating them here.

## 1. Scenario boundary

- **Scenario name:** A stable product concept, not a sample prompt.
- **User job:** The decision or understanding the view should make faster.
- **Direct triggers:** Phrases that should select this scenario after Fify is explicitly invoked.
- **Exclusions:** Nearby intents that must remain another scenario or normal prose.
- **Grounding source:** User-supplied facts, researched facts, or both.

## 2. Information model

Define semantic roles before components. For each role, state whether it is required or optional and map grounded fields to visible content.

| Role             | Required          | Grounded mapping                    | Priority          |
| ---------------- | ----------------- | ----------------------------------- | ----------------- |
| Primary answer   | Yes               | Section title/body                  | First scan target |
| Supporting roles | Scenario-specific | `label`, `value`, `detail`, sources | Supporting        |

Rules:

- Preserve exact numbers, names, dates, owners, uncertainty, and source IDs.
- Use stable semantic envelope IDs, but map them to internal representation slot IDs.
- Omit a role when grounding does not support it; never add decorative filler.
- State what remains in the authoritative text fallback.

## 3. Layout contract

- **North-Star references:** Identify the relevant web screen and existing Fify components/tokens.
- **Wide canvas:** Describe hierarchy, columns, alignment, and what is visible without scrolling.
- **Compact canvas:** Describe stacking order, priority changes, and interaction changes.
- **Scale behavior:** Define behavior for minimum, typical, and maximum item counts.
- **Overflow:** Identify the only surfaces allowed to scroll and in which direction.
- **Progressive disclosure:** State what may move below the fold or behind interaction.

## 4. Interaction contract

- Allowed local interactions: selection, filtering, disclosure, inputs, or checklist state.
- Follow-up prompt behavior and state that must survive in `continuationState`.
- Non-consequential boundary: actions the scenario must never perform.
- Keyboard, focus, labeling, and reduced-motion expectations.

## 5. Success criteria

Write observable pass/fail statements covering:

- correct blueprint, topology, semantic roles, and components;
- exact grounded facts and fallback preservation;
- wide, compact, minimum, and maximum data cases;
- no page-level overflow, clipping, duplicate cards, mount errors, or console errors;
- positive explicit invocation and negative untagged behavior;
- follow-up refinement when supported;
- acceptable startup/render timing measured from the installed bundle.

## 6. Test prompts

Keep `fixtures.json` to the smallest set that proves the contract:

1. A canonical explicit `@Fify` request.
2. A compact or scale-boundary case when layout behavior changes.
3. The same structured request without Fify, which must not activate.
4. Add a follow-up, maximum-scale, or honest-failure case only when that behavior is part of the scenario contract.
