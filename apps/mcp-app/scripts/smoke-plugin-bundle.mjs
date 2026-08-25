import assert from "node:assert/strict";
import { constants } from "node:fs";
import { access, chmod, copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const sourcePluginRoot = process.argv[2];
assert.ok(sourcePluginRoot, "Pass the bundled plugin root path.");
const liveProfile = process.argv.includes("--live-profile");

const sourceBundle = path.join(
  path.resolve(sourcePluginRoot),
  "server",
  "dist",
  "server.mjs",
);
const sourceLauncher = path.join(
  path.resolve(sourcePluginRoot),
  "scripts",
  "launch_fify_mcp",
);
await access(sourceLauncher, constants.X_OK);

const isolatedRoot = await mkdtemp(
  path.join(os.tmpdir(), "fify-plugin-smoke-"),
);
const isolatedBundle = path.join(isolatedRoot, "server", "dist", "server.mjs");
const isolatedLauncher = path.join(isolatedRoot, "scripts", "launch_fify_mcp");
await mkdir(path.dirname(isolatedBundle), { recursive: true });
await mkdir(path.dirname(isolatedLauncher), { recursive: true });
await copyFile(sourceBundle, isolatedBundle);
await copyFile(sourceLauncher, isolatedLauncher);
await chmod(isolatedLauncher, 0o755);

const transport = new StdioClientTransport({
  command: "./scripts/launch_fify_mcp",
  args: ["./server/dist/server.mjs"],
  cwd: isolatedRoot,
  env: {
    CODEX_MCP_NODE_PATH: process.execPath,
    PATH: "/usr/bin:/bin",
  },
  stderr: "pipe",
});
const client = new Client(
  { name: "fify-plugin-bundle-smoke", version: "1.0.0" },
  { capabilities: {} },
);
let serverStderr = "";
transport.stderr?.setEncoding("utf8");
transport.stderr?.on("data", (chunk) => {
  serverStderr += chunk;
});

const startedAt = performance.now();
try {
  await client.connect(transport);
  const tools = await client.listTools();
  const renderer = tools.tools.find(
    (tool) => tool.name === "render_information_ui",
  );
  assert.ok(renderer, "The bundled server must expose render_information_ui.");
  assert.equal(
    renderer._meta?.ui?.resourceUri,
    "ui://fify/information-ui-v9.html",
  );
  const readyAt = performance.now();

  const result = await client.callTool({
    name: "render_information_ui",
    arguments: {
      version: "1.0",
      originalRequest: "Compare a pilot and phased rollout.",
      groundedAnswer:
        "A pilot limits exposure; a phased rollout balances speed and control.",
      locale: "en-US",
      sections: [
        {
          id: "sec_comparison",
          title: "Rollout options",
          body: "Compare the two grounded options.",
          sourceIds: [],
          items: [
            {
              id: "item_pilot",
              label: "Pilot",
              value: "Lower exposure",
              detail: "Start with one team.",
              sourceIds: [],
            },
            {
              id: "item_phased",
              label: "Phased",
              value: "Balanced",
              detail: "Expand in controlled waves.",
              sourceIds: [],
            },
          ],
        },
      ],
      sources: [],
      suggestedRefinements: [],
    },
  });
  const renderedAt = performance.now();
  assert.notEqual(result.isError, true);
  assert.equal(result.structuredContent?.state, "complete");
  assert.ok(
    Array.isArray(result.structuredContent?.frames) &&
      result.structuredContent.frames.length > 0,
    "The bundled renderer must return UI frames.",
  );

  const briefing = await client.callTool({
    name: "render_information_ui",
    arguments: {
      version: "1.0",
      originalRequest:
        "Create an executive briefing for leadership from these results.",
      groundedAnswer:
        "Growth is holding, but enterprise delivery is now the constraint.",
      locale: "en-US",
      sections: [
        {
          id: "briefing_summary",
          title:
            "Growth is holding, but enterprise delivery is now the constraint",
          body: "Pipeline remains healthy while delivery capacity delays revenue recognition.",
          sourceIds: [],
          items: [],
        },
        {
          id: "executive_signals",
          title: "Executive signals",
          body: "The current operating snapshot.",
          sourceIds: [],
          items: [
            {
              id: "revenue_outlook",
              label: "Revenue outlook",
              value: "On plan",
              detail: "Demand remains stable.",
              sourceIds: [],
            },
            {
              id: "delivery_backlog",
              label: "Enterprise backlog",
              value: "+18%",
              detail: "Implementation starts are slipping.",
              sourceIds: [],
            },
          ],
        },
        {
          id: "decision_required",
          title: "Decision required",
          body: "Approve a 90-day capacity plan.",
          sourceIds: [],
          items: [
            {
              id: "recommendation",
              label: "Recommendation",
              value: "Approve",
              detail: "Begin this quarter.",
              sourceIds: [],
            },
            {
              id: "accountable_owner",
              label: "Accountable owner",
              value: "COO",
              detail: "Own staffing tradeoffs.",
              sourceIds: [],
            },
          ],
        },
      ],
      sources: [],
      suggestedRefinements: [],
    },
  });
  assert.notEqual(briefing.isError, true);
  assert.equal(briefing.structuredContent?.state, "complete");
  const briefingComplete = briefing.structuredContent?.frames?.find(
    (frame) => frame.type === "complete",
  );
  assert.deepEqual(
    briefingComplete?.experience?.representation?.blueprintIds,
    ["briefing"],
  );
  assert.equal(
    briefingComplete?.experience?.screen?.contextLabel,
    "Executive briefing",
  );

  if (liveProfile) {
    const profileStartedAt = performance.now();
    const profile = await client.callTool({
      name: "render_information_ui",
      arguments: {
        version: "1.0",
        originalRequest: "Who is Steve Jobs?",
        groundedAnswer:
          "Steve Jobs was an American entrepreneur and product leader who co-founded Apple.",
        locale: "en-US",
        profileSubject: "Steve Jobs",
        sections: [
          {
            id: "identity",
            title: "Steve Jobs",
            body: "An American entrepreneur and product leader.",
            sourceIds: [],
            items: [
              {
                id: "known-for",
                label: "Known for",
                value: "Apple co-founder",
                detail:
                  "He helped shape several generations of personal technology.",
                sourceIds: [],
              },
              {
                id: "lived",
                label: "Lived",
                value: "1955–2011",
                detail: "Born February 24, 1955; died October 5, 2011.",
                sourceIds: [],
              },
            ],
          },
        ],
        sources: [],
        suggestedRefinements: [],
      },
    });
    assert.notEqual(profile.isError, true);
    const profileFrames = profile.structuredContent?.frames;
    assert.ok(Array.isArray(profileFrames));
    const complete = profileFrames.find((frame) => frame.type === "complete");
    assert.ok(complete, "The profile render must complete.");
    assert.deepEqual(complete.experience?.representation?.blueprintIds, [
      "profile-reference",
    ]);
    assert.ok(
      complete.experience?.nodes?.some(
        (node) =>
          node.type === "Image" &&
          node.mediaRole === "identity" &&
          String(node.value).includes("upload.wikimedia.org"),
      ),
      "The live profile render must contain an attributed Wikimedia portrait.",
    );
    console.log(
      `Live profile media smoke passed in ${Math.round(performance.now() - profileStartedAt)} ms.`,
    );
  }

  console.log(
    `Portable Fify MCP smoke passed: startup ${Math.round(readyAt - startedAt)} ms, render ${Math.round(renderedAt - readyAt)} ms.`,
  );
} catch (error) {
  if (serverStderr.trim()) console.error(serverStderr.trim());
  throw error;
} finally {
  await client.close().catch(() => {});
  await rm(isolatedRoot, { recursive: true, force: true });
}
