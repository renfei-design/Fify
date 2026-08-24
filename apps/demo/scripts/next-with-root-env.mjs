import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import nextEnv from "@next/env";

const demoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const projectRoot = path.resolve(demoRoot, "../..");
const nextBin = path.join(demoRoot, "node_modules/next/dist/bin/next");
const nextArgs = process.argv.slice(2);
const { loadEnvConfig } = nextEnv;
const nextProcessEnv = { ...process.env };

if (
  !nextProcessEnv.FIFY_NEXT_DIST_DIR &&
  (nextArgs[0] === "build" || nextArgs[0] === "start")
) {
  nextProcessEnv.FIFY_NEXT_DIST_DIR = ".next-build";
}

loadEnvConfig(projectRoot, nextArgs[0] === "dev");

const child = spawn(process.execPath, [nextBin, ...nextArgs], {
  cwd: demoRoot,
  env: nextProcessEnv,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
