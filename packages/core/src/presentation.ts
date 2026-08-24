import type { UINode } from "./language.js";

export type InformationUISurfaceFamily =
  | "layout"
  | "card"
  | "hero"
  | "media"
  | "text"
  | "facts"
  | "palette"
  | "badge"
  | "metric"
  | "data-viz"
  | "timeline"
  | "comparison"
  | "checklist"
  | "steps"
  | "table"
  | "progress"
  | "callout"
  | "quote"
  | "action"
  | "input"
  | "choice"
  | "tabs"
  | "map"
  | "calendar"
  | "code"
  | "visual"
  | "divider"
  | "spacer";

/** Portable semantic families consumed by both web and MCP renderer adapters. */
export function informationUISurfaceFamilyForType(
  type: string,
): InformationUISurfaceFamily {
  return (
    ({
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
      Timeline: "timeline",
      Comparison: "comparison",
      Checklist: "checklist",
      Steps: "steps",
      Table: "table",
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
    }[type] as InformationUISurfaceFamily | undefined) ?? "text"
  );
}

export interface InformationUIThemeMode {
  background: string;
  panel: string;
  panelSoft: string;
  ink: string;
  muted: string;
  faint: string;
  line: string;
  accent: string;
  accentSecond: string;
  accentSoft: string;
  positive: string;
}

/** One presentation constitution; adapters decide how to materialize it. */
export const informationUITheme = {
  light: {
    background: "oklch(0.985 0.003 255)",
    panel: "oklch(1 0 0)",
    panelSoft: "oklch(0.965 0.006 255)",
    ink: "oklch(0.19 0.01 260)",
    muted: "oklch(0.48 0.014 255)",
    faint: "oklch(0.6 0.012 255)",
    line: "oklch(0.89 0.008 255)",
    accent: "oklch(0.57 0.12 202)",
    accentSecond: "oklch(0.64 0.13 180)",
    accentSoft: "oklch(0.94 0.025 205)",
    positive: "oklch(0.48 0.13 155)",
  },
  dark: {
    background: "oklch(0.145 0.008 260)",
    panel: "oklch(0.18 0.009 260)",
    panelSoft: "oklch(0.205 0.009 260)",
    ink: "oklch(0.93 0.006 255)",
    muted: "oklch(0.67 0.012 255)",
    faint: "oklch(0.54 0.012 255)",
    line: "oklch(0.29 0.01 260)",
    accent: "oklch(0.72 0.105 202)",
    accentSecond: "oklch(0.76 0.12 180)",
    accentSoft: "oklch(0.235 0.025 210)",
    positive: "oklch(0.74 0.14 155)",
  },
} as const satisfies {
  light: InformationUIThemeMode;
  dark: InformationUIThemeMode;
};

export function informationUIThemeCssVariables(prefix = "gx") {
  const light = informationUITheme.light;
  const dark = informationUITheme.dark;
  const adaptive = (key: keyof InformationUIThemeMode) =>
    `light-dark(${light[key]}, ${dark[key]})`;
  return [
    `--${prefix}-bg:${adaptive("background")}`,
    `--${prefix}-panel:${adaptive("panel")}`,
    `--${prefix}-panel-soft:${adaptive("panelSoft")}`,
    `--${prefix}-ink:${adaptive("ink")}`,
    `--${prefix}-muted:${adaptive("muted")}`,
    `--${prefix}-faint:${adaptive("faint")}`,
    `--${prefix}-line:${adaptive("line")}`,
    `--${prefix}-accent:${adaptive("accent")}`,
    `--${prefix}-accent-2:${adaptive("accentSecond")}`,
    `--${prefix}-accent-soft:${adaptive("accentSoft")}`,
    `--${prefix}-positive:${adaptive("positive")}`,
  ].join(";");
}

export function informationUIWebThemeStyle() {
  const theme = informationUITheme.dark;
  return {
    "--ui-background": theme.background,
    "--ui-foreground": theme.ink,
    "--ui-card": theme.panel,
    "--ui-muted": theme.panelSoft,
    "--ui-muted-foreground": theme.muted,
    "--ui-primary": theme.accent,
    "--ui-accent": theme.accentSoft,
    "--ui-border": theme.line,
    "--ui-ring": theme.accent,
  } as const;
}

export type InformationUINodeType = UINode["type"];
