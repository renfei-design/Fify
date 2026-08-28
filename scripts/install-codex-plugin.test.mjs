import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execute = promisify(execFile);

test("Codex install requires a full host restart and host-call verification", async () => {
  const { stdout } = await execute(
    process.execPath,
    ["scripts/install-codex-plugin.mjs", "--dry-run"],
    { cwd: process.cwd() },
  );

  assert.match(stdout, /codex mcp get fify/);
  assert.match(stdout, /Refuse installation.*desktop MCP host is running/);
  assert.match(stdout, /Fully quit ChatGPT\/Codex and reopen it/);
  assert.match(stdout, /brand-new tagged task/);
  assert.match(stdout, /pnpm codex:verify-host/);
  assert.doesNotMatch(stdout, /Fify is installed\. Start a new Codex task/);
});
