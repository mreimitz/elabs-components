---
description: Check the tree is releasable, or cut a release — bump the lockstep version, verify the published artifact, tag, and let CI publish the packages
argument-hint: <version, e.g. 1.10.0> [--dry-run] | --check [package filter]
allowed-tools: Task, Read, Grep, Glob, Edit, Bash(pnpm:*), Bash(node:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git fetch:*), Bash(git tag:*), Bash(git push:*), Bash(gh run:*), Bash(gh pr:*), Bash(gh release:*)
---

Release `$ARGUMENTS` of brand-ui. Read `@docs/RELEASING.md` first — it is the procedure of
record. For a full release you may hand the work to the **`brand-ui-release`** agent.

**Division of labour:** you prepare and verify locally; **CI publishes.**
`.github/workflows/release.yml` fires on the `v*` tag and is the only thing that runs
`pnpm publish`. Never run `pnpm publish` yourself.

## `--check` — is the tree releasable right now? (validate only)

Optionally scoped to a package filter. Run, and report a green/red table:

1. `git status` — no unexpected or uncommitted files; no secrets, `.env` or machine-specific
   absolute paths staged.
2. `pnpm install`, then `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
   `pnpm build`, `pnpm registry:validate`.
3. Distribution readiness: `pnpm version:check` (all lockstep sites agree),
   `pnpm publish-ready:check` (scope, `private`, `repository`, `publishConfig`, `.npmrc`),
   `pnpm css-assets:check --require-dist`, **`pnpm consumer:check`** (packs every package,
   installs the tarballs into a throwaway Vite app and builds it — release-blocking),
   `pnpm changelog:check` (a non-empty `## v<version>` section; red between `version:set`
   and the rename is expected).
4. Optional: `pnpm release:snapshot` — packs the artifact set into `release/v<version>/` with
   a SHA-256 manifest, to see what a release would attach.

Stop there. Do not bump, tag or push.

## 1. Preflight — stop on anything red

- Clean tree, on `main`, in sync with `origin/main`.
- `pnpm publish-ready:check` — red means the release cannot work; fix it and stop.
- `pnpm version:check`.

## 2. Decide the version

`$ARGUMENTS` gives the target; missing or invalid semver → ask. Sanity-check the bump against
`CHANGELOG.md` `## Unreleased`: new component/export → minor; breaking API/token/package
change → major; fixes only → patch. Empty `## Unreleased` → nothing to release, stop.

## 3. Write the version

- `pnpm version:set <version>` — the only writer of every version site. Never hand-edit.
- Rename `## Unreleased` to `## v<version> — <today>`; add a fresh empty `## Unreleased`.
- `pnpm version:check` and `pnpm changelog:check`.

## 4. Verify the artifact consumers will get — before the tag

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm format:check`
- `pnpm css-assets:check --require-dist`
- **`pnpm consumer:check`** — the decisive one. If it fails, the release is broken; fix it,
  never skip it.

`--dry-run` → stop here and report. Do not commit or tag.

## 5. Land it, then tag the commit CI already proved

1. Commit the version bump + changelog (`release: v<version>`) and land it on `main`
   (`docs/RELEASING.md` §4 covers the branch/PR path when one is used).
2. **Ask the user before tagging.** The tag publishes; npm versions are immutable.
3. Wait for CI's blocking battery on that commit to be green (`gh run watch` /
   `gh pr checks`).
4. Resolve and verify the tag target, then tag:

   ```bash
   git fetch origin --tags
   sha="$(pnpm -s release-tag-target)"
   GH_TOKEN=$(gh auth token) pnpm release-verdict:check -- --sha "$sha" --repo <owner>/<repo>
   git tag v<version> "$sha" && git push origin refs/tags/v<version>
   ```

   `release-tag-target` picks the commit whose CI run already passed (a PR merge's head
   rather than the fresh merge commit), so the battery runs once per release. A tag on the
   wrong commit is fixed per `docs/RELEASING.md` §4 — delete the remote tag, re-tag, re-push;
   no force push needed.

## 6. Watch the publish

`gh run watch` / `gh run list --workflow=Release`. The workflow checks the verdict for the
tagged SHA, authenticates to the registry, builds, publishes, attaches the release assets and
runs a fresh-install smoke. A run that fails at start with 0 billable ms is an org
spending-limit block, not a code failure — say so.

## 7. Report honestly

State what ran and what did not. A pushed tag without a successful run is **not** a release.
Confirm with `gh release view v<version>` and by resolving one package from the registry.
A bad publish follows `docs/RELEASING.md` §7 (Rollback) — never improvise.
