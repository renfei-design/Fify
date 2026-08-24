import { informationUISurfaceFamilyForType } from "@fify/core";
import { runInformationUIWidget } from "./widget-client.js";
import { informationUIWidgetTheme } from "./widget-theme.js";

export const INFORMATION_UI_RESOURCE_URI = "ui://fify/information-ui-v4.html";
export const LEGACY_INFORMATION_UI_RESOURCE_URIS = [
  "ui://fify/information-ui-v3.html",
  "ui://fify/information-ui-v2.html",
] as const;

/** A newly mounted widget has consumed no frames, regardless of the server high-water mark. */
export function initialInformationUIAfterSequence() {
  return 0;
}

/**
 * Self-contained MCP Apps resource. The bridge and semantic renderer are authored
 * as regular TypeScript, typechecked independently, then serialized into the
 * sandboxed widget without shipping executable model output.
 */
export const informationUIWidgetHtml = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>${informationUIWidgetTheme}</style>
</head>
<body>
  <main class="gx-app" aria-live="polite">
    <header class="gx-toolbar">
      <div class="gx-brand"><span class="gx-mark" aria-hidden="true"></span><span>Fify</span></div>
      <div class="gx-toolbar-actions">
        <span class="gx-ready-badge" id="ready-badge">Preparing</span>
        <button class="gx-expand" type="button" id="expand" aria-label="Expand interactive view">Expand</button>
      </div>
    </header>
    <p class="gx-status" id="status">Preparing an interactive view…</p>
    <div id="content" class="gx-shell" aria-busy="true">
      <div class="gx-skeleton gx-skeleton-lead"><i></i><i></i><i></i></div>
      <div class="gx-skeleton-grid"><div class="gx-skeleton"><i></i><i></i></div><div class="gx-skeleton"><i></i><i></i></div></div>
    </div>
  </main>
  <script>
${informationUISurfaceFamilyForType.toString()}
(${runInformationUIWidget.toString()})(${initialInformationUIAfterSequence()});
  </script>
</body>
</html>`;
