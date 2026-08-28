# Getting started

Fify has two first-class entry paths. Choose one; you do not need to understand the semantic compiler, A2UI protocol, or renderer before using it.

## Path 1: use Fify in Codex

### Install and use

From a clone, install the local plugin with one command:

```bash
corepack enable
pnpm install
pnpm codex:install
```

The installer refuses to replace Fify while the ChatGPT/Codex desktop MCP host is running. Fully quit the app with Command-Q, run the install from Terminal, then reopen it. A new task alone does not refresh the long-lived MCP host. Then run:

```bash
pnpm codex:verify-host
```

The preflight rejects a stale desktop host and separately checks the exact six-section, three-image comparison through `render_information_ui`. Treat the plugin as ready only after it passes and a brand-new tagged desktop task mounts the native widget. Do not resume a task created before installation; its MCP tool snapshot remains stale.

This path requires Node.js 22+, pnpm 11+, and a Codex installation that supports plugin commands.

Then start a new Codex task. Tag `@Fify` or explicitly ask for an interactive view. Fify is mention-only, so ordinary untagged requests remain standard Codex answers.

Codex supplies the grounded answer, so the local plugin works without an end-user API key. Its bundled MCP server uses the trusted deterministic composer when no optional service credential is present. Named real-person profiles perform a bounded Wikimedia lookup for an openly licensed, attributed portrait unless the user requests no image. Users do not need a Fify account, an envelope schema, or renderer configuration.

Good first prompts:

- `@Fify` compare these options by cost, effort, and risk.
- Use Fify to turn this launch plan into an editable checklist.
- Show the milestones as an interactive timeline.
- Make this summary an interactive view that is easier to explore.
- Turn these operating results into an executive briefing with signals, a decision, risks, and next actions.

### Maintainer bundle only

To create and validate the portable plugin without installing it:

```bash
pnpm plugin:bundle
```

A local or hosted service operator may configure `OPENAI_API_KEY` to enable model-selected layout composition. That credential belongs to the service operator, not to plugin users. See [the Codex/ChatGPT integration boundary](chatgpt-plugin.md) for security, fallback, and release-gate details.

## Path 2: use Fify in the browser

Requirements: Node.js 22+ and pnpm 11+.

```bash
corepack enable
pnpm install
pnpm web
```

Open the local URL printed by Next.js, choose **Settings** in the lower-left navigation, save an OpenAI API key, and ask a question. The port is selected at startup and may change when the default is already in use. The browser-held key is stored in session storage only and is forwarded with generation requests. It is not stored with conversation history.

For a shared local or deployed environment, configure the key on the server instead:

```bash
OPENAI_API_KEY="your-key" pnpm web
```

Never commit a credential. The checked-in `.env.example` contains only empty values, and `.env.local` is ignored.

## What works without a key

- The browser shell and deterministic compiler can be inspected without a provider call.
- Unit tests, semantic evaluations, and mocked-provider development do not require a key.

Fify never presents a fixture or heuristic fallback as live model output. If a required model connection is unavailable, the UI must state that directly.

## Embed the supported React surface

For the smallest application integration, run the checked-in starter:

```bash
pnpm --filter @fify/example-minimal-react dev
```

It imports only supported paths from `@fify/core`, `@fify/a2ui`, and `@fify/react`. The page starts with a deterministic preview; provide an OpenAI API key to run a live two-stage structured-output pipeline through `@fify/core/openai`. The key stays in page memory, the server route never persists it, the renderer uses only registered local components, and an authoritative text fallback remains available. See [the starter source](../examples/minimal-react) and [package boundaries](package-boundaries.md).

## Verify a contribution

```bash
pnpm check
pnpm test:e2e
```

`pnpm check` covers types, tests, semantic evaluations, production builds, and packed-package consumption. Browser tests additionally cover accessibility, interaction, responsive behavior, and truthful output states.
