# 03 · brand-ui end-to-end gap analysis

> Part of the **enterprise-gap** research pack. This benchmarks brand-ui against the enterprise bar
> ([`01`](./01-enterprise-libraries-research.md)) and the agentic-friendliness bar
> ([`02`](./02-ai-agentic-friendliness-research.md)) — across components, functionality, quality
> engineering, usability/DX, AI-friendliness, and organization/governance. Findings feed the
> roadmap ([`04`](./04-roadmap.md)) and the working-packages backlog
> ([`working-packages/`](./working-packages/)).

## Method & honest scope

**What this is based on.** A direct read of the repository on 2026-06-06: the meta-docs
(`README.md`, `PROJECT.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`), all five `skills/*`,
`docs/CONCEPT-ai-skills.md`, the `@qlik-coe-emea/qlabs-components-cli` engine (`packages/cli/lib/core.mjs`,
`bin/brand-ui.mjs`), `brand-ui.manifest.json`, `.mcp.json`, `.github/`, the token system
(`themes.css` + `theme-types.ts`), the registry, and representative component source
(`packages/ui/src/components/button/button.tsx`). Component/story/test **counts come from
filesystem scans** (`find`), not estimates.

**What I did NOT do (the important caveat).** I did **not** run the toolchain — no `pnpm build`,
`typecheck`, `test`, `test:e2e`, `registry:validate`, or `brand-ui` CLI execution; I did **not**
start Storybook or visually verify any component in any theme; and I did **not** read every one of
the ~160 component files. So claims here are about **structure, coverage, configuration, and
documented intent** — they are _static_ findings. Anything that needs a run to confirm (e.g. "do
all six themes actually pass AA", "does the manifest generator currently succeed") is flagged as
**needs-run**. Counts are exact; quality judgments on unread components are inferential.

## Headline: brand-ui is architecturally excellent and operationally unfinished

The lead finding, stated plainly: **brand-ui's design, conventions, and AI-tooling are genuinely
strong — well ahead of most internal libraries and ahead of most public ones on agent-friendliness.
The gaps are not in taste or architecture; they are in the _operational spine_ that turns a good
component system into a trustworthy shared standard: CI, test/story coverage, structured tokens,
versioning, enterprise-grade functionality (data grid / i18n / density), and the depth of the
agent ground-truth layer.** It is, roughly, an A on architecture and a C on operations — and for a
library whose job is to be _the_ standard that many teams build on, operations is what earns trust.

A second, specific finding worth stating up front because it undermines the project's own trust
contract: **CI does not exist.** `README.md` says "CI runs the unit + E2E layers automatically
(`.github/workflows/ci.yml`)", but **there is no `.github/workflows/` directory at all.** The quality gates the whole system is built around run only
locally (hooks) and on demand. This is both a P0 capability gap and a documentation-accuracy gap.

A third, cross-cutting finding that governs _how_ every other fix should be implemented:
**enforcement over reminders.** The maintainer's explicit goal is a **self-maintaining repo** — never
having to remind an agent to register a new component, regenerate the manifest, or update an inventory
file. Today the repo leans the right way (six hooks, a manifest generator, a `check-package-registered`
hook) but stops short: the manifest isn't auto-regenerated or stale-gated, component registration is a
**manual, multi-place ritual** (the quality-gates rule itself lists ~8 files to touch when adding a
package), and inventory/derived docs are hand-maintained. So the operating principle for this entire
program is: **every decision here must be wired into a generator + a gate/hook/CI check + the skill
system, so the correct behavior is automatic and the incorrect behavior fails loudly — not something a
human has to remember.** This is captured as gap area **G** below and as a dedicated working package
(**WP-10**), and it is added to the **Definition of Done of every working package**: a change isn't
"done" until its rule is enforced by automation, not prose.

## Maturity scorecard

Per-dimension, against the bars in docs 01–02. Scale: ●●●● strong · ●●●○ good · ●●○○ partial ·
●○○○ weak.

| #   | Dimension                            | Rating | One-line basis                                                                                                                                                                           |
| --- | ------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Architecture & conventions           | ●●●●   | Clean monorepo, one-way deps, `cva`+`forwardRef`+`cn`+tokens genuinely enforced (verified in source).                                                                                    |
| 2   | Theming system                       | ●●●○   | 6 themes, 139 semantic tokens each, OKLCH, runtime `data-theme`. No density axis; no DTCG; one orphan theme.                                                                             |
| 3   | Component breadth (app UI)           | ●●●●   | ~69 `@qlik-coe-emea/qlabs-components-ui` primitives — full shadcn-class set incl. Combobox, Calendar, DatePicker, Command, Sidebar.                                                      |
| 4   | Component breadth (hard widgets)     | ●●○○   | DataTable wraps TanStack (good) but no virtualization/server model, no range picker, no tree, no transfer; charts are minimal.                                                           |
| 5   | Accessibility                        | ●●●○   | Radix backbone, focus-ring rule, oklch contrast audit tooling. But no axe-in-CI, no VPAT/ACR, AA-in-all-themes is **needs-run**, not proven.                                             |
| 6   | i18n / RTL                           | ●○○○   | None. No RTL/dir handling, no locale formatting, no externalized component strings.                                                                                                      |
| 7   | Documentation & DX                   | ●●●○   | Strong meta-docs, ADRs, guidelines, Storybook autodocs. But story coverage is uneven and some docs are inaccurate (CI).                                                                  |
| 8   | Quality engineering                  | ●●○○   | Good test _intent_ + hooks + Storybook test runner wired, but ~21% of components have tests and **no CI runs any of it**.                                                                |
| 9   | Distribution & versioning            | ●●○○   | Hybrid packages + 14-item registry (strong shape). But `0.1.0`, no Changesets, no migration/deprecation story.                                                                           |
| 10  | AI: source visibility & registry     | ●●●●   | TS-source exports + shadcn-compatible registry — exactly the agent-native model.                                                                                                         |
| 11  | AI: ground-truth interface           | ●●●○   | `@qlik-coe-emea/qlabs-components-cli` + manifest + Storybook MCP. But manifest is an index (no props/anti-patterns); MCP is dev-server-only.                                             |
| 12  | AI: portable guidance                | ●●●○   | CLAUDE.md + rules + AGENTS.md + multi-harness skill build. AGENTS.md carries the "four themes" inaccuracy and lists no runnable command contract.                                        |
| 13  | AI: composition guidance (playbooks) | ●●○○   | Composition patterns exist as prose in the skill, not as packaged, prompt-ready, intent-mapped playbooks an agent invokes.                                                               |
| 14  | Self-maintenance & automation        | ●●○○   | Manifest generator + 6 hooks exist, but the manifest isn't auto-regenerated/stale-gated, component registration is manual & multi-place, and inventory/derived docs are hand-maintained. |
| 15  | Governance                           | ●●○○   | Issue templates, PR template, labels, issue-workflow with RCA — but no CODEOWNERS, no contribution RFC, no release cadence, no owning-team doc.                                          |

## What's genuinely strong (don't regress these)

These are real assets; the roadmap should _protect_ them while filling gaps.

- **Architecture & dependency hygiene.** A clean pnpm + Turborepo monorepo with a strictly one-way
  dependency graph (`tokens → ui/icons → data/ai/flow/charts/marketing/editor`) and cross-package
  imports via `@qlik-coe-emea/qlabs-components-*` aliases. This is exactly the structure that keeps a multi-package system
  maintainable.
- **Conventions are real, not aspirational.** `button.tsx` confirms the rules are followed to the
  letter: `cva` variants, `VariantProps`, `forwardRef`, `cn()` merge-last, `asChild`/Slot, semantic
  tokens only, `focus-visible:ring-2 ring-ring`, exported `ButtonProps` + `buttonVariants`. This
  consistency is itself the single biggest _agent-friendliness_ property (doc 02, lever 8) — an
  agent that learns one component generalizes to all.
- **App-UI breadth is at full shadcn parity.** ~69 `@qlik-coe-emea/qlabs-components-ui` components including the ones lighter
  libraries skip — Combobox, Command (palette), Calendar, DatePicker, InputOTP, Sidebar system,
  Resizable, plus first-class state primitives (`EmptyState`/`ErrorState`/`LoadingState`/`Skeleton`).
- **A real agent-tooling layer.** `@qlik-coe-emea/qlabs-components-cli` (`info`/`search`/`docs`/`audit`/`manifest`), a
  generated `brand-ui.manifest.json`, five skills (consumer + maintainer + audit), a plugin +
  marketplace, a multi-harness skill build, nine slash commands, nine agents, six hooks (including a
  **completion-claim gate** and a **token/boundary** check), and a Storybook MCP. The
  `CONCEPT-ai-skills.md` shows this was designed deliberately against shadcn/vercel/impeccable/intent
  references. **This is ahead of most public libraries.**
- **Token discipline.** 139 semantic tokens defined per theme across 6 themes in OKLCH, with the
  "every theme overrides every token" rule and an oklch-aware contrast audit. The _discipline_ is
  excellent even though the _format_ (lever below) is not yet standard.
- **A thoughtful issue/quality culture.** The "finders report, builders fix, every finding gets RCA"
  workflow, the agent-finding issue template, and the honest-completion-reporting rule are mature
  process design.

## Gaps by area

Each gap notes **what good looks like** (from docs 01–02), **brand-ui today** (verified), **impact**,
and **severity** (P0 broken/credibility-breaking · P1 clearly limiting · P2 polish). The consolidated
register with IDs is at the end.

### A. Components & breadth

**A1 — No enterprise data grid (virtualization / server-side / grouping). [P1]**
_Good:_ enterprise adoption gates on a virtualized, server-capable grid (AG Grid / TanStack +
virtual / MUI X). _Today:_ `@qlik-coe-emea/qlabs-components-data` has 5 components; `DataTable` wraps TanStack Table (the
right engine) but there is no row virtualization, no server-side pagination/sorting model, no row
grouping/aggregation, and "saved views" is still roadmap. _Impact:_ data-heavy internal apps (the
stated audience) will outgrow it immediately and bolt on AG Grid per-app — the exact fragmentation
the library exists to prevent.

**A2 — Missing hard input widgets: range picker, tree, transfer, autocomplete-on-data. [P1]**
_Good:_ date/time **range** pickers, tree / tree-select, transfer ("shuttle"), and combobox/
autocomplete are enterprise table stakes. _Today:_ there's `Combobox`, `Calendar`, `DatePicker` —
but no date **range** picker, no tree/tree-select, no transfer list, no virtualized list/select.
_Impact:_ common enterprise forms and admin UIs can't be built without custom one-offs.

**A3 — Charts are minimal. [P1]**
_Good:_ a real charts story (MUI X Charts, Carbon Charts, or a documented Recharts-block approach
like shadcn). _Today:_ `@qlik-coe-emea/qlabs-components-charts` is 3 components (`MetricCard`, `MetricGrid`, `ChartCard`) —
a container, not a chart set; no actual chart primitives. _Impact:_ dashboards (a named use case)
have KPI tiles but no first-class charts.

**A4 — Coverage thinness in domain packages is a discoverability gap, not just a testing one.**
`@qlik-coe-emea/qlabs-components-icons` has **0 stories**; `flow`, `charts`, `marketing` have **1 story each**; `@qlik-coe-emea/qlabs-components-ai`
has **14 stories for 51 components**. Because agents and humans both discover via Storybook (and the
Storybook MCP serves _stories_), **a component with no story is effectively invisible to the agent
path** (doc 02, lever 8: "missing example = missing capability"). This straddles A and C; counted
under C2 for severity.

_(Noted to avoid a false finding: the three `app-sidebar.tsx` / two `team-switcher.tsx` files are
**not** duplicates — they are distinct shadcn sidebar **blocks** (`sidebar-02/04/05`), which is the
intended pattern.)_

### B. Functionality

**B1 — No density axis. [P1]**
_Good:_ comfortable/compact density is an enterprise hallmark (Ant compact algorithm; Carbon/Fluent
sizing scales; grid density toggles). _Today:_ no density mode anywhere (only per-component `size`
variants; the "compact" hits in source are number-formatting, not UI density). _Impact:_ data-dense
internal tools can't tighten row/control height system-wide.

**B2 — No internationalization or RTL. [P0 for any non-English/EU-facing use; P1 otherwise]**
_Good:_ RTL/bidi-safe styling, Intl locale formatting, externalized component strings. _Today:_
none — no `dir`/RTL handling (the `dir` hits in source are panel orientation), no locale formatting,
hardcoded English microcopy in components. _Impact:_ blocks Arabic/Hebrew and proper localization;
under the EAA this is also an accessibility exposure for EU-facing products. Tailwind v4 logical
properties make this _cheaper_ to add than it once was — but it's currently absent.

**B3 — Theming can't round-trip to design tools, and has no documented multi-brand workflow. [P1]**
Covered as an AI gap too (E2). Functionally: tokens live only as CSS variables, so there's no
artifact a designer's Figma can consume or a brand pack can be generated from. The `brand-ui-theme`
skill documents _manual_ re-brand; there's no token build pipeline.

**B4 — Orphan/`acme` theme drift. [P2]**
`themes.css` contains a `[data-theme="acme"]` block that is **not** in `THEMES`/`THEME_META`
(`theme-types.ts` lists exactly the 6 documented themes). It's a leftover from the `/new-theme acme`
example. Minor, but it's exactly the kind of token-system drift the project's own rules warn about.

### C. Quality engineering & CI (the operational core)

**C1 — There is no CI pipeline at all. [P0]**
_Good:_ unit + interaction + visual-regression + axe, all gated in CI, is the 2025–2026 bar. _Today:_
**no `.github/workflows/` directory exists**, yet `README.md` states CI runs
`ci.yml` (verified: only `README.md` contains the `ci.yml` claim). Every gate (typecheck, lint, test, e2e, registry validation) runs only via local hooks or
manual commands. _Impact:_ the project's central promise — "quality gates every component must
pass" — is unenforced on contributions; nothing stops a regression merging. This is the **single
highest-priority gap** and it also makes the docs untrustworthy (C5). It compounds with the fact
that the Chromatic + axe + Vitest-browser addons are _installed_ in Storybook but never executed by
any automation.

**C2 — Test and story coverage is thin and uneven. [P1]**
Verified counts (component `.tsx` excluding stories/tests):

| Package                                     | Components | Stories | Tests |
| ------------------------------------------- | ---------- | ------- | ----- |
| `@qlik-coe-emea/qlabs-components-ui`        | 69         | 63      | 18    |
| `@qlik-coe-emea/qlabs-components-ai`        | 51         | 14      | 4     |
| `@qlik-coe-emea/qlabs-components-editor`    | 14         | 9       | 9     |
| `@qlik-coe-emea/qlabs-components-icons`     | 8          | 0       | 0     |
| `@qlik-coe-emea/qlabs-components-flow`      | 6          | 1       | 0     |
| `@qlik-coe-emea/qlabs-components-marketing` | 6          | 1       | 0     |
| `@qlik-coe-emea/qlabs-components-data`      | 5          | 1       | 1     |
| `@qlik-coe-emea/qlabs-components-charts`    | 3          | 1       | 0     |

That's **~35 tests for ~162 components (~21%)**, and four packages have **zero** tests. Story
coverage is good in `ui` (~91%) but collapses elsewhere — `ai` is 27%, and `icons` has none. Given
the rules state "every component needs a story" and "story + smoke test = done", this is a large
gap between documented gates and reality — and (per C1) nothing enforces it.

**C3 — Visual regression is wired but not running. [P1]**
The Chromatic Storybook addon and `axe`/`addon-vitest` are present (`apps/docs`), matching the
recommended stack — but with no CI (C1) and no documented Chromatic project/baseline, visual
regression is effectively unused. The capability is one config step away from real.

**C4 — "Theme-safe in all six themes" is asserted, not demonstrated. [P1 / needs-run]**
The quality-gates rule correctly says theme-safety must be _observed_, not inferred from token use.
But there is no stored evidence (no visual sweep artifacts, no per-theme test report) that the
current component set actually passes AA in all six themes. The `brand-ui-audit` skill _can_ produce
this; it apparently hasn't been run across the set and committed. Until run, six-theme AA is an
**open assumption**, not a verified property.

**C5 — Documentation drift erodes trust. [P1]**
Beyond the CI claim (C1, in `README.md` only): `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, and
`docs/TESTING.md` all reference "(all) four themes" while the system ships **six** (README itself
both says four and lists six). For a library whose value proposition to agents is
_"read the docs, they're ground truth"_, drift between docs and reality is uniquely damaging — an
agent that trusts a stale claim ships wrong code.

### D. Usability & developer experience (humans)

**D1 — No single "component index" humans can browse without running Storybook. [P2]**
Discovery today requires either running Storybook or running `brand-ui search`. There's no static,
readable catalog (a generated component index / MDX overview / the manifest rendered) for someone
skimming the repo or a hosted page. Storybook `Introduction.mdx` exists but isn't a full index.

**D2 — Per-component accessibility & token notes aren't surfaced in docs. [P2]**
Best-in-class doc pages show, per component, the WCAG criteria/keyboard map and the tokens consumed
(doc 01, dim 6). brand-ui has the _rules_ centrally but doesn't surface per-component a11y/token
notes in autodocs. This is also an agent-legibility loss (the agent can't see "what's wrong" per
component — see E1).

**D3 — Onboarding is Claude-Code-shaped; other-harness/human onboarding is thinner. [P2]**
The workflow docs assume Claude Code (commands, hooks). A plain "I'm a developer in Cursor / VS
Code, here's how to consume brand-ui in my app" quickstart is thinner, and the consumer story
("install the registry, get guidance") depends on the skills being installed.

### E. AI / agentic-friendliness (the differentiator — refine, don't rebuild)

brand-ui is strong here; these are _depth_ gaps that would make it best-in-class rather than merely
good.

**E1 — The manifest is an index, not a knowledge base. [P1]**
_Good:_ the richest agent metadata carries resolved prop tables **plus relationships and
anti-patterns** ("two primary buttons side by side", "destructive without confirm") — the things
types can't encode (doc 02, lever 4). _Today (verified):_ `brand-ui.manifest.json` entries are
`{name, kind, module}` only; `brand-ui docs` regex-extracts the `<Name>Props` interface text + the
signature on demand. So an agent gets the _location_ and the _raw props text_, but **no resolved
variant values** (e.g. `VariantProps<typeof buttonVariants>` is never expanded to "variant:
default|secondary|…"), **no descriptions/defaults table, no usage examples, and no anti-patterns.**
This is the highest-leverage agent upgrade: enrich the manifest (react-docgen-typescript for real
prop tables; a per-component `meta` for relationships/anti-patterns/state→token mapping).

**E2 — Tokens aren't a structured (DTCG) source of truth. [P1]**
_Good:_ DTCG JSON (`$value`/`$type`/`$description`), intent-named with per-token descriptions, built
to CSS via Style Dictionary. _Today:_ tokens exist only as CSS variables in `themes.css`. There's no
DTCG export, no per-token description an agent can read to choose _when_ to use a token, and no
round-trip to design tools. Adding a DTCG layer (generated from, or as the source for, `themes.css`)
makes theming a machine-readable contract.

**E3 — The ground-truth MCP is ephemeral and React-only. [P1]**
The Storybook addon-mcp (the strongest live agent asset) **only exists while `pnpm storybook` runs**
and is React-only/preview. The project's own roadmap already names the fix: a persistent `brand-ui`
**MCP server** wrapping the existing CLI engine (`search`/`docs`/`tokens`/`audit`). Until then,
agents in a fresh session have no always-on ground-truth endpoint — they fall back to reading source
(fine) or guessing (not).

**E4 — AGENTS.md is present but under-powered and inaccurate. [P1]**
_Correction to a common assumption:_ `AGENTS.md` **does** exist. But (a) it carries the **"four
themes" inaccuracy** (it says four; the system ships six — C5) — note the false `ci.yml` claim is in
`README.md` only, not AGENTS.md — and (b) it doesn't lean on AGENTS.md's key behavioral guarantee:
listing the exact
`typecheck/lint/test` command contract that compliant agents will **auto-run and fix before
finishing**. It mirrors CLAUDE.md rather than exploiting the cross-tool self-validation lever.

**E5 — No llms.txt / hosted agent-doc index. [P2]**
Low priority while internal and code-distributed, but if docs are ever hosted (or cross-agent/
external discovery is wanted), an `llms.txt` + `.md` doc twins is the standard discovery surface.

**E6 — No Figma Code Connect / design-to-code path. [P2]**
Only relevant if a design-driven workflow enters scope. For a code-first/agent-first internal library
this is correctly low priority — noted for completeness.

**E7 — No agent-context generator (ground truth into the files agents read). [P1]**
_Good:_ AgnosticUI's `ag context` emits a single, version-controlled context file carrying real
component locations, prop types, and intent mapping — a portable, MCP-free way to put ground truth
where every agent already looks (CLAUDE.md / AGENTS.md / `.cursor/rules`). _Today:_ brand-ui's ground
truth lives in `brand-ui.manifest.json` + the live Storybook MCP, but there's no command that
**generates** an always-present context file from the manifest. _Impact:_ in a fresh session (MCP
down), the agent relies on reading source or its priors. A `brand-ui context` generator is the
cheapest fix for E3 and the natural _first_ step before a persistent MCP. _(doc 02, §A; roadmap WP-03)_

**E8 — Composition patterns are prose, not packaged playbooks. [P1]**
_Good:_ AgnosticUI ships **Playbooks** — prompt-ready, intent-mapped recipes for whole patterns
("build a dashboard" → the exact component assembly), "the full recipe, not just a component
reference." _Today:_ brand-ui _has_ the patterns (app shell, dashboard, assistant, flow) but only as
prose inside `skills/brand-ui/reference/composition.md`. _Impact:_ agents reliably get the `Button`
API right yet still mis-assemble whole screens — the failure playbooks target. Productizing brand-ui's
patterns into invokable, generated, registered playbooks is one of the highest-leverage agent upgrades
available. _(doc 02, §B; roadmap WP-09)_

### F. Organization & governance

**F1 — No versioning/release engineering. [P1]**
_Good:_ semver + changelog + migration guides + codemods + clean deprecation is the adoption
spine (doc 01, dim 8). _Today:_ every package is `0.1.0`; there are **no Changesets** (the
`PROJECT.md` roadmap lists this under "Later"), no changelog, no published-release process, and a
`prepare-release` command but no actual release pipeline. _Impact:_ consuming teams can't pin
versions, can't see what changed, and can't upgrade safely — which directly undercuts "the standard
library many teams adopt."

**F2 — No deprecation/migration policy or codemods. [P1]**
Related to F1. The rules endorse "delete superseded components" (good instinct) but there's no
_consumer-facing_ deprecation path (warnings, migration notes, codemods) for teams that already
import the old thing. At v0 this is fine; before it's "the standard," it's required.

**F3 — Governance roles are undefined. [P2]**
There's excellent _process_ tooling (issue workflow, RCA, retros) but no `CODEOWNERS`, no named
owning team / RFC-for-new-components process, and no stated release cadence or support window. These
are the "how do many teams contribute back without it becoming a mess" controls that separate a
system from a repo.

**F4 — CI/governance automation gap reinforces everything above.** Without CI (C1) there's no place
to enforce labels, run `registry:validate`, gate coverage, or block doc drift — so F1–F3 have no
teeth even once written. (This is why the roadmap sequences CI first.)

### G. Self-maintenance & enforcement (so the repo maintains itself)

This area is the cross-cutting requirement from the headline: **the correct behavior must be automatic
and the incorrect behavior must fail loudly — never a thing a human remembers to do.** brand-ui leans
this way (six hooks, a manifest generator, `check-package-registered.sh`) but stops short of true
self-maintenance.

**G1 — The manifest/inventory isn't auto-regenerated or stale-gated. [P1]**
_Good:_ a generated source of truth is regenerated automatically and a gate fails if it's stale, so it
can never drift. _Today:_ `brand-ui.manifest.json` is generated by `pnpm manifest` (or `build`) but
nothing **forces** regeneration on commit and no CI check fails a stale manifest — so the "ground
truth, no drift" guarantee depends on someone remembering to run it. _Impact:_ the artifact the whole
agent layer trusts can silently lag the code. _Fix:_ a pre-commit hook + CI step that regenerates and
fails on diff. _(WP-10)_

**G2 — New-component registration is a manual, multi-place ritual — not enforced. [P1]**
_Good:_ adding a component triggers all its bookkeeping automatically (barrel export, story, test,
manifest entry, Storybook storySort, any package list) or a gate blocks the commit with an actionable
message. _Today:_ the project's own quality-gates rule lists **~8 files to touch when adding a
package**, and component-level registration (barrel/story/test/manifest) is convention enforced only
by review + the maintainer skill. The existing `check-package-registered.sh` hook proves the pattern
for _packages_ but it isn't extended to _components_. _Impact:_ this is exactly the "I don't want to
remind the agent every time" pain — registration is remembered, not enforced. _Fix:_ a
registration gate hook (new `*.tsx` in a package ⇒ require barrel + story + manifest entry) with a
clear failure message. _(WP-10)_

**G3 — Inventory/derived docs are hand-maintained instead of generated. [P1]**
_Good:_ every "list of components/packages/tokens" is generated from the manifest and stale-checked,
so it can't fall out of sync. _Today:_ the package tables in `CLAUDE.md`/`AGENTS.md`/`PROJECT.md`/
`Introduction.mdx`, the (missing) component index, the future context file (E7), llms.txt (E5), and
playbook index (E8) are or would be authored by hand. _Impact:_ drift (the "four themes" and CI
inaccuracies in C5 are precisely this failure mode) and recurring manual upkeep. _Fix:_ generate these
from the manifest in `build`/CI with a stale-check; treat the manifest as the one source the rest
derive from. _(WP-10)_

> **The principle, stated once:** for **every** gap in this document, the fix is not done when the code
> is written — it's done when the rule is **wired into a generator + a gate/hook/CI check + the skill
> system**. This is added to each working package's Definition of Done, and WP-10 builds the shared
> machinery that makes it cheap.

## Consolidated gap register

Severity: **P0** credibility-breaking / blocks the core promise · **P1** clearly limits enterprise or
agent use · **P2** polish/hardening. "Lens" = which world it bridges (ENT enterprise parity · AI
agentic-friendliness · BOTH).

| ID  | Area       | Gap                                                           | Sev    | Lens | Working package |
| --- | ---------- | ------------------------------------------------------------- | ------ | ---- | --------------- |
| C1  | QE/CI      | No CI pipeline exists (docs claim one)                        | **P0** | BOTH | WP-01           |
| C5  | Docs       | Docs assert untrue things (CI, "four themes")                 | P1     | BOTH | WP-01           |
| B2  | Func       | No i18n / RTL (P0 if non-English/EU in scope)                 | P0/P1  | ENT  | WP-06           |
| C2  | QE         | ~21% test coverage; 4 packages 0 tests                        | P1     | BOTH | WP-02           |
| C3  | QE         | Visual regression wired but not running                       | P1     | ENT  | WP-02           |
| C4  | QE         | Six-theme AA asserted, not demonstrated                       | P1     | BOTH | WP-02           |
| A1  | Comp       | No virtualized/server-side data grid                          | P1     | ENT  | WP-05           |
| A2  | Comp       | No range picker / tree / transfer / virtual list              | P1     | ENT  | WP-05           |
| A3  | Comp       | Charts are minimal (container only)                           | P1     | ENT  | WP-05           |
| B1  | Func       | No density axis                                               | P1     | ENT  | WP-06           |
| E1  | AI         | Manifest is an index (no resolved props/anti-patterns)        | P1     | AI   | WP-03           |
| E2  | AI/Func    | Tokens not a DTCG structured source of truth                  | P1     | BOTH | WP-04           |
| E3  | AI         | Ground-truth MCP is ephemeral/React-only                      | P1     | AI   | WP-03           |
| E4  | AI         | AGENTS.md inaccurate + no runnable command contract           | P1     | AI   | WP-01           |
| F1  | Gov        | No versioning/Changesets/changelog                            | P1     | ENT  | WP-07           |
| F2  | Gov        | No deprecation/migration policy or codemods                   | P1     | ENT  | WP-07           |
| C2b | QE         | Story coverage uneven (icons 0; ai 27%)                       | P1     | BOTH | WP-02           |
| D1  | DX         | No static browsable component index                           | P2     | BOTH | WP-03           |
| D2  | DX         | No per-component a11y/token notes in docs                     | P2     | BOTH | WP-03           |
| D3  | DX         | Consumer/other-harness onboarding thin                        | P2     | AI   | WP-01           |
| B4  | Theme      | Orphan `acme` theme block (drift)                             | P2     | ENT  | WP-02           |
| F3  | Gov        | No CODEOWNERS / RFC / cadence                                 | P2     | ENT  | WP-07           |
| E5  | AI         | No llms.txt / hosted agent-doc index                          | P2     | AI   | WP-03           |
| E6  | AI         | No Figma Code Connect                                         | P2     | AI   | WP-08           |
| A4  | Comp       | Domain packages under-storied (→ C2b)                         | P1     | BOTH | WP-02           |
| E7  | AI         | No agent-context generator (ground truth into agent files)    | P1     | AI   | WP-03           |
| E8  | AI         | Composition patterns are prose, not packaged playbooks        | P1     | AI   | WP-09           |
| G1  | Self-maint | Manifest not auto-regenerated or stale-gated                  | P1     | BOTH | WP-10           |
| G2  | Self-maint | New-component registration manual & multi-place, not enforced | P1     | BOTH | WP-10           |
| G3  | Self-maint | Inventory/derived docs hand-maintained, not generated         | P1     | BOTH | WP-10           |

The working packages (WP-01…WP-15) are defined and sequenced in [`04-roadmap.md`](./04-roadmap.md)
and detailed as issues/PRs in [`working-packages/`](./working-packages/).

## The bridge: how this serves both worlds at once

Manuel's goal is to be exceptional at **both** enterprise parity and agentic-friendliness. The
encouraging finding is how much the two overlap — the highest-priority fixes serve both:

- **CI + coverage (WP-01/02)** is the enterprise QE bar _and_ the agent "examples-as-tests /
  self-validation" bar. Every story added is both a human doc and an agent capability.
- **A richer manifest (WP-03)** is the agent ground-truth layer _and_ the human per-component
  a11y/props documentation.
- **DTCG tokens (WP-04)** is the design-tool interchange the enterprise wants _and_ the structured,
  described theming contract the agent wants.
- **The hard widgets (WP-05)** are enterprise breadth _and_, once storied, new agent capabilities.
- **Playbooks (WP-09)** are agent composition recipes _and_ human "how do I build a dashboard" docs —
  one artifact, both audiences.
- **Self-maintenance (WP-10)** is enterprise governance hygiene _and_ the agent-trust guarantee: a
  generated, gated manifest/inventory is what lets an agent rely on the ground truth at all.

So the right mental model is not "enterprise work vs AI work" — it's **one operational-maturity
program** where each investment pays into both columns. And the program has a spine: **enforcement over
reminders.** Every package ships its own gate/hook/CI/skill wiring so the system stays correct without
anyone policing it — that is what makes brand-ui safe to hand to many teams _and_ many agents at once.
The roadmap is sequenced on that basis.
