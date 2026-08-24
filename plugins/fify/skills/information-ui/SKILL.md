---
name: information-ui
description: Turn a fully grounded answer into an interactive Fify information view when comparison, planning, chronology, tracking, structured explanation, decision support, or editable state materially improves the answer. Use when the user tags @Fify or explicitly asks for an interactive view, and conservatively for naturally suitable answers. Do not use for simple facts, short conversational answers, creative writing, or when prose is clearer.
---

# Fify information UI

1. Complete all factual reasoning, retrieval, and source checking before calling Fify. Fify is a presentation compiler, not a source of facts.
2. Keep an authoritative plain-language answer. Pass it unchanged as `groundedAnswer`; it is the fallback if UI is unsupported, unavailable, expired, or over quota.
3. Call only `render_information_ui`. Never call or mention `read_information_ui_run`; it is reserved for the mounted app.
4. Use `InformationEnvelopeV1` version `1.0`:
   - Copy the user request into `originalRequest` and use their locale when known.
   - Supply one to eight semantic sections and at most twelve items per section.
   - Give every source, section, and item a stable unique semantic ID.
   - Attach only source IDs that exist in `sources`; use public HTTPS source URLs.
   - Optionally include up to four grounded `media` records when seeing the real subject materially improves the answer. Use only an exact openly licensed image URL already established during research from `upload.wikimedia.org` or `api.openverse.org`, accurate alt text and caption, and an existing `sourceId`. Never invent, search for, or rewrite media during Fify composition; omit media if any provenance is uncertain.
   - Include no more than two short natural-language refinements.
   - Keep the whole envelope under 24,000 characters.
5. Invoke automatically only when structure or non-consequential interaction adds material value: comparisons, plans, timelines, trackers, structured explanations, decision tools, and editable summaries are strong cases.
6. Always invoke when the user tags `@Fify` or says “show this as an interactive view,” unless the requested UI would be unsafe or consequential.
7. After the widget mounts, do not repeat the complete answer. Give at most one short sentence orienting the user; the tool already returns the authoritative text fallback.
8. For follow-up refinements, call the same public tool with a newly grounded envelope. Preserve compatible semantic IDs and pass prior checked, selected, or input state in `continuationState` without exposing it to the user.
9. Keep v1 non-consequential. Selection, filtering, checklists, disclosure, local inputs, and conversational refinements are allowed. Purchasing, publishing, account changes, and third-party mutations are not.
