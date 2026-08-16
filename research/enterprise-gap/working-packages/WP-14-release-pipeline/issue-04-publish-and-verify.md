---
TYPE: issue
TITLE: "[governance] release.yml workflow + /cut-release: publish (library+registry+plugin), verify, rollback"
LABELS: type:tech-debt, severity:P1, area:governance, area:registry, area:ai, needs-triage
WP: WP-14
---

## Summary

Tie it together: a **`release.yml` CI workflow** (and a local `/cut-release` mirror) that runs
**gate → version → build → snapshot → tag → publish → post-release verify**, updating **all registries
in lockstep** (npm/internal, the component registry, the plugin marketplace), plus a documented
**rollback**. This is the automation that makes the release a one-action, enforced process — not a human
checklist.

## Source

[`../../08-release-process.md`](../../08-release-process.md) (steps 4–7, automation, rollback).

## Severity & impact

**P1.** Without automation the process decays into manual steps that get skipped. This is
"enforcement over reminders" applied to releasing.

## Current state & why the gap exists

No CI, no release workflow, no publish/marketplace automation; `/prepare-release` ends at "a human runs
publish."

## Proposed solution

- **`release.yml`** (`workflow_dispatch` and/or on merge of the Changesets "Version Packages" PR):
  1. run the **gate** (issue-01) — abort on red;
  2. `changeset version` (issue-02) + sync plugin/marketplace version;
  3. **build + snapshot** (issue-03);
  4. commit + **tag `v<version>`**;
  5. **publish (lockstep):** library → internal npm (or attach tarballs); component registry → host the
     built JSON; **plugin → update `marketplace.json`** so `/plugin` (Code) + Cowork install the new
     version; create a **GitHub Release** from the CHANGELOG;
  6. **post-release verify:** fresh-install smoke in a scratch dir — install the plugin, `npx shadcn add`
     a block, import a package, run `brand-ui context`; confirm the marketplace serves the new version;
  7. open the next dev cycle (optional) + announce.
- **`/cut-release` command** — local mirror with `--dry-run` (produces the snapshot + validation report,
  **no** tag/publish) so a maintainer can preview.
- **Rollback (documented):** revert `marketplace.json` to the last good version (instant for plugin/
  registry consumers), deprecate the bad package versions (WP-07), restore from `release/<previous>/`;
  ship a follow-up patch through the same gate.
- Secrets (npm token, registry host, marketplace) via repo/org secrets — never committed.

## Affected files

- [ ] `.github/workflows/release.yml` (new)
- [ ] `.claude/commands/cut-release.md` (new) + `package.json` `release` script
- [ ] `CONTRIBUTING.md` / a `docs/RELEASING.md` (the runbook + rollback + cadence + owner)

## Acceptance criteria

- [ ] One trigger runs gate → version → build → snapshot → tag → publish → verify; aborts on a red gate.
- [ ] **Library, component registry, and plugin marketplace are all updated to the same version** in one
      release; `/plugin` + `npx shadcn add` serve it.
- [ ] Post-release fresh-install smoke passes.
- [ ] `/cut-release --dry-run` previews without publishing; a rollback procedure is documented + tested.

## Test to add

A dry-run end-to-end on a fixture (no real publish) asserting each stage runs and the snapshot/report
are produced; a rollback rehearsal (revert marketplace pointer) in a scratch repo.

## Risks / ripple effects

- Publishing is irreversible-ish — gate must be green; default `/cut-release` to dry-run; require owner
  approval (gate I). Cowork marketplace is a 2026 preview — keep the plugin install path resilient.
- No paid deps/secrets in the repo.

## References

- `../../08-release-process.md`; WP-07 (deprecation/rollback), WP-01 (CI), WP-10 (gates),
  vibe-coder-plugin (ships via the same plugin release).
