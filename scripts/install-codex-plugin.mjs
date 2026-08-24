import { rm } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const pluginRoot = path.join(projectRoot, "plugins", "fify");
const serverRoot = path.join(pluginRoot, "server");
const dryRun = process.argv.includes("--dry-run");
const bundleOnly = process.argv.includes("--bundle-only");

function display(file, args) {
  return [file, ...args]
    .map((value) => (/\s/.test(value) ? JSON.stringify(value) : value))
    .join(" ");
}

async function run(file, args) {
  console.log(`\n> ${display(file, args)}`);
  if (dryRun) return;
  await new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `${file} failed${signal ? ` with ${signal}` : ` with exit code ${code}`}.`,
          ),
        );
    });
  });
}

async function marketplaceIsConfigured() {
  if (dryRun) return false;
  return new Promise((resolve) => {
    const child = spawn("codex", ["plugin", "marketplace", "list", "--json"], {
      cwd: projectRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "inherit"],
    });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", () => resolve(false));
    child.once("exit", (code) => {
      if (code !== 0) return resolve(false);
      try {
        const payload = JSON.parse(output);
        resolve(
          payload.marketplaces?.some(
            (marketplace) => path.resolve(marketplace.root) === projectRoot,
          ) ?? false,
        );
      } catch {
        resolve(false);
      }
    });
  });
}

console.log("Preparing the portable Fify Codex plugin…");
await run("corepack", ["pnpm", "plugin:build"]);
if (!dryRun) await rm(serverRoot, { recursive: true, force: true });
await run("corepack", [
  "pnpm",
  "--config.inject-workspace-packages=true",
  "--filter",
  "@fify/mcp-app",
  "deploy",
  "--prod",
  serverRoot,
]);
await run("node", ["scripts/validate-codex-plugin.mjs", "--require-bundle"]);

if (!bundleOnly) {
  if (await marketplaceIsConfigured())
    console.log("\n> Repository marketplace is already configured.");
  else await run("codex", ["plugin", "marketplace", "add", projectRoot]);
  await run("codex", ["plugin", "add", "fify@personal"]);
  console.log(
    "\nFify is installed. Start a new Codex task, then ask normally or tag @Fify.",
  );
} else {
  console.log("\nPortable plugin bundle is ready in plugins/fify/server.");
}
