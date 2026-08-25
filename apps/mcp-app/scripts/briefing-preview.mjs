import { createServer } from "node:http";
import {
  compileGroundedInformationUI,
  createDefaultGroundedCompositionPlan,
} from "../../../packages/core/dist/index.js";
import { informationUIWidgetHtml } from "../dist/widget.js";

const sourceIds = ["operating-review"];
const item = (id, label, value, detail) => ({
  id,
  label,
  value,
  detail,
  sourceIds,
});
const envelope = {
  version: "1.0",
  originalRequest:
    "Create an executive briefing for leadership from these operating results.",
  groundedAnswer:
    "Growth is holding, but enterprise delivery is now the constraint. Approve a 90-day capacity plan focused on the three accounts with the greatest renewal exposure.",
  locale: "en-US",
  sections: [
    {
      id: "briefing-summary",
      title:
        "Growth is holding, but enterprise delivery is now the constraint",
      body: "Pipeline and retention remain healthy. Implementation capacity is delaying revenue recognition and increasing risk in the largest accounts.",
      items: [],
      sourceIds,
    },
    {
      id: "executive-signals",
      title: "Executive signals",
      body: "The current operating snapshot.",
      items: [
        item(
          "revenue-outlook",
          "Revenue outlook",
          "On plan",
          "Demand remains stable and the growth plan is intact.",
        ),
        item(
          "enterprise-backlog",
          "Enterprise backlog",
          "+18%",
          "Implementation starts are slipping as specialist teams carry more concurrent work.",
        ),
        item(
          "renewal-exposure",
          "Renewal exposure",
          "3 accounts",
          "Risk is concentrated in three strategic accounts rather than across the portfolio.",
        ),
      ],
      sourceIds,
    },
    {
      id: "what-changed",
      title: "What changed",
      body: "The signals that materially changed the operating picture.",
      items: [
        item(
          "large-deals",
          "Large deals are still closing",
          "Protect growth plan",
          "Win rates remain inside the expected range.",
        ),
        item(
          "delivery-upside",
          "Delivery is absorbing the upside",
          "Remove bottleneck",
          "Capacity, not acquisition, is limiting recognized revenue.",
        ),
        item(
          "concentrated-risk",
          "Risk is concentrated",
          "Target intervention",
          "Three accounts represent most near-term renewal exposure.",
        ),
      ],
      sourceIds,
    },
    {
      id: "decision",
      title: "Approve a 90-day capacity plan",
      body: "Shift budget toward qualified implementation partners and prioritize the three highest-value launches.",
      items: [
        item("recommendation", "Recommendation", "Approve", "Begin this quarter."),
        item("accountable-owner", "Accountable owner", "COO", "Own delivery and staffing tradeoffs."),
        item("decision-date", "Decision date", "Friday", "Confirm during the operating review."),
      ],
      sourceIds,
    },
    {
      id: "risks",
      title: "Watch closely",
      body: "The risks that can change the recommendation.",
      items: [
        item("renewal-risk", "Renewal concentration", "High", "Three strategic accounts carry most exposure."),
        item("partner-quality", "Partner quality", "Medium", "Acceleration cannot reduce implementation quality."),
      ],
      sourceIds,
    },
    {
      id: "next-actions",
      title: "Next actions",
      body: "Owners and checkpoints after approval.",
      items: [
        item("confirm-capacity", "Confirm partner capacity", "Wednesday", "Operations"),
        item("assign-sponsors", "Assign executive sponsors", "Thursday", "Revenue"),
        item("staffing-decision", "Return with staffing decision", "Friday", "COO"),
      ],
      sourceIds,
    },
  ],
  sources: [
    {
      id: "operating-review",
      title: "Operating review",
      url: "https://example.com/operating-review",
    },
  ],
  suggestedRefinements: ["Show only the decision and risks"],
};

const composition = createDefaultGroundedCompositionPlan(envelope);
const { experience } = compileGroundedInformationUI(
  envelope,
  composition,
  "executive-briefing-preview",
);
const result = {
  runId: "executive-briefing-preview",
  state: "complete",
  lastSequence: 1,
  fallbackText: envelope.groundedAnswer,
  frames: [
    {
      sequence: 1,
      type: "complete",
      experience,
      envelope,
      compilerMode: "deterministic-fallback",
    },
  ],
};

const wrapper = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fify executive briefing preview</title><style>*{box-sizing:border-box}body{margin:0;background:#171719;color:#e8e8ec;font:14px Inter,system-ui,sans-serif}.page{width:min(100%,1180px);margin:24px auto;padding:0 16px}.page.compact{width:430px;max-width:100%}iframe{width:100%;min-height:760px;border:0;background:#111113}</style></head><body><main class="page"><iframe id="app" src="/widget" title="Fify executive briefing"></iframe></main><script>const query=new URLSearchParams(location.search);const page=document.querySelector('.page');if(query.has('compact'))page.classList.add('compact');const result=${JSON.stringify(result)};const frame=document.querySelector('#app');function send(message){frame.contentWindow.postMessage(message,'*')}frame.addEventListener('load',()=>send({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:result}}));window.addEventListener('message',event=>{if(event.source!==frame.contentWindow)return;const message=event.data;if(!message||message.jsonrpc!=='2.0')return;if(message.method==='ui/notifications/size-changed'){frame.style.height=Math.max(760,Number(message.params?.height||0))+'px';return}if(message.method==='ui/initialize'){send({jsonrpc:'2.0',id:message.id,result:{protocolVersion:'2025-06-18',capabilities:{}}});return}if(message.id)send({jsonrpc:'2.0',id:message.id,result:{}})});</script></body></html>`;

const port = Number(process.argv[2] ?? process.env.PORT ?? 4115);
createServer((request, response) => {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(request.url === "/widget" ? informationUIWidgetHtml : wrapper);
}).listen(port, "127.0.0.1", () => {
  console.log(`Fify executive briefing preview: http://127.0.0.1:${port}`);
});
