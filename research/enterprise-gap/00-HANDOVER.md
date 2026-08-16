# 00 · HANDOVER — turn this backlog into GitHub epics, issues, PRs & a task list

> **You are the execution agent.** This is the one document to read to translate the enterprise-gap
> backlog into tracked work on GitHub. It tells you _what_ to create, _in what order_, and _how_. The
> detailed **bodies already exist** in the per-WP files — you read each file and create the matching
> GitHub artifact from it. **Do not re-author bodies here** (that would duplicate and drift — the very
> failure this pack warns about). This runbook = procedure + ordering + the complete worklist.

Scope of this handover: **create the tracking artifacts** (epics, issues, a PR description/draft, and a
task list / project board). **Do NOT implement product code** unless separately instructed — per the
repo rule, _finders report, builders fix_. Each item carries `needs-run` caveats to confirm before any
implementation.

## What you will create

- **15 epic tracking-issues** (one per WP, from each `epic.md`).
- **36 issues** (from each `issue-*.md`).
- **1 PR** (from `WP-01/pr-01-*.md`) — create as a **draft/description** now; open for real when the
  work is done, referencing `Closes #<issue>`.
- **1 master task list / project** grouping everything by phase (NOW / NEXT / LATER) and dependencies.

Total: **52 backlog files** under `working-packages/` → 15 epics + 36 issues + 1 PR.

## Inputs & where bodies come from

```
research/enterprise-gap/
├─ 00-HANDOVER.md            ← you are here (the runbook)
├─ README.md, 01–07*.md      ← context/rationale (link from issues; don't recreate as issues)
└─ working-packages/
   ├─ README.md              ← the index + label/usage notes
   └─ WP-01 … WP-13/         ← epic.md + issue-*.md + pr-*.md  (THE ISSUE/PR BODIES)
```

Each backlog file begins with a front-matter block you parse into GitHub fields:

```
TYPE:   epic (tracking issue) | issue | pr (plan)
TITLE:  "[area] …"            → the GitHub title (keep the [area] prefix)
LABELS: type:…, severity:…, area:…, needs-triage   → apply as labels
WP:     WP-NN                 → the parent epic (issues only)
```

