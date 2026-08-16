# 04 · Roadmap — bridging enterprise parity and agentic-friendliness

> Part of the **enterprise-gap** research pack. Turns the gaps in
> [`03-gap-analysis.md`](./03-gap-analysis.md) into a sequenced program of **working packages**
> (WP-01…WP-15). Each WP is detailed as issue/PR-shaped markdown in
> [`working-packages/`](./working-packages/), ready for a later agent to push to GitHub.
> WP-11 (A2UI support) is detailed in [`05-a2ui-concept.md`](./05-a2ui-concept.md); WP-12 (guidance
> consistency) in [`06-guidance-architecture.md`](./06-guidance-architecture.md); WP-13 (component
> consolidation) in [`07-component-audit.md`](./07-component-audit.md); WP-14 (release pipeline) in
> [`08-release-process.md`](./08-release-process.md); WP-15 (taste / anti-slop) in
> [`09-taste-adoption.md`](./09-taste-adoption.md). ([`10-soft-skill-adoption.md`](./10-soft-skill-adoption.md)
> is a decision record — the soft-skill was **evaluated and not adopted**; no working package.)

## Sequencing principle

The gap analysis showed brand-ui is **architecturally excellent, operationally unfinished**. So the
roadmap fixes the _operational spine first_ (you cannot trust coverage, tokens, or widgets you can't
enforce), then deepens the agent layer, then fills enterprise breadth. Crucially, the early packages
**pay into both columns at once** (CI/tests are both the enterprise QE bar and the agent
examples-as-tests bar), so there is no "enterprise vs AI" trade — it's one maturity program.

Three rules guide the order:

1. **Enforcement before expansion.** Land CI (WP-01) before adding components, or new work just
   accretes the same unenforced debt.
2. **Truth before breadth.** Fix doc/manifest accuracy (WP-01, WP-03) early — for an agent-first
   library, a confident-but-wrong doc is worse than a missing one.
3. **Enforcement over reminders (the spine).** The maintainer's stated goal is a **self-maintaining
   repo** — never reminding an agent to register a component, regenerate the manifest, or update an
   inventory file. So **every working package's Definition of Done includes wiring its rule into a
   generator + a gate/hook/CI check + the skill system.** A change isn't done when the code is
   written; it's done when the correct behavior is automatic and the wrong behavior fails loudly.
   WP-10 builds the shared machinery that makes this cheap for every other package.

## Now / Next / Later

### NOW — make the existing system trustworthy (Foundation)

The library already _claims_ these gates; this phase makes them real. Highest ROI, mostly
self-contained, unblocks everything else.

- **WP-01 · CI, gates & doc-truth** _(P0)_ — Add `.github/workflows/ci.yml` running
  `typecheck → lint → test → build → registry:validate` (and E2E where practical) on PRs; wire
  Storybook interaction + axe + (optional) Chromatic. Fix every doc claim that's untrue (the
  non-existent CI, "four themes" vs six). Upgrade `AGENTS.md` to list the **runnable command
  contract** so compliant agents self-validate. _Closes: C1, C5, E4, D3 (partial)._
- **WP-02 · Coverage to the documented bar** _(P1)_ — Bring story coverage to ~100% (start with the
  zeros: `icons`, then `flow`/`charts`/`marketing`, then the 37 missing `@qlik-coe-emea/qlabs-components-ai` stories) and add
  smoke tests to the four packages that have none. Commit a **six-theme AA audit artifact** (run the
  `brand-ui-audit` skill across the set). Remove the orphan `acme` theme. _Closes: C2, C2b, C3, C4,
  A4, B4._
- **WP-10 · Self-maintaining repo (enforcement machinery)** _(P1)_ — Build the "no more reminders"
  layer: **auto-regenerate the manifest** on commit + a CI stale-gate (G1); a **component-registration
  gate** that fails a new `*.tsx` lacking its barrel export / story / manifest entry, with an
  actionable message (G2, extending the existing `check-package-registered.sh` pattern); and
  **generate inventory/derived docs** (component index, package tables, and later the context file /
  llms.txt / playbook index) from the manifest with a stale-check (G3). Land the _gates_ here in NOW;
  the _generated derived files_ expand as WP-03/WP-09 produce them. _Closes: G1, G2, G3; enables the
  DoD rule for every other WP._

