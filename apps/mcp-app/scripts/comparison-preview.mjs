import { createServer } from "node:http";
import {
  compileGroundedInformationUI,
  createDefaultGroundedCompositionPlan,
} from "../../../packages/core/dist/index.js";
import { informationUIWidgetHtml } from "../dist/widget.js";

const options = [
  { id: "managed", label: "Managed platform" },
  { id: "serverless", label: "Serverless" },
  { id: "containers", label: "Containers" },
  { id: "kubernetes", label: "Kubernetes" },
  { id: "vms", label: "Virtual machines" },
];

const criteria = [
  {
    id: "best-fit",
    title: "Best fit",
    body: "The team shape each approach serves most naturally.",
    values: [
      ["Small product teams", "Fast delivery with minimal operational work."],
      [
        "Event-driven products",
        "Functions and managed services scale independently.",
      ],
      [
        "Portable applications",
        "A consistent runtime across providers and environments.",
      ],
      [
        "Platform organizations",
        "Maximum orchestration control for many services.",
      ],
      ["Legacy workloads", "Familiar infrastructure with broad compatibility."],
    ],
  },
  {
    id: "setup",
    title: "Setup effort",
    body: "Relative effort before the first production release.",
    values: [
      ["Low", "Most infrastructure decisions are handled by the platform."],
      [
        "Low to medium",
        "Simple initially, with service integration work later.",
      ],
      [
        "Medium",
        "Requires images, deployment automation, and runtime configuration.",
      ],
      [
        "High",
        "Clusters, policies, observability, and operations must be established.",
      ],
      [
        "Medium",
        "Provisioning is familiar but still requires system administration.",
      ],
    ],
  },
  {
    id: "control",
    title: "Operational control",
    body: "How much of the underlying runtime the team owns.",
    values: [
      ["Limited", "The platform intentionally abstracts most infrastructure."],
      [
        "Service-level",
        "Control is expressed through functions and managed services.",
      ],
      ["Strong", "Teams control the image, runtime, and deployment model."],
      [
        "Maximum",
        "Networking, scheduling, policy, and runtime are configurable.",
      ],
      [
        "Full machine",
        "The operating system and runtime are directly managed.",
      ],
    ],
  },
  {
    id: "scaling",
    title: "Scaling model",
    body: "How capacity grows as demand changes.",
    values: [
      [
        "Platform managed",
        "Application instances scale within platform limits.",
      ],
      [
        "Request driven",
        "Individual services scale from demand and may reach zero.",
      ],
      [
        "Service replicas",
        "Containers scale horizontally through an orchestrator.",
      ],
      [
        "Policy driven",
        "Workloads and infrastructure scale through cluster policies.",
      ],
      [
        "Capacity planned",
        "Machines are added or resized through infrastructure tooling.",
      ],
    ],
  },
  {
    id: "overhead",
    title: "Team overhead",
    body: "The ongoing operational burden after launch.",
    values: [
      ["Low", "A small team can operate the application effectively."],
      [
        "Low to medium",
        "Operational work shifts toward service boundaries and observability.",
      ],
      [
        "Medium",
        "Images, registries, patching, and orchestration remain team concerns.",
      ],
      ["High", "Usually requires dedicated platform engineering capability."],
      [
        "Medium to high",
        "System maintenance and capacity management remain continuous.",
      ],
    ],
  },
  {
    id: "portability",
    title: "Portability",
    body: "How easily workloads can move between environments.",
    values: [
      ["Low to medium", "Platform conventions can create migration work."],
      ["Medium", "Functions are portable in concept but integrations vary."],
      ["High", "Standard images move across many compatible runtimes."],
      ["High", "The orchestration API is broadly available across providers."],
      [
        "High",
        "Virtual machine formats and automation patterns are widely supported.",
      ],
    ],
  },
];

function createResult(decision) {
  const envelope = {
    version: "1.0",
    originalRequest: decision
      ? "Help me decide between five deployment approaches using only these supplied facts."
      : "Compare five deployment approaches using only these supplied facts.",
    groundedAnswer:
      "The five deployment approaches trade setup speed and team overhead against operational control and portability.",
    locale: "en-US",
    sections: criteria.map((criterion) => ({
      id: criterion.id,
      title: criterion.title,
      body: criterion.body,
      sourceIds: [],
      items: options.map((option, index) => ({
        id: `${criterion.id}-${option.id}`,
        label: option.label,
        value: criterion.values[index][0],
        detail: criterion.values[index][1],
        sourceIds: [],
      })),
    })),
    sources: [],
    suggestedRefinements: decision
      ? ["Continue with my selected approach"]
      : ["Focus on operational effort", "Focus on portability"],
  };
  const composition = createDefaultGroundedCompositionPlan(envelope);
  composition.topology = "responsive-grid";
  for (const placement of composition.placements)
    placement.component = "Comparison";
  const runId = decision
    ? "comparison-decision-preview"
    : "comparison-matrix-preview";
  const { experience } = compileGroundedInformationUI(
    envelope,
    composition,
    runId,
  );
  return {
    runId,
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
}

const previewResults = {
  comparison: createResult(false),
  decision: createResult(true),
};

const wrapper = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fify comparison matrix preview</title><style>*{box-sizing:border-box}body{margin:0;background:#171719;color:#e8e8ec;font:14px Inter,system-ui,sans-serif}.page{width:min(100%,1180px);margin:24px auto;padding:0 16px}.page.compact{width:430px;max-width:100%}iframe{width:100%;min-height:720px;border:0;background:#111113}</style></head><body><main class="page"><iframe id="app" src="/widget" title="Fify comparison information UI"></iframe></main><script>const query=new URLSearchParams(location.search);const page=document.querySelector('.page');if(query.has('compact'))page.classList.add('compact');const results=${JSON.stringify(previewResults)};const result=query.has('decision')?results.decision:results.comparison;const frame=document.querySelector('#app');function send(message){frame.contentWindow.postMessage(message,'*')}frame.addEventListener('load',()=>send({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:result}}));window.addEventListener('message',event=>{if(event.source!==frame.contentWindow)return;const message=event.data;if(!message||message.jsonrpc!=='2.0')return;if(message.method==='ui/notifications/size-changed'){frame.style.height=Math.max(720,Number(message.params?.height||0))+'px';return}if(message.method==='ui/initialize'){send({jsonrpc:'2.0',id:message.id,result:{protocolVersion:'2025-06-18',capabilities:{}}});return}if(message.id)send({jsonrpc:'2.0',id:message.id,result:{}})});</script></body></html>`;

const port = Number(process.argv[2] ?? process.env.PORT ?? 4114);
createServer((request, response) => {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(request.url === "/widget" ? informationUIWidgetHtml : wrapper);
}).listen(port, "127.0.0.1", () => {
  console.log(`Fify comparison parity preview: http://127.0.0.1:${port}`);
});
