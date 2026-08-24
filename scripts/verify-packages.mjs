import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);
const projectRoot = process.cwd();
const pnpmCli = process.env.npm_execpath;
const pnpmCommand = pnpmCli
  ? { file: process.execPath, prefix: [pnpmCli] }
  : { file: "corepack", prefix: ["pnpm"] };

async function runPnpm(args, cwd) {
  try {
    return await execute(pnpmCommand.file, [...pnpmCommand.prefix, ...args], {
      cwd,
      env: {
        ...process.env,
        CI: "1",
        COREPACK_HOME:
          process.env.COREPACK_HOME ?? path.join(tmpdir(), "fify-corepack"),
      },
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    const stdout = typeof error.stdout === "string" ? error.stdout.trim() : "";
    const stderr = typeof error.stderr === "string" ? error.stderr.trim() : "";
    throw new Error(
      [`pnpm ${args.join(" ")} failed`, stdout, stderr]
        .filter(Boolean)
        .join("\n"),
    );
  }
}

const packageRoot = path.join(projectRoot, "packages");
const verificationStore = process.env.FIFY_VERIFY_STORE
  ? path.resolve(process.env.FIFY_VERIFY_STORE)
  : path.join(tmpdir(), "fify-package-store-v11");
const packageDirectories = (await readdir(packageRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(packageRoot, entry.name));
const packages = [];
for (const directory of packageDirectories) {
  const manifest = JSON.parse(
    await readFile(path.join(directory, "package.json"), "utf8"),
  );
  if (!manifest.private) packages.push({ directory, manifest });
}
if (packages.length === 0)
  throw new Error("No public packages were found to verify.");

const verificationRoot = await mkdtemp(
  path.join(tmpdir(), "fify-package-verification-"),
);
const tarballDirectory = path.join(verificationRoot, "tarballs");
const consumerDirectory = path.join(verificationRoot, "consumer");
await mkdir(tarballDirectory);
await mkdir(consumerDirectory);

try {
  const tarballs = new Map();
  for (const item of packages) {
    const before = new Set(await readdir(tarballDirectory));
    await runPnpm(
      ["pack", "--pack-destination", tarballDirectory],
      item.directory,
    );
    const created = (await readdir(tarballDirectory)).filter(
      (file) => !before.has(file),
    );
    if (created.length !== 1) {
      throw new Error(
        `Expected one tarball for ${item.manifest.name}, found ${created.length}.`,
      );
    }
    const tarball = path.join(tarballDirectory, created[0]);
    const archive = await execute("tar", ["-tzf", tarball], {
      maxBuffer: 10 * 1024 * 1024,
    });
    const packedFiles = new Set(archive.stdout.trim().split(/\r?\n/));
    for (const required of ["package/README.md", "package/LICENSE"]) {
      if (!packedFiles.has(required)) {
        throw new Error(
          `${item.manifest.name} is missing ${required} from its tarball.`,
        );
      }
    }
    tarballs.set(item.manifest.name, tarball);
  }

  const dependencies = Object.fromEntries(
    [...tarballs.entries()].map(([name, tarball]) => [name, `file:${tarball}`]),
  );
  Object.assign(dependencies, {
    react: "19.2.3",
    "react-dom": "19.2.3",
  });
  const consumerManifest = {
    name: "fify-packed-package-consumer",
    version: "0.0.0",
    private: true,
    type: "module",
    packageManager: "pnpm@11.1.3",
    dependencies,
    devDependencies: {
      "@types/react": "19.2.3",
      "@types/react-dom": "19.2.3",
      typescript: "5.9.2",
    },
  };
  await writeFile(
    path.join(consumerDirectory, "package.json"),
    `${JSON.stringify(consumerManifest, null, 2)}\n`,
    "utf8",
  );
  const overrides = Object.fromEntries(
    [...tarballs.entries()].map(([name, tarball]) => [name, `file:${tarball}`]),
  );
  await writeFile(
    path.join(consumerDirectory, "pnpm-workspace.yaml"),
    `packages:\n  - "."\noverrides:\n${Object.entries(overrides)
      .map(([name, value]) => `  "${name}": "${value}"`)
      .join("\n")}\n`,
    "utf8",
  );

  const consumerSource = `import { reduceA2UIStream } from "@fify/a2ui";
import {
  createInformationUI,
  fifyCoreVersion,
  fifyInformationCatalogId,
  uiExperienceToA2UI,
  uiLanguageCatalog,
  uiLanguageFixture,
} from "@fify/core";
import { generateOpenAIInformationUI } from "@fify/core/openai";
import { createA2UIRenderer } from "@fify/react";

const universalSurface = reduceA2UIStream(uiExperienceToA2UI(uiLanguageFixture));
const a2uiSurface = reduceA2UIStream([{
  version: "v1.0",
  createSurface: {
    surfaceId: "packed-consumer",
    components: [{ id: "root", component: "Column", children: [] }],
  },
}]);
const supportedInformation = createInformationUI({
  version: "1.0",
  originalRequest: "Compare the packed package paths.",
  groundedAnswer: "The supported facade keeps application imports narrow.",
  locale: "en",
  sections: [{
    id: "paths",
    title: "Package paths",
    body: "Use the supported facade for application code.",
    items: [
      { id: "core", label: "Core", value: "Supported", detail: "Validated information compilation.", sourceIds: [] },
      { id: "internal", label: "Internals", value: "Experimental", detail: "Framework implementation packages.", sourceIds: [] },
    ],
    sourceIds: [],
  }],
  sources: [],
  suggestedRefinements: [],
}, { responseId: "packed-core", surfaceId: "packed-core-surface" });
const supportedSurface = reduceA2UIStream(supportedInformation.messages);
const PackedRenderer = createA2UIRenderer({
  catalogId: fifyInformationCatalogId,
  components: { Page: ({ children }) => children },
});

const checks = {
  packageCount: ${packages.length},
  coreVersion: fifyCoreVersion,
  coreCatalog: supportedSurface?.catalogId,
  coreRoot: supportedSurface?.components.root?.component,
  coreFallback: supportedInformation.fallbackText,
  supportedRendererFactory: typeof PackedRenderer,
  supportedOpenAIAdapter: typeof generateOpenAIInformationUI,
  universalCatalogSize: Object.keys(uiLanguageCatalog.components).length,
  universalLanguageVersion: uiLanguageFixture.version,
  universalRepresentationMode: uiLanguageFixture.representation.mode,
  universalRoot: universalSurface?.components.root?.component,
  a2uiRoot: a2uiSurface?.components.root?.component,
};
if (checks.packageCount !== 3 || checks.coreVersion !== "0.1.0" || checks.coreCatalog !== fifyInformationCatalogId || checks.coreRoot !== "Page" || checks.coreFallback !== "The supported facade keeps application imports narrow." || checks.supportedRendererFactory !== "function" || checks.supportedOpenAIAdapter !== "function" || checks.universalCatalogSize !== 35 || checks.universalLanguageVersion !== "4.0" || checks.universalRepresentationMode !== "open" || checks.universalRoot !== "Page" || checks.a2uiRoot !== "Column") {
  throw new Error("Packed packages loaded but failed their cross-package runtime assertions.");
}
console.log(JSON.stringify(checks));
`;
  await writeFile(
    path.join(consumerDirectory, "index.mjs"),
    consumerSource,
    "utf8",
  );
  await writeFile(
    path.join(consumerDirectory, "index.ts"),
    consumerSource,
    "utf8",
  );

  await runPnpm(
    [
      "install",
      "--prefer-offline",
      "--ignore-scripts",
      "--frozen-lockfile=false",
      "--store-dir",
      verificationStore,
    ],
    consumerDirectory,
  );
  const runtimeResult = await execute(process.execPath, ["index.mjs"], {
    cwd: consumerDirectory,
    maxBuffer: 10 * 1024 * 1024,
  });
  await runPnpm(
    [
      "exec",
      "tsc",
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "false",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "index.ts",
    ],
    consumerDirectory,
  );

  console.log(
    `Verified ${packages.length} packed public packages in an isolated consumer.`,
  );
  console.log(runtimeResult.stdout.trim());
} catch (error) {
  console.error(
    `Package verification workspace retained at ${verificationRoot}`,
  );
  throw error;
}
