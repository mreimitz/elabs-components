# 08 · Release process — validate everything, then cut one coordinated release (plugin + library)

> Part of the **enterprise-gap** pack. The full design for how brand-ui cuts a release: a hard
> **validation gate** (quality + documented + wired + assets in place), one **coordinated version** for
> the library _and_ the plugin, a built **`release/<version>/` snapshot**, and automated publish +
> registry/marketplace updates. Actioned as **WP-14** (which depends on WP-01 CI, WP-10 gates, WP-07
> versioning). This is the **capstone** that composes every enforcement the rest of the program builds.

## Where we are today (honest)

**There is no release process.** What exists:

- `/prepare-release` — a _local_ checklist that runs `format:check / lint / typecheck / test / build /
registry:validate` + per-package `package.json` checks, then prints a green/red table and **tells a
  human to publish manually** ("do NOT run publish or push yourself").
- Build blocks only: `registry:validate`, `registry:build`, `manifest`, `skills:build`.

What's missing: **no Changesets, no CHANGELOG, no CI / release workflow, no `release/` folder, no
coordinated plugin+library versioning** (all packages + plugin hand-synced at `0.1.0`), no publish or
marketplace automation. Packages are `private:true` with `publishConfig` (internal distribution). So:
good _local validation_, zero _release engineering_.

## Principles

1. **One coordinated version for the whole system.** Every `@qlik-coe-emea/qlabs-components-*` package **and** the plugin move
   together at the same SemVer (a Changesets **fixed/locked group**). A "release" is always **plugin +
   library + components**, never one without the other — exactly the requirement.
2. **Nothing ships unvalidated.** A single **blocking gate** must be fully green before a version is
   cut. The gate proves quality _and_ that everything is documented, wired, registered, and that all
   assets are present.
3. **Enforcement over reminders.** The gate is **CI-run** (a `release.yml` workflow), not a human
   checklist. The release _composes_ the WP-01 CI + WP-10 gates — it doesn't re-implement them.
4. **Every release is an immutable, auditable snapshot** under `release/<version>/`, including the
   validation report — so any version is reproducible and the last-good state is restorable.
5. **No drift at the boundary.** Generated artifacts (manifest, registry, context file, catalog,
   inventories, CHANGELOG) are regenerated and **diff-checked** as part of the gate (the C5 lesson).

## Versioning model

- **SemVer**, driven by **Changesets**. Contributors add a changeset per change (patch/minor/major +
  a human note). At release, Changesets computes the bump and writes the CHANGELOG.
- **Locked group:** configure Changesets so all `@qlik-coe-emea/qlabs-components-*` packages + the plugin version **together**
  (one number). A breaking change in any package = a major for the whole system (simple, predictable
  for consumers; matches "always release them together").
- **Pre-release channels** (optional): `next`/`rc` tags for previews.
- The **plugin version is derived from the system version** (`.claude-plugin/plugin.json` +
  `marketplace.json` bumped in lockstep) — no more hand-syncing.

## The validation gate (must be 100% green before cutting)

This is "validate first full quality / documented / wired / in place / assets present," enumerated.
Each item is a CI check; **any red blocks the release.** Grouped A–I:

### A · Code quality (the `/prepare-release` seed, automated)

- clean git tree (no uncommitted junk) · `pnpm install --frozen-lockfile` · `format:check` · `lint` ·
  `typecheck` · `test` (unit) · `build` (all packages → `dist`) · `test:e2e` (Playwright) ·
  `pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook` (interaction + axe) · `registry:validate`.

### B · Coverage & accessibility (WP-02 / WP-10)

- every component has a **story** + a **smoke test** (no zero-story/zero-test packages); coverage
  threshold met · committed **six-theme AA audit** artifact, **zero P0 contrast** failures.

### C · Freshness — generated artifacts not stale (WP-03 / WP-10 / WP-12)

Regenerate, then `git diff --exit-code` each (fail if stale):

- `brand-ui.manifest.json` · the generated **context file** + decision summary (WP-12) · the **component
  index** + package tables (WP-10 G3) · the **A2UI catalog** (if present, WP-11) · the **CHANGELOG**.

### D · Wiring & registration (WP-10)

- every **package** registered everywhere (`check-package-registered`) · every **component** registered
  (barrel + story + manifest — `check-component-registered`) · skills/commands/agents enumerated · the
  **plugin manifest references only things that exist, and everything that exists is referenced** (no
  orphaned or dangling skills/agents/hooks/MCP).

### E · Assets present (the "check all other assets are in place")

- every **file referenced resolves**: registry `files[]` paths exist; skill/doc asset links resolve;
  no dangling references · **bundled plugin assets** present (icons, brand marks, templates, playbooks,
  themes) · the icon set + templates that should ship are shipped (WP-13) · **every theme overrides
  every token** (no fallback holes); **no orphan theme** (the `acme` check).

### F · Plugin validity (the plugin half of the release)

- `plugin.json` + `marketplace.json` **validate against schema** · **plugin version == system version**
  · `skills:build` (multi-harness mirror) clean · `.mcp.json` declarations resolve · **fresh-install
  smoke**: the plugin installs + a skill runs in Claude Code (and, where possible, Cowork).

### G · Documentation complete & accurate

- README / PROJECT / AGENTS / CLAUDE / CONTRIBUTING **accurate** (doc-truth guard — no false claims
  like the CI/"four themes" drift) · **CHANGELOG entry** for this version · new components documented ·
  ADRs for new decisions · the WP-12 guidance current · **migration notes + codemods** if anything
  breaking (WP-07 deprecation policy).

