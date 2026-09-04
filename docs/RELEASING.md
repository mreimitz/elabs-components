# Releasing brand-ui

**Distribution model: public npm packages on
[npmjs.org](https://registry.npmjs.org/) under the `@elabs-ai` scope, published by CI
from a version tag** (ADR [0030](./ADR/0030-public-npm-distribution.md)). Tarballs
are still attached to each GitHub Release, but only as a rollback path for
consumers who cannot reach the registry — they are not the primary channel.

Run **`/release <version>`** and it walks the whole flow. This document is the
reference for what that command does and why each step exists.

> **Status.** The pipeline is wired but has **not yet published to npmjs.org**.
> `v2.0.0` went out on 2026-08-01 through the previous, GitHub Packages model; the
> fork then disabled publishing entirely (ADR 0028) before re-targeting it here.
> The `@elabs-ai` scope is registered on npmjs.org by this maintainer (`elabs` was
> already taken, which is why the scope is `@elabs-ai`). Two things are still owed
> before the first public release: `NPM_TOKEN` — an npm **granular automation**
> token with publish rights on that scope — and `PAGES_DEPLOY_TOKEN` — a
> fine-grained PAT (or deploy key) with `Contents: Read and write` on this repo,
> used only to push the built shadcn registry to `gh-pages` (§5 below covers why
> the default `GITHUB_TOKEN` cannot do this) — both as repository secrets. The
> release set is **14 packages**.

## The division of labour

**You prepare and verify locally; CI publishes.** `.github/workflows/release.yml`
fires on a `v*` tag and is the only thing that runs `pnpm publish`. No publish can
originate from a laptop or an unverified working tree. **Never run `pnpm publish`
by hand.**

## 1. Preflight

```bash
pnpm publish-ready:check   # can these packages reach the registry at all?
pnpm version:check         # do all 18 lockstep sites agree?
```

`publish-ready:check` exists because a registry rejects a publish for reasons that
are invisible locally, late in a release, after some packages have already
published — and npm versions are immutable, so a half-published release cannot be
undone. It verifies:

- no distributable is still `private: true`,
- every package has `repository` + `directory`, so the published package links
  back to its source,
- every package has `publishConfig.registry`,
- the root `.npmrc` maps every published scope to that registry.

One rule is **conditional on the host**: the npm scope must equal the repository
owner on **GitHub Packages only**, which is that registry's own requirement. This
repo publishes `@elabs-ai/*` from `mreimitz/elabs-components`, so the rule is skipped
here — see `requiresOwnerScope()` in `scripts/check-publish-ready.mjs`. It stays
wired because a future GitHub Packages release would otherwise fail after its
first package had already published irreversibly.

## 2. Set the version

```bash
pnpm version:set 2.1.0
```

One command writes all **18** lockstep sites: the 13 component packages, the CLI,
the root, both `.claude-plugin` manifests, and `SERVER_INFO.version` in
`packages/cli/lib/mcp.mjs` (the version the MCP server reports to agents, which
used to drift silently). The sites are **derived**, not a hard-coded list, so a
new package joins automatically — a package is on the train when it declares
`publishConfig` or is not `private`.

This replaces the old hand-edit checklist, which listed 15 files and had actually
undercounted by one. Never edit these versions by hand; `pnpm version:check` is a
CI gate.

Then move `CHANGELOG.md`'s `## Unreleased` heading to `## v2.1.0 — <date>` and
open a fresh `## Unreleased` above it.

## 3. Verify what consumers will actually get

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm format:check
pnpm version:check:test && pnpm css-assets:check:test && pnpm consumer:check:test
pnpm css-assets:check --require-dist
pnpm consumer:check          # <- the decisive one
```

`consumer:check` packs every distributable package, installs the tarballs into a
throwaway Vite app **outside** the workspace, builds it, and asserts the artifact
is usable: every export resolves, `use client` boundaries are correct in both
directions, fonts resolve, no engine resolved at two versions.

This matters more than it sounds. Every app and every other gate in this repo
resolves `@elabs-ai/components-*` to TypeScript **source** via the `exports` map, while
consumers get `publishConfig.exports` → `dist/`. Four defects lived in that blind
spot simultaneously — stripped `use client` directives, fonts copied one level too
deep, esbuild-orphaned stylesheets, and a subpath pointing at raw `.ts` — all with
a fully green `typecheck`/`lint`/`test`/`build`. `consumer:check` is the only
thing that looks at what ships.

## 4. Merge, then tag the commit CI already proved

`main` is **protected** — a direct `git push origin main` is rejected with
`Changes must be made through a pull request` (re-verified 2026-08-17). A release
therefore lands through a PR, and **the battery runs exactly once**, on the PR:

```bash
git switch -c release/v2.1.0
git commit -am "release: v2.1.0"
git push -u origin release/v2.1.0
gh pr create --fill                           # <- THIS is the one battery run

gh pr checks                                  # wait for the blocking job
pnpm merge:check                              # refuses while anything blocking is red OR pending
gh pr merge <n> --merge

git fetch origin --tags
sha="$(pnpm -s release-tag-target)"           # NOT necessarily origin/main — see below
GH_TOKEN=$(gh auth token) pnpm release-verdict:check -- --sha "$sha" --repo <owner>/<repo>

git tag v2.1.0 "$sha"
git push origin refs/tags/v2.1.0              # <- this triggers the publish
```

Pushing the tag is the point of no return: published npm versions are immutable.

### Tag the PR head, not the merge commit

`release.yml` publishes only when `ci.yml`'s blocking battery already concluded
success **for the exact tagged SHA** (§ 5). That pin is deliberate — "`main` is
green" decays the moment `main` moves — but `gh pr merge` mints a **brand-new
commit that no CI run has ever seen**. Tag that and you have asked the battery to
re-prove, from scratch, a tree it proved minutes earlier: ~13 minutes for zero
new information.

A merge commit's **second parent is the PR head** — the commit CI actually ran
on. When the merge changed nothing, that parent has `main`'s exact tree _and_
already carries a verdict, so it is the right commit to tag.
`pnpm release-tag-target` works this out mechanically and prints its reasoning;
it **declines the shortcut** when it would be unsound (a direct push, an octopus
merge, or a second parent whose tree no longer matches `main` because someone
else landed a commit — then `main` itself has to go green, and the second run is
unavoidable). Self-tested: `pnpm release-tag-target:test`.

### If the tag is already on the wrong commit

Nothing has published yet — `release-verdict:check` refuses in ~10 seconds,
before the run installs, builds or publishes anything — so the repair is free and
needs **no force push**:

```bash
git push origin :refs/tags/v2.1.0             # delete the remote tag
git tag -d v2.1.0 && git tag v2.1.0 "$(pnpm -s release-tag-target)"
git push origin refs/tags/v2.1.0              # re-push; the Release workflow re-fires
```

You do **not** have to wait for the whole CI run. The gate reads the blocking jobs,
so the Storybook interaction + axe job (`(non-blocking)`, up to 25 minutes) never
holds a release up. It also reads the **newest** run for the commit, so a superseded
`cancelled` run from a double-push does not veto the green one that replaced it.

**Merge before tag is enforced, not stylistic.** The plugin pointer a
`/plugin marketplace add <path-to-this-repo>` consumer follows is
`.claude-plugin/marketplace.json` **as served by the default branch** — read
through the API, not from the tag's tree, which is why tagging the PR head is
still correct. A tag pushed before the merge publishes new packages while every
plugin consumer stays on the previous version. `release.yml` runs
`pnpm marketplace:check` as a publish-only preflight and fails the run if the
default branch does not already name this version, while the fix is still "merge,
delete the tag, re-tag" rather than twelve burnt immutable versions. (The
post-release smoke re-checks it, because a revert can land between the two.)

## 5. What CI does

`release.yml` does **not** trust your local run. Its first step — before install,
before anything — is `pnpm release-verdict:check`: the commit under the tag must
already have a **completed, successful `CI` run**, and the gate refuses in every
other state (no run, still queued, still running, `failure`, `cancelled`,
`timed_out`, or an API it cannot read). The publish job then:

0. proves the **registry credential** before anything expensive
   (`Registry authentication`): it fails loudly when `secrets.NPM_TOKEN` is empty,
   writes the `//registry.npmjs.org/:_authToken=` line into `~/.npmrc`, and runs
   `npm whoami` to confirm the token is live and owns the scope. Setting
   `NODE_AUTH_TOKEN` on the publish step is **not** enough on its own — something
   has to write that `.npmrc` line, and `actions/setup-node` only does so when it
   is given `registry-url`. It was not, and the first v4.0.0 attempt spent ~6
   minutes on verdict + build + preflight before dying at the publish with
   `npm error code ENEEDAUTH` and zero packages published,
1. builds the **packages only** (`pnpm build:packages`) — `ci.yml` already ran the
   full `pnpm build` on this commit, but on a **different runner**, and
   `publishConfig.exports` points at `dist/`, so this job needs its own copy. It
   deliberately does not build `apps/docs`: a Storybook static site nothing
   publishes cost 2m50s of the v3.0.0 run's 5m23s build,
1. re-checks the lockstep version and asserts the tag matches the version in the tree,
1. `publish-ready:check` (+ its self-test): scope, private, repository, registry,
1. `changelog:check` — asserts `CHANGELOG.md` carries a **non-empty
   `## v<version>` section**, because step 8 lists `RELEASE_NOTES.md` as a
   _required_ Release asset and that file is extracted from it. The rename in § 2
   above is a manual step; without this preflight, skipping it published every
   immutable version and only then died at `gh release create` — no Release, no
   assets, and neither post-release check ever ran,
1. `marketplace:check` — asserts the plugin pointer **on the default branch**
   already names this version. It is the one post-release assertion that needs
   nothing the publish produces (two `gh api` calls), so it is hoisted in front of
   the publish: a tag pushed without `git push origin main` is then a re-tag, not
   twelve immutable versions with a stale plugin. It stays in the smoke too — the
   preflight saves the release, the smoke proves the end state,
1. writes **`validation-report.json` / `.md`** — the derived record of which gates
   passed, on which commit, over which packages (`pnpm release:report`). A step
   behind an `if:` (today `marketplace:check`) is recorded as **`skipped`** rather
   than `passed` when the run is not a tag build, so a `workflow_dispatch` dry-run
   cannot produce a report claiming a check that never executed. Since the battery
   passes in a **different run**, the report now also carries a `battery` block —
   the authorising `CI` run's number, URL and conclusion, stored by step 0's
   `release-verdict:check --out`. Without it a reader could not follow "these
   gates passed" to any evidence, so a report written with no provenance says so
   in its own first paragraph instead of implying otherwise,
1. `pnpm -r publish --access public --no-git-checks` to npmjs.org. Public access is
   explicit rather than inherited, because a scoped package defaults to
   _restricted_ — the failure mode is a release that publishes but nobody can
   install. Provenance is requested through
   `NPM_CONFIG_PROVENANCE` (an env var, never a `--provenance`
   flag: an unrecognised flag would abort the publish mid-release), so it is
   **best-effort** — an unattested publish still succeeds,
1. builds the agent-kit + plugin zips (`release:agent-kit`, `release:plugin`),
1. `pnpm release:snapshot` — packs the `.tgz` rollback tarballs for the **derived**
   distributable set, writes the record half of the snapshot (`RELEASE_NOTES.md`
   extracted from the changelog, a `CHANGELOG.md` copy, and `ground-truth/` — the
   manifest, component inventory and `llms.txt` for exactly this version), picks up
   the `validation-report.json` / `.md` step 5 wrote into the same folder,
   archives all of that into **`release-record-<version>.zip`**, and writes
   **`release-manifest.json`** with a SHA-256 and byte size for every asset **and**
   every record (the `.zip` bundles are not npm packages, so this is the only
   integrity they have; the validation report used to be attached with none at
   all, which is the one artifact where it matters most — its whole job is to
   assert the build was validated). Everything the Release attaches out of the
   snapshot folder is hashed except `release-manifest.json` itself, which cannot
   hash its own output. The archive is what makes the record _retrievable_:
   `release/` is git-ignored and the runner is discarded when the job ends, so an
   un-attached record is one nobody could ever obtain — you could look up the
   checksum of a version's ground truth and never get the bytes. A record it
   cannot write (a missing `RELEASE_NOTES.md`) **fails** the step rather than
   warning past it,
1. creates the GitHub Release with all of it attached,
1. **post-release fresh-install smoke** (`pnpm release:smoke`) — the last step of
   the **same job**, not a dependent one, because it reads the snapshot folder:
   `release/` is git-ignored and the runner is discarded when the job ends, so a
   `needs:` job would have to re-download every asset to find the manifest it
   already had. It is the check `npm view` cannot make. It installs every
   published package **from the registry** into a scratch dir outside the
   workspace, asserts each package's `exports` entry is really inside the tarball
   and non-empty, asserts every asset `release-manifest.json` names is actually
   attached to the Release, imports the published CLI and runs its consumer
   commands (`brand-ui info --json`, `brand-ui docs Button`), and
   **re-**confirms the plugin pointer a `/plugin marketplace add` consumer
   follows names the released version (step 4 already asserted it pre-publish; a
   revert can land in between). `consumer:check` covers the artifact **before**
   publish, from local tarballs; this is the only step that installs what the
   registry actually serves.

   One detail it gets right that is easy to get wrong, and was: **the marketplace
   pointer is read from the DEFAULT BRANCH**, over the GitHub API, not from the
   tag this job checked out. The tag's own copy is forced to agree by
   `pnpm version:check` two steps earlier, so comparing it proves nothing — while
   a `/plugin marketplace add` consumer follows `main`, which § 4 pushes as a
   _separate_ command and a revert can move afterwards.

   `npx shadcn add` is deliberately **not** smoked: a release does not build,
   publish or host the shadcn registry (see below), so there is no URL to test.
   `brand-ui context` is monorepo-only — it writes this repo's `CLAUDE.md` /
   `AGENTS.md` — so the smoke runs the consumer-facing `info` / `docs` instead.

   It runs **after** the publish, which is inherent: it installs what the registry
   serves, and nothing serves it until it is published. Everything that _can_ be
   checked earlier is — `consumer:check` before the tag, the preflights above
   before the publish — so what this step catches is a registry-side or
   pointer-side failure, for which the remedy is § 7 Rollback (patch forward),
   never an undo.

   **Status: field-proven against the PREVIOUS registry, not this one.** The
   v3.0.0 run (2026-08-10) installed the whole published set from GitHub Packages
   and passed; it has never run against npmjs.org. Its self-test
   (`pnpm release:smoke:test`, 27 assertions on injected fakes) covers the logic,
   not the target. Read its output on the first public release rather than
   assuming it.

Watch it with `gh run watch` or `gh run list --workflow=Release`.

**Why the release doesn't run the battery any more (2026-08-10).** `ci.yml` is
`on: pull_request` + `push: main`, so a `v*` tag never triggers it. release.yml used
to close that hole by calling the same reusable `gates.yml` itself, as a `needs:`
dependency. Correct, and unaffordable: on the v3.0.0 run (`31373230456`) the tag ref
re-ran the whole battery for 20 minutes and then waited another 9 on a **non-blocking**
job, while `main`'s own CI run for the identical commit ran alongside it,
09:08:34 → 09:37:21, proving the same thing at the same time. 29 of 38 minutes bought
nothing.

So the property is unchanged and the provenance moved: **no publish from a commit
whose battery has not concluded success**, pinned to the immutable SHA rather than to
a branch, a time window, or "a recent green build". `pnpm release-gates:check` (#103)
now has two rungs:

1. **VERDICT** — release.yml's publishing job must run `pnpm release-verdict:check`
   **before** `pnpm -r publish`. The position is asserted because a `needs:` edge
   GitHub enforced structurally was traded for an ordinary step, and a verdict read
   after an immutable publish stops nothing.
2. **RATCHET** — every gate step recorded in `scripts/release-gates-baseline.json`
   must still be reachable from `ci.yml`. This rung now carries the weight the old
   parity rung shared: the release inherits its authority from whatever that battery
   actually ran, so a gate quietly deleted from `gates.yml` is a gate no release will
   ever run again. It covers both shapes a gate is written in, `pnpm <gate>` **and**
   `pnpm --filter <pkg> <script>`.

**The verdict is read at JOB level, and that is what makes it fast.** It requires
every **blocking** job of the newest CI run for the commit to have concluded
success — not the run as a whole. A run is not complete until its non-blocking jobs
finish too, and today that means the Storybook interaction + axe job, which is
`continue-on-error: true` and time-boxed at 25 minutes. Waiting on the run would put
those 25 minutes back on the release, in front of the tag instead of behind it. A job
is blocking **unless its name says otherwise** (`/non-blocking/i`) — the same
fail-closed convention `pnpm merge:check` uses, imported from it so there is one
definition. Rename a job and it becomes required again; add a job and it is required
from the first run. An empty jobs list, or one with nothing blocking in it, refuses:
"I found nothing that had to pass" is not "everything passed".

**What this trade gives up, stated plainly.** The battery no longer runs on a clean
checkout of the tag ref. It runs on the same commit, which is what the guarantee was
ever about — but if a tag is ever pointed at a commit that is not the one CI tested,
the gate is reading a different tree's verdict. It cannot be: the lookup key is the
commit SHA the tag resolves to. What genuinely changed is that a release now depends
on the GitHub Actions API being readable; the gate fails closed when it is not.

**The shadcn registry IS published by a release (#31).** `registry/` is validated
on every PR (`pnpm registry:validate`) and, once the `pnpm -r publish` step of the
`publish` job itself has succeeded, the `publish-registry` job builds it
(`pnpm registry:build`) and pushes the output to the `gh-pages` branch at a
versioned path plus a `latest` alias (`pnpm registry:publish`; see
`docs/REGISTRY_GUIDELINES.md` "Distribution"). All three distribution surfaces now
move in lockstep with a release: npm packages, the plugin marketplace pointer, and
the hosted registry.

**`publish-registry`'s `if:` is deliberately not "the `publish` job succeeded"
(PR #58 review, "Decouple registry publication from post-publish failures").**
`needs: publish` alone inherits GitHub's default gate — any non-success
conclusion of the `publish` job skips this one — but three of that job's steps
(the release record, the GitHub Release, the post-release smoke) run **after**
the irreversible `pnpm -r publish` and cannot undo it, so a failure in any of
them used to also withhold the registry for packages that had already shipped.
`if: ${{ !cancelled() && needs.publish.outputs.npm-published == 'true' }}` reads
a job `output` set from the **"Publish" step's own `outcome`** (not the job's
overall conclusion), so `publish-registry` now runs whenever `pnpm -r publish`
itself succeeded, regardless of what a later step in that job did, and still
correctly skips when the publish failed or the job was cancelled.

**`publish-registry` proves its own push credential before doing anything else**
(mirroring step 0's `NPM_TOKEN` check above), for the same reason: GitHub
documents that a push made with the workflow's default `GITHUB_TOKEN` does
**not** trigger a GitHub Pages "Deploy from a branch" build (`actions/toolkit#247`,
`JuliaDocs/Documenter.jl#1177`) — so without a maintainer-provided credential the
job would push to `gh-pages` successfully, report green, and the hosted registry
would simply never update. The "Verify Pages deploy credential" step fails loudly
when `secrets.PAGES_DEPLOY_TOKEN` is empty, and `actions/checkout` in this job is
given that token (not the implicit default) so the `git push` inside
`scripts/publish-registry-pages.mjs` inherits a credential that actually triggers
the Pages build.

**The workflow ASSERTS the marketplace pointer; it never writes it.** The pointer
is `.claude-plugin/marketplace.json` on the **default branch**, and it is already
written by `pnpm version:set` in § 2 and pushed by `git push origin main` in § 4 —
so by the time a tag exists, it is correct or the release should not proceed.
Having CI write and push it instead would mean granting the release job write
access to `main` and committing from a tag build, which is a materially larger
blast radius than the problem (a forgotten `git push origin main`) deserves —
especially since the assertion catches that case twice, before the publish
(`marketplace:check` preflight) and after it (`release:smoke`). This is a
deliberate divergence from #106's "the workflow updates the marketplace",
recorded here rather than left as a silent omission.

A `workflow_dispatch` trigger with `dry-run: true` (the default) runs everything
except the publish and the fresh-install smoke — useful for exercising the pipeline
without burning a version. Locally, `pnpm release:snapshot` produces the same
artifact set + records + manifest without touching the registry.

## 6. Confirm it actually published

The workflow's post-release verify **and** fresh-install smoke already do this and
fail the run if either does not hold. To check by hand:

```bash
gh release view v2.1.0
# and resolve a package from the registry, from outside the monorepo:
npm view @elabs-ai/components-ui@2.1.0
# the real thing — a fresh install of the published artifact in a scratch dir.
# No token: the packages are public. GITHUB_REPOSITORY (or --repo) + an
# authenticated `gh` let it read the plugin pointer off the DEFAULT BRANCH;
# without them it falls back to this checkout and says so, because that
# comparison is tautological here.
GITHUB_REPOSITORY=mreimitz/elabs-components pnpm release:smoke
```

## 7. Rollback

**Published versions are immutable.** GitHub Packages does not let you overwrite
or meaningfully un-publish a version, so "rollback" here means _deprecate + patch
forward_, never _undo_. Three cases:

### A bad published version

1. **Deprecate every package at that version, not just the broken one.** A release
   is lockstep, so a partial deprecation is worse than none — consumers would end
   up on a mixed set.

   The names come from the release's own `release-manifest.json` — the derived
   record `pnpm release:snapshot` wrote (#295). Never retype the package list: a
   hand-kept literal here is exactly what shipped v1.7.0 without `@brand/maps`.

   ```bash
   # needs `npm login` as a user with publish rights on the @elabs-ai scope; this is
   # the ONE npm command the repo permits by hand, precisely because CI cannot
   # un-publish for you.
   manifest=release/v1.10.0/release-manifest.json   # or the asset from that Release
   for p in $(node -p "JSON.parse(require('fs').readFileSync('$manifest','utf8')).packages.map(x=>x.name).join('\n')"); do
     npm deprecate "$p@1.10.0" "broken — use 1.10.1"
   done
   ```

   If you no longer have the folder, `gh release download v1.10.0 -p
release-manifest.json` fetches it — it is attached to every Release.

2. **Ship the fix forward as a patch** through `/release` — the same gates, a new
   tag. Never re-tag or force-push a tag: the tag is what the immutable versions
   were built from.
3. **Tell consumers to pin the previous minor**, and point them at that release's
   `.tgz` assets + the `file:` fallback in [`CONSUMING.md`](./CONSUMING.md) if they
   need to move before the patch lands.

### A bad plugin / marketplace pointer

`.claude-plugin/marketplace.json` is served **live from the repo**, so anyone who
ran `/plugin marketplace add <path-to-this-repo>` follows `main`.
Rollback is therefore a git operation, not a registry one:

```bash
git revert <the "release: vX.Y.Z" commit>   # restores both plugin manifests via the lockstep sites
pnpm version:check                          # all 16 sites agree again
git push origin main
```

The pinned `brand-ui-plugin-<v>.zip` on the previous GitHub Release is the offline
alternative. If the agent kit is what regressed, re-run `pnpm release:agent-kit` on
the fixed commit and attach it to the patch release.

**Rehearsal (2026-08-01).** Exercised on a scratch branch off `main`: reverting
the `release: v2.0.0` commit (`b9163e6`) restored **every** lockstep site to
1.9.0 — including `.claude-plugin/marketplace.json`, which is the pointer a plugin
consumer actually follows — and `pnpm version:check` agreed on 1.9.0 across all of
them on the reverted tree. (The rehearsal predates the `viewer` package, so the
count it printed is lower than today's; run `pnpm version:check` for the current
set rather than trusting a number written down here.) The only conflict
was `CHANGELOG.md` (the release commit moved its `## Unreleased` heading); resolve
it in favour of the current file — the changelog is not a rollback surface.

The `npm deprecate` path has **not** been rehearsed. It needs a real published bad
version and publish rights on the scope, and manufacturing one to practise is
worse than the risk it covers. Treat the commands above as untested-in-anger.

### A consumer who must downgrade offline

Point them at the previous release's `.tgz` assets and the `file:` install in
[`CONSUMING.md`](./CONSUMING.md). Their checksums are in that release's
`release-manifest.json`, which is how they can tell the tarball they downloaded is
the one that was built.

### Reconstructing what a version actually was

`release-record-<version>.zip` on each Release carries that version's
`CHANGELOG.md`, its extracted `RELEASE_NOTES.md`, and `ground-truth/` — the
component manifest, the component inventory and `llms.txt` + the per-package
spokes as they stood at the tag. Together with `validation-report.json` (which
gates ran, on which commit) and `release-manifest.json` (a SHA-256 for every asset
_and_ every record) that is the auditable record of a release: what shipped, what
validated it, and what an agent consuming that version was told.

## Consuming

See **[`CONSUMING.md`](./CONSUMING.md)** — the dependency block and the Tailwind
v4 + token wiring. There is no registry auth step any more: the packages are
public.

## Deprecations & support

See **[`DEPRECATION.md`](./DEPRECATION.md)** — how an export is marked
`@deprecated`, the deprecate-in-a-minor / remove-in-the-next-major timeline, what
a major's migration section must carry, and which versions get fixes. A release
that removes anything is a **major** and owes numbered migration steps in
`CHANGELOG.md`.

## Mechanics worth knowing

- `pnpm pack`/`publish` applies `publishConfig` (entry points flip to `dist/`)
  and rewrites `workspace:*` peers to the concrete version. Verified 2026-06-12
  and re-verified by `consumer:check` on every run.
- `files: ["dist", "src"]` keeps `.turbo/` logs and build configs out of the tarball.
- `release/` is throwaway and git-ignored — never commit it.
- The Claude Code plugin installs LIVE from the repo
  (`/plugin marketplace add <path-to-this-repo>`); the attached
  `brand-ui-plugin-<v>.zip` is the pinned/offline alternative, and
  `brand-ui-agent-kit-<v>.zip` is the sanitized consumer subset for other projects.
- `manifest:check` diffs a regenerated manifest against the **committed** one, so
  commit the regenerated `brand-ui.manifest.json` (+ inventory / llms / context)
  together with the bump — run `pnpm agent-docs` before committing.
