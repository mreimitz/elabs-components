---
description: Cut a release — bump the lockstep version, verify the published artifact, tag, and let CI publish the packages
argument-hint: <version, e.g. 1.10.0> [--dry-run]
allowed-tools: Read, Grep, Glob, Edit, Bash(pnpm:*), Bash(node:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git tag:*), Bash(gh run:*), Bash(gh release:*)
---

Cut release `$ARGUMENTS` of brand-ui. Read `@.claude/rules/quality-gates.md` and
`@docs/RELEASING.md` first.

**The division of labour:** you prepare and verify locally; **CI publishes.**
`.github/workflows/release.yml` fires on the `v*` tag and is the only thing that
runs `pnpm publish` — it holds `packages: write` via `secrets.GITHUB_TOKEN`, so
no publish ever happens from a laptop or an unverified tree. Never run
`pnpm publish` yourself.

## 1. Preflight — stop here if anything is red

Run these before touching a single file. Each one blocks:

- `git status` — the tree must be clean, and you must be on `main` and in sync
  with `origin/main` (a release from a stale or dirty tree is unreproducible).
- `pnpm publish-ready:check` — can these packages actually reach the registry?
  Verifies the npm scope equals the GitHub owner (GitHub Packages' hard
  requirement), that no distributable is still `private: true`, that each has a
  `repository` + `directory`, and that `.npmrc` maps the scope. **If this is red,
  the release cannot work — fix it and stop.** Do not attempt a workaround.
- `pnpm version:check` — all 16 lockstep sites currently agree.

## 2. Decide the version

`$ARGUMENTS` gives the target. If it is missing or not valid semver, ask.

Read `CHANGELOG.md`'s `## Unreleased` section and sanity-check the bump against
what actually changed: a new component or public export is a **minor**; a
breaking API/token/package-name change is a **major**; fixes only are a
**patch**. If `## Unreleased` is empty, say so and stop — there is nothing to
release. If the entries clearly disagree with the requested bump, say so before
proceeding.

## 3. Write the version

- `pnpm version:set <version>` — writes all 16 sites (11 packages + the CLI +
  root + both plugin manifests + `SERVER_INFO` in `packages/cli/lib/mcp.mjs`).
  Never hand-edit these; the script is the only writer.
- Rename `CHANGELOG.md`'s `## Unreleased` heading to `## v<version> — <today>`
  and add a fresh empty `## Unreleased` above it.
- `pnpm version:check` to confirm.
- `pnpm changelog:check` to confirm the rename landed. CI runs this as a
  publish-only preflight because `RELEASE_NOTES.md` (extracted from that section)
  is a **required** GitHub Release asset — skipping the rename used to publish
  every immutable version and only then fail on the missing file.

## 4. Verify the artifact consumers will actually get

