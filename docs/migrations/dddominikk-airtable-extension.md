# Migration audit: `dddominikk/airtable-extension`

Tracking issue: [attention-spa/airtable#7](https://github.com/attention-spa/airtable/issues/7)

Source repository: `dddominikk/airtable-extension`

## Audited source state

- default branch: `main`
- default commit: `ed28dfa25be0950a31dc0d07d178270eda8fe4f6`
- default tree: `ec5fa12f8e32981c05f7fae415b1210af2f1e610`
- divergent development branch: `scripting` at `52b3712d6cbdb932d83dde074bfc0267b06a6f4d`
- scripting tree: `1efefdab41b3453c565e7e5b946d3a980d6c2a2b`
- `scripting` is eight commits ahead of its merge base and three commits behind `main`
- releases: none
- tags: none
- repository-authored `.github` workflows: none

## Decision

This repository is a legacy Airtable Blocks/custom-extension experiment. It is not promoted into the active `attention-spa/airtable` formula/library surface.

Useful source-level implementation is preserved inertly under `legacy/airtable-extension/`. The target deliberately does not resurrect the old dependency graph or claim the code is supported by current Airtable Blocks APIs.

### Preserved default-branch material

`legacy/airtable-extension/main/` retains the useful source-level artifacts from the audited default branch:

- Airtable block/base identity metadata;
- the block entry manifest and dependency manifest;
- the React/Airtable Blocks entrypoint;
- `CodeContainer`, `CollapsibleBox`, `Container`, `ObjectViewer`, and `TabSelector` component experiments;
- the generic TypeScript property-renaming utility;
- the recursive 50-record Airtable create/update batching helper.

### Preserved `scripting` branch material

`legacy/airtable-extension/scripting-delta/` preserves the branch-specific work that never reached `main`, including:

- the JSDoc/Airtable field-type typedef experiment corresponding to source issue #2;
- the generalized `RenameTypeProps` / runtime `RenameProps` utility;
- the branch versions of `CodeContainer` and `TabSelector` that consume that type utility;
- package/TypeScript context needed to understand the experiment.

This is reference material, not an active target package.

## Deliberately not copied

- `package-lock.json` from either branch: obsolete dependency-resolution state for an unsupported Airtable Blocks/React/TypeScript stack.
- legacy ESLint/Prettier configuration: scaffolding rather than unique Airtable behavior.
- generated/dependency installation output: not source.
- `src/components/up.js`: **not copied because the audited source contains a plaintext GitHub personal-access-token-shaped credential literal.** The credential value is intentionally not reproduced here. The file is treated as unsafe historical scratch code rather than useful canonical implementation. Any credential represented by that literal should be considered compromised and revoked if it was ever live.

The unsafe script's high-level idea was to turn Airtable text output into temporary private GitHub Gist-backed attachment URLs, update Airtable attachment fields, then delete the temporary Gist. That pattern is not promoted: it couples Airtable scripting to a broad external credential and temporary external storage, and the historical implementation has unresolved correctness/security concerns.

## Issue and pull-request disposition

### Source issue #2 — `JSDoc generics for Airtable scripting environments`

The issue has no body or comments, but the `scripting` branch provides its implementation context. The branch experiment is preserved under `legacy/airtable-extension/scripting-delta/`; no new active target backlog item is created because the old issue does not specify current user-visible requirements or acceptance criteria.

### Source PR #1 — `update`

Already merged historically into the source and reflected by the audited repository state; no separate migration action is required.

### Source PR #3 — Dependabot `cross-spawn` update

Dependency-only maintenance for the obsolete legacy toolchain. It was closed as obsolete rather than migrated.

## Retirement gate

The source repository is retirement-ready when:

1. the legacy/reference migration is merged into `attention-spa/airtable`;
2. source issue #2 is closed with a pointer to this preserved branch context;
3. source Dependabot PR #3 is closed as obsolete;
4. final source readback confirms no other branch, issue, PR, release, tag, or workflow contains unaccounted useful state.

## Final retirement audit — 2026-09-15

All repository-retirement gates are satisfied.

- Target PR #8 was squash-merged as `b1a0e21954f11da1f8433bd465fa6bd6df044f91` and closed `attention-spa/airtable#7`.
- Target review confirmed the credential-shaped literal from the unsafe source scratch file did **not** cross into the target migration.
- Source issue #2 is closed `not_planned` with a pointer to the preserved `scripting` implementation evidence.
- Source Dependabot PR #3 is closed as obsolete. Its branch still exists as GitHub ref residue; the connected migration tooling cannot delete branch refs, and the branch contains only the already-dispositioned dependency update.
- Source `main` remains the audited `ed28dfa25be0950a31dc0d07d178270eda8fe4f6` / tree `ec5fa12f8e32981c05f7fae415b1210af2f1e610`.
- The surviving `scripting` branch is fully accounted for by the preserved `scripting-delta` material and source issue disposition.
- There are no open source issues or pull requests, no repository-authored workflows, no releases, and no tags.
- The target changes are confined to inert `legacy/airtable-extension/**` reference material plus this migration record; no active Airtable/formula runtime behavior was changed.

**Status: `dddominikk/airtable-extension` is repository deletion-ready.** The remaining source branch refs do not contain unaccounted active work or required provenance.

Source deletion is a separate maintainer action. No active target runtime depends on this legacy snapshot.
