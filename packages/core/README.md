# `@fify/core`

The supported Fify semantic compiler and provider boundary. It validates grounded information, selects a catalog-constrained representation, and emits a trusted A2UI stream with an authoritative text fallback.

```ts
import { createInformationUI } from "@fify/core";
```

Use `@fify/core/openai` for the optional OpenAI structured-output adapter. Models produce semantic data, never executable UI code. See the repository `README.md` and `docs/framework.md` for the full contract.
