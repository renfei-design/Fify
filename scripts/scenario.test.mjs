import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import {
  readScenarios,
  renderScenarioQualityMatrix,
  scaffoldScenario,
  scenarioQualityMatrixPath,
  summarizeScenarios,
} from "./scenario.mjs";

test("scenario manifests are the portfolio source of truth", async () => {
  const scenarios = await readScenarios();
  assert.deepEqual(summarizeScenarios(scenarios), {
    tracked: 14,
    implemented: 4,
    verified: 3,
    candidate: 1,
    baseline: 10,
    planned: 0,
  });
  assert.equal(
    await readFile(scenarioQualityMatrixPath, "utf8"),
    await renderScenarioQualityMatrix(scenarios),
  );
});

test("reference and pilot scenarios carry useful fixtures", async () => {
  const scenarios = await readScenarios();
  const comparison = scenarios.find((scenario) => scenario.id === "comparison");
  const briefing = scenarios.find(
    (scenario) => scenario.id === "executive-briefing",
  );
  const checklist = scenarios.find((scenario) => scenario.id === "checklist");
  assert.equal(comparison.contract.layout.maximumItems, 5);
  assert.ok(
    comparison.fixtures.cases.some((fixture) => fixture.canvas === "compact"),
  );
  assert.ok(
    briefing.contract.roles.includes("decision") &&
      briefing.contract.roles.includes("next-action"),
  );
  assert.ok(
    checklist.fixtures.cases.some(
      (fixture) => fixture.id === "negative-activation",
    ),
  );
});

test("scenario scaffold creates only the manifest and fixtures", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fify-scenario-"));
  await scaffoldScenario("customer-health", { root });
  const directory = path.join(root, "scenarios", "customer-health");
  const manifest = JSON.parse(
    await readFile(path.join(directory, "scenario.json"), "utf8"),
  );
  const fixtures = JSON.parse(
    await readFile(path.join(directory, "fixtures.json"), "utf8"),
  );
  assert.equal(manifest.quality.stage, "planned");
  assert.deepEqual(fixtures.cases, []);
});
