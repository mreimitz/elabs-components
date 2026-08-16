---
TYPE: issue
TITLE: "[governance] Coordinated versioning — Changesets locked group (library + plugin, one version)"
LABELS: type:tech-debt, severity:P1, area:governance, needs-triage
WP: WP-14
---

## Summary

Adopt **Changesets** with a **locked/fixed group** so every `@qlik-coe-emea/qlabs-components-*` package **and** the plugin
version **together** at one SemVer, with a generated CHANGELOG — ending the hand-synced `0.1.0`. This is
the "always release plugin + library together" requirement at the versioning layer. (Overlaps
enterprise-gap WP-07 issue-01; this is the release-pipeline-specific cut.)

## Source

[`../../08-release-process.md`](../../08-release-process.md) (versioning model); WP-07.

## Severity & impact

**P1.** Without coordinated versioning there's no coherent "release" — consumers can't pin the system,
and the plugin/library can drift apart in version. Locking them is what makes a single release number
meaningful.

## Current state & why the gap exists

No Changesets; all packages + plugin hand-set to `0.1.0`; no CHANGELOG. Plugin version is maintained
separately from the library.

## Proposed solution

- Add `@changesets/cli`; configure a **fixed group** covering all publishable `@qlik-coe-emea/qlabs-components-*` packages **and
  a hook that bumps the plugin** (`.claude-plugin/plugin.json` + `marketplace.json`) to the same version
  (Changesets doesn't manage non-package files — add a small post-version script to sync the plugin +
  marketplace version from the bumped library version).
- Contributors add a changeset per change (CI gate: package-affecting PRs require one — WP-07/WP-10).
- `changeset version` → bump the locked group + generate per-package + root **CHANGELOG**.
- Decide publish target: internal npm registry vs tarballs-in-snapshot (packages are `private:true`
  today) — record the decision; keep `publishConfig.exports` pointing at `dist`.

## Affected files

- [ ] `.changeset/config.json` (fixed group) + `.changeset/*` entries
- [ ] `scripts/sync-plugin-version.mjs` (plugin + marketplace ← system version)
- [ ] root + per-package `CHANGELOG.md` (generated)
- [ ] `package.json` scripts (`changeset`, `version`, `release`)

## Acceptance criteria

- [ ] `changeset version` bumps **all** `@qlik-coe-emea/qlabs-components-*` packages **and** the plugin/marketplace to the **same**
      version; CHANGELOG generated.
- [ ] A package-affecting PR without a changeset fails CI (coordinate WP-07/WP-10).
- [ ] Plugin version == system version is enforced (also checked in the gate, issue-01 F).

## Test to add

A dry-run `changeset version` on a fixture changeset → assert every package + plugin + marketplace land
on one version and the CHANGELOG updates.

## Risks / ripple effects

- Plugin/marketplace are non-npm files — the sync script must run after `changeset version` (and be
  covered by the gate's version-match check). Don't let them drift.

## References

- `../../08-release-process.md`; WP-07 issue-01 (Changesets); WP-10 (changeset CI gate).
