# `parked/` — work taken out of the build, kept in the repo

A directory under `parked/` is source the maintainer has **withdrawn from the release, the
website and Storybook** but does not want deleted. It stays in git so its history survives and
so it can be revived as a unit.

## What "parked" means, exactly

`parked/` is **not a pnpm workspace member.** `pnpm-workspace.yaml` admits `apps/*`,
`packages/*` and `registry` — nothing else. Everything below follows from that one fact:

| Tool                      | Sees `parked/`? | Why                                                          |
| ------------------------- | --------------- | ------------------------------------------------------------ |
| pnpm, Turborepo           | no              | not a workspace member, so no package, no task                |
| TypeScript (`typecheck`)  | no              | every `tsconfig` is package-scoped                            |
| ESLint (`lint`)           | no              | no root config; each package runs `eslint .` in its own cwd   |
| Vitest (`test`)           | no              | turbo only runs a workspace member's `test`                   |
| Storybook                 | no              | `apps/docs/.storybook/main.ts` globs `packages/` only         |
| The manifest crawl, `gen` | no              | every input path is anchored inside `packages/` or `apps/`    |
| npm tarballs              | no              | no `.npmignore`; every `files` array is package-relative      |

Three surfaces were **not** inert by default and carry one line each. They are the only
machinery parking needs, and each one names this file:

- `.prettierignore` — the root script is `prettier --check .`
- `.vercelignore` — both projects deploy from the repo root and the CLI walks the whole tree
- `scripts/check/context.mjs` — `listRepoFiles()` is `git ls-files`, so the repo-wide check rules
  would otherwise scan `parked/`. The filter sits once in `createFsContext` so every rule
  inherits it.

## Rules while something is parked

- **Do not import from `parked/` anywhere in `apps/`, `packages/`, `registry/` or `scripts/`.**
  Nothing builds it, so such an import fails at build time on a clean checkout, not here.
- Do not "fix" it in place. Parked code is frozen: no typecheck, no tests, no stories, no lint.
  It will not compile against a moved API, and that is expected.
- Do not delete it without the maintainer saying so.
- To bring it back, follow that pack's own `REVIVE.md` — it is the exact inverse of the parking
  and is the reason the parking does not have to be re-derived.

## What is parked

| Pack                        | Parked     | Why                                                                              | Revive                              |
| --------------------------- | ---------- | -------------------------------------------------------------------------------- | ----------------------------------- |
| [`dashboard-pack`](./dashboard-pack/) | 2026-09-22 | The drag-and-drop dashboard sheet's authoring experience was not good enough to ship. The data model is sound; the UX is not. ADR 0037 is **parked, not reversed**. | [`REVIVE.md`](./dashboard-pack/REVIVE.md) |
