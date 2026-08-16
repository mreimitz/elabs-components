# ADR 0030 — Distribution via public npm (`@elabs-ai/*` on npmjs.org)

- **Status:** Accepted
- **Date:** 2026-08-17
- **Supersedes:** ADR [0028](./0028-publishing-disabled-private-fork.md) (publishing disabled)
- **Relates to:** ADR [0016](./0016-distribution-via-github-packages.md) (the GitHub Packages era)

## Context

Three facts changed at once, and together they decide the target:

1. The fork now has a remote — `github.com/mreimitz/elabs-components` — and that
   repo is being made **public**.
2. The maintainer wants the packages installable by **other apps they own**,
   which means real semver resolution and lockfile integrity, not vendored
   tarballs (the pain ADR 0016 originally removed and ADR 0028 reintroduced).
3. The maintainer does **not** want a second GitHub organisation.

That third constraint is what rules out returning to ADR 0016's model. GitHub
Packages requires the npm scope to equal the repository owner; any `@elabs…/*`
scope under owner `mreimitz` is refused at publish time. Satisfying it would mean
renaming the scope to `@mreimitz` across the whole repo — every import, doc,
manifest, skill and gate baseline — for no user-visible gain.

GitHub Packages has a second cost that survives even a rename: its npm registry
demands an authenticated request for _every_ install, public repo or not. Each
consuming app and each CI runner would need a classic PAT with `read:packages`
provisioned before `pnpm install` works at all.

## Decision

**Publish `@elabs-ai/components-*` as PUBLIC packages on npmjs.org, from the public
`mreimitz/elabs-components` repo, on a `v*` tag, from CI.**

1. **The scope is `@elabs-ai`.** npmjs.org sells a scope independently of any
   GitHub account, so the owner-equality rule simply does not apply — the scope
   need not match `mreimitz`. The plan was to keep `@elabs` and rename nothing;
   `elabs` turned out to be taken on npmjs.org, so the maintainer registered
   **`elabs-ai`** and the scope moved with a mechanical, repo-wide codemod
   (4931 references across 777 files, `@elabs` → `@elabs-ai`, plus a `pnpm install`
   to rewrite the lockfile and the workspace links). Package names are otherwise
   unchanged: `@elabs-ai/components-ui`, `@elabs-ai/components-tokens`, and so on.
2. **Consumers configure nothing.** No `.npmrc`, no token, no CI secret. This is
   the whole reason the scope-mapping lines were deleted from `CONSUMING.md`, the
   scaffolder, the getting-started story and the starter `CLAUDE.md` rather than
   merely re-pointed.
3. **The `scope-mismatch` rule is gated on the host, not deleted.**
   `requiresOwnerScope(registry)` in `scripts/check-publish-ready.mjs` returns
   true only for `npm.pkg.github.com`. Deleting the rule would leave a future
   GitHub Packages release to fail _after_ its first package published
   irreversibly; applying it everywhere would block this release outright.
4. **`.npmrc` still maps the scope**, to `https://registry.npmjs.org/`. The
   mapping is redundant at install time — that host is npm's default — but it is
   what `publish-ready:check` reads to decide the publish target, so the repo
   declares its target explicitly instead of inheriting it.
5. **The `.github/workflows` return, in the shape the gates already expect.**
   `gates.yml` (reusable) holds the battery, `ci.yml` calls it on PRs and pushes
   to `main`, and `release.yml` publishes on a `v*` tag **after**
   `release-verdict:check` proves that exact commit's CI was green. The release
   does not re-run the battery; that is the #103 verdict model, unchanged.
6. **`license` becomes `MIT`** on all 12 distributables, with a root `LICENSE`.
   `UNLICENSED` on a public registry is a contradiction: it tells consumers they
   have no right to use what they can freely install.

## Alternatives considered

| Option                                                | Why not                                                                                                                                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub Packages under a new org named `elabs`**     | Smallest diff on paper (~6 lines), but the maintainer explicitly declined a second organisation — and every consumer would still need a `read:packages` PAT.                            |
| **GitHub Packages, scope renamed to `@mreimitz`**     | A repo-wide scope codemod (~4900 references, ~780 files) plus regenerating every derived artifact, to end up with a registry that still requires auth on install. Cost with no benefit. |
| **Private packages on npmjs.org**                     | Needs a paid plan, and reintroduces the token every consuming app must provision. The repo is going public anyway, so the packages' privacy would protect nothing.                      |
| **No registry — git dependencies / release tarballs** | Works, and stays as the rollback path (the `.tgz` assets are still attached to each Release). As the _primary_ channel it is ADR 0028's known regression: no semver, no `pnpm update`.  |

## Consequences

**Better.** A consuming app installs with `pnpm add @elabs-ai/components-ui` and
nothing else. Cross-package peers resolve from the registry. `npx brand-ui …`
works as written, which retires the #265 precondition. A public repo also makes
npm **provenance** attestation available from Actions (declared best-effort in
`release.yml`).

**Worse.** Everything published is public and immutable — a version cannot be
unpublished after 72 hours, and the source is readable by anyone. `pnpm
debrand:check` therefore stops being hygiene and becomes a release-blocking
concern: a name that leaks into a published tarball is public permanently.

**Watch for.** Nothing in this repo can verify who owns a scope on npmjs.org — a
404 on a package name proves the package is absent, not that the scope is free.
That is exactly how the first attempt went wrong: `@elabs` read as available and
was not. The repo now names `@elabs-ai`, which the maintainer registered; if a
publish is ever refused with `E403`, the cause is scope ownership, and the remedy
is the same codemod again, not a workaround in the release pipeline.

## References

- ADR [0028](./0028-publishing-disabled-private-fork.md) — the dormant state this supersedes
- ADR [0016](./0016-distribution-via-github-packages.md) — why the packages carry publish metadata at all
- `docs/RELEASING.md` · `docs/CONSUMING.md` · `scripts/check-publish-ready.mjs`
