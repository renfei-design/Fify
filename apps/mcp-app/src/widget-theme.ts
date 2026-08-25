import { informationUIThemeCssVariables } from "@fify/core";

export const informationUIWidgetTheme = String.raw`
:root {
  color-scheme: light dark;
  ${informationUIThemeCssVariables()};
  --gx-shadow: light-dark(0 18px 45px #32234b12, 0 20px 50px #00000024);
  font: 14px/1.5 Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; min-width: 0; background: transparent; color: var(--gx-ink); }
button, input { font: inherit; }
button { color: inherit; }
input { color: var(--gx-ink); }
.gx-app { width: 100%; max-width: 1120px; margin: 0 auto; padding: 12px 14px 18px; }
.gx-toolbar { min-height: 40px; display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.gx-brand { display: flex; align-items: center; gap: 9px; font-weight: 760; letter-spacing: -.02em; }
.gx-mark { width: 21px; height: 21px; border-radius: 7px; background: linear-gradient(135deg, #725cff 8%, #35b2e7 92%); box-shadow: inset 0 0 0 1px #ffffff28, 0 5px 16px #6451e938; }
.gx-toolbar-actions { display: flex; align-items: center; gap: 8px; }
.gx-ready-badge { padding: 5px 8px; border-radius: 99px; color: var(--gx-muted); background: var(--gx-panel-soft); font-size: 10px; font-weight: 700; letter-spacing: .02em; }
.gx-ready-badge.is-ready { color: var(--gx-positive); }
.gx-expand { min-height: 34px; padding: 0 11px; border: 1px solid var(--gx-line); border-radius: 10px; background: color-mix(in srgb, var(--gx-panel) 86%, transparent); cursor: pointer; }
.gx-status { margin: 0 0 10px; color: var(--gx-muted); font-size: 11px; }
.gx-shell { display: grid; gap: 12px; }
.gx-skeleton, .gx-skeleton-grid > div { min-height: 110px; padding: 18px; display: grid; align-content: center; gap: 10px; border: 1px solid var(--gx-line); border-radius: 20px; background: var(--gx-panel); }
.gx-skeleton-lead { min-height: 210px; }
.gx-skeleton-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.gx-skeleton i { display: block; height: 9px; border-radius: 8px; background: linear-gradient(100deg, var(--gx-panel-soft) 20%, color-mix(in srgb, var(--gx-panel-soft) 55%, var(--gx-accent-soft)) 40%, var(--gx-panel-soft) 60%); background-size: 200% 100%; animation: gx-shimmer 1.25s ease-in-out infinite; }
.gx-skeleton i:first-child { width: 34%; }.gx-skeleton i:nth-child(2) { width: 78%; }.gx-skeleton i:nth-child(3) { width: 58%; }
.gx-experience { display: grid; gap: 13px; }
.gx-surface { min-width: 0; padding: 18px; position: relative; overflow: hidden; border: 1px solid var(--gx-line); border-radius: 20px; background: color-mix(in srgb, var(--gx-panel) 95%, transparent); box-shadow: 0 1px 0 #ffffff08; }
.gx-surface.is-primary { min-height: 198px; padding: clamp(20px, 4vw, 34px); border-color: color-mix(in srgb, var(--gx-accent) 38%, var(--gx-line)); background: radial-gradient(circle at 92% 10%, color-mix(in srgb, var(--gx-accent) 20%, transparent), transparent 32%), linear-gradient(145deg, color-mix(in srgb, var(--gx-panel) 92%, var(--gx-accent-soft)), var(--gx-panel)); box-shadow: var(--gx-shadow); }
.gx-surface.is-primary::after { content: ""; width: 180px; height: 180px; position: absolute; right: -72px; top: -92px; border: 1px solid color-mix(in srgb, var(--gx-accent) 30%, transparent); border-radius: 50%; pointer-events: none; }
.gx-section-heading { max-width: 760px; position: relative; z-index: 1; }
.gx-eyebrow { display: block; margin-bottom: 6px; color: var(--gx-accent); font-size: 9px; font-weight: 820; letter-spacing: .13em; text-transform: uppercase; }
.gx-section-heading h2 { margin: 0; font-size: 18px; line-height: 1.15; letter-spacing: -.025em; }
.gx-surface.is-primary .gx-section-heading h2 { max-width: 720px; font-size: clamp(25px, 4vw, 38px); letter-spacing: -.045em; }
.gx-section-heading p { max-width: 740px; margin: 7px 0 0; color: var(--gx-muted); font-size: 12px; line-height: 1.6; white-space: pre-wrap; }
.gx-surface.is-primary .gx-section-heading p { font-size: 13px; }
.gx-fact-grid { margin: 17px 0 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); position: relative; z-index: 1; border-top: 1px solid var(--gx-line); }
.gx-fact { min-width: 0; padding: 13px 16px 8px 0; border-bottom: 1px solid var(--gx-line); }
.gx-fact dt { color: var(--gx-faint); font-size: 9px; font-weight: 720; text-transform: uppercase; letter-spacing: .06em; }
.gx-fact dd { margin: 0; }.gx-fact-value { margin-top: 6px !important; font-size: 15px; font-weight: 720; letter-spacing: -.02em; }
.gx-fact-detail { margin-top: 4px !important; color: var(--gx-muted); font-size: 10px; line-height: 1.5; }
.gx-local-filter { margin-top: 14px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 10px; align-items: center; }.gx-local-filter > span { grid-column: 1/-1; color: var(--gx-faint); font-size: 9px; font-weight: 720; text-transform: uppercase; letter-spacing: .06em; }.gx-local-filter input { min-width: 0; height: 34px; padding: 0 11px; border: 1px solid var(--gx-line); border-radius: 11px; outline: 0; background: var(--gx-panel-soft); }.gx-local-filter input:focus { border-color: var(--gx-accent); box-shadow: 0 0 0 2px var(--gx-accent-soft); }.gx-local-filter small { color: var(--gx-muted); font-size: 9px; }
.gx-checklist-list { margin-top: 14px; display: grid; gap: 7px; }.gx-check-row { min-height: 58px; padding: 10px; display: grid; grid-template-columns: 0 28px 1fr; gap: 9px; align-items: center; border: 1px solid var(--gx-line); border-radius: 14px; background: var(--gx-panel); cursor: pointer; }
.gx-check-row input { width: 1px; height: 1px; opacity: 0; }.gx-check-control { width: 25px; height: 25px; display: grid; place-items: center; border: 1px solid var(--gx-line); border-radius: 8px; }.gx-check-row.is-checked .gx-check-control { border-color: var(--gx-accent); background: var(--gx-accent); }.gx-check-row.is-checked .gx-check-control::after { content: "✓"; color: white; font-size: 13px; font-weight: 850; }.gx-check-row:has(input:focus-visible) { outline: 2px solid var(--gx-accent); outline-offset: 2px; }
.gx-check-copy { min-width: 0; }.gx-check-copy strong, .gx-check-copy small { display: block; }.gx-check-copy strong { font-size: 11px; }.gx-check-copy small { margin-top: 2px; color: var(--gx-muted); font-size: 9px; line-height: 1.4; }.gx-check-copy b { display: inline-block; margin-top: 5px; color: var(--gx-accent); font-size: 9px; }.gx-check-row.is-checked .gx-check-copy { opacity: .6; }
.gx-step-list { margin: 15px 0 0; padding: 0; list-style: none; }.gx-step { display: grid; grid-template-columns: 38px 1fr; gap: 11px; padding: 10px 0; position: relative; border-top: 1px solid var(--gx-line); }.gx-step-number { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 11px; color: var(--gx-accent); background: var(--gx-accent-soft); font-size: 9px; font-weight: 800; }.gx-step-meta { color: var(--gx-accent); font-size: 9px; }.gx-step strong { display: block; margin-top: 2px; font-size: 11px; }.gx-step p { margin: 3px 0 0; color: var(--gx-muted); font-size: 9px; line-height: 1.48; }
.gx-table-rows { margin-top: 14px; border-top: 1px solid var(--gx-line); }.gx-table-row { padding: 11px 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: start; border-bottom: 1px solid var(--gx-line); }.gx-table-row strong, .gx-table-row small { display: block; }.gx-table-row strong { font-size: 10px; }.gx-table-row small { max-width: 340px; margin-top: 3px; color: var(--gx-muted); font-size: 9px; line-height: 1.45; }.gx-table-row > span { color: var(--gx-accent); font-size: 10px; font-weight: 700; text-align: right; }
.gx-timeline-list { margin-top: 15px; position: relative; }.gx-timeline-list::before { content: ""; position: absolute; left: 57px; top: 12px; bottom: 18px; width: 1px; background: color-mix(in srgb, var(--gx-accent) 32%, var(--gx-line)); }.gx-timeline-event { display: grid; grid-template-columns: 45px 13px 1fr; gap: 8px; padding: 7px 0 12px; }.gx-timeline-event time { color: var(--gx-accent); font-size: 9px; font-weight: 760; }.gx-timeline-event i { width: 9px; height: 9px; margin: 2px 0 0 2px; position: relative; z-index: 1; border: 2px solid var(--gx-accent); border-radius: 50%; background: var(--gx-panel); }.gx-timeline-event strong { font-size: 11px; }.gx-timeline-event p { margin: 3px 0 0; color: var(--gx-muted); font-size: 9px; line-height: 1.48; }
.gx-callout { display: grid; grid-template-columns: 34px 1fr; gap: 12px; color: var(--gx-ink); background: var(--gx-accent-soft); border-color: transparent; }.gx-callout-mark { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 10px; color: white; background: linear-gradient(135deg, var(--gx-accent), var(--gx-accent-2)); }.gx-callout ul { grid-column: 2; margin: 8px 0 0; padding-left: 18px; color: var(--gx-muted); font-size: 10px; }
.gx-text-list { margin: 14px 0 0; padding-left: 18px; color: var(--gx-muted); font-size: 10px; line-height: 1.6; }
.gx-field { margin-top: 17px; display: grid; gap: 7px; position: relative; z-index: 1; }.gx-field > span { color: var(--gx-faint); font-size: 9px; font-weight: 760; letter-spacing: .06em; text-transform: uppercase; }.gx-field input { width: 100%; min-height: 46px; padding: 0 13px; border: 1px solid var(--gx-line); border-radius: 13px; outline: 0; background: var(--gx-panel); }.gx-field input:focus { border-color: var(--gx-accent); box-shadow: 0 0 0 3px var(--gx-accent-soft); }
.gx-choice-list { margin-top: 15px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }.gx-choice-option { min-height: 104px; padding: 13px; display: flex; flex-direction: column; align-items: flex-start; gap: 5px; text-align: left; border: 1px solid var(--gx-line); border-radius: 14px; background: var(--gx-panel); cursor: pointer; }.gx-choice-option strong { font-size: 11px; }.gx-choice-option span { color: var(--gx-accent); font-size: 10px; font-weight: 720; }.gx-choice-option small { color: var(--gx-muted); font-size: 9px; line-height: 1.45; }.gx-choice-option.is-selected { border-color: var(--gx-accent); background: var(--gx-accent-soft); box-shadow: inset 0 3px var(--gx-accent); }
.gx-tab-list { margin-top: 15px; display: flex; gap: 5px; overflow-x: auto; padding: 4px; border-radius: 13px; background: var(--gx-panel-soft); }.gx-tab { min-width: 110px; min-height: 52px; padding: 8px 11px; display: grid; gap: 1px; align-content: center; text-align: left; border: 0; border-radius: 10px; background: transparent; cursor: pointer; }.gx-tab strong { font-size: 10px; }.gx-tab span, .gx-tab small { color: var(--gx-muted); font-size: 8px; }.gx-tab.is-selected { background: var(--gx-panel); box-shadow: 0 5px 18px #00000012; }.gx-tab.is-selected strong { color: var(--gx-accent); }
.gx-continuation-action { min-height: 48px; padding: 0 15px; display: flex; align-items: center; justify-content: space-between; gap: 20px; border: 1px solid color-mix(in srgb, var(--gx-accent) 45%, var(--gx-line)); border-radius: 14px; color: var(--gx-ink); background: linear-gradient(135deg, var(--gx-accent-soft), var(--gx-panel)); cursor: pointer; }.gx-continuation-action span { font-size: 11px; font-weight: 720; }.gx-continuation-action b { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 9px; color: white; background: var(--gx-accent); }
.gx-media { min-width: 0; min-height: 220px; margin: 0; position: relative; overflow: hidden; display: grid; border: 1px solid var(--gx-line); border-radius: 20px; background: var(--gx-panel); box-shadow: var(--gx-shadow); }
.gx-media-frame { min-height: 220px; position: relative; overflow: hidden; background: radial-gradient(circle at 28% 16%, color-mix(in srgb, var(--gx-accent) 28%, transparent), transparent 38%), linear-gradient(145deg, var(--gx-panel-soft), var(--gx-panel)); }
.gx-media img { width: 100%; height: 100%; min-height: 220px; position: absolute; inset: 0; display: block; object-fit: cover; opacity: 0; transform: scale(1.015); transition: opacity .28s ease, transform .5s ease; }
.gx-media.is-ready img { opacity: 1; transform: scale(1); }
.gx-media.media-identity .gx-media-frame { min-height: 290px; }.gx-media.media-identity img { object-position: center 22%; }
.gx-media-placeholder { min-height: inherit; padding: 18px; display: grid; place-content: center; justify-items: center; gap: 8px; color: var(--gx-muted); text-align: center; }
.gx-media-placeholder-mark { width: 46px; height: 46px; display: grid; place-items: center; border: 1px solid color-mix(in srgb, var(--gx-accent) 44%, var(--gx-line)); border-radius: 16px; color: var(--gx-accent); background: var(--gx-accent-soft); font-size: 18px; }
.gx-media-placeholder strong { font-size: 10px; }.gx-media.is-unavailable { box-shadow: none; }
.gx-media figcaption { position: absolute; z-index: 2; left: 10px; right: 10px; bottom: 10px; padding: 12px 13px; border: 1px solid #ffffff24; border-radius: 14px; color: white; background: linear-gradient(145deg, #18141fd9, #101015bf); backdrop-filter: blur(12px); box-shadow: 0 8px 24px #0005; }
.gx-media figcaption .gx-eyebrow { color: #b9aaff; }.gx-media figcaption p { margin: 0; font-size: 10px; line-height: 1.45; }
.gx-layout { min-width: 0; }.gx-page, .gx-stack { display: grid; }.gx-page { gap: 16px; }.gx-stack.gap-none { gap: 0; }.gx-stack.gap-tight { gap: 8px; }.gx-stack.gap-normal { gap: 13px; }.gx-stack.gap-loose { gap: 20px; }.gx-grid { display: grid; grid-template-columns: repeat(var(--gx-columns, 2), minmax(0, 1fr)); gap: 12px; align-items: start; }.gx-row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }.gx-row > * { flex: 1 1 180px; }.gx-rail { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(210px, 1fr); gap: 10px; overflow-x: auto; overscroll-behavior-inline: contain; scroll-snap-type: inline proximity; padding: 2px 2px 8px; }.gx-rail > * { scroll-snap-align: start; }
.gx-card { display: grid; align-content: start; }.gx-card-value { margin-top: 18px; color: var(--gx-accent); font: 680 24px/1.1 ui-serif, Georgia, serif; }.gx-card-children { margin-top: 15px; display: grid; gap: 10px; }.gx-card-children > .gx-surface { padding: 13px; border-radius: 14px; box-shadow: none; }
.gx-hero { min-height: 270px; padding: clamp(26px, 6vw, 60px); position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 22px; align-items: end; border: 1px solid color-mix(in srgb, var(--gx-accent) 36%, var(--gx-line)); border-radius: 26px; background: radial-gradient(circle at 90% 14%, color-mix(in srgb, var(--gx-accent-2) 30%, transparent), transparent 30%), linear-gradient(145deg, color-mix(in srgb, var(--gx-panel) 82%, var(--gx-accent-soft)), var(--gx-panel)); box-shadow: var(--gx-shadow); }.gx-hero::before { content: ""; width: 240px; height: 240px; position: absolute; right: -80px; top: -110px; border: 1px solid color-mix(in srgb, var(--gx-accent) 32%, transparent); border-radius: 50%; }.gx-hero-copy { max-width: 760px; position: relative; z-index: 1; }.gx-hero h2 { margin: 0; max-width: 720px; font-size: clamp(34px, 6vw, 64px); line-height: .96; letter-spacing: -.06em; }.gx-hero p { max-width: 660px; margin: 16px 0 0; color: var(--gx-muted); font-size: 14px; line-height: 1.65; }.gx-hero-mark { width: 96px; height: 96px; position: relative; z-index: 1; display: grid; place-items: center; border: 1px solid color-mix(in srgb, var(--gx-accent) 48%, var(--gx-line)); border-radius: 50%; color: var(--gx-accent); background: var(--gx-panel); font-size: 11px; font-weight: 820; letter-spacing: .08em; }.gx-hero-children { grid-column: 1/-1; display: grid; gap: 10px; }
.gx-palette-list { margin: 16px 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; list-style: none; }.gx-palette-list li { min-width: 0; padding: 8px; display: grid; grid-template-columns: 44px 1fr; gap: 10px; align-items: center; border: 1px solid var(--gx-line); border-radius: 13px; }.gx-swatch { width: 44px; height: 52px; border: 1px solid var(--gx-line); border-radius: 10px; }.gx-palette-list strong, .gx-palette-list code { display: block; }.gx-palette-list strong { font-size: 10px; }.gx-palette-list code { margin-top: 3px; color: var(--gx-accent); font-size: 9px; }.gx-palette-list p { margin: 4px 0 0; color: var(--gx-muted); font-size: 8px; }
.gx-badge { width: fit-content; min-height: 28px; padding: 0 10px; display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--gx-line); border-radius: 99px; color: var(--gx-muted); background: var(--gx-panel-soft); font-size: 9px; font-weight: 760; }.gx-badge.tone-accent, .gx-badge.tone-info { color: var(--gx-accent); border-color: color-mix(in srgb, var(--gx-accent) 34%, var(--gx-line)); background: var(--gx-accent-soft); }.gx-badge.tone-positive { color: var(--gx-positive); }
.gx-metric { display: grid; align-content: center; }.gx-metric-label { color: var(--gx-faint); font-size: 9px; font-weight: 760; letter-spacing: .08em; text-transform: uppercase; }.gx-metric-value { margin-top: 9px; color: var(--gx-ink); font: 680 clamp(30px, 5vw, 48px)/.95 ui-serif, Georgia, serif; letter-spacing: -.05em; }.gx-metric p { margin: 10px 0 0; color: var(--gx-muted); font-size: 10px; }.gx-metric small { margin-top: 7px; color: var(--gx-accent); font-size: 9px; }
.gx-chart { margin: 0; }.gx-chart-plot { min-height: 190px; margin-top: 17px; display: grid; grid-auto-flow: column; grid-auto-columns: minmax(55px, 1fr); gap: 9px; align-items: end; overflow-x: auto; }.gx-chart-plot article { min-width: 54px; display: grid; gap: 4px; text-align: center; }.gx-chart-bar { height: 130px; display: flex; align-items: end; overflow: hidden; border-radius: 10px; background: var(--gx-panel-soft); }.gx-chart-bar i { width: 100%; min-height: 8%; display: block; border-radius: 8px 8px 0 0; background: linear-gradient(180deg, var(--gx-accent-2), var(--gx-accent)); }.gx-chart-plot strong { font-size: 10px; }.gx-chart-plot span { color: var(--gx-muted); font-size: 8px; }
.gx-donut { display: grid; grid-template-columns: auto 1fr; gap: 18px; align-items: center; }.gx-donut-ring { --gx-progress: 0%; width: 112px; aspect-ratio: 1; display: grid; place-items: center; border-radius: 50%; background: conic-gradient(var(--gx-accent) var(--gx-progress), var(--gx-panel-soft) 0); }.gx-donut-ring::before { content: ""; width: 76%; aspect-ratio: 1; grid-area: 1/1; border-radius: 50%; background: var(--gx-panel); }.gx-donut-ring span { grid-area: 1/1; position: relative; z-index: 1; font: 680 18px/1 ui-serif, Georgia, serif; }
.gx-progress-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }.gx-progress-head span { color: var(--gx-muted); font-size: 10px; }.gx-progress-head strong { color: var(--gx-accent); font-size: 11px; }.gx-progress-track { height: 8px; margin-top: 10px; overflow: hidden; border-radius: 99px; background: var(--gx-panel-soft); }.gx-progress-track i { height: 100%; display: block; border-radius: inherit; background: linear-gradient(90deg, var(--gx-accent), var(--gx-accent-2)); }.gx-progress h3 { margin: 15px 0 0; font-size: 13px; }.gx-progress p { margin: 5px 0 0; color: var(--gx-muted); font-size: 10px; }
.gx-quote { margin: 0; padding-left: clamp(24px, 5vw, 46px); }.gx-quote::before { content: "“"; position: absolute; left: 16px; top: 2px; color: var(--gx-accent); font: 700 56px/1 ui-serif, Georgia, serif; opacity: .45; }.gx-quote blockquote { margin: 0; max-width: 760px; font: 570 clamp(20px, 3vw, 30px)/1.35 ui-serif, Georgia, serif; letter-spacing: -.025em; }.gx-quote figcaption { margin-top: 14px; color: var(--gx-muted); font-size: 10px; }
.gx-map { display: grid; gap: 13px; }.gx-map-canvas { min-height: 220px; position: relative; overflow: hidden; border-radius: 15px; background-color: var(--gx-panel-soft); background-image: linear-gradient(var(--gx-line) 1px, transparent 1px), linear-gradient(90deg, var(--gx-line) 1px, transparent 1px); background-size: 26px 26px; }.gx-map-canvas svg { width: 100%; height: 100%; position: absolute; inset: 0; fill: none; stroke: var(--gx-accent); stroke-width: 3; stroke-dasharray: 7 7; opacity: .55; }.gx-map-pin { position: absolute; display: grid; justify-items: center; gap: 3px; transform: translate(-50%, -50%); }.gx-map-pin i { width: 27px; height: 27px; display: grid; place-items: center; border: 2px solid var(--gx-panel); border-radius: 50%; color: white; background: var(--gx-accent); box-shadow: 0 4px 12px #0004; font-size: 9px; font-style: normal; font-weight: 800; }.gx-map-pin span { max-width: 90px; padding: 2px 5px; border-radius: 6px; background: color-mix(in srgb, var(--gx-panel) 88%, transparent); font-size: 8px; text-align: center; }
.gx-calendar-flow { margin-top: 15px; display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; }.gx-calendar-flow article { min-height: 116px; padding: 12px; display: grid; align-content: start; border: 1px solid var(--gx-line); border-radius: 13px; background: var(--gx-panel-soft); }.gx-calendar-flow span { color: var(--gx-accent); font-size: 9px; font-weight: 800; }.gx-calendar-flow strong { margin-top: 13px; font-size: 11px; }.gx-calendar-flow p { margin: 5px 0 0; color: var(--gx-muted); font-size: 9px; line-height: 1.45; }
.gx-code { padding: 0; overflow: hidden; background: #111118; color: #ededf6; }.gx-code header { min-height: 39px; padding: 0 13px; display: flex; align-items: center; gap: 6px; background: #1c1c26; }.gx-code header i { width: 8px; height: 8px; border-radius: 50%; background: #ff6b6b; }.gx-code header i:nth-child(2) { background: #ffc75f; }.gx-code header i:nth-child(3) { background: #62d394; }.gx-code header span { margin-left: 6px; color: #9a9aac; font-size: 9px; }.gx-code pre { max-width: 100%; margin: 0; padding: 17px; overflow: auto; white-space: pre-wrap; font: 10px/1.65 ui-monospace, SFMono-Regular, Menlo, monospace; }
.gx-visual { margin: 0; display: grid; grid-template-columns: minmax(160px, .8fr) 1fr; gap: 18px; align-items: center; }.gx-visual-canvas { min-height: 190px; position: relative; display: grid; place-items: center; overflow: hidden; border-radius: 16px; background: radial-gradient(circle, var(--gx-accent-soft), var(--gx-panel-soft) 66%); }.gx-visual-canvas i { width: 60%; aspect-ratio: 1; position: absolute; border: 1px solid color-mix(in srgb, var(--gx-accent) 38%, transparent); border-radius: 50%; }.gx-visual-canvas i:nth-child(2) { width: 42%; }.gx-visual-canvas i:nth-child(3) { width: 24%; }.gx-visual-canvas strong { position: relative; z-index: 1; color: var(--gx-accent); font: 700 34px/1 ui-serif, Georgia, serif; }.gx-visual figcaption strong { display: block; font-size: 18px; }.gx-visual figcaption p { margin: 7px 0 0; color: var(--gx-muted); font-size: 10px; line-height: 1.55; }
.gx-divider { min-height: 26px; display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; color: var(--gx-faint); font-size: 9px; letter-spacing: .08em; text-transform: uppercase; }.gx-divider i { height: 1px; display: block; background: var(--gx-line); }.gx-divider i:only-child { grid-column: 1/-1; }.gx-spacer.gap-none { min-height: 4px; }.gx-spacer.gap-tight { min-height: 10px; }.gx-spacer.gap-normal { min-height: 18px; }.gx-spacer.gap-loose { min-height: 34px; }
.gx-suggestions { grid-column: 1/-1; padding: 14px 16px; border: 1px solid var(--gx-line); border-radius: 16px; background: var(--gx-panel-soft); }.gx-suggestions > div { display: flex; flex-wrap: wrap; gap: 7px; }.gx-suggestions button { min-height: 34px; padding: 0 11px; border: 1px solid var(--gx-line); border-radius: 99px; background: var(--gx-panel); cursor: pointer; font-size: 10px; }.gx-suggestions button::after { content: " ↗"; color: var(--gx-accent); }
.gx-sources { grid-column: 1/-1; padding: 2px 4px; color: var(--gx-muted); font-size: 10px; }.gx-sources summary { cursor: pointer; }.gx-sources ul { margin: 8px 0 0; padding-left: 18px; }.gx-sources a { color: var(--gx-accent); overflow-wrap: anywhere; }
.gx-notice { padding: 16px; border: 1px solid var(--gx-line); border-radius: 16px; background: var(--gx-panel); }.gx-notice p { color: var(--gx-muted); }.gx-fallback { max-height: 220px; overflow: auto; padding: 12px; white-space: pre-wrap; border-radius: 12px; background: var(--gx-panel-soft); font-size: 11px; }
.gx-expanded .gx-app { max-width: 1280px; padding: 22px; }.gx-expanded .gx-surface { padding: 22px; }
button:focus-visible, summary:focus-visible, a:focus-visible { outline: 2px solid var(--gx-accent); outline-offset: 2px; }
@keyframes gx-shimmer { to { background-position: -200% 0; } }
@media (max-width: 720px) {
  .gx-app { padding: 8px 9px 14px; }.gx-ready-badge { display: none; }.gx-skeleton-grid, .gx-grid { grid-template-columns: 1fr; }.gx-surface, .gx-surface.is-primary, .gx-media, .gx-hero { border-radius: 17px; }.gx-surface, .gx-surface.is-primary { padding: 16px; }.gx-surface.is-primary { min-height: 0; }.gx-surface.is-primary .gx-section-heading h2 { font-size: 26px; }.gx-fact-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.gx-hero { min-height: 235px; padding: 24px; grid-template-columns: 1fr; }.gx-hero h2 { font-size: 38px; }.gx-hero-mark { width: 70px; height: 70px; }.gx-rail { grid-auto-columns: minmax(200px, 82%); }.gx-donut, .gx-visual { grid-template-columns: 1fr; }.gx-visual-canvas { min-height: 160px; }
}
@media (max-width: 430px) { .gx-fact-grid { grid-template-columns: 1fr; }.gx-fact { padding-right: 0; }.gx-toolbar { margin-bottom: 4px; } }
/* North Star parity layer: typography first, containment only when semantic. */
.gx-app { max-width: 1180px; padding: 18px 26px 28px; }
.gx-toolbar { min-height: 46px; margin: 0 0 22px; padding-bottom: 12px; border-bottom: 1px solid var(--gx-line); }
.gx-brand { gap: 10px; font-size: 13px; font-weight: 680; }
.gx-mark { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 0; color: var(--gx-ink); background: none; box-shadow: none; }
.gx-mark svg { width: 26px; height: 26px; display: block; }
.gx-ready-badge { padding: 0; color: var(--gx-muted); background: transparent; font-weight: 580; }
.gx-ready-badge.is-ready::after { content: ""; width: 7px; height: 7px; display: inline-block; margin-left: 7px; border-radius: 50%; background: var(--gx-accent); }
.gx-expand { min-height: 32px; border-color: var(--gx-line); border-radius: 9px; background: transparent; font-size: 11px; }
.gx-status { margin: -12px 0 18px 38px; }
.gx-experience { gap: 24px; }
.gx-layout.gx-page { gap: 28px; }
.gx-surface { padding: 0; overflow: visible; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
.gx-surface.is-primary { min-height: 0; padding: 0; border: 0; background: transparent; box-shadow: none; }
.gx-surface.is-primary::after { display: none; }
.gx-section-heading { max-width: 760px; }
.gx-eyebrow { margin-bottom: 8px; color: var(--gx-muted); font-size: 10px; font-weight: 620; letter-spacing: 0; text-transform: none; }
.gx-section-heading h2 { font-size: 22px; line-height: 1.12; letter-spacing: -.035em; }
.gx-surface.is-primary .gx-section-heading h2 { max-width: 720px; font-size: clamp(27px, 4vw, 36px); letter-spacing: -.045em; }
.gx-section-heading p, .gx-surface.is-primary .gx-section-heading p { margin-top: 10px; color: var(--gx-muted); font-size: 13px; line-height: 1.65; }
.gx-fact-grid { margin-top: 26px; display: block; border-top: 1px solid var(--gx-line); }
.gx-fact { padding: 14px 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 5px 18px; border-bottom: 1px solid var(--gx-line); }
.gx-fact dt { grid-column: 1; color: var(--gx-ink); font-size: 11px; font-weight: 650; letter-spacing: 0; text-transform: none; }
.gx-fact-value { grid-column: 2; grid-row: 1 / span 2; margin-top: 0 !important; color: var(--gx-accent); font-size: 11px; font-weight: 650; text-align: right; }
.gx-fact-detail { grid-column: 1; color: var(--gx-muted); font-size: 10px; line-height: 1.5; }
.gx-media { min-height: 0; border-radius: 12px; box-shadow: none; }
.gx-media-frame { min-height: 0; aspect-ratio: 16 / 9; background: var(--gx-panel-soft); }
.gx-media.media-identity { width: 100%; }
.gx-media.media-identity .gx-media-frame { min-height: 0; aspect-ratio: 4 / 5; }
.gx-media img { min-height: 0; }
.gx-media-copy { padding: 44px 18px 16px; position: absolute; z-index: 1; inset: auto 0 0; color: white; background: linear-gradient(transparent, #080a0de8); opacity: 0; transition: opacity .25s ease; }
.gx-media.is-ready .gx-media-copy { opacity: 1; }
.gx-media-copy strong { font-size: 18px; letter-spacing: -.025em; }
.gx-media figcaption { min-height: 38px; padding: 9px 11px; position: static; display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 0; border-top: 1px solid var(--gx-line); border-radius: 0; color: var(--gx-muted); background: var(--gx-panel); backdrop-filter: none; box-shadow: none; font-size: 8px; }
.gx-media figcaption span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gx-media figcaption a { flex: none; color: var(--gx-accent); text-decoration: none; }
.gx-card { padding: 18px; border: 1px solid var(--gx-line); border-radius: 12px; background: var(--gx-panel); }
.gx-hero { min-height: 0; padding: 8px 0 18px; border: 0; border-bottom: 1px solid var(--gx-line); border-radius: 0; background: transparent; box-shadow: none; }
.gx-hero::before { display: none; }
.gx-hero h2 { font-size: clamp(30px, 4.6vw, 46px); line-height: 1.02; }
.gx-hero p { margin-top: 10px; font-size: 13px; }
.gx-hero-mark { width: auto; height: auto; padding: 0 0 4px; border: 0; border-radius: 0; background: transparent; }
.gx-suggestions { padding: 16px 0 0; border: 0; border-top: 1px solid var(--gx-line); border-radius: 0; background: transparent; }
.gx-sources { padding: 13px 0 0; border-top: 1px solid var(--gx-line); }
.gx-sources summary { font-weight: 620; }
.gx-expanded .gx-app { max-width: 1280px; padding: 26px 34px 36px; }
@media (max-width: 720px) {
  .gx-app { padding: 10px 12px 20px; }
  .gx-toolbar { margin-bottom: 16px; }
  .gx-surface, .gx-surface.is-primary { padding: 0; border-radius: 0; }
  .gx-fact { grid-template-columns: minmax(0, 1fr) auto; }
}

/*
 * Web parity contract.
 * These rules intentionally mirror the semantic renderer in
 * apps/demo/app/shadcn.css. The widget owns a different host shell, but its
 * information components must keep the same composition, type, and states.
 */
.gx-app { container-type: inline-size; overflow: clip; }
.gx-experience, .gx-layout { min-width: 0; max-width: 100%; }
.gx-layout.gx-page { gap: 24px; }
.gx-layout.gx-grid { gap: 28px; }
.gx-layout.gx-grid > *, .gx-layout.gx-rail > * { min-width: 0; max-width: 100%; }
.gx-surface, .gx-surface.is-primary {
  min-height: 0;
  padding: 0;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
.gx-surface.is-primary::after { display: none; }
.gx-section-heading {
  max-width: 680px;
  display: grid;
  gap: 6px;
}
.gx-eyebrow {
  margin: 0;
  color: var(--gx-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
}
.gx-section-heading h2,
.gx-surface.is-primary .gx-section-heading h2 {
  max-width: 680px;
  margin: 0;
  font-size: 20px;
  line-height: 1.2;
  letter-spacing: -.025em;
}
.gx-section-heading p,
.gx-surface.is-primary .gx-section-heading p {
  max-width: 680px;
  margin: 0;
  color: var(--gx-muted);
  font-size: 12px;
  line-height: 1.6;
}
.gx-comparison-matrix { grid-column: 1 / -1; min-width: 0; max-width: 100%; }
.gx-comparison-intro { max-width: 760px; display: grid; gap: 6px; }
.gx-comparison-intro h2 {
  margin: 0;
  font-size: clamp(24px, 3.4cqi, 34px);
  line-height: 1.08;
  letter-spacing: -.04em;
}
.gx-comparison-intro p { margin: 0; color: var(--gx-muted); font-size: 11px; }
.gx-matrix-focus { display: none; }
.gx-comparison-scroll {
  width: 100%;
  max-width: 100%;
  margin-top: 20px;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  border-top: 1px solid var(--gx-line);
  border-bottom: 1px solid var(--gx-line);
  scroll-padding-inline-start: 168px;
  scroll-snap-type: inline proximity;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--gx-muted) 55%, transparent) transparent;
}
.gx-comparison-grid {
  width: 100%;
  min-width: 100%;
  display: grid;
  grid-template-columns: minmax(144px, 168px) repeat(var(--gx-option-count), minmax(176px, 1fr));
  align-items: stretch;
}
.gx-comparison-matrix.options-2 .gx-comparison-grid { min-width: 520px; }
.gx-comparison-matrix.options-3 .gx-comparison-grid { min-width: 696px; }
.gx-comparison-matrix.options-4 .gx-comparison-grid { min-width: 872px; }
.gx-comparison-matrix.options-5 .gx-comparison-grid { min-width: 1048px; }
.gx-matrix-corner,
.gx-matrix-option,
.gx-matrix-criterion,
.gx-matrix-cell {
  min-width: 0;
  padding: 14px;
  border-right: 1px solid var(--gx-line);
  border-bottom: 1px solid var(--gx-line);
  background: var(--gx-bg);
}
.gx-matrix-corner,
.gx-matrix-option {
  position: sticky;
  top: 0;
  z-index: 3;
  min-height: 68px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.gx-matrix-corner {
  left: 0;
  z-index: 5;
  color: var(--gx-muted);
  font-size: 9px;
  font-weight: 650;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.gx-matrix-option {
  border: 0;
  border-right: 1px solid var(--gx-line);
  border-bottom: 1px solid var(--gx-line);
  border-radius: 0;
  color: var(--gx-ink);
  text-align: left;
  scroll-snap-align: start;
}
.gx-matrix-option strong { font-size: 13px; line-height: 1.25; }
.gx-matrix-option small {
  margin-top: 5px;
  color: var(--gx-muted);
  font-size: 9px;
  font-weight: 550;
}
.gx-matrix-option.is-action { cursor: pointer; }
.gx-matrix-option.is-action:hover { background: var(--gx-panel-soft); }
.gx-matrix-option.is-selected {
  color: var(--gx-accent);
  background: var(--gx-accent-soft);
  box-shadow: inset 0 -2px var(--gx-accent);
}
.gx-matrix-criterion {
  position: sticky;
  left: 0;
  z-index: 2;
  min-height: 96px;
  background: var(--gx-bg);
}
.gx-matrix-criterion strong { display: block; font-size: 11px; line-height: 1.35; }
.gx-matrix-criterion p {
  margin: 6px 0 0;
  display: -webkit-box;
  overflow: hidden;
  color: var(--gx-muted);
  font-size: 9px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.gx-matrix-cell { min-height: 96px; background: transparent; }
.gx-matrix-cell.is-selected { background: color-mix(in srgb, var(--gx-accent-soft) 58%, transparent); }
.gx-matrix-cell-option { display: none; }
.gx-matrix-cell strong { display: block; font-size: 13px; line-height: 1.3; }
.gx-matrix-cell p {
  margin: 7px 0 0;
  color: var(--gx-muted);
  font-size: 10px;
  line-height: 1.5;
}
.gx-card-value,
.gx-metric-value,
.gx-donut-ring span,
.gx-quote::before,
.gx-quote blockquote,
.gx-visual-canvas strong { font-family: inherit; }
.gx-metric { padding: 14px 0; border-top: 1px solid var(--gx-line); }
.gx-metric-label { color: var(--gx-muted); font-size: 10px; letter-spacing: 0; text-transform: none; }
.gx-metric-value { margin: 15px 0 5px; font-size: 30px; line-height: 1; }
.gx-quote { padding: 8px 0 8px 18px; border-left: 1px solid var(--gx-line); }
.gx-quote::before { display: none; }
.gx-quote blockquote { font-size: 21px; line-height: 1.35; }
.gx-visual { grid-template-columns: 110px minmax(0, 1fr); }
.gx-visual-canvas { min-height: 0; height: 110px; border: 1px solid var(--gx-line); border-radius: 50%; background: transparent; }
.gx-visual-canvas i { display: none; }

/* Executive briefing blueprint: Fify-native hierarchy, facts, and dividers. */
.blueprint-briefing .gx-layout.gx-grid {
  grid-template-columns: minmax(0, 1.35fr) minmax(260px, .65fr);
  gap: 32px 28px;
}
.blueprint-briefing [data-slot-role="headline"],
.blueprint-briefing [data-slot-role="status"] { grid-column: 1 / -1; }
.blueprint-briefing [data-slot-role="headline"] {
  padding: 2px 0 0;
  border-bottom: 0;
}
.blueprint-briefing [data-slot-role="headline"] .gx-eyebrow {
  color: var(--gx-accent);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: .09em;
  text-transform: uppercase;
}
.blueprint-briefing [data-slot-role="headline"] h2 {
  max-width: 780px;
  font-size: clamp(30px, 4cqi, 42px);
  line-height: 1.06;
  letter-spacing: -.045em;
}
.blueprint-briefing [data-slot-role="headline"] p {
  max-width: 760px;
  font-size: 13px;
  line-height: 1.65;
}
.blueprint-briefing [data-slot-role="status"] {
  padding-top: 22px;
  border-top: 1px solid var(--gx-line);
}
.blueprint-briefing [data-slot-role="status"] .gx-section-heading {
  margin-bottom: -6px;
}
.blueprint-briefing [data-slot-role="status"] .gx-fact-grid {
  margin-top: 18px;
}
.blueprint-briefing [data-slot-role="findings"] .gx-fact,
.blueprint-briefing [data-slot-role="decisions"] .gx-fact,
.blueprint-briefing [data-slot-role="alerts"] .gx-fact {
  grid-template-columns: minmax(0, 1fr) minmax(92px, auto);
}
.blueprint-briefing [data-slot-role="decisions"] .gx-fact-value,
.blueprint-briefing [data-slot-role="alerts"] .gx-fact-value {
  min-width: 84px;
}
.blueprint-briefing [data-slot-role="actions"] .gx-step-list {
  margin-top: 20px;
}
.blueprint-briefing [data-slot-role="actions"] .gx-step {
  grid-template-columns: 28px minmax(0, 1fr);
  padding: 14px 0;
}
.blueprint-briefing [data-slot-role="actions"] .gx-step-number {
  width: auto;
  height: auto;
  display: block;
  border-radius: 0;
  background: transparent;
  font-size: 10px;
}
.blueprint-briefing [data-slot-role="actions"] .gx-step-meta {
  float: right;
  margin-left: 12px;
  text-align: right;
}

@container (max-width: 480px) {
  .gx-layout.gx-grid { grid-template-columns: 1fr !important; gap: 24px; }
  .gx-choice-list, .gx-fact-grid { grid-template-columns: 1fr; }
  .gx-visual { grid-template-columns: 80px minmax(0, 1fr); }
  .gx-visual-canvas { height: 76px; }
}
@container (max-width: 560px) {
  .blueprint-briefing .gx-layout.gx-grid { display: flex; flex-direction: column; align-items: stretch; gap: 30px; }
  .blueprint-briefing .gx-layout.gx-grid > * { width: 100%; }
  .blueprint-briefing [data-slot-role="headline"] { order: -50; }
  .blueprint-briefing [data-slot-role="status"] { order: -40; }
  .blueprint-briefing [data-slot-role="decisions"] { order: -30; }
  .blueprint-briefing [data-slot-role="headline"] h2 { font-size: 30px; }
  .blueprint-briefing [data-slot-role="status"] .gx-fact,
  .blueprint-briefing [data-slot-role="findings"] .gx-fact,
  .blueprint-briefing [data-slot-role="decisions"] .gx-fact,
  .blueprint-briefing [data-slot-role="alerts"] .gx-fact {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .gx-comparison-intro h2 { font-size: 26px; }
  .gx-comparison-scroll { overflow-x: visible; border: 0; scroll-padding: 0; scroll-snap-type: none; }
  .gx-comparison-grid { width: 100%; min-width: 0; display: block; }
  .gx-comparison-matrix.options-2 .gx-comparison-grid,
  .gx-comparison-matrix.options-3 .gx-comparison-grid,
  .gx-comparison-matrix.options-4 .gx-comparison-grid,
  .gx-comparison-matrix.options-5 .gx-comparison-grid { min-width: 0; }
  .gx-matrix-corner, .gx-matrix-option { display: none; }
  .gx-matrix-criterion {
    position: static;
    min-height: 0;
    padding: 18px 0 9px;
    border: 0;
    border-top: 1px solid var(--gx-line);
    background: transparent;
  }
  .gx-matrix-criterion p { max-width: 46ch; -webkit-line-clamp: 2; }
  .gx-matrix-cell {
    min-height: 0;
    padding: 11px 0;
    display: grid;
    grid-template-columns: minmax(96px, .42fr) minmax(0, 1fr);
    gap: 4px 14px;
    border: 0;
    border-bottom: 1px solid var(--gx-line);
  }
  .gx-matrix-cell.is-selected { background: transparent; box-shadow: inset 2px 0 var(--gx-accent); padding-left: 10px; }
  .gx-matrix-cell-option {
    display: block;
    grid-column: 1;
    grid-row: 1 / span 2;
    color: var(--gx-muted);
    font-size: 10px;
    font-weight: 650;
  }
  .gx-matrix-cell strong { grid-column: 2; font-size: 12px; }
  .gx-matrix-cell p { grid-column: 2; margin-top: 1px; }
  .gx-matrix-focus {
    margin-top: 16px;
    display: grid;
    gap: 8px;
  }
  .gx-matrix-focus > span { color: var(--gx-muted); font-size: 9px; font-weight: 650; text-transform: uppercase; letter-spacing: .06em; }
  .gx-matrix-focus-options { display: flex; flex-wrap: wrap; gap: 6px; }
  .gx-matrix-focus-option {
    min-height: 32px;
    padding: 7px 10px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 1px solid var(--gx-line);
    border-radius: 999px;
    color: var(--gx-ink);
    background: transparent;
    cursor: pointer;
  }
  .gx-matrix-focus-option small { color: var(--gx-muted); font-size: 8px; }
  .gx-matrix-focus-option.is-selected { border-color: var(--gx-accent); color: var(--gx-accent); background: var(--gx-accent-soft); }
}
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; } }
`;
