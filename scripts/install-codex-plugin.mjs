import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parseDesktopAppServerStart } from "./verify-codex-host.mjs";

const execute = promisify(execFile);

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const pluginRoot = path.join(projectRoot, "plugins", "fify");
const serverRoot = path.join(pluginRoot, "server");
const bundledServer = path.join(
  projectRoot,
  "apps",
  "mcp-app",
  "dist",
  "plugin-server.mjs",
);
const installedServer = path.join(serverRoot, "dist", "server.mjs");
const dryRun = process.argv.includes("--dry-run");
const bundleOnly = process.argv.includes("--bundle-only");
const allowRunningHost = process.argv.includes("--allow-running-host");

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

async function assertDesktopIsStoppedBeforeInstall() {
  if (bundleOnly || allowRunningHost) return;
  if (dryRun) {
    console.log(
      "\n> Refuse installation if the ChatGPT/Codex desktop MCP host is running.",
    );
    return;
  }
  if (process.platform !== "darwin") return;
  const { stdout } = await execute("ps", ["-axo", "lstart=,command="]);
  if (parseDesktopAppServerStart(stdout) == null) return;
  throw new Error(
    [
      "Fify installation stopped before changing the active plugin.",
      "The ChatGPT/Codex desktop MCP host is still running and cannot hot-reload a replaced plugin bundle.",
      "Fully quit the desktop app with Command-Q, run `pnpm codex:install` from Terminal, then reopen the app and create a brand-new task.",
      "Use `--allow-running-host` only for controlled diagnostics that will be followed by a full restart.",
    ].join("\n"),
  );
}

console.log("Preparing the portable Fify Codex plugin…");
await run("corepack", ["pnpm", "plugin:build"]);
if (!dryRun) {
  await rm(serverRoot, { recursive: true, force: true });
  await mkdir(path.dirname(installedServer), { recursive: true });
  await copyFile(bundledServer, installedServer);
}
await run("corepack", [
  "pnpm",
  "--filter",
  "@fify/mcp-app",
  "exec",
  "node",
  "scripts/smoke-plugin-bundle.mjs",
  pluginRoot,
]);
await run("node", ["scripts/validate-codex-plugin.mjs", "--require-bundle"]);

if (!bundleOnly) {
  await assertDesktopIsStoppedBeforeInstall();
  if (await marketplaceIsConfigured())
    console.log("\n> Repository marketplace is already configured.");
  else await run("codex", ["plugin", "marketplace", "add", projectRoot]);
  await run("codex", ["plugin", "add", "fify@personal"]);
  await run("codex", ["mcp", "get", "fify"]);
  console.log(
    [
      "\nFify's files are installed, but the running Codex MCP host is not refreshed by opening a new task.",
      "Fully quit ChatGPT/Codex and reopen it before testing Fify. Closing a window or returning to an existing task is not enough.",
      "After reopening, run `pnpm codex:verify-host` from this repository, then create a brand-new tagged task. This preflight must pass and the new desktop task must mount before Fify is accepted as ready.",
    ].join("\n"),
  );
} else {
  console.log("\nPortable plugin bundle is ready in plugins/fify/server.");
}
