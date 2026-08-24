import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { A2UIComponent, A2UISurfaceState } from "@fify/a2ui";
import {
  uiLanguageCatalogId,
  uiNodeSchema,
  type UINode,
} from "@fify/core";
import {
  GenerationActivity,
  UILanguageRenderer,
  UniversalDemo,
  type RendererContext,
} from "./universal-demo";

const noAction = {
  type: "none" as const,
  prompt: "" as const,
  targetId: "" as const,
  value: "" as const,
};

function node(input: Partial<UINode> & Pick<UINode, "id" | "type">) {
  return uiNodeSchema.parse({
    slot: input.type === "Page" ? "" : "answer",
    importance: "supporting",
    relationship: "standalone",
    mediaRole: "none",
    variant: "default",
    tone: "neutral",
    title: "",
    text: "",
    label: "",
    value: "",
    meta: "",
    icon: "",
    span: "full",
    align: "start",
    columns: 1,
    gap: "normal",
    progress: null,
    action: noAction,
    items: [],
    children: [],
    ...input,
  });
}

function surface(nodes: readonly UINode[]): A2UISurfaceState {
  return {
    surfaceId: "accessibility-test",
    catalogId: uiLanguageCatalogId,
    sendDataModel: true,
    components: Object.fromEntries(
      nodes.map((value) => [
        value.id,
        {
          ...value,
          component: value.type,
          catalogId: uiLanguageCatalogId,
        } satisfies A2UIComponent,
      ]),
    ),
    dataModel: {
      screen: { title: "Accessible generated answer", contextLabel: "Test" },
    },
  };
}

const context: RendererContext = {
  checked: new Set(["task-one"]),
  selected: { choices: "option-one", tabs: "tab-two" },
  inputs: { source: "Notes" },
  generating: false,
  runAction: vi.fn(),
  setInput: vi.fn(),
  useSuggestion: vi.fn(),
};

