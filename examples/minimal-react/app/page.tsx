"use client";

import {
  reduceA2UIStream,
  type A2UIComponent,
  type A2UIMessage,
} from "@fify/a2ui";
import { createInformationUI, fifyInformationCatalogId } from "@fify/core";
import { createA2UIRenderer } from "@fify/react";
import { useMemo, useState, type ReactNode } from "react";

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function items(component: A2UIComponent) {
  return Array.isArray(component.items)
    ? component.items.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object",
      )
    : [];
}

interface ComponentProps {
  component: A2UIComponent;
  children?: ReactNode;
}

function Collection({ component, children }: ComponentProps) {
  const collectionItems = items(component);
  return (
    <section
      className={`information-block type-${component.component.toLowerCase()}`}
    >
      <header>
        <span>{component.component}</span>
        {text(component.title) ? <h2>{text(component.title)}</h2> : null}
        {text(component.text) ? <p>{text(component.text)}</p> : null}
      </header>
      {collectionItems.length ? (
        <div className="information-items">
          {collectionItems.map((item, index) => (
            <article key={text(item.id) || index}>
              <strong>{text(item.label)}</strong>
              {text(item.value) ? <b>{text(item.value)}</b> : null}
              <p>{text(item.detail)}</p>
            </article>
          ))}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function Structural({ children }: ComponentProps) {
  return <div className="information-grid">{children}</div>;
}

const collectionComponents = [
  "Hero",
  "Card",
  "Text",
  "FactList",
  "ColorPalette",
  "Badge",
  "Metric",
  "Chart",
  "Donut",
  "Comparison",
  "Checklist",
  "Steps",
  "Table",
  "Timeline",
  "Progress",
  "Callout",
  "Quote",
  "Input",
  "ChoiceGroup",
  "Tabs",
  "MapPanel",
  "Calendar",
  "CodeBlock",
  "Visual",
] as const;

const components: Record<string, typeof Collection> = Object.fromEntries(
  collectionComponents.map((name) => [name, Collection]),
);
for (const name of ["Stack", "Row", "Grid", "Rail", "Divider", "Spacer"])
  components[name] = Structural;

const InformationRenderer = createA2UIRenderer<null>({
  catalogId: fifyInformationCatalogId,
  components: {
    Page: ({ children }) => (
      <section className="information-page">{children}</section>
    ),
    ...components,
  },
});

const example = createInformationUI(
  {
    version: "1.0",
    originalRequest: "Compare a focused launch with a broad launch.",
    groundedAnswer:
      "A focused launch is faster to validate. A broad launch reaches more use cases but costs more to support.",
    locale: "en",
    sections: [
      {
        id: "launch-options",
        title: "Choose the launch shape",
        body: "Both options can work; the trade-off is speed versus coverage.",
        items: [
          {
            id: "focused",
            label: "Focused launch",
            value: "Faster validation",
            detail:
              "Ship one excellent workflow and learn from early adopters.",
            sourceIds: [],
          },
          {
            id: "broad",
            label: "Broad launch",
            value: "More coverage",
            detail:
              "Support more workflows at the cost of additional complexity.",
            sourceIds: [],
          },
        ],
        sourceIds: [],
      },
    ],
    sources: [],
    suggestedRefinements: [],
  },
  { responseId: "minimal-react-starter" },
);

interface GeneratedPayload {
  messages: readonly A2UIMessage[];
  fallbackText: string;
  provider: { model: string };
}

export default function Page() {
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState(
    "Compare a focused launch with a broad launch.",
  );
  const [messages, setMessages] = useState<readonly A2UIMessage[]>(
    example.messages,
  );
  const [fallback, setFallback] = useState(example.fallbackText);
  const [model, setModel] = useState<string | null>(null);
  const [status, setStatus] = useState<"ready" | "generating" | "error">(
    "ready",
  );
  const [error, setError] = useState("");
  const surface = useMemo(() => reduceA2UIStream(messages), [messages]);

  async function generate() {
    if (!apiKey.trim() || prompt.trim().length < 3 || status === "generating")
      return;
    setStatus("generating");
    setError("");
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-openai-api-key": apiKey.trim(),
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const payload = (await response.json()) as GeneratedPayload & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Generation failed.");
      setMessages(payload.messages);
      setFallback(payload.fallbackText);
      setModel(payload.provider.model);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Generation failed.");
      setStatus("error");
    }
  }

  return (
    <main className="starter-shell">
      <header className="starter-header">
        <div>
          <span className="starter-mark">F</span>
          <strong>Fify starter</strong>
        </div>
        <span className="provenance">
          {model
            ? `Generated with ${model}`
            : "Deterministic preview · no model call"}
        </span>
      </header>
      <section className="starter-intro">
        <span>API key in. Trusted components out.</span>
        <h1>Ask in words. Get an interface.</h1>
        <p>
          The model creates validated information and a separate layout plan.
          Fify compiles both into catalog-only A2UI rendered by your React
          components.
        </p>
      </section>
      <section
        className="composer"
        aria-label="Generate an information interface"
      >
        <label>
          <span>OpenAI API key</span>
          <input
            aria-label="OpenAI API key"
            type="password"
            autoComplete="off"
            placeholder="sk-…"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
          <small>
            Held in React state for this page only; never written to disk.
          </small>
        </label>
        <label>
          <span>Ask Fify</span>
          <textarea
            aria-label="Ask Fify"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
          />
        </label>
        <button
          type="button"
          onClick={generate}
          disabled={
            !apiKey.trim() ||
            prompt.trim().length < 3 ||
            status === "generating"
          }
        >
          {status === "generating"
            ? "Generating two validated stages…"
            : "Generate interface"}
        </button>
        {error ? (
          <p className="composer-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>
      {surface ? (
        <InformationRenderer surface={surface} context={null} />
      ) : (
        <p role="alert">Fify did not return a renderable surface.</p>
      )}
      <details className="fallback">
        <summary>Authoritative plain-text fallback</summary>
        <p>{fallback}</p>
      </details>
      <p className="trust-note">
        This starter does not retrieve live sources. Verify time-sensitive or
        important information.
      </p>
    </main>
  );
}
