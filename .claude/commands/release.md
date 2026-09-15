---
description: Check the tree is releasable, or drive a Changesets release — add a changeset, review and merge the Version PR, confirm CI published
argument-hint: [--check] | [status]
allowed-tools: Task, Read, Grep, Glob, Edit, Bash(pnpm:*), Bash(node:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git fetch:*), Bash(gh run:*), Bash(gh pr:*), Bash(gh release:*)
---

Release brand-ui with `$ARGUMENTS`. Read `@docs/RELEASING.md` first — it is the procedure of
record. You may hand the work to the **`brand-ui-release`** agent.

**CI publishes.** `.github/workflows/release.yml` (changesets/action) is the only thing that
publishes. Never run `pnpm publish` or `changeset publish` yourself.

## `--check` — is the tree releasable? (validate only)

Report a green/red table, then stop:

1. `git status` — nothing unexpected staged; no secrets, `.env` or machine-specific paths.
2. `pnpm check:changed` and `pnpm check` (includes the version-sync rule).
3. `pnpm changeset status` — which packages a merge would release, at which bump.
4. `node scripts/check-css-assets.mjs --require-dist` after `pnpm build`, and
   **`pnpm consumer:check`** (packs + installs the tarballs into a throwaway app — release-blocking).

## Release

1. **Changesets present?** `pnpm changeset status`. None → nothing to release; say so and stop.
   A consumer-facing change without one → add it with `pnpm changeset` (confirm the bump:
   breaking → major, new component/export → minor, fixes → patch).
2. **Version PR.** After the changeset lands on `main`, CI opens or updates
   "Release: version packages" (`gh pr list --head changeset-release/main`). Check it bumps
   every fixed-group package to the same version and that root, both `.claude-plugin`
   manifests and the MCP `SERVER_INFO` moved with it.
3. **Ask the user before merging it.** The merge publishes; npm versions are immutable.
4. **Watch the publish:** `gh run watch` / `gh run list --workflow=Release`. A run that fails
   at start with 0 billable ms is an org spending-limit block, not a code failure — say so.

## Report honestly

A merged Version PR without a successful Release run is **not** a release. Confirm with
`npm view @elabs-ai/components-ui@<version>` and that the fresh-install smoke step passed.
A bad publish follows `docs/RELEASING.md` §4 (Rollback) — never improvise.
