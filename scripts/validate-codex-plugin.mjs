import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const pluginRoot = path.join(projectRoot, "plugins", "fify");
const manifest = JSON.parse(
  await readFile(path.join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"),
);
const mcp = JSON.parse(
  await readFile(path.join(pluginRoot, ".mcp.json"), "utf8"),
);
const marketplace = JSON.parse(
  await readFile(
    path.join(projectRoot, ".agents", "plugins", "marketplace.json"),
    "utf8",
  ),
);

assert.equal(manifest.name, path.basename(pluginRoot));
assert.match(manifest.version, /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/);
assert.equal(manifest.skills, "./skills/");
assert.equal(manifest.mcpServers, "./.mcp.json");
assert.ok(Array.isArray(manifest.interface?.defaultPrompt));
assert.ok(manifest.interface.defaultPrompt.length > 0);
assert.ok(manifest.interface.defaultPrompt.length <= 3);
for (const prompt of manifest.interface.defaultPrompt)
  assert.ok(typeof prompt === "string" && prompt.length <= 128);

const server = mcp.mcpServers?.fify;
assert.equal(server?.command, "node");
assert.deepEqual(server?.args, ["./server/dist/server.js"]);

const entry = marketplace.plugins?.find((item) => item.name === "fify");
assert.equal(entry?.source?.source, "local");
assert.equal(entry?.source?.path, "./plugins/fify");
assert.equal(entry?.policy?.installation, "AVAILABLE");
assert.ok(["ON_INSTALL", "ON_USE"].includes(entry?.policy?.authentication));
assert.equal(entry?.category, "Productivity");

if (process.argv.includes("--require-bundle"))
  await access(path.join(pluginRoot, "server", "dist", "server.js"));

console.log(
  "Validated the Fify Codex plugin manifest, MCP config, and marketplace entry.",
);
