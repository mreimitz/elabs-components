# 01 · The audit concept — how a repo-architecture review must work

> Part 1 of the **repo-architect-review** concept. This doc defines _what_ the
> review judges, _how_ it judges it (the method and discipline), _what skills and
> knowledge_ it needs and where to source them, and _how the results surface_ —
> one view for the manager, one for the agents who pick up the findings. The
> machinery that runs it lives in [`02-structural-design.md`](./02-structural-design.md).

Working name: `repo-architect-review`. Status: **concept / blueprint** — not yet built.

---

## 1. The gap this fills

brand-ui already has a deliberate, layered review system. What it does **not** have
is a standing review at the **repository / system tier** — a holistic read of the
whole repo as one artifact.

| Tier              | Existing surface                                                              | Scope                                     |
| ----------------- | ----------------------------------------------------------------------------- | ----------------------------------------- |
| Component         | `/review-component`, `/review-interface`, `agents/brand-ui-reviewer`          | one component / one file                  |
| Rendered surface  | `visual-ux-reviewer`, `accessibility-reviewer`, `/qa-flows`, `/visual-review` | one screen / story, in a browser          |
| Agent process     | `/session-retro` → `session-reviewer`                                         | one work session's _behaviour_            |
| Point decision    | `design-system-architect`                                                     | one structural decision, on request       |
| **Repo / system** | **— none (recurring) —**                                                      | **the whole repo, across all dimensions** |

