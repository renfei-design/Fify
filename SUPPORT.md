# Support

Fify is an open-source project with a public ChatGPT integration. The hosted service is supported on a reasonable-effort basis; response times and uninterrupted availability are not guaranteed.

## Before asking for help

1. For ChatGPT, ask it to render the answer with Fify again and confirm the complete plain answer is still visible.
2. For local development, follow [Getting started](docs/getting-started.md), confirm Node.js 22+ and pnpm 11+, and run `pnpm check`.
3. Remove generated caches and retry from a clean local state if browser output disagrees with current source.

## Include in a support request

- Which path you are using: ChatGPT app, Codex plugin, or browser demo.
- Operating system, Node version, pnpm version, and the command you ran.
- The affected route or package.
- A minimal reproduction and the complete error message.
- Whether a provider key was configured, without including the key itself.
- Whether the behavior occurs with deterministic fixtures or only live generation.

Use a GitHub issue for reproducible bugs and a GitHub Discussion for setup questions or design proposals when Discussions are enabled. Use GitHub's private vulnerability-reporting flow for vulnerabilities or sensitive reports as described in [SECURITY.md](SECURITY.md). Never post API keys, customer data, private prompts, or generated interfaces containing sensitive information.
