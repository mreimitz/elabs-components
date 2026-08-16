# 00 · HANDOVER — build the vibe-coder-plugin (file the issue/PR concept → push to GitHub → implement)

> **You are the build agent.** This runbook takes the **vibe-coder-plugin** stream from design to a
> built feature, in **three phases, in order**:
>
> 1. **Create the issue/PR concept** — turn this backlog into GitHub epics, issues, and PR plans.
> 2. **Push it all to GitHub** — create them with labels, epic↔child links, ordering, and a board.
> 3. **Implement** — build each issue in dependency order; each implementation is a PR that
>    `Closes #<issue>`.
>
> Do **phases 1+2 first, then phase 3** — work must be tracked before it's built (the repo's _finders
> report, builders fix_ rule: the issue exists before the implementing PR). The GitHub mechanics
> (front-matter→fields, label creation, dedupe, epic task lists) are **identical to the enterprise-gap
> handover** — read [`../enterprise-gap/00-HANDOVER.md`](../enterprise-gap/00-HANDOVER.md) for them and
> apply them here.

This stream is **design-stage**: several items depend on the enterprise-gap substrate and on CLI
functions that don't exist yet — confirm each item's `needs-run` notes and "Depends on" links **before
implementing it** in phase 3.

## Phase 1 + 2 — the issue/PR concept (create these in GitHub)

- **4 epic tracking-issues** (one per VP, from each `epic.md`).
- **6 issues** (from each `issue-*.md`). **VP-04 keeps its issues inline** in the epic — create the
  epic with a checklist, or split the 3 inline issues; ask the requester.
- A **task list / project** grouping by build order.

Total backlog files: **10** (4 epics + 6 issues). Prefix is **VP-** (distinct from enterprise-gap's
**WP-**).

## File → GitHub mapping & conventions

Identical to the enterprise-gap handover: parse each file's `TYPE / TITLE / LABELS / WP` front-matter →
GitHub fields; body after the `---` is the issue body; epics get a **task list** of their children;
create labels first (from [`../../.github/labels.md`](../../.github/labels.md)); **search before create**
(dedupe). See [`../enterprise-gap/00-HANDOVER.md`](../enterprise-gap/00-HANDOVER.md) for the full rules.

## Build order

| Order | VP                                                                                    | Why                                                                                       |
| ----- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **1** | **VP-01 — Plugin foundation** (`VP-01-plugin-foundation/`)                            | router + plugin wiring + CLI engine stubs; unblocks the rest.                             |
| **2** | **VP-02 — Greenfield `new-app`** + **VP-04 — Visual engine** (`VP-02-…/`, `VP-04-…/`) | the headline experience; VP-02 uses VP-04's loop — build together.                        |
| **3** | **VP-03 — Brownfield `migrate`** (`VP-03-brownfield-migrate/`)                        | higher-risk; best once the enriched manifest (enterprise-gap WP-03) + guidance are solid. |

**Cross-stream dependency (critical):** these VPs consume enterprise-gap WPs — **WP-03** (manifest/
context/MCP), **WP-09** (playbooks), **WP-13** (templates), **WP-05** (widgets/charts), **WP-10**
(gates), **WP-12** (guidance), **WP-07** (versioning). Note "Depends on #<enterprise-gap epic>" on each
VP epic. Sensible sequencing: enterprise-gap NOW/NEXT in flight → VP-01/02/04 → VP-03.

## The worklist (all 10 artifacts)

**VP-01 — Plugin foundation** (`VP-01-plugin-foundation/`)

- `epic.md` — _epic_ — [plugin] VP-01 — one guided plugin for Cowork + Code
- ↳ `issue-01-router-and-plugin-wiring.md` — `brand-ui-start` router + wire plugin for both surfaces
- ↳ `issue-02-cli-engine-functions.md` — CLI `scaffold`/`scan`/`map`/`codemod` (skeletons + contracts)

**VP-02 — Greenfield `new-app`** (`VP-02-greenfield-newapp/`)

- `epic.md` — _epic_ — [plugin] VP-02 — greenfield guided build flow
- ↳ `issue-01-new-app-skill.md` — staged interview + living `app-spec.md`
- ↳ `issue-02-scaffold-from-spec.md` — `brand-ui scaffold` → born-compliant app + context handoff

**VP-04 — Visual feedback engine** (`VP-04-visual-feedback-engine/`)

- `epic.md` — _epic, issues inline_ — propose→preview→pick→refine (Storybook-MCP real renders +
  artifacts). Inline: loop reference + fidelity ladder · Storybook-MCP preview helper · artifact preview.

