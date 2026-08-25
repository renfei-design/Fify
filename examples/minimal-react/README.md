# Minimal React starter

This is the smallest browser example of Fify's supported package boundary. It uses only:

- `@fify/core` to validate grounded information and compile A2UI.
- `@fify/a2ui` to reduce the protocol messages into a surface.
- `@fify/react` to render application-owned components.
- `@fify/core/openai` in a server route for strict Responses API generation.

```bash
corepack enable
pnpm install
pnpm --filter @fify/example-minimal-react dev
```

Open the local URL printed by Next.js. The port is selected at startup and may change when the default is already in use.

The page opens with a deliberately deterministic preview. Add an OpenAI API key and ask a question to run the live two-stage pipeline: one strict structured output creates the information envelope and a second chooses only the catalog layout. The key is held in page memory and forwarded through the local server route; it is not written to disk.

This small starter does not retrieve current web sources. It rejects model-authored citations and visibly reminds users to verify time-sensitive or important information. Use the full demo when you need Fify's live evidence-resolution path.