The closest thing that exists is the one-shot [`research/enterprise-gap/`](../enterprise-gap/README.md)
pack (compiled 2026-06-06): a maturity scorecard, a gap register, the verdict
_"architecturally excellent and operationally unfinished — an A on architecture, a
C on operations."_ That was a **human-directed static analysis, run once, with the
toolchain explicitly not executed** (see its [scope note](../enterprise-gap/README.md#scope--honesty-note)).

`repo-architect-review` is the **operationalized successor** to that pack:

- **Recurring & callable**, not a one-time research effort — a function the manager
  invokes on demand.
- **Agent-run** by specialist auditors in isolated context windows, not by one
  person reading for a day.
- **Runtime-verified where it can be** — it _runs_ `typecheck` / `lint` / `test` /
  `build` / `registry:validate` / `docs:check` and reads the result, closing the
  `needs-run` caveats the enterprise-gap pack had to leave open.
- **Continuous with the baseline** — it re-scores the same dimensions on the same
  scale, so every run reads as _movement_ against 2026-06-06, not a fresh opinion.

It does **not** replace the other tiers. It sits above them and, where a problem is
really a component bug or an a11y defect, it routes down to them.

---

## 2. Guiding principles (inherited, not invented)

The review must obey the repo's own governance, or it has no authority to judge it
by that governance. Five principles carry straight over:

1. **Observed, not inferred.** The quality-gates rule already forbids inferring
   theme-safety from "it uses tokens" — it must be _rendered and seen_. The same
   bar applies to every claim here: a finding cites a `file:line`, a command's exit
   code, or a counted artifact. No vibes. (`.claude/rules/quality-gates.md`,
   `.claude/rules/conceptual-framing.md`.)
2. **Finders report, builders fix.** The audit is a **finder**. It never edits
   product code. Every actionable finding becomes an issue spec routed through
   `root-cause-analyst` → `/file-issue`; the fix is separate work.
   (`.claude/rules/issue-workflow.md`.)
3. **Honest scope, lead with the caveat.** Borrow the enterprise-gap discipline
   verbatim: state what was **run vs. read vs. assumed**, flag `needs-run` items,
   and put the caveat in the headline, not a footnote.
4. **Enforcement over reminders.** The audit's _recommendations_ should prefer
   systemic fixes (a generator + gate/hook/CI) over "remember to…". And the audit
   itself should lean on deterministic evidence (the manifest, the CLI, the
   toolchain) before human-style judgment.
5. **Concept before conformance.** Per `conceptual-framing.md`: green checks prove
   conformance to a spec, not that the spec is the right idea. The review judges the
   repo against its **stated goals** (`PROJECT.md`, `docs/DECISIONS.md`), not against
   a generic checklist.

---

## 3. The mental model — an architecture fitness review

The right academic frame is **architecture fitness functions** (Ford, Parsons & Kua,
_Building Evolutionary Architectures_, 2nd ed.): _an automated, objective, repeatable
assessment of a specific architectural characteristic._ A repo's architecture is not
one number; it's a set of characteristics, each with its own measurable signals and
its own rubric.

brand-ui already runs **atomic** fitness functions — the hooks and `pnpm *:check`
gates fire continuously on every edit and answer one narrow question each (is this
component registered? is the manifest stale? is `ai` imported types-only?).

`repo-architect-review` is the **holistic, triggered** fitness function: it answers
the broad questions the atomic gates can't — _is the structure still coherent? does
what-lives-where still have a reason? is the shipped surface what we intended?_ —
on demand, across the whole repo.

```
atomic fitness functions      holistic fitness function
(hooks + CI + *:check)         (repo-architect-review)
every edit, one question  ──►  on demand, every dimension
deterministic, binary          deterministic evidence + architectural judgment
already exist                  this concept
```

Each of the nine dimensions below is **one holistic fitness function**: a definition,
a set of signals (deterministic first, judgment second), a rubric, and a rating on a
repeatable scale.

---

## 4. The nine dimensions

These are Manuel's nine, kept distinct (not collapsed), each given a code, a crisp
definition, what "good" looks like _in this repo_, the evidence to gather, and where
the knowledge to judge it comes from. `⚙` = machine-checkable / deterministic;
`◐` = needs architectural judgment on top of evidence.

### D1 — Structure & boundaries

- **Asks:** Is the monorepo's shape still coherent? Do dependencies flow one way
  (`tokens → ui/icons → data/ai/flow/charts/marketing/editor/blueprint`)? Any sideways
  or circular imports, orphan packages, or god-modules?
- **Good here:** the one-way rule in `CLAUDE.md` holds in _source_, not just on paper;
  every package has a single clear responsibility; no relative cross-package imports.
- **Evidence:** ⚙ import-graph from the manifest + `madge`/`grep` for cross-package
  relative imports; ⚙ `validate-component-boundaries.sh` parity; ◐ does each package's
  real content match its stated responsibility in `AGENTS.md`/`PROJECT.md`?
- **Knowledge source:** `docs/ADR/0001-architecture.md`, `0002-component-ownership-model.md`;
  Turborepo/monorepo dependency-boundary guidance; the design-system rule.

### D2 — Maintainability

- **Asks:** How costly is change? Duplication, dead code, oversized files, missing
  tests on load-bearing modules, churn hotspots, abstraction that blocks source-ownership.
- **Good here:** small, single-job modules; duplication consolidated (the enterprise-gap
  pack already flagged `StatePanel`/`AppSidebar`/`MetricCard` forks — WP-13); test
  coverage at the documented bar; no closed abstractions (a D5 non-goal).
- **Evidence:** ⚙ test/story coverage counts per package; ⚙ duplication scan; ⚙
  file-size / complexity outliers; ⚙ `git log` churn × low-coverage = risk hotspots;
  ◐ is a given abstraction worth its indirection?
- **Knowledge source:** the maintainability findings already in
  [`enterprise-gap/03-gap-analysis.md`](../enterprise-gap/03-gap-analysis.md);
  `engineering:tech-debt` skill; general refactoring practice.

### D3 — Naming conventions

- **Asks:** Are names predictable and consistent — packages, files (kebab-case),
  components (PascalCase), tokens (semantic), variants (`cva`), commands, agents,
  rules? Can an agent _guess_ the name correctly?
- **Good here:** the `component-api.md` naming rules hold everywhere; token names are
  semantic (no `blue-500`); no synonyms-for-the-same-thing across packages.
- **Evidence:** ⚙ lint for file/dir casing; ⚙ token-name regex vs `themes.css`; ⚙
  collisions / near-synonyms across barrels; ◐ do names reveal intent?
- **Knowledge source:** `.claude/rules/component-api.md`, `styling-and-tokens.md`,
  `icons.md`; the manifest as the name registry.

### D4 — Consistency (what lives where, and **why**)

- **Asks:** Does every artifact's _placement_ have a defensible reason? App UI in
  `@qlik-coe-emea/qlabs-components-ui`, marketing in `@qlik-coe-emea/qlabs-components-marketing`, data/ai/flow/charts in their packages;
  package-primitive vs. registry-block decisions; ADR-backed structural choices.
- **Good here:** placement matches the decision rules in `DECISIONS.md` (D1–D7) and
  `registry.md`; nothing is in a package "because it was easy"; subpath exports clear
  the gate in `component-api.md`.
- **Evidence:** ⚙ misplaced exports (e.g. a marketing section in `ui`); ⚙ registry
  items that should be package primitives or vice-versa; ◐ for each questionable
  placement, is there a _stated_ rationale (ADR/rule) or is it drift?
- **Knowledge source:** `docs/DECISIONS.md`, `docs/ADR/*`, `.claude/rules/registry.md`,
  `scope-and-non-goals.md`.

### D5 — Engineering best practices

- **Asks:** TS strictness, React 19 patterns (`forwardRef`, controlled/uncontrolled,
  `use()`), Radix-first interactive behaviour, `cva` variants, testing strategy,
  motion-tokening, accessibility baseline, no paid deps.
- **Good here:** the patterns in `component-api.md` / `interaction-guidelines.md` /
  `accessibility.md` / `MOTION_GUIDELINES.md` are actually followed; tests exist where
  the rules demand; `eslint`/`tsc` clean.
- **Evidence:** ⚙ `pnpm typecheck && lint && test && build` (run, read exit codes);
  ⚙ `test-storybook` interaction+axe where stories changed; ⚙ raw-hex / `transition:all`
  / `<div onClick>` scans; ◐ are the abstractions idiomatic for React 19 / Tailwind v4?
- **Knowledge source:** React / Tailwind v4 / Radix / TanStack / `@xyflow/react` docs
  (**search — these are present-day**); the repo's own rules; `engineering:*` skills.

### D6 — AI readiness (agent legibility)

- **Asks:** Can a coding agent extend this repo correctly _without guessing_? Is there
  ground truth (manifest, context generator, MCP), portable guidance (AGENTS.md,
  llms.txt), and are skills/playbooks discoverable and fresh?
- **Good here:** the manifest is rich (resolved prop tables, variants, anti-patterns —
  WP-03 target, today an index), `AGENTS.md` is a _runnable_ contract, `llms.txt`
  exists per the agent-docs decision ([`enterprise-gap/11`](../enterprise-gap/11-agent-docs-architecture.md)),
  and every component an agent might reach has a story (the Storybook MCP serves
  _stories_).
- **Evidence:** ⚙ manifest freshness (`pnpm manifest:check`) and depth; ⚙ story/manifest
  coverage gaps; ⚙ presence + currency of `AGENTS.md` / `llms.txt` vs the
  **agents.md standard** (now Linux-Foundation-stewarded); ◐ would an agent be misled
  by anything stale?
- **Knowledge source:** [agents.md](https://agents.md/) standard; the
  [llms.txt](https://llmstxt.org/) proposal; Claude Code subagent/skill/hook docs;
  [`enterprise-gap/02-ai-agentic-friendliness-research.md`](../enterprise-gap/02-ai-agentic-friendliness-research.md).

### D7 — Enterprise readiness (the operational spine)

- **Asks:** The things that turn a good system into a _trusted standard_: CI that
  actually runs the gates, versioning/release, distribution, governance (CODEOWNERS,
  RFC, deprecation), i18n/RTL, security hygiene, doc-truth.
- **Good here:** the gates run in CI; a release pipeline exists (WP-14); docs don't
  reference machinery that isn't there.
- **Worked example of _trend_ (why recurring beats one-shot):** the enterprise-gap
  baseline (2026-06-06) found **no `.github/workflows/` at all** — gap C1, its #1 fix.
  A run today would _measure_ `.github/workflows/ci.yml` present (added 2026-06-07) and
  score D7 **▲ improved**. That movement-vs-baseline is exactly what a standing audit
  surfaces and a one-time static read cannot.
- **Evidence:** ⚙ does `.github/workflows/` exist and run the documented gates? ⚙
  Changesets/versioning present? ⚙ `pnpm docs:check` (docs match reality); ◐ is the
  governance enough for "many teams depend on this"?
- **Knowledge source:** [`enterprise-gap/01`](../enterprise-gap/01-enterprise-libraries-research.md)
  - [`08-release-process.md`](../enterprise-gap/08-release-process.md);
    `engineering:deploy-checklist`; production-readiness practice (**search for current**).

### D8 — Compiled-output fidelity (does the shipped surface match intent?)

- **Asks:** Manuel's sharpest question — _is the compiled outcome that reaches the
  end-user really what we want?_ Does `tsup`/Storybook build output match the source's
  promises: exports resolve, types ship, tree-shaking works, no dev-only leakage,
  bundle size sane, themes render correctly on a **real, unmodified** app screen?
- **Good here:** `publishConfig.exports` and subpath leaves build and resolve; a
  consumer importing `@qlik-coe-emea/qlabs-components-ui` gets working types + CSS; the six themes render
  correctly on a `scenarios-*` story (not a demo authored to look right); no
  `"use client"`/RSC-safety violations in shipped output.
- **Evidence:** ⚙ `pnpm build` then inspect `dist/` (exports map, `.d.ts`, sourcemaps);
  ⚙ import the built package in a scratch consumer; ⚙/◐ render a representative real
  screen in each theme via Storybook MCP and _see_ it; ⚙ bundle-size deltas.
- **Knowledge source:** `docs/ADR/0006-subpath-exports.md`; `tsup`/Vite build docs;
  the quality-gates "observed on a real screen" rule; `editor-components.md` (runtime-
  computed-theme caveat — tokens can be right and the render still wrong).
- **Note:** this is the dimension most often _skipped_ because it needs a build + a
  render, not just a read. It is the one the recurring audit adds most value on,
  precisely because the one-shot enterprise-gap pack left it `needs-run`.

### D9 — Agentic-repo hygiene (`.claude` / `CLAUDE.md` / `PROJECT.md` / `AGENTS.md`)

- **Asks:** Is the governance layer itself well-architected? Are the rules coherent
  and non-contradictory, the commands/agents/hooks consistent and load-bearing,
  CLAUDE.md lean (it loads every session), the docs internally consistent, no dead
  rules or orphan agents?
- **Good here:** `CLAUDE.md` imports resolve; every `.claude/agents/*` is reachable
  from a command or rule; hooks wired in `settings.json` actually exist and pass
  `shellcheck`; "CLAUDE.md advisory vs hooks mandatory" is respected (anything that
  _must_ hold is a hook, not a sentence); no rule contradicts another.
- **Evidence:** ⚙ resolve every `@.claude/rules/*` import and every cited path; ⚙
  agents referenced vs agents defined (orphans / dangling); ⚙ `shellcheck` hooks +
  `settings.json` JSON-valid + every wired hook file present; ◐ is a recurring
  reminder a candidate to promote to a hook?
- **Knowledge source:** `docs/ADR/0004-claude-code-setup.md`; Claude Code docs on
  subagents/commands/hooks/settings (**search — capabilities evolve**); the
  `session-retro` governance-gap taxonomy (MISSING / WEAK / UNENFORCED / IGNORED).

---

## 5. Special skills the review needs

A repo-architecture review is not one skill; it is a panel of specialists. Each
dimension cluster needs a distinct competency. The table maps the competency to
**where it already lives in this repo** (reuse first) and the external body of
knowledge behind it.

| Competency                                   | Dimensions | Already encoded in                                           | External knowledge                               |
| -------------------------------------------- | ---------- | ------------------------------------------------------------ | ------------------------------------------------ |
| Monorepo / dependency architecture           | D1, D4     | `design-system-architect`, ADR 0001/0002, `design-system.md` | Turborepo/Nx docs; _Building Evolutionary Arch._ |
| TS/React API & maintainability               | D2, D3, D5 | `component-builder`, `component-api.md`, `engineering:*`     | React 19 / TS / Radix / TanStack docs            |
| Design-system & token governance             | D3, D4, D8 | `design-system-architect`, `styling-and-tokens.md`           | DTCG tokens; design-system practice              |
| Accessibility & interaction                  | D5, D8     | `accessibility-reviewer`, `interaction-guidelines.md`        | WCAG 2.x; Vercel Web Interface Guidelines        |
| Build / release / enterprise ops             | D7, D8     | `prepare-release`, `enterprise-gap/08`                       | production-readiness; Changesets; CI practice    |
| Agent-context engineering                    | D6, D9     | the manifest, `brand-ui` CLI, `storybook-mcp.md`             | agents.md; llms.txt; Claude Code docs            |
| Technical writing / information architecture | D6, D9     | `docs-writer`, `engineering:documentation`                   | Diátaxis; doc-truth discipline                   |
| Root-cause analysis & issue authoring        | all        | `root-cause-analyst`, `/file-issue`                          | 5-Whys; the repo's issue template                |

The strong implication for Part 2: **don't build one omniscient reviewer.** Cluster
the dimensions into a few specialist auditors, and **reuse the two senior agents that
already exist** — `design-system-architect` (the panel chair / synthesizer) and
`root-cause-analyst` (the issue author).

---

## 6. Special knowledge & where to source it

Two classes of knowledge, with different freshness rules.

### Internal — the repo's own ground truth (read, never guess)

- **The manifest** `brand-ui.manifest.json` + `brand-ui` CLI (`context`, `search`,
  `docs`, design `audit`) — the canonical component/token index. Start here; it
  prevents API hallucination.
- **The rules** `.claude/rules/*.md` — the binding conventions the repo is judged by.
- **The decisions** `docs/DECISIONS.md` (D1–D7) + `docs/ADR/0001–0008` — _why_ the
  architecture is the way it is. A finding that contradicts an ADR must say so.
- **The intent** `PROJECT.md` (vision, goals, **non-goals**) — the success criteria
  the review scores against.
- **The baseline** `research/enterprise-gap/` — the 2026-06-06 maturity scorecard and
  gap register. Every run computes _trend vs. this_.
- **The toolchain output** — the gates in `AGENTS.md` ("Validate before you finish"),
  _run_ and read: `typecheck` · `lint` · `test` · `build` · `registry:validate` ·
  `manifest:check` · `components:check` · `docs:check` · `format:check` ·
  `test-storybook`. This is the difference between the recurring audit and the
  static one.

### External — current best practice (these are present-day facts → **must be searched**, not recalled)

- **Architecture fitness functions** — Ford/Parsons/Kua, _Building Evolutionary
  Architectures_ (2nd ed.). The framing for the whole review.
- **agents.md** — the open AGENTS.md standard, now stewarded under the Linux
  Foundation's Agentic AI Foundation; the bar for D6 portable guidance.
- **llms.txt** — the complementary agent-facing index standard.
- **Claude Code docs** — current subagent / slash-command / skill / hook / settings
  capabilities (the "CLAUDE.md advisory vs hooks mandatory" distinction); the bar for D9.
- **Framework docs** — React 19, Tailwind v4, Radix, TanStack Table, `@xyflow/react`,
  Monaco — for idiom checks in D5/D8.
- **WCAG 2.x** + **Vercel Web Interface Guidelines** (already adopted delta-only) — D5/D8.

> Discipline: anything in the _external_ column is a moving target. The reviewer
> **searches** for the current version of a standard or framework idiom before
> asserting the repo is behind it — it never marks the repo "stale vs. X" from
> training-data memory.

---

## 7. Evidence discipline & the scoring model

### Evidence labels (every signal is tagged)

- **Measured** — a command ran and this is its output / a counted artifact (exit code,
  coverage number, `dist/` contents). Highest trust.
- **Observed** — a file was read and this `file:line` shows it (a render was _seen_ in
  a theme). High trust.
- **Inferred** — reasoned from measured/observed evidence but not directly confirmed.
  Must be labelled; cannot be the sole basis of a P0.
- **Assumed / needs-run** — could not be verified this run (e.g. real-device i18n).
  Flagged explicitly, never silently dropped.

### The rating scale (continuity with the baseline)

Reuse the enterprise-gap scale so trend is legible: **●●●● strong · ●●●○ good ·
●●○○ partial · ●○○○ weak**, one rating per dimension, plus a trend arrow vs. the
2026-06-06 baseline (▲ improved · ▬ flat · ▼ regressed). A rating is only valid with
a one-line **rubric justification** citing the evidence — the scale is repeatable,
not a gut score.

### Findings

Each finding carries a **severity** (P0 ignored-rule / shipped-wrong / trust-breaking ·
P1 clear gap causing rework · P2 polish), a dimension, evidence, and a _proposed
direction_ (not a finished fix — that's the analyst's job). Severity-weighted finding
counts feed the dimension ratings so the score and the register can't disagree.

---

## 8. How the results surface — two audiences, one evidence base

This is the crux of Manuel's question. The review produces **two renderings of one
evidence base** — mirroring the repo's own "one source → generated → gated" guidance
architecture (WP-12). They never diverge because they're generated from the same run.

### A. The manager surface — _Architecture Health Scorecard_

One screen, decision-oriented, no code. For Manuel as project owner. Contains:

- **The scorecard** — nine dimensions, ●-rating + trend arrow vs. baseline.
- **Verdict** — 2–3 honest sentences (the enterprise-gap "A on architecture, C on
  operations" voice), calibrated, no flattery.
- **Top risks** — the 3–5 highest-severity findings in plain language + business impact.
- **Movement** — what improved / regressed since the last run.
- **"If only one thing happens next"** — a single highest-leverage recommendation.
- **Honest scope** — what was run vs. read vs. assumed this run; `needs-run` items.

Format: a Markdown report (rendered HTML optional) at
`research/repo-architect-review/runs/<date>/scorecard.md`. Skimmable in 60 seconds.

### B. The agent-pickup surface — _Findings register_

Machine-legible, one record per finding, structured so **another coding agent can act
on any single finding without re-investigating** — then routes into the existing
`root-cause-analyst` → `/file-issue` spine.

Each record (and a parallel `findings.json`):

```
ID            RAR-<run>-<NN>
Dimension     D1…D9
Severity      P0 | P1 | P2
Evidence      <Measured|Observed|Inferred|Assumed> — file:line / command / count
Symptom       <one line, factual>
Proposed dir. <rule-aligned direction; not a finished fix>
needs-run     <what must be confirmed before building, if anything>
Routes to     /file-issue (→ root-cause-analyst) | a lower tier (component/a11y) | governance (session-retro style)
```

The register is the **handover artifact**: the gate approves it, then approved
records flow to `/file-issue` (architecture findings often become _epics_, exactly
as the enterprise-gap pack's WPs did). Lower-tier problems (a single component bug, an
a11y defect) are routed _down_ to `/review-component` / `accessibility-reviewer`
rather than filed as architecture issues.

### Why two surfaces and not one

The manager needs **judgment compressed to a decision**; the agent needs **evidence
expanded to an action**. A single doc serves neither well. Generating both from one
run guarantees the executive claim and the filed issue rest on the same `file:line`.

---

## 9. What the review explicitly does NOT do (scope boundary)

- **It does not fix code.** Finder, not builder. (`issue-workflow.md`.)
- **It does not gate CI by itself.** Advisory + gated by the manager; nothing is filed
  or changed without approval (the chosen posture, mirroring `/session-retro`).
- **It does not replace the lower tiers.** Component / surface / process reviews stay
  authoritative in their scope; the audit routes to them, it doesn't re-do them.
- **It does not re-derive ground truth** the manifest/CLI already provide — it consumes
  them.
- **It does not invent a new severity/label vocabulary** — it reuses the repo's
  (`P0/P1/P2`, `.github/labels.md`, the ●-scale).

---

_Continued in [`02-structural-design.md`](./02-structural-design.md) — the `.claude`
callable function: orchestrator phases, the auditor agents and their models, the
handover contracts, the gate, and the route to `/file-issue`._
