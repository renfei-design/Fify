import { createServer } from "node:http";
import {
  uiExperienceSchema,
  uiLanguageFixtureRepresentation,
} from "../../../packages/core/dist/index.js";
import { informationUIWidgetHtml } from "../dist/widget.js";

const none = { type: "none", prompt: "", targetId: "", value: "" };
const node = (value) => ({
  id: value.id,
  type: value.type,
  slot: value.slot ?? (value.type === "Page" || ["Stack", "Row", "Grid", "Rail"].includes(value.type) ? "" : "primary"),
  importance: value.importance ?? "supporting",
  relationship: value.relationship ?? "standalone",
  mediaRole: value.mediaRole ?? "none",
  variant: value.variant ?? "default",
  tone: value.tone ?? "neutral",
  title: value.title ?? "",
  text: value.text ?? "",
  label: value.label ?? "",
  value: value.value ?? "",
  meta: value.meta ?? "",
  icon: value.icon ?? "",
  span: value.span ?? "full",
  align: value.align ?? "start",
  columns: value.columns ?? 1,
  gap: value.gap ?? "normal",
  progress: value.progress ?? null,
  action: value.action ?? none,
  items: value.items ?? [],
  children: value.children ?? [],
});
const item = (id, label, value, detail, progress = null, tone = "neutral") => ({ id, label, value, detail, progress, tone });

const experience = uiExperienceSchema.parse({
  version: "4.0",
  responseId: "mcp-catalog-parity",
  goal: "Prove recursive ChatGPT rendering across the portable Fify catalog",
  representation: uiLanguageFixtureRepresentation,
  screen: { title: "Catalog parity", contextLabel: "ChatGPT adapter" },
  suggestions: ["Focus this view on the strongest signals", "Turn this into an action plan"],
  nodes: [
    node({ id: "root", type: "Page", gap: "loose", children: ["hero", "dashboard", "divider", "places", "code-visual", "badges"] }),
    node({ id: "hero", type: "Hero", importance: "primary", tone: "accent", label: "Renderer parity", title: "One semantic graph, adapted beautifully.", text: "This fixture exercises recursive layout, nested cards, data views, maps, schedules, code, and decorative composition inside the ChatGPT surface.", value: "35 / 35" }),
    node({ id: "dashboard", type: "Grid", columns: 3, gap: "normal", children: ["signal-card", "donut", "chart", "palette", "quote"] }),
    node({ id: "signal-card", type: "Card", title: "Launch signals", text: "Nested components remain independently meaningful.", label: "Live status", variant: "elevated", children: ["metric", "progress"] }),
    node({ id: "metric", type: "Metric", label: "Initialization", value: "97%", text: "Successful first render", meta: "+2.4 points" }),
    node({ id: "progress", type: "Progress", label: "Parity coverage", value: "Complete", title: "Renderer families", text: "Every portable semantic type has a native adapter.", progress: 100, tone: "positive" }),
    node({ id: "donut", type: "Donut", title: "Host fit", text: "Compact without losing hierarchy.", label: "Host fit", value: "92%", progress: 92, tone: "accent" }),
    node({ id: "chart", type: "Chart", title: "Perceived quality", text: "Meaningful progress across the adapter milestones.", items: [item("c1", "Baseline", "41", "", 41), item("c2", "Grounded", "68", "", 68), item("c3", "Recursive", "86", "", 86), item("c4", "Parity", "96", "", 96)] }),
    node({ id: "palette", type: "ColorPalette", title: "Adaptive palette", text: "Trusted values only.", items: [item("p1", "Signal", "#35B2E7", "Primary emphasis"), item("p2", "Compose", "#725CFF", "Secondary emphasis"), item("p3", "Ready", "#35B978", "Positive state")] }),
    node({ id: "quote", type: "Quote", text: "Parity is not pixel copying. It is preserving capability, hierarchy, and delight inside the host.", label: "Fify rendering principle", meta: "Adapter contract" }),
    node({ id: "divider", type: "Divider", label: "Spatial and narrative surfaces" }),
    node({ id: "places", type: "Grid", columns: 2, gap: "normal", children: ["map", "calendar"] }),
    node({ id: "map", type: "MapPanel", title: "Design weekend", text: "Spatial information becomes the organizing surface.", items: [item("m1", "Gallery", "", "", 14), item("m2", "Market", "", "", 48), item("m3", "Studio", "", "", 77)] }),
    node({ id: "calendar", type: "Calendar", title: "Three-day rhythm", text: "Chronology stays scannable at compact widths.", items: [item("d1", "Explore", "Fri", "Neighborhood walk", null, "accent"), item("d2", "Make", "Sat", "Studio sessions", null, "positive"), item("d3", "Reflect", "Sun", "Museum and notes", null, "info")] }),
    node({ id: "code-visual", type: "Row", gap: "normal", children: ["code", "visual"] }),
    node({ id: "code", type: "CodeBlock", label: "Semantic contract", text: "render(root)\n  → walk(children)\n  → adapt(semanticFamily)\n  → preserve(state + meaning)" }),
    node({ id: "visual", type: "Visual", label: "Runtime composition", title: "Built for the answer", text: "Decorative form stays subordinate to the information hierarchy.", value: "∞" }),
    node({ id: "badges", type: "Rail", gap: "tight", children: ["badge-adaptive", "badge-safe", "badge-stateful"] }),
    node({ id: "badge-adaptive", type: "Badge", label: "Host-adaptive", icon: "✦", tone: "accent" }),
    node({ id: "badge-safe", type: "Badge", label: "Catalog-only", icon: "✓", tone: "positive" }),
    node({ id: "badge-stateful", type: "Badge", label: "State-preserving", icon: "↻", tone: "info" }),
  ],
});

