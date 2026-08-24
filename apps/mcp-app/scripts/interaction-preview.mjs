import { createServer } from "node:http";
import {
  compileGroundedInformationUI,
  createDefaultGroundedCompositionPlan,
  uiExperienceToA2UI,
} from "../../../packages/core/dist/index.js";
import { informationUIWidgetHtml } from "../dist/widget.js";

const envelope = {
  version: "1.0",
  originalRequest: "@Fify build an editable decision tool for these rollout options",
  groundedAnswer: "Pilot minimizes exposure, phased balances speed and control, and all-at-once is fastest with the highest launch risk.",
  locale: "en-US",
  sections: [
    {
      id: "options",
      title: "Choose a rollout shape",
      body: "Select the option that best fits the launch constraints.",
      sourceIds: ["rollout-brief"],
      items: [
        { id: "pilot", label: "Pilot", value: "Lowest exposure", detail: "Start with one team and expand after validation.", sourceIds: ["rollout-brief"] },
        { id: "phased", label: "Phased", value: "Balanced", detail: "Expand in controlled waves with review gates.", sourceIds: ["rollout-brief"] },
        { id: "all-at-once", label: "All at once", value: "Fastest", detail: "Launch everywhere with the largest rollback surface.", sourceIds: ["rollout-brief"] },
      ],
    },
    {
      id: "budget-input",
      title: "Set the working budget",
      body: "This value stays with the view when you ask for a refinement.",
      sourceIds: [],
      items: [{ id: "budget", label: "Budget", value: "Enter an amount", detail: "Use the amount available for the first launch stage.", sourceIds: [] }],
    },
    {
      id: "constraints",
      title: "Grounded constraints",
      body: "Filter the verified constraints without changing the underlying answer.",
      sourceIds: ["rollout-brief"],
      items: [
        { id: "constraint-risk", label: "Risk tolerance", value: "Medium", detail: "A rollback must remain possible.", sourceIds: ["rollout-brief"] },
        { id: "constraint-time", label: "Launch window", value: "6 weeks", detail: "The rollout must begin this quarter.", sourceIds: ["rollout-brief"] },
        { id: "constraint-team", label: "Delivery team", value: "8 people", detail: "The same team supports migration and launch.", sourceIds: ["rollout-brief"] },
        { id: "constraint-regions", label: "Regions", value: "3", detail: "Localization is ready in three regions.", sourceIds: ["rollout-brief"] },
        { id: "constraint-rollback", label: "Rollback target", value: "30 min", detail: "Recovery must complete within thirty minutes.", sourceIds: ["rollout-brief"] },
        { id: "constraint-support", label: "Support coverage", value: "Business hours", detail: "No overnight support is funded.", sourceIds: ["rollout-brief"] },
        { id: "constraint-training", label: "Training", value: "Required", detail: "Operators need a guided launch checklist.", sourceIds: ["rollout-brief"] },
      ],
    },
  ],
  sources: [{ id: "rollout-brief", title: "Approved rollout brief", url: "https://example.com/rollout-brief" }],
  suggestedRefinements: ["Recommend an option using my inputs", "Focus on the launch risks"],
};

const composition = createDefaultGroundedCompositionPlan(envelope);
composition.placements[0].component = "ChoiceGroup";
composition.placements[1].component = "Input";
composition.placements[2].component = "Table";
const { experience } = compileGroundedInformationUI(envelope, composition, "interaction-preview");
const frames = [
  { sequence: 1, type: "status", stage: "accepted", message: "Preparing an interactive view…" },
  { sequence: 2, type: "status", stage: "composition", message: "Choosing the clearest structure…" },
  ...uiExperienceToA2UI(experience, { surfaceId: "fify-interaction-preview" }).map((message, index) => ({ sequence: index + 3, type: "a2ui", message })),
  { sequence: 4, type: "complete", experience, envelope, compilerMode: "deterministic-fallback" },
];

const wrapper = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fify interaction preview</title><style>body{margin:0;background:#ececf0;font:14px system-ui;color:#222}.page{max-width:900px;margin:24px auto;padding:0 16px}.page.compact{max-width:430px}.event{margin-top:10px;padding:10px 12px;border-radius:10px;background:#fff;color:#555}iframe{width:100%;min-height:510px;border:0;border-radius:18px;background:#fff;box-shadow:0 10px 35px #18182818}</style></head><body><div class="page"><h1>Fify interaction preview</h1><iframe id="app" src="/widget" title="Fify information UI"></iframe><div class="event" id="event">Waiting for an interaction…</div></div><script>const page=document.querySelector('.page');if(new URLSearchParams(location.search).has('compact'))page.classList.add('compact');const frame=document.querySelector('#app'),eventBox=document.querySelector('#event');function send(message){frame.contentWindow.postMessage(message,'*')}frame.addEventListener('load',()=>send({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:{runId:'interaction-preview',state:'complete',lastSequence:4,fallbackText:${JSON.stringify(envelope.groundedAnswer)},frames:${JSON.stringify(frames)}}}}));window.addEventListener('message',event=>{if(event.source!==frame.contentWindow)return;const message=event.data;if(!message||message.jsonrpc!=='2.0')return;if(message.method==='ui/notifications/size-changed'){frame.style.height=Math.max(510,Number(message.params?.height||0))+'px';return}if(message.method==='ui/notifications/model-context-changed'){eventBox.textContent='Widget state: '+JSON.stringify(message.params?.structuredContent||{});return}if(message.method==='ui/message'){eventBox.textContent='Follow-up sent: '+(message.params?.content?.[0]?.text||'');send({jsonrpc:'2.0',id:message.id,result:{}});return}if(message.method==='ui/initialize'){send({jsonrpc:'2.0',id:message.id,result:{protocolVersion:'2025-06-18',capabilities:{}}});return}if(message.method==='tools/call'&&message.params?.name==='read_information_ui_run'){const after=Number(message.params.arguments?.afterSequence||0);send({jsonrpc:'2.0',id:message.id,result:{structuredContent:{runId:'interaction-preview',state:'complete',lastSequence:4,frames:${JSON.stringify(frames)}.filter(frame=>frame.sequence>after)}}});return}if(message.id)send({jsonrpc:'2.0',id:message.id,result:{}})});</script></body></html>`;

const port = Number(process.argv[2] ?? process.env.PORT ?? 4112);
const server = createServer((request, response) => {
  const widget = request.url === "/widget";
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(widget ? informationUIWidgetHtml : wrapper);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Fify interaction preview: http://127.0.0.1:${port}`);
});
