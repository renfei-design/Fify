# Fify plugin

Fify turns complex AI answers into useful interactive views.

Install once, then tag `@Fify` or explicitly ask for an interactive view. Fify is mention-only and never activates for an ordinary untagged request. No end-user API key, account, schema, or renderer configuration is required. Codex provides the grounded answer; Fify turns it into a trusted information view and preserves the original text as fallback.

From a cloned repository, the local install is one command:

```bash
pnpm codex:install
```

The installer refuses to replace Fify while the ChatGPT/Codex desktop MCP host is running. Fully quit the app with Command-Q, run the command from Terminal, then reopen it. Closing a window or opening a new task does not refresh the long-lived MCP host. Run `pnpm codex:verify-host` from the repository; it exercises the exact six-section, three-image comparison. The preflight must pass and a brand-new tagged desktop task must mount the native widget before Fify is accepted as ready. Never resume a task created before installation because its MCP tool snapshot remains stale.

Try one of these prompts:

- `@Fify` compare these options by cost and risk.
- Use Fify to make this a three-day plan.
- Show the milestones as an interactive timeline.
- Turn this summary into a Fify checklist.
- Turn these operating results into an executive briefing with signals, the decision, risks, and next actions.

The local plugin is useful without a provider key: Codex supplies the authoritative grounded answer and the bundled server uses an immediate trusted deterministic layout. Named real-person profiles perform a bounded Wikimedia lookup for an openly licensed, attributed portrait unless the user requests no image; set `FIFY_PROFILE_MEDIA_LOOKUP=0` to disable that network lookup. A hosted service operator may explicitly set both `FIFY_ENABLE_MODEL_COMPOSER=1` and `OPENAI_API_KEY` to enable model-selected composition, but plugin users should never be asked for those credentials.

The ChatGPT directory build uses the same contract through a stateless hosted MCP endpoint. It returns the complete view in the initial tool response so serverless request routing cannot interrupt rendering.