The **body** = everything after the closing `---` of that block, used verbatim as the issue/PR body.
(The issue files already follow the repo's `.github/ISSUE_TEMPLATE/agent-finding.md` shape.)

## Preconditions (do these first)

1. **Confirm the target repo** with the requester (the brand-ui repo).
2. **Create labels once** from [`../../.github/labels.md`](../../.github/labels.md) (type / severity /
   area / `needs-triage`). If a label is missing at create time, file the issue without it and keep the
   `LABELS:` line in the body (per the repo convention).
3. **Tooling:** use the GitHub MCP (`mcp__github__create_issue`, `update_issue`, `add_issue_comment`,
   `create_pull_request`) **or** `gh` CLI. Either is fine; be consistent.
4. **Dedupe:** the repo rule is _search before create_. For each item, search existing issues by title;
   if a match exists, comment/link instead of creating a duplicate.

## File → GitHub mapping rules

| File `TYPE` | Create as                       | Notes                                                                                                                                 |
| ----------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `epic …`    | a **tracking issue**            | title from `TITLE`; body from file; add a **task list** of its child issues (`- [ ] #<child>`); label incl. the WP's area + severity. |
| `issue`     | a **GitHub issue**              | title/body/labels from the file; link to its epic ("Part of #<epic>"); add the epic checkbox to the epic's task list.                 |
| `pr (plan)` | a **draft PR / PR description** | don't open a real PR until the work is implemented; when you do, `Closes #<issue>` and include the file's checklist.                  |

Render each epic's body, then append a **task list** linking its children (this is how "translate into
task lists" is satisfied natively on GitHub — the epic's checkboxes track its issues).

## Build order (phases + dependencies)

Create in this order so dependencies and the "enforcement over reminders" spine hold. (Rationale:
[`04-roadmap.md`](./04-roadmap.md).)

| Phase     | Working packages (create in this order)                                                           | Key dependencies                                                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **NOW**   | **WP-01** → **WP-10** → **WP-02**                                                                 | WP-01 (CI) blocks everything; WP-10 gates depend on WP-01; WP-02 depends on WP-01.                                                                                 |
| **NEXT**  | **WP-03** → **WP-12** → **WP-09** → **WP-04** → **WP-13** → **WP-15**                             | WP-03 pairs WP-10; WP-09 depends on WP-03 + WP-02; WP-12 & WP-13 reuse WP-03/WP-10; WP-15 harvests into brand-ui-audit (its plugin part depends on the VP stream). |
| **LATER** | **WP-05** → **WP-06** → **WP-07** → **WP-11** → **WP-08 (optional)** → **WP-14 (capstone, last)** | WP-05/06/07 depend on WP-01/02; WP-11 depends on WP-03 + WP-10; WP-08 depends on WP-04; **WP-14 is last — its gate runs the other WPs' checks at once**.           |

Record each dependency on the GitHub side: in the epic body note "Depends on #<other epic>", and/or use
a Project with a Status/Phase field. **First sprint** (if asked to pick): WP-01 in full + WP-10
issue-01/02 (the manifest + registration gates) + the WP-02 zero-story/zero-test subset.

## The complete worklist (all 43 artifacts)

Create every row. **Read the file for the body + exact `LABELS`.** `↳` = child issue of the epic above
it. Order top-to-bottom within the phase order above.

### NOW

**WP-01 — CI, gates & doc-truth** (`WP-01-ci-gates-doctruth/`)

- `epic.md` — _epic_ — [governance] WP-01 — CI, quality gates & documentation truth
- ↳ `issue-01-add-ci-pipeline.md` — Add CI pipeline — gates currently run nowhere **(P0)**
- ↳ `issue-02-fix-doc-inaccuracies.md` — Fix inaccurate docs — non-existent CI and theme-count drift
- ↳ `issue-03-agents-md-runnable-contract.md` — Make AGENTS.md self-validating — runnable command contract
- `pr-01-github-actions-ci.md` — _PR_ — ci: add GitHub Actions pipeline (implements issue-01)

**WP-10 — Self-maintaining repo** (`WP-10-self-maintaining-repo/`)

- `epic.md` — _epic_ — [governance] WP-10 — Self-maintaining repo: enforcement over reminders
- ↳ `issue-01-manifest-autoregen-and-stale-gate.md` — Auto-regenerate the manifest + fail CI on stale
- ↳ `issue-02-component-registration-gate.md` — Component-registration gate — auto-wired or fail loudly
- ↳ `issue-03-generated-inventories.md` — Generate inventory/derived docs from the manifest + stale-check
- ↳ `issue-04-institutionalize-the-convention.md` — Institutionalize 'enforcement over reminders'

**WP-02 — Coverage to the bar** (`WP-02-coverage/`)

- `epic.md` — _epic_ — [test] WP-02 — Bring story/test/theme coverage to the documented bar
- ↳ `issue-01-story-coverage.md` — Story coverage to ~100% — start with the zero-story packages
- ↳ `issue-02-smoke-tests.md` — Add smoke tests — four packages have zero tests
- ↳ `issue-03-six-theme-aa-artifact-and-acme.md` — Prove six-theme AA + remove orphan `acme` theme

### NEXT

**WP-03 — Agent ground-truth** (`WP-03-agent-ground-truth/`)

- `epic.md` — _epic_ — [ai] WP-03 — enriched manifest, context generator, MCP, index
- ↳ `issue-01-enrich-manifest.md` — Enrich the manifest with resolved prop tables (expanded cva)
- ↳ `issue-02-component-meta-antipatterns.md` — Per-component intent metadata: relationships/anti-patterns
- ↳ `issue-04-context-generator.md` — `brand-ui context` generator (ground truth into agent files) _(do before MCP)_
- ↳ `issue-03-persistent-mcp-and-index.md` — Persistent brand-ui MCP server + static component index

**WP-12 — Guidance consistency** (`WP-12-guidance-consistency/`)

- `epic.md` — _epic_ — [governance] WP-12 — one decisions source, generated everywhere, gated
- ↳ `issue-01-canonical-decisions-and-rules.md` — Canonical decisions source + new rules
- ↳ `issue-02-generate-into-surfaces-and-gate.md` — Generate decision summary into CLAUDE/AGENTS/context + gate
- ↳ `issue-03-adrs-and-types-only-hook.md` — ADRs (scope + dependency) + types-only-never-runtime hook

**WP-09 — Playbooks** (`WP-09-playbooks/`)

- `epic.md` — _epic_ — [ai] WP-09 — Playbooks: composition recipes as invokable agent skills
- ↳ `issue-01-playbook-format-and-first-set.md` — Define the playbook format + author the first 3–5
- ↳ `issue-02-playbook-registration-and-surfacing.md` — Auto-register & surface playbooks, stale-gated

**WP-04 — DTCG tokens** (`WP-04-dtcg-tokens/`)

- `epic.md` — _epic_ — [tokens] WP-04 — DTCG token source of truth + Style Dictionary _(issues inline in the epic)_

**WP-13 — Component consolidation** (`WP-13-component-consolidation/`)

- `epic.md` — _epic_ — [ui] WP-13 — consolidation + net-new widgets + templates/icons
- ↳ `issue-01-statepanel.md` — Collapse empty/error/loading-state into one `StatePanel`
- ↳ `issue-02-appsidebar-consolidation.md` — One parameterized `AppSidebar` + shared nav primitives
- ↳ `issue-03-metriccard-parameterize.md` — Parameterize `MetricCard`; retire the editor fork
- ↳ `issue-04-net-new-widgets.md` — number/tag/file-upload/rating/color/stepper/descriptions (+ Gantt, heavy)
- ↳ `issue-05-templates-and-icons.md` — Registry templates + a real icon set

**WP-15 — Taste / anti-slop adoption** (`WP-15-taste-anti-slop/`)

- `epic.md` — _epic_ — [ai] WP-15 — adopt the taste-skill (anti-slop audit + taste profile)
- ↳ `issue-01-anti-slop-audit.md` — harvest the AI-TELLS catalog (visual + content) into brand-ui-audit
- ↳ `issue-02-taste-profile.md` — dials → token-backed taste profile (register × density × motion × expressiveness)
- ↳ `issue-03-plugin-taste-wiring.md` — feel stage + anti-slop bar + curated arsenal in the plugin

### LATER

**WP-05 — Hard widgets** (`WP-05-hard-widgets/epic.md`) — _epic, issues inline_ — data grid (virtualization/server/saved-views), date-range picker / tree / transfer / virtual list, real charts set.
**WP-06 — Density & i18n/RTL** (`WP-06-density-i18n/epic.md`) — _epic, issues inline_ — density axis; i18n/RTL foundation.
**WP-07 — Versioning & governance** (`WP-07-versioning-governance/epic.md`) — _epic, issues inline_ — Changesets/release; deprecation+codemods; CODEOWNERS/RFC/cadence.
**WP-11 — A2UI support** (`WP-11-a2ui-support/`)

- `epic.md` — _epic_ — [ai] WP-11 — build the A2UI baseline into @qlik-coe-emea/qlabs-components-ai
- ↳ `issue-01-a2ui-spike.md` — Phase-0 spike (de-risk the moving spec)
- ↳ `issue-02-catalog-generator.md` — Generate the brand-ui A2UI catalog from the manifest + gate
- ↳ `issue-03-react-renderer-mvp.md` — A2UI renderer MVP in @qlik-coe-emea/qlabs-components-ai (sibling to JSXPreview)
- ↳ `issue-04-custom-components.md` — A2UI custom components (DataTable/charts/MetricGrid/DateTimeInput)
- ↳ `issue-05-enhance-ai-components.md` — Enhance Artifact/Tool/Message to host A2UI
  **WP-08 — Figma Code Connect (optional)** (`WP-08-figma-code-connect/epic.md`) — _epic, deferred_ — only if a design-driven workflow enters scope; depends on WP-04.
  **WP-14 — Release pipeline (capstone)** (`WP-14-release-pipeline/`)
- `epic.md` — _epic_ — [governance] WP-14 — validate → version → snapshot → publish (plugin + library)
- ↳ `issue-01-validation-gate.md` — one blocking release gate (quality + docs + wiring + assets)
- ↳ `issue-02-coordinated-versioning.md` — Changesets locked group (library + plugin, one version)
- ↳ `issue-03-build-and-snapshot.md` — dual build + the `release/<version>/` snapshot
- ↳ `issue-04-publish-and-verify.md` — `release.yml` + `/cut-release`: publish, verify, rollback

_(There is no WP-16 — the soft-skill / brand-register elevation was evaluated and cut; see the decision
record [`10-soft-skill-adoption.md`](./10-soft-skill-adoption.md).)_

> WP-04, WP-05, WP-06, WP-07, WP-08 keep their constituent issues **inline in the epic** (the epic body
> lists them). Either (a) create just the epic and keep the issues as a checklist in its body, or (b)
> split each inline issue into its own GitHub issue — ask the requester which granularity they want for
> the LATER phase. NOW/NEXT epics already have discrete `issue-*.md` files → create those as issues.

## Guardrails (carry these into every artifact)

- **Finders report, builders fix.** These issues _describe_ work with root-cause + acceptance criteria;
  implementation is separate and references the issue (`Closes #N`).
- **`needs-run` before building.** Several issues flag assumptions to confirm by running the toolchain
  (e.g. "does `pnpm manifest` succeed", "does six-theme AA actually fail"). Confirm before coding.
- **Enforcement over reminders.** Each item's Definition of Done includes wiring its rule into a
  generator + gate/hook/CI + skill — not just code. Don't mark done until the gate exists (WP-10).
- **Don't fabricate.** This pack is a **static analysis** (no toolchain was run; see
  [`03-gap-analysis.md`](./03-gap-analysis.md#method--honest-scope)). Treat items as proposals to verify.
- **Link context, don't copy it.** Reference the `0X-*.md` docs from issues for rationale; don't paste
  them in.

## Definition of done (for this handover)

- [ ] Labels created; target repo confirmed.
- [ ] 15 epics created as tracking issues, each with a task list of its children.
- [ ] 36 issues created, labeled, and linked to their epic.
- [ ] WP-01 PR created as a draft/description (opened for real only when implemented).
- [ ] LATER-phase granularity (inline vs split) confirmed with the requester and applied.
- [ ] A phase/dependency view exists (Project board or epic "Depends on #" notes) reflecting the build
      order above.
- [ ] Each created artifact's body matches its source file (no drift); dedupe checked.

---

_Index & rationale: [`README.md`](./README.md). Backlog index + labels:
[`working-packages/README.md`](./working-packages/README.md). Sequencing:
[`04-roadmap.md`](./04-roadmap.md)._