Rationale: after NOW, "done = green CI + storied + theme-verified + auto-registered" is _enforced_, not
aspirational — and the Storybook-MCP agent path can see every component (a story = an agent
capability). WP-10 is what delivers the maintainer's core ask: registration and inventory upkeep stop
being things anyone has to remember.

### NEXT — deepen the agent ground-truth layer (the differentiator)

With enforcement in place, make brand-ui best-in-class for agents — refining the strong existing
layer, not rebuilding it.

- **WP-03 · Manifest enrichment + context generator + MCP + index** _(P1)_ — Enrich
  `brand-ui.manifest.json` from `react-docgen-typescript` (resolved prop tables incl. expanded `cva`
  variant values, descriptions, defaults) and add a per-component `meta` carrying **relationships,
  state→token mapping, and anti-patterns** (the thing types can't encode). Then **ship the ground
  truth two ways, in order**: (1) a **`brand-ui context` generator** (AgnosticUI-style) that writes
  the manifest into the files agents already read — `CLAUDE.md` / `AGENTS.md` / `.cursor/rules` — as a
  portable, MCP-free, version-controlled context file (the cheap fix for E3/E7); (2) the persistent
  **`brand-ui` MCP server** over the existing CLI engine (`search`/`docs`/`tokens`/`audit`) for live
  querying when the static file isn't enough. Generate a static **component index** (humans + agents)
  with per-component a11y/token notes. All of the above is **generated + stale-gated by WP-10**.
  _Closes: E1, E3, E7, D1, D2; strengthens E5 foundation._
- **WP-04 · DTCG token source of truth** _(P1)_ — Introduce a DTCG (`$value`/`$type`/`$description`)
  token layer with Style Dictionary building to today's `themes.css` CSS variables (single source,
  no drift), with an intent-named, **described** token graph. Makes theming a machine-readable
  contract for both agents and (future) design tools. _Closes: E2, B3._
- **WP-09 · Playbooks (composition recipes as agent skills)** _(P1)_ — Productize brand-ui's existing
  composition patterns (app shell, dashboard, AI chat app, data app, flow canvas) into **prompt-ready,
  intent-mapped playbooks** — "build a dashboard" → the exact `MetricGrid`+`DataTable`+`AppShell`
  assembly — each with a generated playbook doc, an intent schema, and a story/example that doubles as
  its test. Registered and indexed automatically (WP-10). The highest-leverage agent upgrade after the
  manifest. _Closes: E8._
- **WP-12 · Guidance consistency ("how & when to use what")** _(P1)_ — One canonical decisions source
  (`docs/DECISIONS.md`: paradigm fork; AI SDK message vs A2UI surface vs JSXPreview; scope non-goal;
  types-only dependency) **generated into** `CLAUDE.md`/`AGENTS.md`/the context file + skills, and
  **stale-gated** — so every surface (and every agent) picks the right tool, and the guidance can't
  drift (the C5 fix applied to guidance). Plus ADRs for the scope boundary + dependency posture and a
  types-only-never-runtime hook. Authoring can start now; the generate+gate parts reuse WP-03/WP-10.
  See [`06-guidance-architecture.md`](./06-guidance-architecture.md). _Closes the guidance half of
  C5/area G for the new decisions._
- **WP-13 · Component consolidation + net-new widgets + templates/icons** _(P1)_ — Act on the component
  audit: merge the duplicated sets (`StatePanel`; one parameterized `AppSidebar` + shared nav
  primitives; parameterized `MetricCard`), add the net-new widgets not owned by WP-05 (number/tag/
  file-upload/rating/color/stepper/descriptions; interactive Gantt flagged heavy), and fill the empty
  layers (registry **templates**, a real **icon set**). The consolidation half is a cheap NOW-adjacent
  win; breadth is incremental. Hard widgets (charts/grid/tree/transfer/range) stay in WP-05; the
  discoverability fix is WP-03/WP-10's generated index. See
  [`07-component-audit.md`](./07-component-audit.md). _Closes audit C-1…C-4 + breadth gaps._
