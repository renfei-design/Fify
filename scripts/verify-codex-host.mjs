import { execFile, spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execute = promisify(execFile);

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const options = ["MacBook Neo", "MacBook Air", "MacBook Pro"];
const sourceIds = ["neo-source", "air-source", "pro-source"];
const sources = options.map((title, index) => ({
  id: sourceIds[index],
  title: `${title} test source`,
  url: `https://www.apple.com/${title.toLowerCase().replaceAll(" ", "-")}/specs/`,
}));
const criterion = (id, title, values) => ({
  id,
  title,
  body: `${title} comparison for installed-host verification.`,
  sourceIds,
  items: options.map((label, index) => ({
    id: `${id}-${index + 1}`,
    label,
    value: values[index],
    detail: `${title} detail for ${label}.`,
    sourceIds: [sourceIds[index]],
  })),
});

export const hostVerificationEnvelope = {
  version: "1.0",
  originalRequest: "Compare MacBook Neo, MacBook Air, and MacBook Pro.",
  locale: "en",
  groundedAnswer:
    "MacBook Air is the balanced default; MacBook Neo is the budget option; MacBook Pro is for sustained professional work.",
  sources,
  media: options.map((subject, index) => ({
    id: `product-${index + 1}`,
    role: "illustration",
    subject,
    alt: `${subject} product image`,
    caption: subject,
    sourceId: sourceIds[index],
    url: `https://www.apple.com/v/fify-host-check/images/${index + 1}.png`,
  })),
  sections: [
    criterion("verdict", "Verdict", [
      "Budget option",
      "Best default",
      "Professional option",
    ]),
    criterion("starting-price", "Starting price", [
      "Lowest",
      "Mid",
      "Highest",
    ]),
    criterion("memory", "Memory", ["Entry", "Balanced", "Highest ceiling"]),
    criterion("battery", "Battery", ["All day", "All day", "Longest"]),
    criterion("performance", "Performance", [
      "Everyday",
      "General",
      "Sustained",
    ]),
    criterion("tradeoffs", "Tradeoffs", [
      "Most constrained",
      "Balanced",
      "Heaviest",
    ]),
  ],
  suggestedRefinements: [],
};

const prompt = [
  "Do not browse, inspect files, or substitute a text UI.",
  "Call the Fify MCP tool render_information_ui exactly once with this exact nine-slot comparison payload:",
  JSON.stringify(hostVerificationEnvelope),
  "After the tool call, reply with HOST_TOOL_CALL_PASS. If the exact tool is absent or the call fails, reply with HOST_TOOL_CALL_FAIL.",
].join("\n");

const args = [
  "exec",
  "--ephemeral",
  "--json",
  "--sandbox",
  "read-only",
  "--ignore-rules",
  "-C",
  projectRoot,
  prompt,
];

async function main() {
  const desktop = await inspectDesktopFreshness();
  if (desktop.status !== "fresh") {
    console.error(`\n${desktop.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(desktop.message);

  const child = spawn("codex", args, {
    cwd: projectRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "inherit"],
  });

  let buffer = "";
  let sawFifyCall = false;
  let sawCompletedRun = false;
  let sawComparisonBlueprint = false;
  let sawPassMessage = false;

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    process.stdout.write(chunk);
    buffer += chunk;
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      inspectLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  });

  child.once("error", (error) => {
    console.error(`Could not start the Codex host verification: ${error.message}`);
    process.exitCode = 1;
  });

  child.once("exit", (code) => {
    if (buffer.trim()) inspectLine(buffer);
    if (
      code !== 0 ||
      !sawFifyCall ||
      !sawCompletedRun ||
      !sawComparisonBlueprint ||
      !sawPassMessage
    ) {
      console.error(
        "\nFify CLI verification failed. The desktop timestamp check passed, but Fify is not ready for desktop acceptance.",
      );
      process.exitCode = 1;
      return;
    }
    console.log(
      "\nFify preflight passed: the desktop host is newer than the installed bundle and a fresh Codex process completed the nine-slot comparison with the compare-decide blueprint. Final acceptance still requires a brand-new tagged desktop task to mount the widget.",
    );
  });

  function inspectLine(line) {
    if (!line.trim().startsWith("{")) return;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    const item = event.item;
    if (
      item?.type === "mcp_tool_call" &&
      item.server === "fify" &&
      item.tool === "render_information_ui"
    ) {
      sawFifyCall = true;
      if (
        event.type === "item.completed" &&
        item.error == null &&
        item.result?.structured_content?.state === "complete"
      ) {
        sawCompletedRun = true;
        const complete = item.result.structured_content.frames?.find(
          (frame) => frame.type === "complete",
        );
        sawComparisonBlueprint =
          complete?.experience?.representation?.blueprintIds?.includes(
            "compare-decide",
          ) === true &&
          complete?.experience?.representation?.slots?.length === 9;
      }
    }
    if (
      event.type === "item.completed" &&
      item?.type === "agent_message" &&
      item.text?.includes("HOST_TOOL_CALL_PASS")
    )
      sawPassMessage = true;
  }
}

export function parseDesktopAppServerStart(processList) {
  for (const line of processList.split("\n")) {
    if (
      !line.includes("/Applications/ChatGPT.app/Contents/Resources/codex") ||
      !line.includes("features.code_mode_host=true") ||
      !line.includes("app-server")
    )
      continue;
    const match = line.match(
      /^\s*(?:\d+\s+)?(\w{3}\s+\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+/,
    );
    if (!match) continue;
    const timestamp = Date.parse(match[1]);
    if (Number.isFinite(timestamp)) return timestamp;
  }
  return null;
}

export function desktopFreshness({ desktopStartedAt, pluginInstalledAt }) {
  if (desktopStartedAt == null)
    return {
      status: "missing",
      message:
        "ChatGPT/Codex desktop is not running or its primary app-server could not be identified. Open the desktop app before verifying Fify.",
    };
  if (desktopStartedAt <= pluginInstalledAt)
    return {
      status: "stale",
      message: `Fify desktop verification failed: the desktop MCP host started at ${new Date(desktopStartedAt).toLocaleString()}, before the installed Fify bundle at ${new Date(pluginInstalledAt).toLocaleString()}. Fully quit ChatGPT with Command-Q, reopen it, and rerun this command. Closing a window is not a restart.`,
    };
  return {
    status: "fresh",
    message: `Desktop freshness check passed: host ${new Date(desktopStartedAt).toLocaleString()} · Fify ${new Date(pluginInstalledAt).toLocaleString()}.`,
  };
}

async function inspectDesktopFreshness() {
  if (process.platform !== "darwin")
    return {
      status: "missing",
      message:
        "Desktop freshness verification is currently supported only on macOS.",
    };
  const [{ stdout: processes }, { stdout: mcp }] = await Promise.all([
    execute("ps", ["-axo", "lstart=,command="]),
    execute("codex", ["mcp", "get", "fify"]),
  ]);
  const cwd = mcp.match(/^\s*cwd:\s*(.+?)\/?\.?\s*$/m)?.[1];
  if (!cwd)
    return {
      status: "missing",
      message: "Fify is not registered in the Codex MCP inventory.",
    };
  let installed;
  try {
    installed = await stat(cwd);
  } catch (error) {
    return {
      status: "missing",
      message: `The registered Fify bundle could not be inspected: ${error.message}`,
    };
  }
  return desktopFreshness({
    desktopStartedAt: parseDesktopAppServerStart(processes),
    pluginInstalledAt: installed.mtimeMs,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
