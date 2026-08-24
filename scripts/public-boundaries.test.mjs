import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import path from "node:path";

const projectRoot = process.cwd();
const supportedPackages = new Set([
  "@fify/a2ui",
  "@fify/core",
  "@fify/react",
]);

test("supported package manifests declare their prerelease stability", async () => {
  for (const packageName of supportedPackages) {
    const directory = packageName.slice("@fify/".length);
    const manifest = JSON.parse(
      await readFile(
        path.join(projectRoot, "packages", directory, "package.json"),
        "utf8",
      ),
    );
    assert.equal(manifest.name, packageName);
    assert.equal(manifest.fify?.stability, "supported-prerelease");
    assert.equal(manifest.publishConfig?.access, "public");
  }
});

test("evaluation tooling remains private", async () => {
  const manifest = JSON.parse(
    await readFile(
      path.join(projectRoot, "packages", "evals", "package.json"),
      "utf8",
    ),
  );
  assert.equal(manifest.name, "@fify/evals");
  assert.equal(manifest.private, true);
  assert.equal(manifest.publishConfig, undefined);
});

test("the minimal starter imports only supported Fify packages", async () => {
  const source = (
    await Promise.all([
      readFile(
        path.join(projectRoot, "examples/minimal-react/app/page.tsx"),
        "utf8",
      ),
      readFile(
        path.join(
          projectRoot,
          "examples/minimal-react/app/api/generate/route.ts",
        ),
        "utf8",
      ),
    ])
  ).join("\n");
  const imports = [...source.matchAll(/from\s+["'](@fify\/[^"']+)["']/g)].map(
    (match) => match[1],
  );

  assert.deepEqual([...new Set(imports)].sort(), [
    "@fify/a2ui",
    "@fify/core",
    "@fify/core/openai",
    "@fify/react",
  ]);
  for (const packageName of imports)
    assert.ok(
      supportedPackages.has(packageName.split("/").slice(0, 2).join("/")),
      `${packageName} is not a supported application import`,
    );
});
