import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const checkHistory = process.argv.includes("--history");
const excludedDirectories = new Set([
  ".git",
  ".next",
  ".next-build",
  ".next-dev",
  ".next-e2e",
  ".pnpm-store",
  ".turbo",
  "coverage",
  "dist",
  "eval-results",
  "node_modules",
  "playwright-report",
  "test-results",
]);
const excludedFiles = new Set([".DS_Store", ".env.local"]);
const excludedPaths = new Set(["plugins/fify/server"]);

const secretPatterns = [
  ["OpenAI-style secret", /\bsk-[A-Za-z0-9_-]{16,}\b/g],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/g],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
];
const placeholderPattern = /(example|placeholder|test|your[-_ ]?key|redacted)/i;
const forbiddenPathPatterns = [
  ["local environment file", /(^|\/)\.env(?:\..+)?$/],
  ["credential material", /\.(?:key|pem|p12|pfx)$/i],
  ["runtime database", /\.(?:db|sqlite|sqlite3)$/i],
  ["operating-system metadata", /(^|\/)\.DS_Store$/],
  [
    "dependency or build output",
    /(^|\/)(?:node_modules|\.next[^/]*|\.turbo|dist|coverage|eval-results|test-results)(\/|$)/,
  ],
];

function hasGitRepository() {
  try {
    return (
      execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim() === "true"
    );
  } catch {
    return false;
  }
}

function walk(directory, prefix = "") {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    if (excludedFiles.has(entry.name) || entry.name.endsWith(".tsbuildinfo"))
      continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (excludedPaths.has(relative)) continue;
    if (entry.isDirectory()) files.push(...walk(absolute, relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
}

function trackedGitlinks() {
  return execFileSync("git", ["ls-files", "--stage"], {
    cwd: root,
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .filter((line) => line.startsWith("160000 "))
    .map((line) => line.split("\t")[1])
    .filter(Boolean);
}

function inspectPaths(paths, scope) {
  const findings = [];
  for (const file of paths) {
    for (const [label, pattern] of forbiddenPathPatterns) {
      if (pattern.test(file) && file !== ".env.example") {
        findings.push(`${scope}: ${label}: ${file}`);
      }
    }
  }
  return findings;
}

function inspectContent(file, content, scope) {
  const findings = [];
  if (content.includes("\0")) return findings;
  if (
    /\/Users\/[^/\s]+\/(?:Desktop|Documents)|[A-Za-z]:\\Users\\/i.test(content)
  ) {
    findings.push(`${scope}: local absolute path: ${file}`);
  }
  for (const [label, pattern] of secretPatterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      if (!placeholderPattern.test(match[0]))
        findings.push(`${scope}: ${label}: ${file}`);
    }
  }
  return findings;
}

function inspectCurrentTree(files) {
  const findings = inspectPaths(files, "tree");
  for (const file of files) {
    const absolute = path.join(root, file);
    if (!statSync(absolute).isFile() || statSync(absolute).size > 2_000_000)
      continue;
    findings.push(
      ...inspectContent(file, readFileSync(absolute, "utf8"), "tree"),
    );
  }
  return findings;
}

function inspectHistory() {
  const names = execFileSync(
    "git",
    ["log", "--all", "--name-only", "--pretty=format:"],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    },
  )
    .split(/\r?\n/)
    .filter(Boolean);
  const patch = execFileSync(
    "git",
    ["log", "--all", "-p", "--full-history", "--no-ext-diff"],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  return [
    ...inspectPaths([...new Set(names)], "history"),
    ...inspectContent("Git patch history", patch, "history"),
  ];
}

const gitRepository = hasGitRepository();
if (checkHistory && !gitRepository) {
  console.error(
    "Public history check requires a Git repository. Restore or initialize .git first.",
  );
  process.exit(2);
}

const gitFiles = gitRepository ? trackedFiles() : [];
const files = gitFiles.length > 0 ? gitFiles : walk(root);
const findings = inspectCurrentTree(files);
if (gitFiles.length > 0) {
  for (const gitlink of trackedGitlinks()) {
    findings.push(`tree: embedded Git repository: ${gitlink}`);
  }
}
if (checkHistory) findings.push(...inspectHistory());

if (findings.length) {
  console.error(
    `Public safety check failed with ${findings.length} finding(s):`,
  );
  for (const finding of [...new Set(findings)]) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  `Public safety check passed for ${files.length} ${gitFiles.length > 0 ? "tracked" : "candidate"} files${checkHistory ? " and Git history" : ""}.`,
);
