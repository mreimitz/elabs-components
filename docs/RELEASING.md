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

`pnpm version-sync:check` (in the gate battery) fails when those sites drift from the packages.
Review the PR like any other: CI runs the battery on it, including `pnpm consumer:check`
(packs every package, installs the tarballs into a throwaway Vite app and builds it).

## 3. Merge → publish

Merging the Version PR leaves no pending changesets, so the next run publishes:

1. **Release mode** — publishes only if some distributable's version is not on npm yet
   (a routine push builds nothing; a partial publish resumes);
2. **Registry authentication** — fails loudly if `secrets.NPM_TOKEN` is empty, then `npm whoami`;
3. `pnpm release:publish` = `pnpm build:packages && changeset publish` — `access: public`,
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

Watch with `gh run list --workflow=Release`. Confirm: `npm view @elabs-ai/components-ui@<v>`,
or re-run the smoke from a checkout: `GITHUB_REPOSITORY=mreimitz/elabs-components pnpm release:smoke`.

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
  `git revert` the Version PR's merge, `pnpm version-sync:check`, push.

## See also

[`CONSUMING.md`](./CONSUMING.md) (install + Tailwind wiring) ·
[`DEPRECATION.md`](./DEPRECATION.md) (deprecate in a minor, remove in the next major).
`pnpm pack`/`publish` applies `publishConfig` (entry points flip to `dist/`) and rewrites
`workspace:*` ranges. `release/` is git-ignored scratch output — never commit it.
