import assert from "node:assert/strict";
import test from "node:test";
import {
  desktopFreshness,
  hostVerificationEnvelope,
  parseDesktopAppServerStart,
} from "./verify-codex-host.mjs";

const desktopProcess =
  " 1054 Wed Aug 19 12:56:22 2026 /Applications/ChatGPT.app/Contents/Resources/codex -c features.code_mode_host=true app-server --analytics-default-enabled";

test("finds the primary ChatGPT desktop MCP host", () => {
  assert.equal(
    parseDesktopAppServerStart(desktopProcess),
    Date.parse("Wed Aug 19 12:56:22 2026"),
  );
  assert.equal(
    parseDesktopAppServerStart(
      "85776 Thu Aug 27 13:08:33 2026 /Applications/ChatGPT.app/Contents/Resources/codex app-server --listen stdio://",
    ),
    null,
  );
});

test("rejects a desktop host that predates the installed plugin", () => {
  const result = desktopFreshness({
    desktopStartedAt: Date.parse("Wed Aug 19 12:56:22 2026"),
    pluginInstalledAt: Date.parse("Thu Aug 27 13:18:19 2026"),
  });
  assert.equal(result.status, "stale");
  assert.match(result.message, /Command-Q/);
});

test("accepts only a desktop host started after installation", () => {
  assert.equal(
    desktopFreshness({
      desktopStartedAt: Date.parse("Thu Aug 27 13:20:00 2026"),
      pluginInstalledAt: Date.parse("Thu Aug 27 13:18:19 2026"),
    }).status,
    "fresh",
  );
});

test("host verification exercises the exact comparison scale that regressed", () => {
  assert.equal(hostVerificationEnvelope.sections.length, 6);
  assert.equal(hostVerificationEnvelope.media.length, 3);
  assert.equal(
    hostVerificationEnvelope.sections.every(
      (section) => section.items.length === 3,
    ),
    true,
  );
});