describe("universal renderer accessibility contract", () => {
  it("renders honest names, states, progress semantics, and heading levels", () => {
    const markup = renderToStaticMarkup(
      <UILanguageRenderer
        context={context}
        surface={surface([
          node({
            id: "root",
            type: "Page",
            children: [
              "primary",
              "progress",
              "donut",
              "source",
              "choices",
              "checklist",
              "tabs",
            ],
          }),
          node({
            id: "primary",
            type: "Text",
            importance: "primary",
            title: "Accessible answer",
            text: "The primary response starts at heading level two.",
          }),
          node({
            id: "progress",
            type: "Progress",
            label: "Study progress",
            value: "64%",
            progress: 64,
          }),
          node({
            id: "donut",
            type: "Donut",
            label: "Budget used",
            value: "40%",
            progress: 40,
          }),
          node({
            id: "source",
            type: "Input",
            label: "Source notes",
            text: "Paste notes",
          }),
          node({
            id: "choices",
            type: "ChoiceGroup",
            title: "Choose a pace",
            action: {
              type: "select",
              prompt: "",
              targetId: "choices",
              value: "",
            },
            items: [
              {
                id: "option-one",
                label: "Focused",
                value: "",
                detail: "One task at a time",
                tone: "neutral",
                progress: null,
              },
            ],
          }),
          node({
            id: "checklist",
            type: "Checklist",
            title: "Ready to ship",
            action: {
              type: "toggle",
              prompt: "",
              targetId: "checklist",
              value: "",
            },
            items: [
              {
                id: "task-one",
                label: "Keyboard review",
                value: "",
                detail: "Verify the focus path",
                tone: "neutral",
                progress: null,
              },
            ],
          }),
          node({
            id: "tabs",
            type: "Tabs",
            label: "Answer view",
            action: {
              type: "select",
              prompt: "",
              targetId: "tabs",
              value: "",
            },
            items: [
              {
                id: "tab-one",
                label: "Summary",
                value: "",
                detail: "",
                tone: "neutral",
                progress: null,
              },
              {
                id: "tab-two",
                label: "Details",
                value: "",
                detail: "",
                tone: "neutral",
                progress: null,
              },
            ],
          }),
        ])}
      />,
    );

    expect(markup).toContain("<h2>Accessible answer</h2>");
    expect(markup.match(/role="progressbar"/g)).toHaveLength(2);
    expect(markup).toContain('aria-label="Study progress"');
    expect(markup).toContain('aria-label="Budget used"');
    expect(markup).toMatch(
      /<label[^>]*><span>Source notes<\/span>[\s\S]*<input/,
    );
    expect(markup).toContain('role="checkbox" aria-checked="true"');
    expect(markup).toMatch(
      /<div[^>]*aria-label="Answer view"[^>]*role="group"/,
    );
    expect(markup).not.toContain('role="tablist"');
    expect(markup.match(/aria-pressed="true"/g)?.length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("gives the conversation shell one stable page heading", () => {
    const markup = renderToStaticMarkup(<UniversalDemo />);
    expect(markup.match(/<h1/g)).toHaveLength(1);
    expect(markup).toContain('<h1 class="sr-only">Fify browser chat</h1>');
    expect(markup).toContain("<h2>Ask in words.");
    expect(markup).toContain("Browser chat");
    expect(markup).toContain("Codex integration");
    expect(markup).toContain("Catalog-constrained interface");
    expect(markup).toContain("API key settings");
    expect(markup).toContain("Manage your API key in Settings");
    expect(markup).toContain('<dialog class="gxchat-settings-dialog"');
    expect(markup).not.toContain('class="gxchat-key"');
    expect(markup).toContain('aria-label="Message Fify"');
    expect(markup).toContain('href="#fify-composer"');
    expect(markup).toContain('id="fify-composer"');
  });

  it("collapses generated source links by default", () => {
    const markup = renderToStaticMarkup(
      <UILanguageRenderer
        context={context}
        surface={surface([
          node({ id: "root", type: "Page", children: ["sources"] }),
          node({
            id: "sources",
            type: "Sources",
            title: "Sources",
            meta: "As of 2026-08-24T08:00:00.000Z",
            items: [
              {
                id: "source-one",
                label: "Primary report",
                value: "Verified source",
                detail: "https://example.com/report",
                tone: "neutral",
                progress: null,
              },
            ],
          }),
        ])}
      />,
    );

    expect(markup).toMatch(/<details><summary[^>]*>.*Sources.*<\/summary>/);
    expect(markup).not.toContain("<details open");
    expect(markup).toContain('href="https://example.com/report"');
  });

  it("keeps unresolved media loading but removes unavailable media", () => {
    const unresolved = renderToStaticMarkup(
      <UILanguageRenderer
        context={context}
        surface={surface([
          node({ id: "root", type: "Page", children: ["portrait"] }),
          node({
            id: "portrait",
            type: "Image",
            title: "Portrait",
            mediaRole: "identity",
          }),
        ])}
      />,
    );
    expect(unresolved).toContain("Finding an openly licensed visual…");
    expect(unresolved).not.toContain("Visual unavailable");

    const unavailable = renderToStaticMarkup(
      <UILanguageRenderer
        context={context}
        surface={surface([
          node({
            id: "root",
            type: "Page",
            children: ["portrait", "answer"],
          }),
          node({
            id: "portrait",
            type: "Image",
            title: "Portrait",
            mediaRole: "identity",
            meta: "Unavailable",
          }),
          node({
            id: "answer",
            type: "Text",
            text: "The answer remains visible.",
          }),
        ])}
      />,
    );
    expect(unavailable).toContain("The answer remains visible.");
    expect(unavailable).not.toContain("gxui-image");
    expect(unavailable).not.toContain("Visual unavailable");
  });

  it("uses a compact live disclosure and collapses the trace when complete", () => {
    const active = renderToStaticMarkup(
      <GenerationActivity
        id="turn-activity"
        active
        elapsedMs={3_200}
        status={{
          type: "status",
          phase: "composing",
          elapsedMs: 3_100,
          state: "advanced",
          completedUnits: 2,
          totalUnits: 4,
          unit: "regions",
        }}
        activities={[
          {
            type: "activity",
            id: "provider-summary",
            phase: "composing",
            label: "Thinking through the interface",
            detail: "A comparison keeps the options easy to scan.",
            state: "active",
            source: "provider",
            elapsedMs: 3_100,
          },
        ]}
      />,
    );
    expect(active).toContain('aria-expanded="true"');
    expect(active).toContain("Thinking through the interface");
    expect(active).toContain("A comparison keeps the options easy to scan.");
    expect(active).toContain('role="status"');
    expect(active).not.toContain('role="progressbar"');

    const complete = renderToStaticMarkup(
      <GenerationActivity
        id="turn-complete"
        active={false}
        elapsedMs={5_200}
        status={null}
        activities={[]}
      />,
    );
    expect(complete).toContain('aria-expanded="false"');
    expect(complete).toContain("Interface ready");
    expect(complete).not.toContain("Built interface in 5.2s");
    expect(complete).not.toContain("gxchat-activity-trace");
  });
});
