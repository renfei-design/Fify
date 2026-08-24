# Governance

Fify is currently maintainer-led while the public API is being stabilized.

## Decision model

- Small fixes, tests, documentation, and examples are decided through ordinary review.
- Public contract changes require an issue or RFC that explains the user problem, compatibility impact, alternatives, and migration path.
- Security boundaries, model trust boundaries, action authorization, and release gates require maintainer approval.
- Decisions should be recorded in code, documentation, an ADR, or an accepted RFC—not left only in chat.

## Roles

- **Contributors** propose changes and participate in review.
- **Reviewers** have demonstrated sustained judgment in a project area and may approve changes in that area.
- **Maintainers** manage releases, security reports, governance, and the stable public contract.

Role changes are based on sustained contribution, sound review judgment, respect for project boundaries, and community conduct. A public maintainer list and nomination process must be added before the first stable release.

## Compatibility

Packages and APIs explicitly marked experimental may change between prereleases. Stable APIs require documented deprecation and migration guidance before removal. The initial public package boundary will be finalized before registry publication.

## Releases

No package is published solely because the code builds. A release must pass the documented quality gates, package-consumer verification, browser smoke tests, security review appropriate to its scope, and an explicit maintainer approval.
