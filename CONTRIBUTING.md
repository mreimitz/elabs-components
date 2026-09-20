# Contributing to brand-ui

## Local setup

```bash
# Node >= 20, pnpm >= 9
corepack enable          # or: npm i -g pnpm
pnpm install
pnpm storybook           # Storybook on :6006
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

- Unit/smoke tests with Vitest + Testing Library: `pnpm --filter @elabs-ai/components-<pkg> test`.
- Every new component needs at least a render + key-behavior smoke test.
- Type safety: `pnpm typecheck`. Lint: `pnpm lint`. Format: `pnpm format`.

## Docs requirements

- Every component has a Storybook story (`tags: ["autodocs"]`) demonstrating its
  variants/states.
- Update `docs/` or `.claude/rules/` when you change a convention.
- Notable decisions get an ADR in `docs/ADR/`.

## Definition of done

A change is done when: `pnpm --filter @elabs-ai/components-<pkg> typecheck && lint &&
test` are green for every package touched; the component has a co-located story
(`tags: ["autodocs"]`) verified in both themes (`light`, `dark`) via Storybook; public
types are exported and the barrel export is updated; semantic tokens only, no raw hex;
and `/review-component` (or the `brand-ui-reviewer` agent for anything bigger than a
tweak) has run. `pnpm check:changed` scopes typecheck/lint/test to your diff;
`pnpm check` runs every repo convention rule and `pnpm check:test` their self-tests.
Full catalogue: `docs/GATES.md`.

## Borrowed from another project? Credit it in the same change

If you vendor, adapt, port, copy or re-express anything from another project —
code, a design, sample data, an image, a technique — add it to
`scripts/attributions.sources.json` (name, canonical URL, licence and copyright
read from the upstream's actual LICENSE file — never from a badge or README) and
run `pnpm gen`. That regenerates both [`ATTRIBUTION.md`](ATTRIBUTION.md)
and the in-product `AttributionPanel` from one dataset.

A comment saying `// Adapted from foo` is a useful pointer, but it is **not** an
attribution — `pnpm check --rule attribution-provenance` fails on one whose upstream is
not credited. Never hand-add an npm dependency; those are harvested from the
manifests.

## Self-maintaining repo (enforcement over reminders)

brand-ui stays correct because **machinery enforces its conventions**, not because
contributors remember to. So when you introduce a convention — a new file that must be
registered, a new inventory that must stay fresh, a new rule everything must follow —
**ship its enforcement in the same change**: a generator (so the artifact is produced,
not hand-kept) and/or a gate/hook (so a violation _fails CI_, not merely _warns in a
doc_). A convention documented only in prose is incomplete and will drift.

Plug into the existing machinery rather than inventing a parallel one: a generator joins
`pnpm gen` (freshness via `pnpm gen:check`), a rule joins `pnpm check` as one
`scripts/check/rules/<id>.mjs` with pass/fail fixtures that `pnpm check:test` runs, so the
rule can't silently rot (`scripts/check/README.md`). Catalogue: `docs/GATES.md`.

## Release cadence & ownership

- **Cadence: on demand, by the maintainer.** Merging the "Release: version packages" PR
  publishes (runbook: [`docs/RELEASING.md`](./docs/RELEASING.md)); only
  `.github/workflows/release.yml` publishes.
- **Deprecations, breaking changes and the support window:**
  [`docs/DEPRECATION.md`](./docs/DEPRECATION.md) — deprecate in a minor, remove
  in the next major, ship migration steps in `CHANGELOG.md`.
- **Ownership** is not currently recorded in a CODEOWNERS file, so there is no automatic
  reviewer assignment (branch protection is also not available on this repo's plan).
  Route a review through `/review-component` or the `brand-ui-reviewer` agent — see
  "Definition of done" above — before merging anything bigger than a tweak.
- **Does a new component earn a place in a package?** There is no separate RFC
  process — use the two checks that already exist: a **dedupe/reuse audit** first
  (does this already exist across `@elabs-ai/components-*` or `registry/`?) and
  decision **D4** in [`docs/DECISIONS.md`](./docs/DECISIONS.md) (stable shared
  primitive → package; prototype-specific composition → copy-own registry block).

### Changesets

- A PR that changes what a consumer of a shipped package gets runs `pnpm changeset` and
  commits the file: bump (patch / minor / major) plus one consumer-facing line.
- Every distributable is in one `fixed` group (`.changeset/config.json`), so versions stay
  lockstep; root, plugin and MCP versions follow via `scripts/sync-version-extras.mjs`.
- Test-, story- and app-only PRs need no changeset.

## Registry item requirements

- Source file(s) under `registry/` + an entry in `registry/registry.json`.
- Accurate `dependencies`/`registryDependencies`/`files[]`; `target` for pages.
- `pnpm check --rule registry-validate` must pass. See `docs/REGISTRY_GUIDELINES.md`.

## Pull request checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (unit/smoke)
- [ ] `pnpm build` passes
- [ ] `pnpm format:check` clean
- [ ] `pnpm check` and `pnpm check:test` pass
- [ ] `pnpm check --rule registry-validate` passes (if registry touched)
- [ ] Stories added/updated; component works in both themes
- [ ] Public types exported; barrel export updated
- [ ] No raw colors outside `themes.css`; no paid deps; no secrets/absolute paths
- [ ] Docs/ADR updated if conventions changed
- [ ] Anything borrowed from another project is credited in
      `scripts/attributions.sources.json` and `pnpm gen` was run
- [ ] Enforcement over reminders: a new convention ships with a generator and/or a
      gate/hook (not just a doc note) — see "Self-maintaining repo" above

CI runs the full pipeline on every push; run `pnpm check` and `pnpm check:test` locally
before opening a PR.
