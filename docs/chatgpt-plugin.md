# Fify as a zero-setup ChatGPT capability

The installable package lives at `plugins/fify`; the MCP Apps server and widget live at `apps/mcp-app`. End users install once, then explicitly invoke Fify or ask for an interactive view. Ordinary untagged requests remain standard answers. Users do not provide an API key, create a Fify account, or learn the envelope schema.

## Runtime boundary

The model sees one read-only tool: `render_information_ui`. It must first produce a factual, sourced answer, then pass that exact answer plus semantic sections into `InformationEnvelopeV1`. The tool returns the authoritative text immediately even when UI cannot mount.

The mounted app alone sees `read_information_ui_run`. It polls with `{ runId, afterSequence }`, receives unseen frames, and can reconnect without duplicating prior frames. The widget displays its own shell before the first poll completes.

`packages/core/src/grounded.ts` is the security boundary. It validates strict envelopes and provenance, constrains model composition to semantic IDs, and binds exact host copy into the portable `UIExperience`. A model can select topology, component, order, and importance; it cannot author copy, links, dates, prices, or citations. If the server model is unavailable, the trusted deterministic composer produces a clearly labeled safe layout instead of pretending model generation succeeded.

The ChatGPT/Codex adapter shares semantic surface families and theme tokens with the web renderer. Grounded v1 can materialize text, facts, comparisons, checklists, steps, tables, timelines, executive briefings, callouts, inputs, choice groups, tabs, and trusted media. Executive, leadership, board, and decision brief requests route through a dedicated Fify briefing blueprint with an answer-first headline, flat signal rows, decision details, risks, and owned next actions; unsupported sections are omitted. Large fact/table surfaces get local filtering; selections and semantic input IDs are preserved for conversational continuation. Named real-person profiles may supply a canonical `profileSubject`; trusted server code resolves and attributes a Wikimedia portrait before composition. Other media remains limited to exact host-supplied URLs from the resource CSP allowlist and must resolve to an existing source.

## Local installation

1. Install workspace dependencies.
2. Fully quit ChatGPT/Codex with Command-Q, then run `pnpm codex:install` from Terminal. The installer refuses to replace Fify while the desktop MCP host is running. It builds a portable production-only MCP deployment inside the ignored `plugins/fify/server` directory, validates the plugin contract, adds the repository marketplace, and installs Fify.
3. Reopen ChatGPT/Codex. Opening a new task without restarting does not refresh the long-lived MCP host.
4. Run `pnpm codex:verify-host`. It must reject any desktop MCP host older than the installed bundle and complete the exact six-section, three-image comparison through `render_information_ui`.
5. Start a brand-new tagged Codex desktop task and require the native widget to mount before recording installed acceptance. Never reuse a task created before installation because its MCP tool snapshot remains stale. Then try the prompts in `plugins/fify/README.md` and exercise the positive and negative activation prompts in `plugins/fify/evals/activation.json`.

The bundled stdio server works without a provider key because the host supplies the grounded answer and the server has a trusted deterministic composer. Profile portrait lookup contacts only the English Wikipedia and Wikimedia Commons APIs and can be disabled with `FIFY_PROFILE_MEDIA_LOOKUP=0`. A local or hosted operator can optionally set `OPENAI_API_KEY`, `FIFY_COMPOSER_MODEL`, and a private `FIFY_QUOTA_SALT`; never place a provider key in the plugin bundle or request one from an end user. A public directory entry can point the same plugin contract at a hosted MCP endpoint.

## Data and failure behavior

- In-memory runs retain validated envelopes and frames for no more than one hour.
- Quotas use a salted hash of stable host metadata: 20 successful renders per day and two active runs. Failed runs do not consume the daily success quota.
- For named-person profiles, the canonical subject name is sent to the English Wikipedia and Wikimedia Commons APIs to resolve an openly licensed portrait and attribution. No answer text or host identifier is sent in that lookup.
- The provider gateway uses non-persistent Responses API calls. Operational state after run expiry is limited to aggregate quota counters in this implementation.
- Invalid input, expired runs, provider errors, timeouts, unavailable UI, and quota limits leave the authoritative tool text intact.

## Release gates

Run `pnpm plugin:test`, `pnpm plugin:bundle`, and `pnpm plugin:validate`, then smoke-test both tool calls through an MCP client. `pnpm --filter @fify/mcp-app preview` exercises the profile/media layout; `pnpm --filter @fify/mcp-app preview:interactions` exercises selection, filtering, semantic input state, continuation, and compact layout. Before public beta, run the activation set with a fresh account, verify a 95% or better widget initialization rate, audit that every rendered factual field resolves to the envelope, and complete keyboard, focus, screen-reader, contrast, reduced-motion, mobile, light-theme, and dark-theme checks.