The full battery, in this order. **This runs BEFORE the tag**, per the
Definition-of-Done rule — review precedes integration:

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm format:check`
- `pnpm version:check:test && pnpm css-assets:check:test && pnpm consumer:check:test`
- `pnpm css-assets:check --require-dist`
- **`pnpm consumer:check`** — the decisive one. It packs every package, installs
  the tarballs into a throwaway Vite app outside the workspace, builds it, and
  asserts the artifact is usable (exports resolve, `use client` boundaries are
  right in both directions, fonts resolve, no engine at two versions). Nothing
  else in this repo consumes `dist/`, so this is the only check that sees what a
  consumer sees. If it fails, the release is broken — fix it, do not skip it.

If `--dry-run` was passed, stop here and report. Do not commit or tag.

## 5. Land it on `main`, then tag the commit CI ALREADY proved

**The battery runs ONCE per release. If you find yourself waiting on a second
full CI run, you have tagged the wrong commit** — read the "one run" rule below
before waiting 13 minutes for a verdict you already hold.

`main` is **protected**: a direct `git push origin main` is rejected
(`Changes must be made through a pull request`). Verified on 2026-08-17; do not
re-derive it from older prose that says protection is impossible on this plan.
So a release lands through a PR, and the sequence is:

1. **Commit the version bump + changelog** on a release branch:
   `git switch -c release/v<version>` → `release: v<version>`.
2. **Push the branch and open the PR.** `git push -u origin release/v<version>`,
   `gh pr create`. This is the ONE battery run of the release. Watch it with
   `gh run watch` / `gh pr checks`.
3. **Ask the user before merging.** The merge + tag is what publishes, and npm
   versions are immutable — this is the point of no return. Show the exact
   commands below.
4. **Merge** once the blocking job is green: `pnpm merge:check` (refuses while
   anything blocking is failing OR pending), then `gh pr merge <n> --merge`.
5. **Resolve the tag target — do not assume it is `main`:**

   ```bash
   git fetch origin --tags
   pnpm -s release-tag-target            # prints the SHA to tag; reasoning on stderr
   ```

6. **Verify the verdict for THAT SHA, then tag it:**

   ```bash
   sha="$(pnpm -s release-tag-target)"
   GH_TOKEN=$(gh auth token) pnpm release-verdict:check -- --sha "$sha" --repo <owner>/<repo>
   git tag v<version> "$sha" && git push origin refs/tags/v<version>
   ```

### Why the tag goes on the PR head, not on `main` (the "one run" rule)

`release.yml` publishes only when `ci.yml`'s blocking battery already concluded
success **for the exact tagged SHA**. That pin is right — "`main` is green"
decays the moment `main` moves — but `gh pr merge` mints a **brand-new commit**
that no CI run has ever seen. Tag it and you are asking the battery to re-prove,
from scratch, a tree it just proved.

A merge commit's **second parent is the PR head** — the commit CI actually ran
on. When the merge changed nothing, that parent has `main`'s exact tree AND
carries a verdict, so it is the commit to tag. `pnpm release-tag-target` decides
this mechanically (`scripts/resolve-release-tag-target.mjs`, self-tested via
`pnpm release-tag-target:test`) and **refuses the shortcut** when it is not
sound: a direct push, an octopus merge, or a merge whose second parent no longer
has `main`'s tree (someone else landed a commit — then `main` itself must go
green and there is no way around the second run).

**Tagging `main`'s merge commit is not destructive**, so this is a cost rule, not
a safety rule: `release-verdict:check` refuses in ~10 seconds, before anything is
installed or published. It costs a re-tag and a wasted CI run. That is exactly
what happened on the v4.0.0 attempt.

**Fixing a tag that is already on the wrong commit** (nothing has published, so
this is free — and it needs no force push):

```bash
git push origin :refs/tags/v<version>     # delete the remote tag
git tag -d v<version> && git tag v<version> "$(pnpm -s release-tag-target)"
git push origin refs/tags/v<version>      # re-push; the Release workflow re-fires
```

**Merge before tag is enforced, not stylistic.** The plugin pointer a
`/plugin marketplace add` consumer follows is `.claude-plugin/marketplace.json`
as served by the **default branch** — read through the API, not from the tag's
tree, which is why tagging the PR head is still correct. A tag pushed before the
merge leaves every plugin consumer on the previous version, and `release.yml`
runs `pnpm marketplace:check` as a publish-only preflight that fails the run —
before anything is published — if the default branch does not already name this
version.

## 6. Watch the publish

Once pushed, `release.yml` first runs `pnpm release-verdict:check`: the commit
under the tag must already have a green blocking battery from `ci.yml`. It does
**not** re-run that battery (doing so cost 29 of the v3.0.0 run's 38 minutes,
re-proving what `main`'s CI was proving at the same moment). It then proves the
**registry credential before anything expensive** (`Registry authentication` —
`setup-node` writes the `//registry.npmjs.org/:_authToken=` line only because it
is given `registry-url`, and `npm whoami` confirms the token is live). The
v4.0.0 attempt had neither: `NODE_AUTH_TOKEN` alone is inert, so the run spent
~6 minutes on verdict + build + preflight and died at the publish with
`npm error code ENEEDAUTH`. It then builds the
packages only (`pnpm build:packages` — no Storybook site), runs the
publish-only preflight (lockstep version, tag↔version, `publish-ready:check`,
`changelog:check`, **`marketplace:check`**), publishes, builds the
agent-kit/plugin zips, packs the snapshot (`release-manifest.json` with a SHA-256
per asset **and** per record, plus `release-record-<version>.zip` carrying the
changelog and the agent-facing ground truth for exactly that version), creates
the GitHub Release, and finishes with a **post-release verify** that resolves
every published package from the registry and asserts every manifest asset is
attached, plus a **fresh-install smoke** (`pnpm release:smoke`) — a separate job,
so the Release exists the moment the publish job ends — that installs the
published packages into a scratch dir, runs the published CLI, and re-checks the
plugin pointer on the **default branch**. A skipped `git push origin main` is
therefore caught twice: once before the publish, where the fix is free, and again
after. Follow it with `gh run watch` / `gh run list --workflow=Release`.

The pipeline is live — `v3.0.0` shipped through it on 2026-08-10. If a run fails
at runner start with 0 billable ms and empty `steps[]`, that is an org
spending-limit block, not a code failure: say so plainly rather than reporting
the release as done.

## 7. Report honestly

State what actually ran and what did not. If the tag is pushed but the workflow
never started, the release is **not** done — the packages are unpublished. Verify
with `gh release view v<version>` and by resolving one package from the registry
before claiming success. Lead with anything unverified.

**If the run went bad** — a half publish, a broken version, a wrong plugin
pointer — do not improvise. Published versions are immutable; the procedure is
`docs/RELEASING.md` **§ 7 Rollback** (deprecate every package at that version,
patch forward through the same gates, revert the version commit for the
marketplace pointer). Report which of those you did.