- **WP-15 · Taste / anti-slop adoption** _(P1)_ — Harvest the external **taste-skill** (anti-AI-slop
  catalog incl. the "Jane Doe effect" content checks + the pre-flight) into `brand-ui-audit` + rules
  **token-translated, register-gated, a11y-safe**, and wire the three dials into a token-backed **taste
  profile** (`register × density × motion × expressiveness`). Don't install the skill raw (it hardcodes
  hex/fonts and mandates motion). Also feeds the plugin's feel stage + anti-slop bar. See
  [`09-taste-adoption.md`](./09-taste-adoption.md). _Sharpens the existing AI-generated-output detector._

### LATER — enterprise breadth & governance (Standard-grade)

Once trustworthy and agent-excellent, fill the enterprise functionality and run-it-like-a-standard
gaps.

- **WP-05 · Hard widgets** _(P1)_ — Data grid upgrade (TanStack virtualization + server-side model +
  saved views), date **range** picker, tree/tree-select, transfer list, virtualized list/select, and
  a real charts set (or a documented Recharts-block approach). Each shipped with stories + tests +
  six-theme verification (enforced by WP-01/02). _Closes: A1, A2, A3._
- **WP-06 · Density & i18n/RTL** _(P1; B2 is P0 if non-English/EU products are in scope)_ — A
  system-wide density axis (comfortable/compact via tokens) and an i18n/RTL foundation (logical-
  property styling, locale formatting, externalized component strings). _Closes: B1, B2._
- **WP-07 · Versioning, release & governance** _(P1)_ — Changesets + changelog + release pipeline,
  a deprecation/migration policy (with codemods where APIs break), `CODEOWNERS`, an RFC-for-new-
  components note, and a stated cadence/support window. _Closes: F1, F2, F3, F4._
- **WP-08 · Design-to-code (optional)** _(P2)_ — Figma kit + Code Connect + token round-trip, **only
  if** a design-driven workflow enters scope. Explicitly deferred for a code-first/agent-first lib.
  _Closes: E6._
- **WP-11 · A2UI support (generative UI, phase-gated R&D)** _(P2)_ — **built into `@qlik-coe-emea/qlabs-components-ai`** (an
  `@qlik-coe-emea/qlabs-components-ai/a2ui` module, sibling to the existing `JSXPreview`), not a greenfield package: a catalog
  (generated from the manifest) + a React renderer over `@a2ui/web_core` that renders Google's A2UI
  agent-driven surfaces with brand-ui components, themed across all six themes; existing
  `Artifact`/`Tool`/`Message` blocks gain A2UI hosting. The catalog is a curated subset (Tier-1/2
  only). Depends on WP-03 + WP-10. Full concept: [`05-a2ui-concept.md`](./05-a2ui-concept.md).
  _Realizes the A2UI part of the generative-UI frontier (doc 02 §C)._
- **WP-14 · Release pipeline (the capstone)** _(P1)_ — the end-to-end release: a blocking **validation
  gate** (quality + documented + wired + assets present), **one coordinated version** for the library
  _and_ the plugin (Changesets locked group), a built **`release/<version>/` snapshot**, and automated
  **publish + registry/marketplace updates**, with post-release verify + rollback. **Composes** WP-01 +
  WP-10 + WP-02 + WP-07 + WP-11/12/13 (it runs all their gates at once), so it's built **last**. Full
  design: [`08-release-process.md`](./08-release-process.md). _Closes the "how do we actually ship this"
  gap; gates the vibe-coder-plugin stream's releases too._
- _(Brand-register elevation / the **soft-skill** — **evaluated and cut**: marketing-only, out of scope
  for an app-first library. No working package. Decision record:
  [`10-soft-skill-adoption.md`](./10-soft-skill-adoption.md).)_

## Dependency & priority map

```
NOW (foundation)        NEXT (agent depth)         LATER (breadth & standard)
────────────────        ──────────────────         ─────────────────────────
WP-01  CI ───────────►  WP-03 manifest+context ──►  WP-09 playbooks
WP-02  coverage         WP-04 DTCG tokens           WP-05 hard widgets
WP-10  enforcement ──►  (gates everything;          WP-06 density / i18n
       machinery         derived-file gen grows      WP-07 versioning / gov
                         with WP-03 / WP-09)         WP-08 Figma (optional)
```

