# Release process

Fify uses a deliberate release-candidate process because the repository contains provider integration, generated plugin assets, and public packages.

## 1. Prepare the candidate

- Work from a clean `main` branch.
- Update `CHANGELOG.md` and package versions together.
- Keep `.env.local`, generated plugin servers, build output, test artifacts, and local databases untracked.
- Generate the portable plugin from its canonical sources with `pnpm plugin:bundle`.

## 2. Run the gates

```bash
pnpm install --frozen-lockfile
pnpm check:history
pnpm audit --prod
pnpm check
pnpm test:e2e
```

`check:history` examines tracked paths and patch history for common credential formats, private-key material, local absolute paths, databases, and generated output. It complements review; it cannot prove that arbitrary prose, images, or domain-specific configuration are safe.

## 3. Review the exact payload

Before an external push, record:

- the full commit SHA and branch;
- the destination owner and repository;
- whether the remote is new or has history to preserve;
- the tracked file count and largest tracked files;
- current-tree and history safety results;
- dependency audit, build, test, package, plugin, and browser results.

Inspect the screenshots manually and use only synthetic, public, or isolated data.

## 4. Publish deliberately

Obtain explicit maintainer approval for that exact commit and destination. Prefer a normal fast-forward push. Do not force-push over an existing remote history to make a release easier.

After publication, fetch from the public remote and confirm that the remote SHA, tree, README, license, repository visibility, and CI result match the approved candidate.
