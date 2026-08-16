# ADR 0020 — Lockstep versioning via `pnpm version:set` (not Changesets)

- **Status:** Accepted
- **Date:** 2026-08-02
- **Relates to:** issue #104 (which proposed the Changesets route and stays open
  as the record of this divergence), ADR
  [`0016`](./0016-distribution-via-github-packages.md) (where the packages are
  published)

## Context

A brand-ui release is one number applied to more than the npm packages. At the
time of writing it lands on **16 lockstep sites**: the 11 component packages, the
CLI, the repo root, both `.claude-plugin` manifests (`plugin.json` and
`marketplace.json`), and `SERVER_INFO.version` in `packages/cli/lib/mcp.mjs` — the
version the MCP server reports to agents. Only the first 12 are npm packages; the
rest are plain files.

The original design (`research/enterprise-gap/08-release-process.md`, filed as
issue #104) specified **Changesets with a fixed/locked group**: contributors add a
changeset per change, `changeset version` computes the bump and writes the
CHANGELOG, and a post-version script syncs the non-package files.

What actually shipped is different, and had been for several releases before
anyone wrote down why. `CONTRIBUTING.md` asserted the decision and cited ADR 0016
for it — but ADR 0016 is about _which registry_, and the word "Changeset" appears
nowhere in it. A claim whose cited source does not support it is exactly the
doc-truth class `pnpm docs:check` exists to prevent, so the decision is recorded
here instead.

## Decision

**Version the whole system in lockstep, written by one derived writer —
`pnpm version:set X.Y.Z` — and enforced by `pnpm version:check`. Do not adopt
Changesets; do not add a `.changeset/` directory.**

The consequences that follow from that:

- **One number, every site.** `scripts/set-version.mjs` **derives** its site list
  (`versionSites()`) rather than carrying a hard-coded one: a package joins the
  train by declaring `publishConfig` or by not being `private`. The hand-kept
  checklist it replaced listed 15 files and had undercounted by one.
- **`pnpm version:check` is a CI gate**, and runs again as a publish-only
  preflight inside `release.yml` — a disagreeing site fails before anything
  immutable is published.
- **The CHANGELOG is hand-written, under `## Unreleased`.** `/release` renames
  that heading to `## vX.Y.Z — <date>`; `release-snapshot.mjs` **extracts**
  `RELEASE_NOTES.md` from it (never retypes it), and `pnpm changelog:check`
  asserts the section exists before the publish.
- **`## Unreleased` IS the per-change record, and it is enforced per branch.**
  `pnpm changelog-entry:check` (`scripts/check-changelog-entry.mjs`, in the CI
  battery, self-tested) fails a branch that changes
  `packages/<distributable>/src/**` — tests and stories excluded — without adding
  a line under `## Unreleased`. That is the PROPERTY #64's "a changeset is
  required for package-affecting PRs (CI check)" asks for, obtained without a
  second versioning tool: the record is the changelog entry rather than a
  `.changeset/*.md` file.
- **Release intent lives in the release, not in per-PR metadata.** The bump is
  chosen by the maintainer cutting the release, against `docs/DEPRECATION.md`'s
  deprecate-in-a-minor / remove-in-the-next-major rules.

## Alternatives considered

| Option                                             | Why not                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Changesets with a fixed group** (#104, as filed) | Changesets manages _packages_. Four of the 16 sites are not packages (both plugin manifests, the MCP `SERVER_INFO`, the root), so it needs a post-version sync script anyway — which is `set-version.mjs` minus the derivation. That leaves a second versioning tool and a `.changeset/` directory to reach the same one number. The per-PR gate its `changeset status` provides is kept: `pnpm changelog-entry:check` enforces the same property against `## Unreleased`. |
| **Changesets for the CHANGELOG alone**             | The generated changelog is a concatenation of per-PR notes. This repo's changelog is written for consumers upgrading a design system — grouped by surface, with migration steps — which is a release-time editorial act, not an accumulation.                                                                                                                                                                                                                              |
| **Independent per-package SemVer**                 | Consumers install several `@elabs/components-*` packages that share tokens, peers and a theme contract. Independent versions make "which set is compatible" a consumer problem and let the plugin drift from the library it documents — the exact failure #104 was filed to end.                                                                                                                                                                                           |
| **Keep the manual edit checklist**                 | It is what `version:set` replaced. It drifted (15 of 16 sites) and nothing detected the miss.                                                                                                                                                                                                                                                                                                                                                                              |

## Consequences

**Better.** One command, one gate, no second versioning tool and no per-PR
ceremony. The site list is derived, so a new package is on the train the moment it
declares `publishConfig` — nobody has to remember to register it.

**Worse.** The bump is a judgement call at release time rather than an accumulated
one, so nothing mechanically proves "this diff is a minor". `docs/DEPRECATION.md`
carries that rule in prose, and the release owner applies it — an accepted gap,
not an oversight. What is NOT a gap (it was, in this ADR's first revision) is the
per-change record: `pnpm changelog-entry:check` enforces it, so "no per-PR
ceremony" now means "no second tool", not "nothing is written down".

**Reversible.** Nothing here blocks adopting Changesets later; it would replace
`set-version.mjs`'s writer half while keeping `versionSites()` as the sync target.
Until then, #104's Changesets acceptance criteria are de-scoped **by this record**,
not by a citation of ADR 0016.

## References

- `scripts/set-version.mjs` — the single writer (`versionSites()` + `--check`)
- `scripts/check-release-notes.mjs` — the pre-publish changelog gate
- `scripts/check-changelog-entry.mjs` — the per-branch change-record gate (#64)
- [`../RELEASING.md`](../RELEASING.md) § 2 — the runbook step
- [`../DEPRECATION.md`](../DEPRECATION.md) — what makes a bump a major
- [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) — "Release cadence & ownership"
