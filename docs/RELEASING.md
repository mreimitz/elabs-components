# Releasing brand-ui

Public npm packages under `@elabs-ai` on [npmjs.org](https://registry.npmjs.org/)
(ADR [0030](./ADR/0030-public-npm-distribution.md)), versioned and published by
[Changesets](https://github.com/changesets/changesets) from CI. Never run `pnpm publish` by hand.

## 1. Every PR: add a changeset

A PR that changes what a consumer gets runs `pnpm changeset`: pick patch / minor / major and
write one consumer-facing line. Breaking API/token/package change → major; new component or
export → minor; fixes → patch. Test-, story- and app-only PRs need none.

All distributable packages are one `fixed` group in `.changeset/config.json`, so they always
share one version (lockstep). A test in `scripts/sync-version-extras.test.mjs` fails if a
distributable package is missing from that group.

## 2. The Version PR

Each push to `main` runs `.github/workflows/release.yml` (`changesets/action`). With pending
changesets it opens or updates **"Release: version packages"**, produced by
`pnpm changeset:version`:

1. `changeset version` — bumps the whole fixed group, writes each package's `CHANGELOG.md`,
   deletes the consumed changesets;
2. `node scripts/sync-version-extras.mjs` — stamps the same version on the sites Changesets
   does not know: root `package.json`, `.claude-plugin/plugin.json`,
   `.claude-plugin/marketplace.json` (the pointer `/plugin marketplace add` consumers follow)
   and `SERVER_INFO.version` in `packages/cli/lib/mcp.mjs`;
3. `pnpm install --lockfile-only`.

`pnpm check` (its version-sync rule) fails when those sites drift from the packages.
Review the PR like any other: CI runs the full pipeline on it, including `pnpm consumer:check`
(packs every package, installs the tarballs into a throwaway Vite app and builds it).

## 3. Merge → publish

Merging the Version PR leaves no pending changesets, so the next run publishes:

0. **`storybook-gate`** — the Storybook interaction + axe run, light and dark, as a
   `needs:` of the release job. See § Gates below for why it is duplicated here.
1. **Release mode** — publishes only if some distributable's version is not on npm yet
   (a routine push builds nothing; a partial publish resumes);
2. **Registry authentication** — fails loudly if `secrets.NPM_TOKEN` is empty, then `npm whoami`;
3. `pnpm release:publish` = `turbo run build --filter=./packages/* && changeset publish` — `access: public`,
   provenance via `NPM_CONFIG_PROVENANCE` (best-effort), git tags and a GitHub Release per
   package (`@elabs-ai/components-<pkg>@<version>`);
4. `release:agent-kit` + `release:plugin` zips, attached to the `@elabs-ai/components-cli` Release
   (check the plugin locally first: `claude plugin validate . --strict`);
5. **`pnpm release:smoke`** — installs every published package **from the registry** in a
   scratch dir, asserts each `exports` entry is in the tarball, runs the published CLI
   (`info --json`, `docs Button`) and checks the marketplace pointer on the default branch;
6. **`publish-registry`** — builds the shadcn registry and pushes it to `gh-pages`
   (`r/<version>/` + `r/latest/`). Needs `secrets.PAGES_DEPLOY_TOKEN`: a push with the
   default `GITHUB_TOKEN` does not trigger a Pages build. Runs whenever the npm publish
   succeeded, even if a later step of the release job failed.
7. **`deploy-docs`** — deploys **Storybook** to its own Vercel project
   (`storybook.elabs-ai.com`) from the newest `@elabs-ai/components-cli@<version>` tag,
   then checks that its `/mcp` reports that version and **crawls every story the
   deployed Storybook serves** (`node scripts/release-smoke.mjs --stories-only`),
   failing on a visible error overlay, an uncaught page error, or a chart that measured
   to nothing.
8. **`deploy-home`** — deploys the **website** to the project that owns the public
   addresses, then runs `node scripts/site-smoke.mjs` against **both**
   `https://elabs-components.vercel.app` and `https://elabs-ai.com`: every path a
   consumer or an agent opens, on each address, plus 30 sampled stories crawled through
   `/storybook/` on the canonical one. It runs after `deploy-docs` on purpose — the site
   reaches Storybook by rewriting `/storybook`, so the other order leaves the previous
   release's Storybook behind the current site.

   Vercel's Git integration is off in both projects (`git.deploymentEnabled: false` in
   each app's `vercel.json`), so pushes to `main` never deploy: production keeps the
   previous release until these jobs replace it. Both need `secrets.VERCEL_TOKEN` (a
   token scoped to the `elabs-ai` Vercel team). Redeploy the current release by hand: run
   the Release workflow with **deploy-docs** and/or **deploy-home** ticked.

   Which project is which, and what each address serves, is the operations table in
   [ADR 0038](./ADR/0038-home-site-in-apps-home.md) — including why `.vercelignore` at the
   repo root is what makes a CLI deploy possible at all.

Watch with `gh run list --workflow=Release`. Confirm: `npm view @elabs-ai/components-ui@<v>`,
or re-run the smoke from a checkout: `GITHUB_REPOSITORY=mreimitz/elabs-components pnpm release:smoke`.

## Gates — what can actually stop a release

**A red `ci.yml` does not.** `ci.yml` and `release.yml` are both triggered by the push
to `main` and nothing connects them; `main` carries no required status checks
(`gh api repos/:owner/:repo/branches/main/protection` returns no
`required_status_checks`), which is what makes a direct push to `main` possible at all.
On 2026-09-17 that combination shipped a docs site whose stories were throwing, from a
release workflow that was green.

Two halves fix it, and only one of them lives in this repo:

- **In the repo (done).** `release.yml` runs the Storybook interaction + axe job itself
  as `storybook-gate`, and `release` has `needs: storybook-gate`. The same command as
  `ci.yml`, deliberately duplicated: it is the one job whose failure must stop a
  publish, with no repository setting in the loop. The post-deploy story crawl in
  `deploy-docs` is the second half of the same idea, aimed at the artefact rather than
  the source, and `deploy-home`'s two `site-smoke` runs are the third: they open the
  addresses a consumer opens, which is the one thing neither build log can report.
- **In repository settings (for a maintainer).** Make the CI jobs required on `main`, so
  a red run also stops the merge and not only the publish:

  ```bash
  gh api -X PUT repos/mreimitz/elabs-components/branches/main/protection \
    -F required_status_checks[strict]=true \
    -F 'required_status_checks[contexts][]=Storybook interaction + axe (light)' \
    -F 'required_status_checks[contexts][]=Storybook interaction + axe (dark)' \
    -F 'required_status_checks[contexts][]=Quality' \
    -F enforce_admins=false -F required_pull_request_reviews=null -F restrictions=null
  ```

  This changes who can push to `main`, so it is a deliberate maintainer decision, not
  something a workflow file can do for you.

## 4. Rollback

Published versions are immutable: roll back by **deprecate + patch forward**.

- **Bad version** — deprecate every distributable at that version (lockstep; a partial
  deprecation leaves consumers on a mixed set), then ship a patch changeset:

  ```bash
  for p in $(node --input-type=module -e "import { distributablePackages } from './scripts/lib/distributables.mjs'; for (const p of distributablePackages()) console.log(p.name)"); do
    npm deprecate "$p@1.10.0" "broken — use 1.10.1"
  done
  ```

  Not rehearsed; needs `npm login` with publish rights on `@elabs-ai`.

- **Bad plugin pointer** — `.claude-plugin/marketplace.json` is served live from `main`:
  `git revert` the Version PR's merge, `pnpm check`, push.

## See also

[`CONSUMING.md`](./CONSUMING.md) (install + Tailwind wiring) ·
[`DEPRECATION.md`](./DEPRECATION.md) (deprecate in a minor, remove in the next major).
`pnpm pack`/`publish` applies `publishConfig` (entry points flip to `dist/`) and rewrites
`workspace:*` ranges. `release/` is git-ignored scratch output — never commit it.
