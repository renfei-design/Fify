# Fify plugin

Fify turns complex AI answers into useful interactive views.

Install once, then ask normally or tag `@Fify`. No end-user API key, account, schema, or renderer configuration is required. Codex provides the grounded answer; Fify turns it into a trusted information view and preserves the original text as fallback.

From a cloned repository, the local install is one command:

```bash
pnpm codex:install
```

That command builds a portable MCP server inside the plugin, validates the manifest and marketplace entry, registers the local marketplace, and installs Fify. Start a new Codex task after installation so the new skill and tool are loaded.

Try one of these prompts:

- Compare these options by cost and risk.
- Make this a three-day plan.
- Show the milestones as a timeline.
- Turn this summary into a checklist.

The local plugin is useful without a provider key: Codex supplies the authoritative grounded answer and the bundled server uses a trusted deterministic layout. A service operator may configure `OPENAI_API_KEY` to enable a model-selected layout, but plugin users should never be asked for that credential.

The ChatGPT directory build uses the same contract through a stateless hosted MCP endpoint. It returns the complete view in the initial tool response so serverless request routing cannot interrupt rendering.
