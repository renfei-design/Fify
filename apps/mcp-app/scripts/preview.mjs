import { createServer } from "node:http";
import {
  compileGroundedInformationUI,
  createDefaultGroundedCompositionPlan,
  uiExperienceToA2UI,
} from "../../../packages/core/dist/index.js";
import { informationUIWidgetHtml } from "../dist/widget.js";

const envelope = {
  version: "1.0",
  originalRequest: "@Fify Who is LeBron James?",
  groundedAnswer: "LeBron James is an American professional basketball player whose career includes four NBA championships and the league's all-time scoring record.",
  locale: "en-US",
  sections: [
    {
      id: "identity",
      title: "LeBron James",
      body: "A career defined by longevity, playmaking, scoring, and championship leadership.",
      sourceIds: ["nba-profile"],
      items: [
        { id: "role", label: "Known for", value: "All-around play", detail: "Elite scoring, passing, rebounding, and positional versatility.", sourceIds: ["nba-profile"] },
        { id: "draft", label: "NBA entry", value: "2003 · No. 1 pick", detail: "Selected first overall directly from St. Vincent–St. Mary High School.", sourceIds: ["nba-profile"] },
        { id: "record", label: "Signature record", value: "All-time scoring leader", detail: "He became the NBA's career points leader in February 2023.", sourceIds: ["nba-profile"] }
      ]
    },
    {
      id: "career-landmarks",
      title: "Championship landmarks",
      body: "Four title runs across three franchises anchor his postseason résumé.",
      sourceIds: ["nba-profile"],
      items: [
        { id: "miami-2012", label: "Miami Heat", value: "2012", detail: "First NBA championship and Finals MVP.", sourceIds: ["nba-profile"] },
        { id: "miami-2013", label: "Miami Heat", value: "2013", detail: "Back-to-back championship and Finals MVP.", sourceIds: ["nba-profile"] },
        { id: "cleveland-2016", label: "Cleveland Cavaliers", value: "2016", detail: "Delivered the franchise's first NBA title.", sourceIds: ["nba-profile"] },
        { id: "lakers-2020", label: "Los Angeles Lakers", value: "2020", detail: "Won a fourth championship and fourth Finals MVP.", sourceIds: ["nba-profile"] }
      ]
    }
  ],
  sources: [
    { id: "nba-profile", title: "NBA player profile", url: "https://www.nba.com/player/2544/lebron-james/bio" },
    { id: "portrait-source", title: "LeBron James 2023 · Wikimedia Commons", url: "https://commons.wikimedia.org/wiki/File:LeBron_James_2023.jpg" }
  ],
  media: [{
    id: "lebron-portrait",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/LeBron_James_2023.jpg/330px-LeBron_James_2023.jpg",
    alt: "LeBron James wearing a Los Angeles Lakers uniform during a 2023 game",
    caption: "LeBron James during a 2023 Los Angeles Lakers game · photo by ReaganHoang10, CC BY-SA 4.0",
    role: "identity",
    sourceId: "portrait-source"
  }],
  suggestedRefinements: ["Show the career timeline", "Focus on the records"]
};

const composition = createDefaultGroundedCompositionPlan(envelope);
composition.placements[0].component = "FactList";
composition.placements[1].component = "Timeline";
const { experience } = compileGroundedInformationUI(envelope, composition, "preview-run");
const frames = [
  { sequence: 1, type: "status", stage: "accepted", message: "Preparing an interactive view…" },
  { sequence: 2, type: "status", stage: "composition", message: "Choosing the clearest structure…" },
  ...uiExperienceToA2UI(experience, { surfaceId: "fify-preview-run" }).map((message, index) => ({ sequence: index + 3, type: "a2ui", message })),
  { sequence: 4, type: "complete", experience, envelope, compilerMode: "deterministic-fallback" }
];

const wrapper = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fify MCP Apps preview</title><style>body{margin:0;background:#ececf0;font:14px system-ui;color:#222}.page{max-width:900px;margin:24px auto;padding:0 16px}.page.compact{max-width:430px}.note{margin-bottom:12px;color:#5d5d66}.event{margin-top:10px;padding:10px 12px;border-radius:10px;background:#fff;color:#555}iframe{width:100%;min-height:510px;border:0;border-radius:18px;background:#fff;box-shadow:0 10px 35px #18182818}</style></head><body><div class="page"><h1>Fify MCP Apps preview</h1><p class="note">This is the real widget using a local standards-based MCP Apps bridge. The run is already complete before mount, matching the Codex regression case.</p><iframe id="app" src="/widget" title="Fify information UI"></iframe><div class="event" id="event">Waiting for an interaction…</div></div><script>const page=document.querySelector('.page');if(new URLSearchParams(location.search).has('compact'))page.classList.add('compact');const frame=document.querySelector('#app'),eventBox=document.querySelector('#event');function send(message){frame.contentWindow.postMessage(message,'*')}frame.addEventListener('load',()=>send({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:{runId:'preview-run',state:'complete',lastSequence:4,fallbackText:${JSON.stringify(envelope.groundedAnswer)},frames:${JSON.stringify(frames)}}}}));window.addEventListener('message',event=>{if(event.source!==frame.contentWindow)return;const message=event.data;if(!message||message.jsonrpc!=='2.0')return;if(message.method==='ui/notifications/size-changed'){frame.style.height=Math.max(510,Number(message.params?.height||0))+'px';return}if(message.method==='ui/notifications/model-context-changed'){eventBox.textContent='Widget state: '+JSON.stringify(message.params?.structuredContent||{});return}if(message.method==='ui/message'){eventBox.textContent='Follow-up sent: '+(message.params?.content?.[0]?.text||'');send({jsonrpc:'2.0',id:message.id,result:{}});return}if(message.method==='ui/initialize'){send({jsonrpc:'2.0',id:message.id,result:{protocolVersion:'2025-06-18',capabilities:{}}});return}if(message.method==='tools/call'&&message.params?.name==='read_information_ui_run'){const after=Number(message.params.arguments?.afterSequence||0);send({jsonrpc:'2.0',id:message.id,result:{structuredContent:{runId:'preview-run',state:'complete',lastSequence:4,frames:${JSON.stringify(frames)}.filter(frame=>frame.sequence>after)}}});return}if(message.id)send({jsonrpc:'2.0',id:message.id,result:{}})});</script></body></html>`;

const port = Number(process.argv[2] ?? process.env.PORT ?? 4111);
const server = createServer((request, response) => {
  const widget = request.url === "/widget";
  response.writeHead(200, { "content-type": widget ? "text/html; charset=utf-8" : "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(widget ? informationUIWidgetHtml : wrapper);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Fify MCP Apps preview: http://127.0.0.1:${port}`);
});