- **WP-01 blocks everything** — no point enforcing coverage (WP-02), gates (WP-10), or widgets (WP-05)
  with no CI to run them.
- **WP-10 lands its gates in NOW** (depends on WP-01's CI). Its _derived-file generation_ (context
  file, llms.txt, playbook index) expands as WP-03/WP-09 produce those artifacts — but the
  manifest-stale gate and the component-registration gate ship immediately, which is what stops the
  manual-reminder pain.
- **WP-02 should precede WP-05** — land the enforced "story + test + six-theme + auto-registered" bar
  before adding new components, so new widgets are born compliant.
- **WP-03 and WP-04 are independent** and can run in parallel after WP-01. **WP-09 depends on WP-03**
  (it composes from the enriched manifest + context surface) and on the WP-02 coverage bar.
- **WP-07** can start any time but has teeth only after WP-01 (CI enforces labels/validate/cadence).
- **WP-11 (A2UI)** is phase-gated R&D that depends on **WP-03** (manifest → generated catalog) and
  **WP-10** (catalog stale-gate); start with a Phase-0 spike. Keep it contained in a `@qlik-coe-emea/qlabs-components-ai/a2ui`
  module (it's the safe successor to `@qlik-coe-emea/qlabs-components-ai`'s `JSXPreview`).
- **WP-14 (release pipeline) is the capstone** — its validation gate _runs_ WP-01/02/10/11/12/13's
  checks at once, so build it **last**, after those gates exist. Designing it now (doc 08) tells each
  earlier package what its check must plug into.

## Effort & impact (rough, for prioritization — not estimates to commit to)

| WP    | Title                                                       | Effort | Enterprise impact | Agent impact | Phase            |
| ----- | ----------------------------------------------------------- | ------ | ----------------- | ------------ | ---------------- |
| WP-01 | CI, gates & doc-truth                                       | S–M    | High              | High         | NOW              |
| WP-02 | Coverage to the bar                                         | M–L    | High              | High         | NOW              |
| WP-10 | Self-maintaining repo (enforcement)                         | M      | High              | **High**     | NOW              |
| WP-03 | Manifest + context gen + MCP + index                        | M      | Med               | **High**     | NEXT             |
| WP-04 | DTCG tokens                                                 | M      | Med               | High         | NEXT             |
| WP-09 | Playbooks                                                   | M      | Med               | **High**     | NEXT             |
| WP-12 | Guidance consistency (how & when to use what)               | S–M    | Med               | **High**     | NEXT             |
| WP-13 | Component consolidation + net-new widgets + templates/icons | M–L    | High              | Med          | NEXT             |
| WP-15 | Taste / anti-slop adoption (audit + taste profile)          | S–M    | Med               | **High**     | NEXT             |
| WP-05 | Hard widgets                                                | **L**  | **High**          | Med          | LATER            |
| WP-06 | Density & i18n/RTL                                          | M–L    | High              | Low          | LATER            |
| WP-07 | Versioning & governance                                     | M      | High              | Low          | LATER            |
| WP-08 | Figma Code Connect                                          | M      | Low               | Med          | LATER (opt)      |
| WP-11 | A2UI support (generative UI)                                | M–L    | Low               | **High**     | LATER (R&D)      |
| WP-14 | Release pipeline (validate → version → snapshot → publish)  | M      | **High**          | Med          | LATER (capstone) |

## Suggested first move

If only one thing happens next: **WP-01.** It's the smallest package with the biggest trust payoff —
it makes the system's own promises true, turns the already-installed test/axe/Chromatic addons into a
real gate, and fixes the docs an agent reads as ground truth. Everything else is safer to build on a
green pipeline.

A reasonable first sprint: **WP-01 in full + the WP-10 manifest-stale & component-registration gates +
the WP-02 "zero-story/zero-test" subset** (icons, flow, charts, marketing, data). That combination
delivers both halves of the maintainer's ask at once — a green pipeline _and_ the "I never have to
remind the agent to register a component again" outcome — after which the maturity scorecard in
[`03`](./03-gap-analysis.md#maturity-scorecard) moves from "good architecture / weak operations" to
"trustworthy, self-maintaining foundation," and the rest of the roadmap builds on solid ground.
