# ADR 0016 — Distribution via GitHub Packages (and the scope rename it forced)

> **Superseded.** This repo is a private fork with no remote and no registry;
> nothing is published. The reasoning below is kept as the record of why the
> packages are scoped and carry publish metadata at all. See
> [ADR 0028](./0028-publishing-disabled-private-fork.md) for what holds today.

- **Status:** Superseded by [ADR 0028](./0028-publishing-disabled-private-fork.md) (2026-08-16)
- **Date:** 2026-08-01
- **Supersedes:** the "no npm registry / tarballs only" premise stated in
  `docs/RELEASING.md` and `docs/CONSUMING.md`

## Context

brand-ui was consumed by copying `.tgz` tarballs. `docs/CONSUMING.md` documented
the real cost: download release assets into `vendor/`, declare `file:`
dependencies, **and** mirror a `pnpm.overrides` entry for every package —
because `workspace:*` peers are rewritten to concrete versions at pack time and
would otherwise trigger a registry lookup that resolves to nothing.

That meant no semver resolution, no lockfile integrity, no `pnpm update`, no
`npx <cli>`, and an upgrade was a manual re-download and re-pin. The override
mirror block was the single most-reported consumer pain point.

The packages were also `private: true` and scoped `@brand` — a scope nobody
owns — so publishing was blocked by construction, not by policy.

## Decision

**Publish the packages as private npm packages on GitHub Packages
(`https://npm.pkg.github.com`), from the owning organization’s repo,
published by CI on a version tag.**

This forces three coupled changes:

1. **Scope rename.** GitHub Packages only accepts packages whose npm scope
   equals the repository owner. `@brand/<pkg>` → `@elabs/components-<pkg>`.
   The repo name is carried in the package name so the packages stay
   collision-free inside a scope shared by every repo in the org — otherwise the
   design system would claim generic names like `@elabs/ui`.
2. **Publish metadata.** `private` removed (repo visibility is what keeps the
   package private); `repository` + `directory` added (GitHub Packages needs it
   to link the package and inherit visibility); `publishConfig.registry` added
   (otherwise a publish targets npmjs.org).
3. **CI-only publishing.** `secrets.GITHUB_TOKEN` already carries
   `packages: write` for this repo, so no maintainer needs a personal
   `write:packages` token and no publish can originate from an unverified
   working tree.

## Alternatives considered

| Option                                      | Why not                                                                                                                                                                                                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Corporate Artifactory / Azure Artifacts** | Keeps `@brand/*` untouched (no scope constraint) and is the natural enterprise answer, but needs a feed provisioned and access granted to every consumer, including personal projects outside the tenant. Revisit if one becomes available — the packaging work here is registry-agnostic. |
| **Self-hosted Verdaccio**                   | Also keeps `@brand/*`, ~$0–5/month, but makes a small team responsible for uptime, auth, TLS and backups of a service that sits in the critical path of every `pnpm install`.                                                                                                              |
| **npmjs.org private org**                   | ~$7/user/month, and `@brand` is almost certainly taken there, so it forces a rename anyway — the cost without the benefit.                                                                                                                                                                 |
| **Keep tarballs, improve the docs**         | Does not fix semver, lockfile integrity, or the override mirror. The pain is structural.                                                                                                                                                                                                   |

Free-plan quotas were checked rather than assumed: artifacts are ~4.6 MB per
release, against 500 MB storage and 1 GB monthly transfer — roughly 100 versions
and 200 cold installs per month. Not a constraint at this size.

## Consequences

**Better.** Consumers write `"@elabs/components-ui": "^X.Y.Z"`
and nothing else. The `pnpm.overrides` mirror is deleted. `npx` works on the
CLI. Upgrades are `pnpm update`.

**Worse.** Private packages have no anonymous read, so every consumer needs a
classic PAT with `read:packages` (fine-grained PATs are unreliable against this
registry), and another repo's CI needs an explicit package-access grant — its
own `GITHUB_TOKEN` cannot read this repo's packages. This is a real onboarding
step that the tarball flow did not have.

**Permanent.** Published npm versions and names are immutable. The package names
chosen here cannot be cleanly changed later.

**Verbose.** `@elabs/components-ui` is a 34-character specifier on
every import line. Accepted deliberately in exchange for collision-safety.

## What made this safe to do

The rename touched 4,683 occurrences across 758 files, so it was executed as a
committed codemod (`scripts/rename-scope.mjs`) rewriting the scope **token**,
not a map of package names. The name-map approach was tried first and was wrong:
it renamed the packages but left executable prefix checks like
`name.startsWith("@brand/")` in `check-dep-direction.mjs`, which would have left
that gate matching nothing and **passing vacuously**. A silently dead gate is
worse than a red one.

Three enforcement gates ship with this decision, each self-tested:

- **`pnpm publish-ready:check`** — refuses to release when the scope, `private`
  flag, `repository` or `publishConfig.registry` would make the publish fail.
  npm versions are immutable, so a half-published release cannot be undone; this
  fails before anything is tagged.
- **`pnpm version:check`** — all 16 lockstep version sites agree.
- **`pnpm consumer:check`** — packs every package, installs the tarballs into a
  throwaway Vite app outside the workspace, and builds it. This is the only
  thing in the repo that consumes `dist/`; everything else resolves `src/` via
  the `exports` map, which is how four packaging defects shipped undetected (see
  ADR 0006 and the CHANGELOG entry for this change).

## References

- `docs/CONSUMING.md` — registry auth and the consumer dependency block
- `docs/RELEASING.md` — the release flow; `/release <version>`
- `.github/workflows/release.yml` — the publishing pipeline
- ADR [0006](./0006-subpath-exports.md) — subpath exports, the `exports` vs
  `publishConfig.exports` split this builds on
