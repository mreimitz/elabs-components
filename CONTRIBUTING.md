# Contributing to brand-ui

## Local setup

```bash
# Node >= 20, pnpm >= 9
corepack enable          # or: npm i -g pnpm
pnpm install
pnpm storybook                # Storybook on :6006
pnpm playground          # Vite on :5173
```

## Branch style

- `feat/<scope>-<short-desc>` — new component/feature
- `fix/<scope>-<short-desc>` — bug fix
- `chore/<scope>-<short-desc>` — tooling/docs/maintenance

Keep changes scoped to one concern per PR where possible.

## Component development workflow

1. Scaffold: `/new-component <pkg> <Name> [purpose]` (or copy an existing
   component's folder structure).
2. Implement following `docs/COMPONENT_GUIDELINES.md` and `.claude/rules/*`:
   semantic tokens only, `forwardRef` + `className` + `cn()`, variants via `cva`,
   Radix for interactive behavior, exported types.
3. Co-locate `component.tsx`, `index.ts`, `*.stories.tsx`, `*.test.tsx`.
4. Add the barrel export in the package's `src/index.ts`.
5. Verify in Storybook across both themes.

## Testing

- Unit/smoke tests with Vitest + Testing Library: `pnpm --filter @qlik-coe-emea/qlabs-components-<pkg> test`.
- Every new component needs at least a render + key-behavior smoke test.
- Type safety: `pnpm typecheck`. Lint: `pnpm lint`. Format: `pnpm format`.

## Docs requirements

- Every component has a Storybook story (`tags: ["autodocs"]`) demonstrating its
  variants/states.
- Update `docs/` or `.claude/rules/` when you change a convention.
- Notable decisions get an ADR in `docs/ADR/`.

## Self-maintaining repo (enforcement over reminders)

brand-ui stays correct because **machinery enforces its conventions**, not because
contributors remember to. So when you introduce a convention — a new file that must be
registered, a new inventory that must stay fresh, a new rule everything must follow —
**ship its enforcement in the same change**: a generator (so the artifact is produced,
not hand-kept) and/or a gate/hook (so a violation _fails CI_, not merely _warns in a
doc_). A convention documented only in prose is incomplete and will drift.

Plug into the existing gate set rather than inventing a parallel one — `pnpm docs:check`,
`manifest:check`, `components:check`, `agents:check`, `ai:types-only`, `lucide:check`,
`charts:reuse:check` (each with a `*:check:test` self-test so the gate can't silently
rot). Full principle: `.claude/rules/quality-gates.md` → "Enforcement over reminders".

## Release cadence & ownership

- **Cadence: on demand, by the maintainer.** There is no train and no calendar —
  a release is cut when there is something worth shipping, with
  **`/release <version>`** (runbook: [`docs/RELEASING.md`](./docs/RELEASING.md)).
  You prepare and verify locally; `.github/workflows/release.yml` is the only
  thing that publishes.
- **Versioning is lockstep**, across all 16 sites, written only by
  `pnpm version:set X.Y.Z` and enforced by `pnpm version:check`. No independent
  per-package versioning, and **no Changesets** — that direction was proposed
  (issue #104), weighed and rejected in ADR
  [`0020`](./docs/ADR/0020-lockstep-versioning.md), which records why and what it
  costs; do not reintroduce a `.changeset/` directory.
- **A package-affecting change records itself in `CHANGELOG.md`.** If your branch
  touches `packages/<pkg>/src/**` of a shipped package, add a line under
  `## Unreleased` saying what a **consumer** gets. `pnpm changelog-entry:check`
  (in the CI battery) fails a branch that does not — the lockstep stand-in for
  "a changeset is required for package-affecting PRs" (#64). Test-only,
  story-only and app-only changes are exempt; `## Unreleased` is what `/release`
  renames into the release notes, so an unrecorded change ships undocumented.
- **Deprecations, breaking changes and the support window:**
  [`docs/DEPRECATION.md`](./docs/DEPRECATION.md) — deprecate in a minor, remove
  in the next major, ship migration steps in `CHANGELOG.md`.
- **Ownership** is recorded in [`.github/CODEOWNERS`](./.github/CODEOWNERS)
  (automatic review requests; branch protection is not available on this repo's
  plan, so it documents ownership rather than blocking a merge).
- **Does a new component earn a place in a package?** There is no separate RFC
  process — use the two gates that already exist: the **dedupe/reuse audit** at
  the top of `.claude/rules/quality-gates.md` (does this already exist across
  `@qlik-coe-emea/qlabs-components-*` or `registry/`?) and decision **D4** in
  [`docs/DECISIONS.md`](./docs/DECISIONS.md) (stable shared primitive → package;
  prototype-specific composition → copy-own registry block).

## Registry item requirements

- Source file(s) under `registry/` + an entry in `registry/registry.json`.
- Accurate `dependencies`/`registryDependencies`/`files[]`; `target` for pages.
- `pnpm registry:validate` must pass. See `docs/REGISTRY_GUIDELINES.md`.

## Pull request checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (unit/smoke)
- [ ] `pnpm test:e2e` passes (Playwright; `pnpm test:e2e:install` first) — and add
      an E2E test for any new flow
- [ ] `pnpm build` passes
- [ ] `pnpm format:check` clean
- [ ] `pnpm registry:validate` passes (if registry touched)
- [ ] Stories added/updated; component works in both themes
- [ ] Public types exported; barrel export updated
- [ ] No raw colors outside `themes.css`; no paid deps; no secrets/absolute paths
- [ ] Docs/ADR updated if conventions changed
- [ ] Enforcement over reminders: a new convention ships with a generator and/or a
      gate/hook (not just a doc note) — see "Self-maintaining repo" above

Run `/prepare-release` to execute the full gate locally before opening a PR.
