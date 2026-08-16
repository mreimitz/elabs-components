---
description: Validate all packages before publishing or internal distribution
argument-hint: [package filter, e.g. @elabs-ai/components-ui]
allowed-tools: Read, Grep, Glob, Bash(pnpm:*), Bash(node:*), Bash(git status:*), Bash(git diff:*)
---

Run the pre-distribution checklist for brand-ui. Read
`@.claude/rules/quality-gates.md`. Optionally scope to `$ARGUMENTS`.

> **This command only VALIDATES.** To actually cut a release — bump the lockstep
> version, tag, and have CI publish the packages to GitHub Packages — use
> **`/release <version>`**, which runs this checklist as part of a longer flow.
> Use `/prepare-release` on its own to answer "is the tree releasable right now?"

1. Clean state: `git status` — ensure no unexpected/uncommitted junk.
2. Install: `pnpm install` (lockfile honored).
3. Quality gates across the workspace (or filtered):
   - `pnpm format:check`
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm build`
4. Registry: `pnpm registry:validate`.
5. Distribution readiness — these replace eyeballing each `package.json`:
   - `pnpm version:check` — all 16 lockstep version sites agree.
   - `pnpm publish-ready:check` — scope matches the GitHub owner, nothing is
     still `private: true`, every package has `repository` + `directory` and
     `publishConfig.registry`, and `.npmrc` maps the scope.
   - `pnpm css-assets:check --require-dist` — shipped CSS resolves in `dist/`.
   - **`pnpm consumer:check`** — packs every package, installs the tarballs into
     a throwaway Vite app and builds it. The only check in this repo that
     consumes `dist/` the way a consumer does; treat a failure as release-blocking.
   - `pnpm release-gates:check` — every blocking gate a PR runs is also reachable
     from the release tag path. A `v*` tag does NOT trigger `ci.yml`, so a gate
     added to only one workflow would silently never run for a release (#103).
   - `pnpm changelog:check` — `CHANGELOG.md` carries a non-empty
     `## v<version>` section for the version in the tree, so `RELEASE_NOTES.md`
     (a **required** GitHub Release asset) can be extracted. Between
     `pnpm version:set` and the `## Unreleased` rename this is expected to be
     red — that is the point (`docs/RELEASING.md` § 2).
   - `pnpm release:snapshot` — optional dry run of the artifact set: packs the
     **derived** distributable list into `release/v<version>/` and writes
     `release-manifest.json` (SHA-256 + size per asset). `release/` is
     git-ignored throwaway; this is how you see what a release would attach
     before you tag. It fails if a required record (`RELEASE_NOTES.md`) cannot be
     written — same reason as above.
6. Verify no secrets, `.env`, or machine-specific absolute paths are committed.
7. Summarize: a green/red table of each gate, the versions to be released, and
   anything blocking. Do NOT run `pnpm publish` or `git push` yourself — publishing
   is CI's job (`.github/workflows/release.yml`, triggered by the `v*` tag).
