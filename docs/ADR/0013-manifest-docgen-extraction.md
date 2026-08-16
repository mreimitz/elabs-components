# ADR 0013 — Manifest docgen: resolved prop tables via `react-docgen-typescript`

- **Status:** Accepted
- **Date:** 2026-06-09
- **Deciders:** brand-ui-design-system-architect (design gate for WP-03 #79)
- **Supersedes / relates to:** complements the dependency-free `extractVariants` /
  `extractPropTable` already in `packages/cli/lib/core.mjs` (the cva + own-prop half,
  shipped on `feat/wp03-79-cva-variants`); this ADR covers ONLY the remaining
  inherited-prop-resolution half of #79.

## Context

`brand-ui.manifest.json` is the anti-hallucination ground truth the `brand-ui` skill,
CLI (`brand-ui docs`), llms.txt and context files all read. Today the manifest's prop
data is produced by a deterministic, **dependency-free** regex/brace scanner
(`extractPropTable`) that captures a component's _own-declared_ props (name, optional,
type text, leading TSDoc) plus the literal `extends` clause — but it deliberately does
**not resolve inherited types**. An agent sees `extends ButtonHTMLAttributes<…>,
VariantProps<typeof buttonVariants>` as a string, not the expanded inherited surface,
and TSDoc descriptions/defaults from base interfaces are absent.

`@elabs/components-cli` is, by stated invariant in its own header, **dependency-free** (zero
runtime deps; the `package.json` has no `dependencies` key). Adding a docgen engine is
therefore a structural change to a package whose dependency-freeness is a feature, and
it churns the lockfile — both are architect-gated calls.

The cva-variant-expansion slice of #79 already shipped (`feat/wp03-79-cva-variants`),
so this ADR scopes #79 to the **react-docgen prop-table half only**.

## Options considered

1. **`react-docgen-typescript`** — the engine Storybook autodocs uses. Resolves the
   full TS type, inherited props, defaults and TSDoc per component. Output aligns with
   the docs site (same engine), which is the whole point of "the manifest agrees with
   Storybook." Mature, OSS (MIT), widely used. Heavier: it spins a TS program.
2. **`ts-morph`** — a TS-compiler-API wrapper. More general (we'd hand-write the
   prop-resolution walk), more control, but we'd reimplement what `react-docgen-typescript`
   already does and risk diverging from Storybook's resolution.
3. **Hand-rolled TS-compiler-API pass** (`typescript` `createProgram` directly) — no
   new dep beyond `typescript` (already present), maximum control, but the most code to
   own and maintain, and again diverges from Storybook's resolver.

## Decision

Adopt **`react-docgen-typescript`** as a **dev dependency of `@elabs/components-cli`**.

- It is the engine Storybook's `@storybook/react-vite` docgen uses, so the manifest's
  resolved prop tables match what the docs site shows — one resolution source of truth,
  no "the CLI says X but autodocs says Y" drift.
- It does the inherited-prop + default + description resolution we'd otherwise hand-roll
  against the TS compiler API (option 3), at the cost we'd pay anyway.
- It is MIT-licensed and free — clears the no-paid-deps constraint.

### Why this does NOT break the "dependency-free CLI" invariant

The invariant that matters is the **runtime** one: `brand-ui <cmd>` (info/search/docs/
context) must run with zero install in a consumer repo, reading the committed
`brand-ui.manifest.json`. That invariant is preserved:

- `react-docgen-typescript` is a **`devDependency`**, used ONLY by `generateManifest`
  during `pnpm manifest` (a maintainer/CI build step), never by the shipped `bin/` or
  `lib/` read path. The committed manifest is the artifact consumers read; producing it
  may use a heavier toolchain.
- The seam is isolated to a **new module** `packages/cli/lib/docgen.mjs` that is
  imported only from `generateManifest`'s extraction step and is **best-effort**: if the
  docgen pass throws or a generic prop won't resolve, it falls back to the existing
  dependency-free `extractPropTable` output (#79 risk note: "some complex generic props
  won't resolve cleanly — fall back to the raw type string, don't crash"). The
  dependency-free scanner stays as the floor; docgen enriches on top.

### Integration seam

- `generateManifest(repoRoot)` in `core.mjs` already calls `collectProps`. Add a
  `resolveProps` step (new `lib/docgen.mjs`) that, per package, runs
  `react-docgen-typescript` over the component source files and **merges resolved
  inherited props + defaults + descriptions** into the existing `props` table, keyed by
  component, with the dependency-free table as fallback.
- Manifest shape: extend each `props[Component]` entry with resolved fields
  (`defaultValue`, resolved `type`, `description`) — additive, so existing readers
  (`render-docs.mjs`, `brand-ui docs`) keep working; `brand-ui docs <Component>` prints
  the richer table when present.
- Cache/scope: docgen over ~160 components is slow. Scope the program to one package's
  `tsconfig` at a time and reuse the program within a package (the #79 risk note).

## Install timing

**Defer the install to the human.** This block (the architect gate) does not run
`pnpm install`. The builder lane that implements #79's prop-table half:

1. stages `packages/cli/package.json` with `"devDependencies": { "react-docgen-typescript": "<latest ^>" }`,
2. surfaces a flagged follow-up "human: run `pnpm install` to update the lockfile, then
   `pnpm manifest` to regenerate" — the lockfile write is the human's to approve.

The `check-package-registered` hook and the manifest stale-gate (`pnpm manifest:check`)
already guard the downstream artifacts.

## Consequences

- `+` Manifest/CLI/llms/context gain resolved inherited props, defaults and descriptions
  — the highest-leverage anti-hallucination win, aligned with Storybook autodocs.
- `+` Runtime read-path stays dependency-free; only the build step gains a dev dep.
- `−` `pnpm manifest` gets slower (mitigated by per-package program reuse) and the
  lockfile gains one MIT dev dep.
- `−` Resolution can be imperfect on exotic generics — handled by best-effort fallback,
  never a crash.

## References

- Issue #79; `packages/cli/lib/core.mjs` (`generateManifest`, `collectProps`,
  `extractPropTable`, `extractVariants`); `.claude/rules/quality-gates.md` ("Adding a new
  package or a public subpath export" — the no-paid-deps + manifest-freshness gates);
  branch `feat/wp03-79-cva-variants` (the already-shipped cva half).
