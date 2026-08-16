# ADR 0006 — Public subpath exports (gated on dependency-tree isolation)

- Status: Accepted
- Date: 2026-06-06

## Context

A few packages already ship public **subpath exports** in addition to their
barrel:

- `@elabs/components-editor` — `./markdown`, `./markdown/frontmatter`, `./monaco-environment`
- `@elabs/components-ui` — `./lib/cn`
- `@elabs/components-tokens` — `./styles.css`

Each was added ad hoc, with no written convention. Without a rule the next
maintainer (human or agent) either proliferates subpaths as a general
API-organization habit — fragmenting every package's surface — or re-litigates
whether subpaths are allowed at all. The concrete trigger: `markdown/frontmatter`
was added on an agent's own initiative to dodge a Monaco-in-jsdom test failure,
without architect review and without discovery registration (issues #42, #43,
#47). A brand-ui-design-system-architect review judged the subpath itself the _right_
model for that case — this ADR codifies _when_ that is true.

## Decision

A subpath export (`@elabs/components-<pkg>/<leaf>`) is **warranted only when BOTH**:

1. **The leaf has a materially lighter or different dependency tree** than the
   package trunk — e.g. a pure helper that does not pull the package's heavy
   engine (Monaco, React Flow, TanStack Table).
2. **A real consumer needs the leaf without the trunk** — unit tests that must
   avoid the engine, an RSC/server path, or a bundle-sensitive route.

A subpath is **not** a general API-organization mechanism. "Data utils get a
subpath" is rejected: it would fragment every package's surface for no
dependency-isolation benefit. When in doubt, export from the barrel.

When a subpath is warranted it MUST be added consistently and made discoverable:

- `exports` (source entry) **and** `publishConfig.exports` (`dist` entry).
- a `tsup.config.ts` entry so it builds to `dist/`.
- `pnpm manifest` re-run (so the discovery crawler sees the leaf, not just the
  barrel) and registration in the docs/skill discovery surfaces.
- the decision routed through `brand-ui-design-system-architect` — a public subpath is a
  structural API change, not an implementation detail.

## Alternatives considered

- **Barrel-only, no subpaths.** Simplest surface, but forces engine-heavy code
  into every consumer's bundle/test even when a pure leaf would do — the exact
  Monaco-in-jsdom pain that motivated the first subpath.
- **Subpaths as free API organization** (a subpath per logical area). Rejected —
  it fragments the surface, multiplies the all-three-places maintenance burden,
  and makes discovery harder, all without a dependency-isolation payoff.
- **Gated subpaths (chosen).** Keeps the barrel the default while allowing a
  narrow, justified exception for dependency-tree isolation.

## Consequences

- The three existing subpaths all clear the gate, so this ADR ratifies the status
  quo rather than forcing a migration.
- Adding a subpath now carries a checklist (three places + discovery + architect),
  raising the bar above "edit `exports` and move on" — intentionally, since each
  subpath is a public API commitment.
- See @.claude/rules/component-api.md "Subpath exports" and
  @.claude/rules/quality-gates.md "Adding a new package or a public subpath
  export"; enforced (warn-only) by `.claude/hooks/check-package-registered.sh`.