const envelope = { continuationState: null, sources: [] };
const frames = [
  { sequence: 1, type: "status", stage: "accepted", message: "Preparing the parity surface…" },
  { sequence: 2, type: "complete", experience, envelope, compilerMode: "parity-fixture" },
];

const wrapper = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fify catalog parity</title><style>body{margin:0;background:#ececf0;font:14px system-ui;color:#222}.page{max-width:1120px;margin:24px auto;padding:0 16px}.page.compact{max-width:430px}iframe{width:100%;min-height:600px;border:0;border-radius:18px;background:#fff;box-shadow:0 10px 35px #18182818}</style></head><body><div class="page"><h1>Fify catalog parity</h1><iframe id="app" src="/widget" title="Fify catalog parity"></iframe></div><script>const page=document.querySelector('.page');if(new URLSearchParams(location.search).has('compact'))page.classList.add('compact');const frame=document.querySelector('#app');function send(message){frame.contentWindow.postMessage(message,'*')}frame.addEventListener('load',()=>send({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:{runId:'catalog-preview',state:'complete',lastSequence:2,fallbackText:'Catalog parity preview',frames:${JSON.stringify(frames)}}}}));window.addEventListener('message',event=>{if(event.source!==frame.contentWindow)return;const message=event.data;if(!message||message.jsonrpc!=='2.0')return;if(message.method==='ui/notifications/size-changed'){frame.style.height=Math.max(600,Number(message.params?.height||0))+'px';return}if(message.method==='ui/initialize'){send({jsonrpc:'2.0',id:message.id,result:{protocolVersion:'2025-06-18',capabilities:{}}});return}if(message.method==='tools/call'&&message.params?.name==='read_information_ui_run'){const after=Number(message.params.arguments?.afterSequence||0);send({jsonrpc:'2.0',id:message.id,result:{structuredContent:{runId:'catalog-preview',state:'complete',lastSequence:2,frames:${JSON.stringify(frames)}.filter(frame=>frame.sequence>after)}}});return}if(message.id)send({jsonrpc:'2.0',id:message.id,result:{}})});</script></body></html>`;

const port = Number(process.argv[2] ?? process.env.PORT ?? 4113);
createServer((request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(request.url === "/widget" ? informationUIWidgetHtml : wrapper);
}).listen(port, "127.0.0.1", () => console.log(`Fify catalog parity preview: http://127.0.0.1:${port}`));
