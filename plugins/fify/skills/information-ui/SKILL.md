---
name: information-ui
description: Turn a fully grounded answer into an interactive Fify information view only when the user explicitly invokes Fify or asks for an interactive view. Do not use for ordinary untagged requests, even when comparison, planning, chronology, tracking, structured explanation, decision support, or editable state could benefit from interaction.
---

# Fify information UI

1. Complete all factual reasoning, retrieval, and source checking before calling Fify. Fify is a presentation compiler, not a source of facts.
   - Fast path: when the user already supplied the facts or source material needed for the requested view, treat that material as the grounding. Do not browse, enrich, or re-research it unless accuracy or freshness requires verification.
   - Prepare the envelope in one pass and call the tool immediately after grounding. Do not inspect files, run shell commands, probe the renderer, or narrate internal composition work.
2. Keep an authoritative plain-language answer. Pass it unchanged as `groundedAnswer`; it is the fallback if UI is unsupported, unavailable, expired, or over quota.
3. Call `render_information_ui` exactly once per user turn. Never call or mention `read_information_ui_run`; it is reserved for the mounted app.
   - When the user explicitly tags `@Fify`, confirm that `render_information_ui` is available before doing extended retrieval or composition.
   - Codex may defer MCP tools instead of showing them in the initial static tool list. If `render_information_ui` is not directly visible, use the execution tool to search `ALL_TOOLS` for the exact tool name `mcp__fify__render_information_ui`. If found, call it as `tools.mcp__fify__render_information_ui(...)` from that execution context. Never treat omission from the initial tool list as proof that Fify is unavailable.
   - Report the native tool as unavailable only after the exact deferred-tool lookup returns no match. Do not substitute a search for the word `Fify`, inspect plugin files, or infer availability from whether the skill itself loaded.
   - Never retry `render_information_ui` in the same turn. If it returns a validation diagnostic or fallback, let that mounted card terminate and give at most one short orienting sentence; another call would create a duplicate card.
   - If the native tool is unavailable, fail fast with one short sentence. Do not create or edit files, run shell commands, inspect plugin internals, import the MCP SDK, or call Fify over HTTP as a workaround. Those paths cannot mount the native information UI.
4. Use `InformationEnvelopeV1` version `1.0`:
   - Copy the user request into `originalRequest` and use their locale when known.
   - For a named real-person profile, set `profileSubject` to the canonical person name unless the user explicitly requests no image. Fify resolves and attributes a trusted portrait; do not perform a separate image search first.
   - Supply one to eight semantic sections and at most twelve items per section.
   - Give every source, section, and item a stable unique semantic ID.
   - Attach only source IDs that exist in `sources`; use public HTTPS source URLs.
   - Optionally include up to four pre-resolved grounded `media` records for other visual evidence. Use only an exact openly licensed image URL already established during research from `upload.wikimedia.org` or `api.openverse.org`, accurate alt text and caption, and an existing `sourceId`. Never invent or rewrite media URLs; omit media if any provenance is uncertain.
   - Include no more than two short natural-language refinements.
   - Keep the whole envelope under 24,000 characters.
   - For an executive, leadership, board, or decision briefing, use the dedicated briefing contract instead of imitating a dashboard:
     - Put the answer-first headline and concise executive summary in the first section. Keep that section to zero or one item.
     - Follow with an `Executive signals` section whose items use `label` for the signal, `value` for the scannable status or metric, and `detail` for the evidence-backed explanation.
     - Use separate sections for `What changed`, `Decision`, `Risks`, and `Next actions` when the grounded answer supports them. Omit unsupported sections rather than filling the layout.
     - Put decision status, accountable owner, and decision date in the `Decision` items. Put owners or due dates in the `value` of `Next actions` items.
     - Preserve uncertainty and source IDs on every claim. Do not author visual styling, decorative cards, or dashboard chrome in the envelope; Fify owns the briefing layout and component styling.
5. Never invoke Fify implicitly. An ordinary untagged request must receive a normal answer, even when it is a comparison, plan, timeline, tracker, structured explanation, decision tool, or editable summary.
6. Invoke only when the user tags `@Fify`, explicitly names Fify, or explicitly asks to show or render the answer as an interactive view. Do not treat words such as “compare,” “plan,” “timeline,” or “checklist” alone as permission to invoke Fify.
7. After the widget mounts, do not repeat the complete answer. Give at most one short sentence orienting the user; the tool already returns the authoritative text fallback.
8. For follow-up refinements, call the same public tool with a newly grounded envelope. Preserve compatible semantic IDs and pass prior checked, selected, or input state in `continuationState` without exposing it to the user.
9. Keep v1 non-consequential. Selection, filtering, checklists, disclosure, local inputs, and conversational refinements are allowed. Purchasing, publishing, account changes, and third-party mutations are not.
