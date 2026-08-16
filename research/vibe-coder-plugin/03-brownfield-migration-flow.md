# 03 · Brownfield flow — "scan my app → migrate it onto brand-ui"

> Part of the **vibe-coder-plugin** pack. The experience for a user who already has an app and wants to
> adopt/optimize brand-ui: a full repo scan, a deep mapping analysis, and a codemod-driven, incremental
> migration plan. Delivered as a `migrate` skill (working package **VP-03**). This flow **reuses the
> enterprise-gap methodology** (gap analysis + component audit) — pointed at the _user's_ repo instead
> of brand-ui itself.

## The principle: generate codemods, don't hand-migrate

The 2025–2026 consensus on large-scale codebase migration: **pair an agent with deterministic
codemods.** A generic agent editing file-by-file hits a consistency ceiling and is unreviewable at
scale; the durable pattern is **scan → map → generate AST codemods → dry-run → review → apply
incrementally** (strangler-fig), keeping the app working at every step. So the `migrate` flow's job is
to _produce a plan + codemods + review gates_, not to blindly rewrite the repo.

## The four stages

### Stage 1 — Full repo scan (the "what have you got")

A read-only sweep that profiles the codebase:

- **Framework & build:** React/Next/Vite/Remix; TS/JS; package manager; monorepo?
- **Existing UI layer:** which library (MUI, Ant, Chakra, Mantine, shadcn, Bootstrap, custom, none),
  and its version/footprint.
- **Styling approach:** Tailwind, CSS-in-JS (Emotion/styled-components), CSS Modules, vanilla CSS,
  inline — this drives the hardest part of the migration (theming).
- **Component inventory:** which components exist, **usage frequency** (a `Button` used 400× vs a
  one-off), and where the complexity concentrates.
- **Design tokens / theming:** any existing token system, theme switching, dark mode.
- **Quality posture:** tests, a11y, Storybook, CI — what safety net exists for the migration.

_Output:_ a **repo profile** (`migration/repo-profile.md`) — the factual base, like the enterprise-gap
codebase deep-dive but for their repo.

### Stage 2 — Deep mapping analysis (the "what maps to what")

For each existing component/pattern, map to brand-ui using the **WP-03 manifest** as ground truth, and
classify:

| Class               | Meaning                                                                                         | Action                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Direct map**      | 1:1 equivalent (their `Button` → `@qlik-coe-emea/qlabs-components-ui` `Button`)                 | codemod, prop-rename                                            |
| **Map-with-props**  | equivalent but different API (variant/size names)                                               | codemod with a prop map                                         |
| **Compose / block** | maps to a brand-ui block/playbook, not one component (their dashboard → the dashboard playbook) | guided recompose                                                |
| **Gap**             | no brand-ui equivalent yet                                                                      | keep as-is, OR file a new-component request (feeds WP-13/WP-05) |
| **Drop**            | redundant once brand-ui is in (their theme system → tokens)                                     | remove in a late phase                                          |

Also analyze the **styling migration** specifically (e.g. Emotion `sx`/styled → semantic tokens; CSS
Modules → token utilities) — usually the biggest effort.

_Output:_ a **migration analysis** (`migration/analysis.md`) — effectively the enterprise-gap _gap
analysis_ applied to their repo: per-area mapping, risk, effort, and a coverage estimate ("~70% of
your UI maps directly; ~20% needs prop maps; ~10% has no equivalent yet").

### Stage 3 — Migration plan (strangler-fig, phased)

A sequenced plan where **each phase is independently shippable and the app keeps working**:

1. **Coexistence layer** — add brand-ui tokens + `ThemeProvider` alongside the existing UI; nothing
   replaced yet. Establishes the target theme.
2. **Leaf primitives** — Button, Input, Card, Badge, etc. (highest-frequency, lowest-risk) via codemods.
3. **Composite components** — tables → `DataTable`, forms → brand-ui form set, overlays → Dialog/Sheet.
4. **Shells & navigation** — app shell, sidebar, top-nav (the AppShell/AppSidebar).
5. **Theming cutover** — styling migrated to tokens; remove the old theme system.
6. **Remove the old library** — once usage hits zero, drop the dependency.

_Output:_ `migration/plan.md` (their repo's _roadmap_) + per-phase working packages (issues/PRs) in the
same format as the enterprise-gap backlog — so a coding agent can execute it.

### Stage 4 — Execute (codemods + agent-assist, review-gated)

Per phase:

- **Generate a codemod** (jscodeshift / ast-grep) for each direct/prop-map class — the agent writes the
  transform from the mapping in Stage 2.
- **Dry-run → show the diff** for the user to review (never auto-apply across the repo unsupervised).
- **Apply incrementally**, run tests/typecheck per phase, keep green.
- **Agent-assist the long tail** (compose/gap classes) with the brand-ui **context file** loaded, so
  the manual edits stay on-brand.
- **Visual verification:** before/after — render the migrated surface (Storybook-MCP for the brand-ui
  side; the running app for after) so the user sees parity, not just a green diff.

## Visual feedback in the brownfield flow

- **Stage 1/2:** a rendered **analysis dashboard** (an artifact) — mapping coverage, risk heatmap by
  area, top components by usage — so the user grasps scope at a glance.
- **Stage 4:** **before/after side-by-side** per migrated surface + the **codemod diff review** gate.
- The same propose→preview→pick loop applies when a "compose/block" class needs a layout decision
  (offer brand-ui playbook options, render them, let the user pick).

## Outputs

- `migration/repo-profile.md`, `migration/analysis.md`, `migration/plan.md` (their repo's profile + gap
  analysis + roadmap).
- **Generated codemods** (committed, re-runnable) + a **phased PR series** (one PR per phase, each
  shippable, tests green).
- The brand-ui **context file** + gates added to their repo, so their own agent continues the migration
  and stays on-brand.

## Guardrails (migration is the higher-risk stream)

- **Read-only until the plan is approved.** Scan + analyze never edit code.
- **Dry-run + diff review before every apply;** never bulk-rewrite unsupervised.
- **Strangler-fig:** the app must build and pass tests at the end of every phase.
- **Codemods for the mechanical 80%; agent-assist (with context) for the rest** — don't pretend a
  generic agent will do a consistent cross-repo rewrite alone.
- **Analysis quality depends on the manifest** (WP-03) — the richer the brand-ui ground truth, the
  better the mapping. (So brownfield benefits from enterprise-gap NEXT landing first.)

## Where it runs

**Claude Code** (in the existing repo) for the scan + codemod execution; **Cowork** (repo as
workspace) for the scan/analysis conversation + plan review. Same `migrate` skill.

## Sketch of the skill

`migrate` (SKILL.md): Stage 1 a `repo-scanner` subagent (read-only inventory) → Stage 2 a
`migration-analyst` subagent (mapping vs the manifest, reusing the `root-cause-analyst`/audit
methodology) → Stage 3 emits the plan + working packages → Stage 4 a `codemod-runner` (generate →
dry-run → review → apply) + `brand-ui-audit` for visual parity. All gated, all reviewable.

---

_Related: enterprise-gap [`03-gap-analysis.md`](../enterprise-gap/03-gap-analysis.md) +
[`07-component-audit.md`](../enterprise-gap/07-component-audit.md) (the methodology this reuses), WP-03
(manifest), WP-07 (codemods/deprecation). Sources:
[`_research/plugin-and-dx-notes.md`](./_research/plugin-and-dx-notes.md) (codemods, strangler-fig,
AI-assisted migration, repo scanning)._