### H · Safety & compliance

- no secrets / `.env` / absolute machine paths · **no raw hex outside `themes.css`** · **no paid deps**
  · license fields present · **SemVer correctness**: a breaking change requires a **major** bump **and**
  a migration note (cross-check the changeset against the diff).

### I · Release intent

- a **changeset exists** describing the release; the computed bump matches intent; the release owner
  (CODEOWNERS) approves.

> The gate emits a **validation report** (green/red per check) that is stored in the release snapshot —
> auditable proof the version was validated.

## The release steps (after the gate is green)

1. **Version:** `changeset version` → bump the locked group across all `@qlik-coe-emea/qlabs-components-*` packages + plugin +
   `marketplace.json`; regenerate per-package + root **CHANGELOG**.
2. **Build everything (plugin + library):** `pnpm build` (packages → `dist`) · `registry:build`
   (shadcn → hostable JSON) · `manifest` + context + component index + A2UI catalog · `skills:build`
   (multi-harness) · package the plugin bundle.
3. **Snapshot:** create `release/<version>/` (contents below) incl. the **validation report** + a
   `release-manifest.json` (versions, git SHA, date, checksums, asset list).
4. **Commit + tag:** commit the version bumps + CHANGELOG + the snapshot; tag `v<version>`.
5. **Publish (all registries updated):**
   - **Library** → internal npm registry (or `npm pack` tarballs in the snapshot if not publishing).
   - **Component registry** → host the built shadcn JSON so `npx shadcn add` serves the new version.
   - **Plugin** → updated `marketplace.json` so `/plugin` (Code) + Cowork install the new version.
   - **GitHub Release** with notes from the CHANGELOG.
6. **Post-release verify:** fresh-install smoke in a scratch app — install the plugin, `npx shadcn add`
   a block, import a package, run `brand-ui context`; confirm the marketplace serves the new version.
7. **Close the cycle:** (optional) bump to the next dev/pre-release; announce (CHANGELOG + internal
   comms).

## The `release/<version>/` snapshot — contents

An immutable, auditable record per version (the user's "new version subfolder"):

```
release/<version>/
├─ release-manifest.json     # version, git SHA, date, package+plugin versions, checksums, asset list
├─ validation-report.md      # the green/red gate results (proof it was validated)
├─ RELEASE_NOTES.md          # human notes (from CHANGELOG)
├─ CHANGELOG.md              # changes in this version
├─ registry/                 # the built shadcn registry JSON (hostable component distribution)
├─ plugin/                   # the plugin bundle snapshot (.claude-plugin + compiled skills)
└─ ground-truth/             # brand-ui.manifest.json + context file + component index + A2UI catalog
```

> **Design note (be deliberate):** store the **distributable + manifests + report + notes**, not heavy
> transient build output. For library packages, store **`npm pack` tarballs** (small, installable,
> checksummed) rather than raw `dist/` trees — or rely on the npm registry + git tag and keep
> `release/<version>/` as the _record_ (manifest + report + registry/plugin/ground-truth). Pick one and
> keep it consistent; don't commit `node_modules`/build junk. The snapshot's job is **auditability +
> restorability**, not being the build cache.

## Automation (the actual process, not a checklist)

- **`release.yml` CI workflow** — triggered by `workflow_dispatch` or by merging the Changesets
  "Version Packages" PR. Runs: **gate (A–I) → version → build (plugin+library) → snapshot → tag →
  publish → post-release verify**. This is the source of truth; it **reuses** the WP-01 CI jobs + the
  WP-10 gates (compose, don't duplicate).
- **`pnpm release` / `/cut-release` command** — a local mirror for dry-runs (`--dry-run` produces the
  snapshot + validation report **without** tagging/publishing), so a maintainer can preview a release.
- Supersedes `/prepare-release` (which becomes the local "run the gate" entry point feeding this).

## Governance, rollback, cadence

- **Owner:** a release owner / CODEOWNERS approves (gate I). **Cadence:** on-demand or per-sprint
  (state it in CONTRIBUTING).
- **Rollback:** if a release is bad — revert the `marketplace.json` pointer to the last good version
  (instant for plugin/registry consumers), deprecate the bad package versions (WP-07 policy), and the
  `release/<previous>/` snapshot is the restorable last-good state. A breaking issue → a follow-up
  patch release through the same gate.
- **Pre-release:** `rc`/`next` channels for risky changes before a stable cut.

## How this composes the rest of the program

The release gate is literally "**run all the enforcement at once**": WP-01 (CI), WP-02 (coverage),
WP-10 (manifest/registration/inventory/stale + types-only), WP-12 (guidance fresh), WP-13 (assets/
templates/icons present), WP-11 (catalog fresh), WP-07 (Changesets/versioning/deprecation). So WP-14
(the release pipeline) is the **last** thing to build — it depends on those gates existing — but
designing it now tells every earlier package _what its check must plug into_.

## Answering the brief directly

- **Cuts a release?** → the `release.yml` workflow / `pnpm release` (step list above).
- **New version subfolder in `release/`?** → `release/<version>/` immutable snapshot (above).
- **Validate first — full quality, documented, wired, in place, all assets present?** → the A–I gate;
  100% green required, with a stored validation report.
- **Always plugin + library + components together?** → one locked SemVer; dual build + dual publish;
  the snapshot contains both. ✅

---

_Related: WP-14 (this, the pipeline), WP-07 (Changesets/versioning/deprecation), WP-01 (CI), WP-10
(gates), WP-13 (assets), WP-12 (guidance), WP-11 (catalog); `/prepare-release` (the seed)._
