---
TYPE: issue
TITLE: "[governance] Dual build (plugin + library) + the release/<version>/ snapshot"
LABELS: type:tech-debt, severity:P1, area:governance, area:registry, needs-triage
WP: WP-14
---

## Summary

After the gate (issue-01) is green and the version is bumped (issue-02), **build everything — plugin
and library together — and write the immutable `release/<version>/` snapshot** (the "new version
subfolder"), including the validation report and a `release-manifest.json`.

## Source

[`../../08-release-process.md`](../../08-release-process.md) (release steps + snapshot contents).

## Severity & impact

**P1.** This produces the actual release artifacts and the auditable, restorable record per version.

## Current state & why the gap exists

Build blocks exist (`build`, `registry:build`, `manifest`, `skills:build`) but nothing assembles a
coordinated, versioned release artifact; there's no `release/` folder.

## Proposed solution

- **Build (plugin + library):** `pnpm build` (packages → `dist`) · `registry:build` (shadcn → hostable
  JSON) · `manifest` + context + component index + A2UI catalog · `skills:build` (multi-harness) ·
  package the plugin bundle.
- **Snapshot** → `release/<version>/`:
  - `release-manifest.json` — version, git SHA, date, per-package + plugin versions, **checksums**,
    asset list.
  - `validation-report.md` — from issue-01 (proof it was validated).
  - `RELEASE_NOTES.md` + `CHANGELOG.md`.
  - `registry/` (built shadcn JSON) · `plugin/` (bundle) · `ground-truth/` (manifest + context +
    component index + A2UI catalog).
  - **Library:** `npm pack` tarballs (small, installable, checksummed) — **not** raw `dist/`/node_modules.
- Add `.gitattributes`/`.gitignore` discipline so the snapshot stores the **record + distributable**,
  not transient build junk (per the design note).

## Affected files

- [ ] `scripts/release-snapshot.mjs` (assemble `release/<version>/`)
- [ ] `release/` folder convention + `.gitignore` rules
- [ ] `package.json` (`release:build`, `release:snapshot` scripts)

## Acceptance criteria

- [ ] A release produces `release/<version>/` with the manifest, validation report, notes, CHANGELOG,
      built registry JSON, plugin bundle, ground-truth, and library tarballs — all checksummed.
- [ ] The snapshot contains **both** the plugin and the library (the coordinated release).
- [ ] No `node_modules`/transient build output committed; the snapshot is reproducible from the tag.

## Test to add

A dry-run snapshot on a fixture version → assert the expected files exist + checksums match the built
artifacts.

## Risks / ripple effects

- Snapshot size — store tarballs + records, not raw trees (design note). Keep it auditable, not a cache.

## References

- `../../08-release-process.md` (snapshot contents + design note); `registry:build`/`manifest`/`skills:build`.
