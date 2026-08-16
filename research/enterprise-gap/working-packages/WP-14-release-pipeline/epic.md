---
TYPE: epic (tracking issue)
TITLE: "[governance] WP-14 — Release pipeline: validate → version → snapshot → publish (plugin + library)"
LABELS: type:tech-debt, severity:P1, area:governance, area:test, area:registry, needs-triage
---

## Summary

Build the end-to-end release process designed in
[`../../08-release-process.md`](../../08-release-process.md): a hard **validation gate** (quality +
documented + wired + assets present), **one coordinated SemVer** for the library _and_ the plugin, a
built **`release/<version>/` snapshot**, and automated **publish + registry/marketplace updates** — so
every release ships the plugin **and** the component library together, only after everything is proven
green. Today there is **no** release process (only the local `/prepare-release` checklist; no
Changesets/CHANGELOG/CI/`release/` folder; versions hand-synced at 0.1.0).

## Why this is the capstone (build it last)

The release gate **composes** the rest of the program's enforcement (WP-01 CI, WP-02 coverage, WP-10
manifest/registration/inventory/stale gates, WP-12 guidance freshness, WP-13 assets, WP-11 catalog,
WP-07 Changesets/versioning). It depends on those existing — so WP-14 is sequenced **after** them — but
designing it now tells each earlier package what its check must plug into.

## Child issues

- **issue-01-validation-gate** — one blocking `release` gate composing the A–I checks (quality,
  coverage/AA, freshness/no-drift, wiring/registration, assets present, plugin validity, docs, safety,
  intent) + a stored validation report. _(P1)_
- **issue-02-coordinated-versioning** — Changesets with a **locked group** (all `@qlik-coe-emea/qlabs-components-*` + plugin one
  version) + CHANGELOG; plugin version derived from the system version (no hand-syncing). _(P1)_
- **issue-03-build-and-snapshot** — dual build (library + plugin + registry + manifest/context/catalog/
  skills) and the immutable `release/<version>/` snapshot (release-manifest, validation report, notes,
  registry/plugin/ground-truth). _(P1)_
- **issue-04-publish-and-verify** — the `release.yml` workflow + `/cut-release` command: tag, publish
  (library + registry + plugin marketplace), GitHub Release, **post-release fresh-install verify**, and
  the rollback procedure. _(P1)_

## Definition of done

- A green-or-block **release gate** runs in CI; a release is impossible unless A–I pass, with a stored
  validation report.
- One `changeset version` bumps the whole system (library + plugin) together; CHANGELOG generated.
- A release produces `release/<version>/` (snapshot + report) and publishes the **library, the
  registry, and the plugin** in lockstep; the marketplace serves the new version.
- Post-release fresh-install smoke passes; a documented rollback exists.

## Dependencies

Depends on **WP-01** (CI), **WP-10** (gates), **WP-07** (Changesets/versioning/deprecation), and the
freshness/asset checks from **WP-03/WP-11/WP-12/WP-13/WP-02**. Sequence **LATER** (capstone). Also
gates the **vibe-coder-plugin** stream's releases (it ships via the same plugin).