**VP-03 — Brownfield `migrate`** (`VP-03-brownfield-migrate/`)

- `epic.md` — _epic_ — [plugin] VP-03 — scan → analyze → codemod-driven migration
- ↳ `issue-01-scan-and-map.md` — `scan` (repo profile) + `map`/`analyze` (existing → brand-ui), read-only
- ↳ `issue-02-codemod-execution.md` — generate → dry-run → review → apply, phased + visual parity

## Phase 3 — Implementation (only after the issues exist in GitHub)

Start once phases 1+2 are done **and** the relevant enterprise-gap dependencies are live. Work
**issue-by-issue, in the build order above**; each issue becomes one PR. Per issue:

1. **Confirm readiness.** Check the issue's `needs-run` notes + its "Depends on" links (e.g. don't
   build VP-02 `scaffold` before WP-13 templates / WP-09 playbooks exist; don't build VP-03 `codemod`
   before the WP-03 manifest is rich enough). If a dependency is missing, leave the issue open and pick
   the next **unblocked** one.
2. **Branch:** `feat/vp-NN-<slug>` off the default branch.
3. **Implement to the issue's Acceptance criteria** — exactly what it specifies; **reuse the substrate**
   (manifest, playbooks, templates, gates) rather than reinventing.
4. **Run the gates green:** `pnpm typecheck lint test build` (+ `registry:validate` if registry
   touched, + `pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook` if components/stories changed). Add the
   issue's "Test to add."
5. **Born-compliant:** the new/edited code passes the WP-10 gates (manifest/registration/stale +
   types-only) and the six-theme `brand-ui-audit`; semantic tokens only, no raw hex.
6. **Open the PR:** `Closes #<issue>`, fill the repo PR template, link the epic. Keep PRs small (one
   issue each). For VP-03 migration, **one PR per migration phase**, app green at each.
7. **Review → merge**, tick the epic's task-list box, move to the next unblocked issue.

**Implementation order:** VP-01 in full (foundation) → **VP-02 + VP-04 together** (greenfield + the
visual loop it uses) → **VP-03** (brownfield) — and each only after the enterprise-gap WPs it depends
on are live.

**Stop-and-ask triggers:** a dependency isn't ready; an issue's `needs-run` shows the assumption was
wrong (re-scope the issue, don't force it); a Cowork-only capability is unavailable (fall back to the
portable mechanism — `AskUserQuestion`/Storybook-MCP/artifacts — and note it).

## Guardrails (carry into every artifact)

- **File first, then build** (finders report, builders fix) — every implementing PR references an
  existing issue (`Closes #N`); don't implement work that isn't tracked.
- **Design-stage / needs-substrate** — these depend on enterprise-gap WPs + new CLI functions that
  don't exist yet; note the dependency, don't assume readiness.
- **Migration is real-code editing** — VP-03 must stay read-only until plan approval; every codemod is
  dry-run + diff-reviewed before apply; app green every phase.
- **Cowork is a 2026 preview** — document install for both surfaces; don't hard-depend on unreleased
  Cowork org/visual APIs.
- **Link context, don't copy it** — reference the `0X-*.md` designs for rationale.

## Definition of done

**Phases 1+2 (the issue/PR concept is in GitHub):**

- [ ] Labels created (shared with enterprise-gap); target repo confirmed.
- [ ] 4 VP epics created with child task lists; 6 issues created + linked; VP-04 granularity confirmed.
- [ ] Each VP epic notes its cross-stream "Depends on #<WP>" links.
- [ ] A build-order view (project board / epic notes) reflects VP-01 → VP-02+VP-04 → VP-03 and the
      enterprise-gap dependencies.

**Phase 3 (the plugin is built):**

- [ ] Each issue implemented as a merged PR (`Closes #N`) meeting its acceptance criteria, in
      dependency order; gates green; six-theme audit passing.
- [ ] VP-01 foundation works (router + plugin installs/runs in Cowork **and** Code; CLI functions live).
- [ ] `new-app` runs the guided build → spec → born-compliant scaffold; `migrate` runs scan → analysis
      → review-gated codemod migration; the visual loop works.
- [ ] Plugin version bumped (Changesets); the `brand-ui` plugin marketplace updated.
- [ ] Any item blocked by a missing dependency is left open with the blocker recorded (not forced).

---

_Index & rationale: [`README.md`](./README.md). Mechanics:
[`../enterprise-gap/00-HANDOVER.md`](../enterprise-gap/00-HANDOVER.md). Designs:
[`01`](./01-plugin-landscape.md)–[`04`](./04-skills-functions-architecture.md)._
