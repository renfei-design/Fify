import { describe, expect, it } from "vitest";
import { informationUISurfaceFamilyForType } from "@fify/core";
import {
  INFORMATION_UI_RESOURCE_URI,
  LEGACY_INFORMATION_UI_RESOURCE_URIS,
  informationUIWidgetHtml,
  initialInformationUIAfterSequence,
} from "./widget.js";

describe("information UI widget replay", () => {
  it("starts from zero even when the initial result reports a completed high-water mark", () => {
    expect(initialInformationUIAfterSequence()).toBe(0);
    expect(informationUIWidgetHtml).toMatch(/sequence\s*=\s*0/);
    expect(informationUIWidgetHtml).not.toContain(
      "sequence=Number(out.lastSequence",
    );
  });

  it("cannot remain on the loading shell forever when replay fails", () => {
    expect(informationUIWidgetHtml).toMatch(/pollFailures\s*>=\s*8/);
    expect(informationUIWidgetHtml).toContain("did not receive a tool result");
    expect(informationUIWidgetHtml).toContain("acceptToolInput");
    expect(informationUIWidgetHtml).toContain(
      "completed without renderable frames",
    );
    expect(informationUIWidgetHtml).toContain("could not reconnect");
  });

  it("uses the standards-first MCP Apps result and tool-call bridge", () => {
    expect(informationUIWidgetHtml).toContain("ui/notifications/tool-result");
    expect(informationUIWidgetHtml).toContain("tools/call");
    expect(informationUIWidgetHtml).toContain("read_information_ui_run");
  });

  it("maps the complete portable catalog to host-native semantic families", () => {
    expect({
      Page: informationUISurfaceFamilyForType("Page"),
      Stack: informationUISurfaceFamilyForType("Stack"),
      Row: informationUISurfaceFamilyForType("Row"),
      Grid: informationUISurfaceFamilyForType("Grid"),
      Rail: informationUISurfaceFamilyForType("Rail"),
      Card: informationUISurfaceFamilyForType("Card"),
      Hero: informationUISurfaceFamilyForType("Hero"),
      Image: informationUISurfaceFamilyForType("Image"),
      SectionHeader: informationUISurfaceFamilyForType("SectionHeader"),
      Text: informationUISurfaceFamilyForType("Text"),
      FactList: informationUISurfaceFamilyForType("FactList"),
      Sources: informationUISurfaceFamilyForType("Sources"),
      ColorPalette: informationUISurfaceFamilyForType("ColorPalette"),
      Badge: informationUISurfaceFamilyForType("Badge"),
      Metric: informationUISurfaceFamilyForType("Metric"),
      Chart: informationUISurfaceFamilyForType("Chart"),
      Donut: informationUISurfaceFamilyForType("Donut"),
      Comparison: informationUISurfaceFamilyForType("Comparison"),
      Checklist: informationUISurfaceFamilyForType("Checklist"),
      Steps: informationUISurfaceFamilyForType("Steps"),
      Table: informationUISurfaceFamilyForType("Table"),
      Timeline: informationUISurfaceFamilyForType("Timeline"),
      Progress: informationUISurfaceFamilyForType("Progress"),
      Callout: informationUISurfaceFamilyForType("Callout"),
      Quote: informationUISurfaceFamilyForType("Quote"),
      Button: informationUISurfaceFamilyForType("Button"),
      Input: informationUISurfaceFamilyForType("Input"),
      ChoiceGroup: informationUISurfaceFamilyForType("ChoiceGroup"),
      Tabs: informationUISurfaceFamilyForType("Tabs"),
      MapPanel: informationUISurfaceFamilyForType("MapPanel"),
      Calendar: informationUISurfaceFamilyForType("Calendar"),
      CodeBlock: informationUISurfaceFamilyForType("CodeBlock"),
      Visual: informationUISurfaceFamilyForType("Visual"),
      Divider: informationUISurfaceFamilyForType("Divider"),
      Spacer: informationUISurfaceFamilyForType("Spacer"),
    }).toEqual({
      Page: "layout",
      Stack: "layout",
      Row: "layout",
      Grid: "layout",
      Rail: "layout",
      Card: "card",
      Hero: "hero",
      Image: "media",
      SectionHeader: "text",
      Text: "text",
      FactList: "facts",
      Sources: "facts",
      ColorPalette: "palette",
      Badge: "badge",
      Metric: "metric",
      Chart: "data-viz",
      Donut: "data-viz",
      Comparison: "comparison",
      Checklist: "checklist",
      Steps: "steps",
      Table: "table",
      Timeline: "timeline",
      Progress: "progress",
      Callout: "callout",
      Quote: "quote",
      Button: "action",
      Input: "input",
      ChoiceGroup: "choice",
      Tabs: "tabs",
      MapPanel: "map",
      Calendar: "calendar",
      CodeBlock: "code",
      Visual: "visual",
      Divider: "divider",
      Spacer: "spacer",
    });
  });

  it("walks arbitrary validated UI graphs instead of requiring the grounded fixture layout", () => {
    expect(informationUIWidgetHtml).toContain("function renderNode");
    expect(informationUIWidgetHtml).toContain("function renderLayout");
    expect(informationUIWidgetHtml).toContain('nodes.has("root")');
    expect(informationUIWidgetHtml).not.toContain(
      'nodes.get("grounded-layout")',
    );
    expect(informationUIWidgetHtml).not.toContain(
      'node.id === "grounded-layout"',
    );
    expect(informationUIWidgetHtml).toContain("path.has(id)");
  });

  it("ships the host-adaptive visual system without exposing compiler internals", () => {
    expect(informationUIWidgetHtml).toContain("gx-comparison-matrix");
    expect(informationUIWidgetHtml).toContain("gx-comparison-grid");
    expect(informationUIWidgetHtml).toContain("gx-matrix-criterion");
    expect(informationUIWidgetHtml).toContain("gx-timeline-list");
    expect(informationUIWidgetHtml).toContain("gx-media-frame");
    expect(informationUIWidgetHtml).toContain("gx-local-filter");
    expect(informationUIWidgetHtml).toContain("gx-choice-list");
    expect(informationUIWidgetHtml).toContain("gx-tab-list");
    expect(informationUIWidgetHtml).toContain("gx-hero");
    expect(informationUIWidgetHtml).toContain("gx-chart-plot");
    expect(informationUIWidgetHtml).toContain("gx-donut-ring");
    expect(informationUIWidgetHtml).toContain("gx-map-canvas");
    expect(informationUIWidgetHtml).toContain("gx-calendar-flow");
    expect(informationUIWidgetHtml).toContain("gx-visual-canvas");
    expect(informationUIWidgetHtml).toContain("upload.wikimedia.org");
    expect(informationUIWidgetHtml).toContain("api.openverse.org");
    expect(informationUIWidgetHtml).toContain("topology-");
    expect(informationUIWidgetHtml).toContain("gx-media-copy");
    expect(informationUIWidgetHtml).toContain("Photo:");
    expect(informationUIWidgetHtml).toContain("Source ↗");
    expect(informationUIWidgetHtml).toContain("container-type: inline-size");
    expect(informationUIWidgetHtml).toContain("@container (max-width: 560px)");
    expect(informationUIWidgetHtml).toContain(
      "repeat(var(--gx-option-count), minmax(176px, 1fr))",
    );
    expect(informationUIWidgetHtml).toContain(
      ".gx-comparison-matrix.options-5 .gx-comparison-grid { min-width: 1048px; }",
    );
    expect(informationUIWidgetHtml).toContain("position: sticky");
    expect(informationUIWidgetHtml).toContain("@media (max-width: 720px)");
    expect(informationUIWidgetHtml).toContain("prefers-reduced-motion");
    expect(informationUIWidgetHtml).not.toContain("safe layout fallback");
    expect(informationUIWidgetHtml).not.toContain("deterministic-fallback");
  });

  it("groups aligned comparison criteria into one scalable matrix", () => {
    expect(informationUIWidgetHtml).not.toContain("gx-primary-region");
    expect(informationUIWidgetHtml).not.toContain("gx-supporting-grid");
    expect(informationUIWidgetHtml).toContain("comparisonSignature");
    expect(informationUIWidgetHtml).toContain("comparisonGroups");
    expect(informationUIWidgetHtml).toContain("renderComparisonMatrix");
    expect(informationUIWidgetHtml).toContain(" options · ");
    expect(informationUIWidgetHtml).toContain("Not available");
    expect(informationUIWidgetHtml).toContain("overscroll-behavior-inline");
    expect(informationUIWidgetHtml).not.toContain("gx-comparison-rail");
    expect(informationUIWidgetHtml).not.toContain("gx-option-label");
  });

  it("keeps static comparison evidence non-interactive and gates selection", () => {
    expect(informationUIWidgetHtml).toContain(
      'comparison.action?.type === "select"',
    );
    expect(informationUIWidgetHtml).toContain("if (!selectable)");
    expect(informationUIWidgetHtml).toContain('element("div", className)');
    expect(informationUIWidgetHtml).toContain(
      'element("button", `${className} is-action`)',
    );
    expect(informationUIWidgetHtml).toContain("Choose an option");
  });

  it("persists checked, selected, and input state for follow-up composition", () => {
    expect(informationUIWidgetHtml).toContain(
      "inputs: Object.fromEntries(state.inputs)",
    );
    expect(informationUIWidgetHtml).toContain(
      "Keep my current selections and inputs.",
    );
  });

  it("uses a new MCP resource cache key for the richer renderer", () => {
    expect(informationUIWidgetHtml).toContain("renderMedia");
    expect(INFORMATION_UI_RESOURCE_URI).toBe(
      "ui://fify/information-ui-v9.html",
    );
    expect(LEGACY_INFORMATION_UI_RESOURCE_URIS).toContain(
      "ui://fify/information-ui-v8.html",
    );
    expect(LEGACY_INFORMATION_UI_RESOURCE_URIS).toContain(
      "ui://fify/information-ui-v7.html",
    );
    expect(LEGACY_INFORMATION_UI_RESOURCE_URIS).toContain(
      "ui://fify/information-ui-v6.html",
    );
    expect(LEGACY_INFORMATION_UI_RESOURCE_URIS).toContain(
      "ui://fify/information-ui-v5.html",
    );
    expect(LEGACY_INFORMATION_UI_RESOURCE_URIS).toContain(
      "ui://fify/information-ui-v4.html",
    );
    expect(LEGACY_INFORMATION_UI_RESOURCE_URIS).toContain(
      "ui://fify/information-ui-v3.html",
    );
  });

  it("keeps the compiler diagnostic instead of overwriting it with a generic failure", () => {
    expect(informationUIWidgetHtml).toContain(
      'out.state === "failed" && !mounted',
    );
  });

  it("renders the briefing blueprint with semantic roles and compact decision priority", () => {
    expect(informationUIWidgetHtml).toContain("currentSlotRoles");
    expect(informationUIWidgetHtml).toContain("semanticEyebrow");
    expect(informationUIWidgetHtml).toContain("surface.dataset.slotRole");
    expect(informationUIWidgetHtml).toContain(".blueprint-briefing");
    expect(informationUIWidgetHtml).toContain('[data-slot-role="headline"]');
    expect(informationUIWidgetHtml).toContain(
      '[data-slot-role="decisions"] { order: -30; }',
    );
  });

  it("serializes a syntactically valid, self-contained widget client", () => {
    const script = informationUIWidgetHtml.match(
      /<script>([\s\S]*?)<\/script>/,
    )?.[1];
    expect(script).toBeTruthy();
    expect(() => new Function(script ?? "")).not.toThrow();
  });
});
