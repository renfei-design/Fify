# Changelog

Notable user-facing and public-contract changes will be recorded here.

Fify has not published a registry release. Until prereleases begin, changes remain part of the unreleased development line.

## Unreleased

### Added

- Two explicit adoption paths: the Codex integration and browser chat.
- A focused getting-started guide for end users, evaluators, and local plugin maintainers.
- Community governance, support, and conduct policies.
- Three supported prerelease packages: `@fify/core`, `@fify/react`, and `@fify/a2ui`.
- A supported `@fify/core/openai` adapter and a minimal live React integration with strict answer and layout schemas.
- A portable Codex plugin bundle, one-command local installation, and repository-owned validation.
- Public-tree and Git-history safety checks for release candidates.

### Changed

- Consolidated the semantic compiler, grounding policy, provider gateway, and presentation language into `@fify/core`.
- Reduced the public framework from thirteen packages to three.
- Focused the browser product on one universal information interface rather than separate weather, triage, and benchmark products.
- Browser-chat onboarding now puts the session-only API key in Settings instead of the conversation composer.

### Fixed

- Narrow comparison layouts stack at mobile widths.
- Development, production builds, and Playwright use isolated Next.js output directories.
- Production dependency audit findings were resolved.
