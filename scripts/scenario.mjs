import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export const scenariosPath = path.join(projectRoot, "scenarios");
export const scenarioQualityMatrixPath = path.join(
  projectRoot,
  "docs",
  "scenario-quality-matrix.md",
);

const stages = ["verified", "candidate", "baseline", "planned"];
const priorities = ["P0", "P1", "P2", "P3"];
const evidenceStates = ["pass", "partial", "fail", "pending", "none"];
const dimensions = [
  ["contract", "Contract"],
  ["visualParity", "Visual"],
  ["canvas", "Canvas"],
  ["interactionFit", "Interaction"],
  ["runtime", "Runtime"],
];

export const qualityScale = {
  minimum: 0,
  maximum: 4,
  target: 3,
  labels: {
    0: "Missing",
    1: "Fragile",
    2: "Functional gap",
    3: "Release candidate",
    4: "North-Star quality",
  },
};

function markdownCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

function evidenceLabel(evidence) {
  return [
    `Auto ${evidence.automated}`,
    `Preview ${evidence.deterministicPreview}`,
    `Installed ${evidence.installedCodex}`,
    `Human ${evidence.humanReview}`,
  ].join(" · ");
}

function titleFromId(id) {
  return id
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function validateId(id) {
  assert.match(
    id,
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Scenario IDs must use lowercase kebab-case.",
  );
}

export function validateScenario(
  manifest,
  fixtures,
  { root = projectRoot } = {},
) {
  assert.equal(manifest.version, "1.0");
  validateId(manifest.id);
  assert.equal(fixtures.version, "1.0");
  assert.equal(fixtures.scenarioId, manifest.id);
  assert.match(manifest.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(manifest.name.length > 0, manifest.id);

  const contract = manifest.contract;
  assert.ok(contract.userJob.length > 0, `${manifest.id}:userJob`);
  assert.ok(Array.isArray(contract.triggers), `${manifest.id}:triggers`);
  assert.ok(Array.isArray(contract.exclusions), `${manifest.id}:exclusions`);
  assert.ok(Array.isArray(contract.roles), `${manifest.id}:roles`);
  assert.ok(contract.layout.wide.length > 0, `${manifest.id}:wide`);
  assert.ok(contract.layout.compact.length > 0, `${manifest.id}:compact`);
  assert.ok(Number.isInteger(contract.layout.minimumItems), manifest.id);
  assert.ok(Number.isInteger(contract.layout.maximumItems), manifest.id);
  assert.ok(contract.layout.minimumItems >= 1, manifest.id);
  assert.ok(
    contract.layout.maximumItems >= contract.layout.minimumItems,
    manifest.id,
  );
  assert.ok(
    Array.isArray(contract.interactions),
    `${manifest.id}:interactions`,
  );
  assert.ok(contract.fallback.length > 0, `${manifest.id}:fallback`);

  assert.ok(manifest.implementation.blueprints.length > 0, manifest.id);
  assert.ok(manifest.implementation.components.length > 0, manifest.id);

  const quality = manifest.quality;
  assert.ok(stages.includes(quality.stage), manifest.id);
  assert.ok(priorities.includes(quality.priority), manifest.id);
  assert.ok(quality.nextAction.length > 0, manifest.id);
  for (const [dimension] of dimensions) {
    const score = quality.scores[dimension];
    assert.ok(Number.isInteger(score), `${manifest.id}:${dimension}`);
    assert.ok(score >= qualityScale.minimum && score <= qualityScale.maximum);
  }
  for (const state of Object.values(quality.evidence))
    assert.ok(evidenceStates.includes(state), `${manifest.id}:${state}`);
  for (const reference of quality.refs)
    assert.ok(
      existsSync(path.join(root, reference)),
      `${manifest.id}:${reference}`,
    );

  assert.ok(Array.isArray(fixtures.cases), `${manifest.id}:cases`);
  const caseIds = new Set();
  for (const fixture of fixtures.cases) {
    validateId(fixture.id);
    assert.ok(
      !caseIds.has(fixture.id),
      `${manifest.id}:duplicate fixture ${fixture.id}`,
    );
    caseIds.add(fixture.id);
    assert.ok(fixture.prompt.length > 0, `${manifest.id}:${fixture.id}:prompt`);
    assert.ok(["wide", "compact", "either"].includes(fixture.canvas));
    assert.equal(typeof fixture.expectedActivation, "boolean");
  }

  if (["verified", "candidate"].includes(quality.stage))
    assert.ok(
      fixtures.cases.length > 0,
      `${manifest.id} needs a canonical fixture.`,
    );
  if (quality.stage === "verified") {
    assert.equal(quality.evidence.installedCodex, "pass", manifest.id);
    assert.equal(quality.evidence.humanReview, "pass", manifest.id);
    assert.ok(
      dimensions.every(
        ([dimension]) => quality.scores[dimension] >= qualityScale.target,
      ),
      `${manifest.id} is verified with a quality dimension below target.`,
    );
  }
  if (quality.stage === "candidate") {
    assert.equal(quality.evidence.automated, "pass", manifest.id);
    assert.equal(quality.evidence.deterministicPreview, "pass", manifest.id);
    assert.equal(quality.evidence.installedCodex, "pass", manifest.id);
    assert.equal(quality.evidence.humanReview, "pending", manifest.id);
    assert.ok(quality.gaps.length > 0, manifest.id);
  }
  if (["baseline", "planned"].includes(quality.stage))
    assert.ok(quality.gaps.length > 0, manifest.id);

  return { ...manifest, fixtures };
}

export async function readScenarios({ root = projectRoot } = {}) {
  const rootScenariosPath = path.join(root, "scenarios");
  const entries = await readdir(rootScenariosPath, { withFileTypes: true });
  const scenarios = [];
  for (const entry of entries
    .filter((item) => item.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const directory = path.join(rootScenariosPath, entry.name);
    const manifest = JSON.parse(
      await readFile(path.join(directory, "scenario.json"), "utf8"),
    );
    const fixtures = JSON.parse(
      await readFile(path.join(directory, "fixtures.json"), "utf8"),
    );
    assert.equal(
      entry.name,
      manifest.id,
      `${entry.name}: directory and scenario ID differ.`,
    );
    scenarios.push(validateScenario(manifest, fixtures, { root }));
  }
  assert.ok(scenarios.length > 0, "No scenarios found.");
  return scenarios;
}

export function summarizeScenarios(scenarios) {
  const counts = Object.fromEntries(stages.map((stage) => [stage, 0]));
  for (const scenario of scenarios) counts[scenario.quality.stage] += 1;
  return {
    tracked: scenarios.length,
    implemented: counts.verified + counts.candidate,
    ...counts,
  };
}

export async function renderScenarioQualityMatrix(scenarios) {
  const summary = summarizeScenarios(scenarios);
  const reviewedAt = [...scenarios].sort((left, right) =>
    right.reviewedAt.localeCompare(left.reviewedAt),
  )[0].reviewedAt;
  const rows = scenarios
    .map((scenario) => {
      const scores = dimensions.map(
        ([dimension]) => `${scenario.quality.scores[dimension]}/4`,
      );
      return `| ${markdownCell(scenario.name)} | ${scenario.quality.stage} | ${scenario.quality.priority} | ${scores.join(" | ")} | ${markdownCell(evidenceLabel(scenario.quality.evidence))} | ${scenario.quality.gaps.length} | ${markdownCell(scenario.quality.nextAction)} |`;
    })
    .join("\n");
  const queue = [...scenarios]
    .filter(
      (scenario) =>
        scenario.quality.stage !== "verified" || scenario.quality.gaps.length,
    )
    .sort(
      (left, right) =>
        priorities.indexOf(left.quality.priority) -
        priorities.indexOf(right.quality.priority),
    )
    .map(
      (scenario) =>
        `- **${scenario.quality.priority} · ${scenario.name}:** ${scenario.quality.nextAction}`,
    )
    .join("\n");
  const scale = Object.entries(qualityScale.labels)
    .map(([score, label]) => `- **${score}:** ${label}`)
    .join("\n");

  return prettier.format(
    `# Fify scenario quality matrix

> Generated from \`scenarios/*/scenario.json\`. Do not edit this file directly. Run \`pnpm scenario:check -- --write\` after changing a scenario.

Last reviewed: **${reviewedAt}**

## Portfolio status

| Measure | Count |
| --- | ---: |
| Tracked scenarios | ${summary.tracked} |
| Implemented scenarios | ${summary.implemented} |
| Verified | ${summary.verified} |
| Candidate, awaiting human acceptance | ${summary.candidate} |
| Baseline, dedicated quality work needed | ${summary.baseline} |
| Planned | ${summary.planned} |

"Implemented" means verified or candidate. Baseline scenarios have generic renderer support but do not yet have a complete, accepted scenario-specific experience.

## Quality scale

${scale}

Fify does not collapse quality into one average. A scenario is verified only when every dimension meets the target, the installed Codex path passes, and human review passes.

## Scenario matrix

| Scenario | Stage | Priority | Contract | Visual | Canvas | Interaction | Runtime | Evidence | Gaps | Next action |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | --- |
${rows}

## Improvement queue

${queue}

## Evidence meanings

- **Automated:** compiler, renderer, integration, activation, or comprehension coverage.
- **Preview:** deterministic wide and compact visual fixture coverage.
- **Installed:** the portable bundle was exercised through the installed Codex plugin path.
- **Human:** explicit user or reviewer acceptance of the current installed experience.
`,
    { parser: "markdown" },
  );
}

export async function scaffoldScenario(id, { root = projectRoot } = {}) {
  validateId(id);
  const directory = path.join(root, "scenarios", id);
  assert.ok(!existsSync(directory), `Scenario '${id}' already exists.`);
  const name = titleFromId(id);
  const today = new Date().toISOString().slice(0, 10);
  const manifest = {
    version: "1.0",
    id,
    name,
    reviewedAt: today,
    contract: {
      userJob: `Define the ${name.toLowerCase()} user job.`,
      triggers: [],
      exclusions: [],
      roles: ["primary-answer"],
      layout: {
        wide: "Define the wide-canvas hierarchy.",
        compact: "Define the compact stacking order.",
        minimumItems: 1,
        maximumItems: 1,
      },
      interactions: [],
      fallback: "Preserve the complete grounded plain answer.",
    },
    implementation: {
      blueprints: ["open-composition"],
      components: ["Text"],
    },
    quality: {
      stage: "planned",
      priority: "P2",
      scores: {
        contract: 0,
        visualParity: 0,
        canvas: 0,
        interactionFit: 0,
        runtime: 0,
      },
      evidence: {
        automated: "none",
        deterministicPreview: "none",
        installedCodex: "pending",
        humanReview: "pending",
      },
      refs: [],
      gaps: ["Complete the scenario contract and canonical fixtures."],
      nextAction:
        "Define the user job, triggers, semantic roles, and responsive layout.",
    },
  };
  const fixtures = { version: "1.0", scenarioId: id, cases: [] };
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, "scenario.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await writeFile(
    path.join(directory, "fixtures.json"),
    `${JSON.stringify(fixtures, null, 2)}\n`,
  );
  return { manifest, fixtures };
}

async function checkScenarios({ write = false, selectedId } = {}) {
  const scenarios = await readScenarios();
  if (selectedId)
    assert.ok(
      scenarios.some((scenario) => scenario.id === selectedId),
      `Unknown scenario '${selectedId}'.`,
    );
  const rendered = await renderScenarioQualityMatrix(scenarios);
  if (write) {
    await writeFile(scenarioQualityMatrixPath, rendered);
    console.log("Updated docs/scenario-quality-matrix.md.");
  } else {
    const current = await readFile(scenarioQualityMatrixPath, "utf8").catch(
      () => "",
    );
    assert.equal(
      current,
      rendered,
      "Scenario quality matrix is stale. Run pnpm scenario:check -- --write.",
    );
  }
  const summary = summarizeScenarios(scenarios);
  console.log(
    `${selectedId ? `Scenario '${selectedId}' and portfolio` : "Scenario portfolio"} valid: ${summary.implemented}/${summary.tracked} implemented, ${summary.verified} verified.`,
  );
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "new") {
    const id = args.find((argument) => !argument.startsWith("--"));
    assert.ok(id, "Usage: pnpm scenario:new <scenario-id>");
    await scaffoldScenario(id);
    await checkScenarios({ write: true, selectedId: id });
    console.log(`Created scenarios/${id}/scenario.json and fixtures.json.`);
    return;
  }
  if (command === "check") {
    await checkScenarios({
      write: args.includes("--write"),
      selectedId: args.find((argument) => !argument.startsWith("--")),
    });
    return;
  }
  throw new Error("Use 'new' or 'check'.");
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url))
  await main();
