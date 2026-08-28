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

function createProductResult() {
  const products = ["MacBook Neo", "MacBook Air", "MacBook Pro"];
  const sourceIds = ["apple-neo", "apple-air", "apple-pro"];
  const envelope = {
    version: "1.0",
    originalRequest:
      "Compare MacBook Neo, MacBook Air, and MacBook Pro and help me choose with Fify.",
    groundedAnswer:
      "MacBook Air is the strongest balance for most people. MacBook Neo prioritizes price, while MacBook Pro prioritizes sustained professional work.",
    locale: "en-US",
    sections: [
      {
        id: "recommendation",
        title: "Recommendation",
        body: "MacBook Air is the strongest balance for most people.",
        sourceIds,
        items: [
          {
            id: "recommended-option",
            label: "Recommended option",
            value: "MacBook Air",
            detail:
              "It balances price, portability, memory headroom, and longevity.",
            sourceIds: ["apple-air"],
          },
        ],
      },
      {
        id: "starting-price",
        title: "Starting price",
        body: "Current U.S. starting prices.",
        sourceIds,
        items: ["$599", "$1,099", "$1,699"].map((value, index) => ({
          id: `price-${index + 1}`,
          label: products[index],
          value,
          detail:
            index === 0 ? "Lowest starting price." : "Higher capability tier.",
          sourceIds: [sourceIds[index]],
        })),
      },
      {
        id: "best-fit",
        title: "Best fit",
        body: "The workload each model handles most naturally.",
        sourceIds,
        items: [
          ["Everyday basics", "Browsing, documents, streaming, calls."],
          ["Most buyers", "School, office, coding, and travel."],
          ["Demanding production", "Video, 3D, audio, and large builds."],
        ].map(([value, detail], index) => ({
          id: `fit-${index + 1}`,
          label: products[index],
          value,
          detail,
          sourceIds: [sourceIds[index]],
        })),
      },
      {
        id: "memory",
        title: "Memory",
        body: "Practical headroom for larger workloads.",
        sourceIds,
        items: ["8GB fixed", "16–32GB", "16–128GB"].map((value, index) => ({
          id: `memory-${index + 1}`,
          label: products[index],
          value,
          detail:
            index === 0
              ? "The main longevity constraint."
              : index === 1
                ? "Enough range for most workflows."
                : "Built for memory-heavy work.",
          sourceIds: [sourceIds[index]],
        })),
      },
      {
        id: "tradeoff",
        title: "Tradeoff",
        body: "The most important compromise to accept.",
        sourceIds,
        items: [
          "Fixed memory and fewer ports",
          "No XDR display or Pro ports",
          "Higher price and weight",
        ].map((value, index) => ({
          id: `tradeoff-${index + 1}`,
          label: products[index],
          value,
          detail: "",
          sourceIds: [sourceIds[index]],
        })),
      },
    ],
    sources: [
      {
        id: "apple-neo",
        title: "MacBook Neo - Apple",
        url: "https://www.apple.com/macbook-neo/",
      },
      {
        id: "apple-air",
        title: "MacBook Air - Apple",
        url: "https://www.apple.com/macbook-air/",
      },
      {
        id: "apple-pro",
        title: "MacBook Pro - Apple",
        url: "https://www.apple.com/macbook-pro/",
      },
    ],
    media: [
      {
        id: "neo-product",
        url: "https://www.apple.com/v/macbook-neo/b/images/meta/macbook_neo__f2p1f7yafjyy_og.png",
        alt: "MacBook Neo",
        caption: "Official MacBook Neo product image",
        role: "illustration",
        subject: "MacBook Neo",
        sourceId: "apple-neo",
      },
      {
        id: "air-product",
        url: "https://www.apple.com/v/macbook-air/z/images/meta/macbook_air_mx__ez5y0k5yy7au_og.png",
        alt: "MacBook Air",
        caption: "Official MacBook Air product image",
        role: "illustration",
        subject: "MacBook Air",
        sourceId: "apple-air",
      },
      {
        id: "pro-product",
        url: "https://www.apple.com/v/macbook-pro/ax/images/meta/macbook-pro__difvbgz1plsi_og.png",
        alt: "MacBook Pro",
        caption: "Official MacBook Pro product image",
        role: "illustration",
        subject: "MacBook Pro",
        sourceId: "apple-pro",
      },
    ],
    suggestedRefinements: ["Focus on memory and longevity"],
  };
  const composition = createDefaultGroundedCompositionPlan(envelope);
  const runId = "comparison-product-preview";
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

function createMisspellingRegressionResult() {
  const products = ["OPPO Enco Free4", "Sony LinkBuds Fit", "AirPods Pro 3"];
  const rawLabels = [
    "\u201cVivo Encore Free\u201d",
    "\u201cSony LindBuds\u201d",
    "\u201cApple Airpod pro\u201d",
  ];
  const makeItems = (prefix, labels, values, details) =>
    values.map((value, index) => ({
      id: `${prefix}-${index + 1}`,
      label: labels[index],
      value,
      detail: details[index],
      sourceIds: [],
    }));
  const envelope = {
    version: "1.0",
    originalRequest:
      "Compare Vivo Encore Free, Sony LindBuds, and Apple Airpod pro",
    groundedAnswer:
      "The request resolves to OPPO Enco Free4, Sony LinkBuds Fit, and AirPods Pro 3. Choose by ecosystem, fit, and battery priorities.",
    locale: "en-US",
    sections: [
      {
        id: "model-assumptions",
        title: "Model assumptions",
        body: "The request is normalized to canonical current product names.",
        sourceIds: [],
        items: makeItems(
          "assumption",
          rawLabels,
          products,
          products.map(() => "Canonical product used for this comparison."),
        ),
      },
      {
        id: "quick-verdict",
        title: "Quick verdict",
        body: "Choose by ecosystem and fit priority.",
        sourceIds: [],
        items: makeItems(
          "verdict",
          ["Best value", "Best secure fit", "Best for iPhone"],
          products,
          [
            "Strong Android value with multipoint and capable ANC.",
            "A lightweight cross-platform choice for commuting and workouts.",
            "The deepest iPhone integration and strongest all-round recommendation.",
          ],
        ),
      },
      {
        id: "key-comparison",
        title: "Key comparison",
        body: "Manufacturer battery and ANC ratings use different conditions.",
        sourceIds: [],
        items: makeItems(
          "spec",
          products,
          ["6 h ANC", "5.5 h ANC", "8 h ANC"],
          [
            "24 hours with the case; IP55 earbuds.",
            "Secure supporters, multipoint, and IPX4.",
            "24 hours with the case; IP57 earbuds and case.",
          ],
        ),
      },
      {
        id: "buying-guidance",
        title: "Which one should you buy?",
        body: "Start with your phone, then choose the trade-off.",
        sourceIds: [],
        items: makeItems(
          "buy",
          ["Android value", "Cross-platform fit", "iPhone"],
          products,
          products.map(() => "Grounded buying guidance for this priority."),
        ),
      },
    ],
    sources: [],
    suggestedRefinements: ["Compare current prices"],
  };
  const { experience } = compileGroundedInformationUI(
    envelope,
    createDefaultGroundedCompositionPlan(envelope),
    "comparison-misspelling-regression",
  );
  return {
    runId: "comparison-misspelling-regression",
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
  product: createProductResult(),
  regression: createMisspellingRegressionResult(),
  comparison: createResult(false),
  decision: createResult(true),
};

const wrapper = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fify comparison matrix preview</title><style>*{box-sizing:border-box}body{margin:0;background:#171719;color:#e8e8ec;font:14px Inter,system-ui,sans-serif}.page{width:min(100%,1180px);margin:24px auto;padding:0 16px}.page.compact{width:430px;max-width:100%}iframe{width:100%;min-height:720px;border:0;background:#111113}</style></head><body><main class="page"><iframe id="app" src="/widget" title="Fify comparison information UI"></iframe></main><script>const query=new URLSearchParams(location.search);const page=document.querySelector('.page');if(query.has('compact'))page.classList.add('compact');const results=${JSON.stringify(previewResults)};const result=query.has('regression')?results.regression:query.has('scale')?results.comparison:query.has('decision')?results.decision:results.product;const frame=document.querySelector('#app');function send(message){frame.contentWindow.postMessage(message,'*')}frame.addEventListener('load',()=>send({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:result}}));window.addEventListener('message',event=>{if(event.source!==frame.contentWindow)return;const message=event.data;if(!message||message.jsonrpc!=='2.0')return;if(message.method==='ui/notifications/size-changed'){frame.style.height=Math.max(720,Number(message.params?.height||0))+'px';return}if(message.method==='ui/initialize'){send({jsonrpc:'2.0',id:message.id,result:{protocolVersion:'2025-06-18',capabilities:{}}});return}if(message.id)send({jsonrpc:'2.0',id:message.id,result:{}})});</script></body></html>`;

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
