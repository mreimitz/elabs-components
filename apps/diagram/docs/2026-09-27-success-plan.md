# Atlas — the success plan

Date: 2026-09-27 · Purpose: rethink the 65-item programme into something that ships, gets used, and earns its next step · Supersedes the release table in `PRODUCT.md` §3 (rewritten to match)

## 1. What success is

**Phase A (decided 2026-09-27): the maintainer alone uses Atlas for real deals for 8 weeks and keeps coming back to it.** Metric: `≥ 3 real customer diagrams made in Atlas`, `≥ 3 interactive stories sent to customers`, `used in week 7 and 8 without forcing it`. Measured from the workspace's Git history and the published files.

**Phase B (when the maintainer decides, not before):** three named Qlik presales colleagues (C1) via a shared Git workspace repo he administers; metric `weekly active authors ≥ 3`, `published stories ≥ 10`, `"used it again" ≥ 2 of 3` after 4 weeks. If either phase fails, the reasons are in the diagrams that _weren't_ made.

## 2. Why the current plan would fail

1. **No first user.** Everything is built for personas; nobody is named. The maintainer is the only user of R0.
2. **The wedge is buried.** The differentiator — on-brand Qlik marketecture that morphs into the technical truth and ships as an interactive file — sits in wave 3, behind home, catalog, MCP, tabs and a language service.
3. **Platform before product.** Server, OIDC, permissions, audit: right for R2, fatal as R1 attention. A shared Git repo already gives a small team sharing, versions and audit for free.
4. **Maintainer bandwidth.** One person reviews everything. A plan that needs him for 15 acceptance gates in wave 1 stalls on him.
5. **Breadth of bets.** Seven theme families, four vendor profiles, four box anatomies, PPTX, guided builder — each a bet without evidence.

## 3. The rethink — one wedge, three cohorts, evidence-gated growth

### 3.1 The wedge (what ships first)

> A Qlik presales opens Atlas, picks the _Qlik Cloud + customer landscape_ template, adjusts it in the inspector or the YAML, switches to the marketecture lens (on-brand, the deck's rules), walks the story, and publishes one interactive HTML the customer opens without installing anything.

That is the whole of **Release 1**. Everything in it serves that sentence; everything else is parked.

### 3.2 Cohorts, not personas

| Cohort                                            | Who                                              | When                                  | What they get                                                                                                                                         | What we learn                                                                   |
| ------------------------------------------------- | ------------------------------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **C0 — the maintainer**                           | Manuel                                           | now → wave 1                          | local mode, wedge features                                                                                                                            | whether the wedge works at all                                                  |
| **C1 — three Qlik SEs** (named by the maintainer) | colleagues in EMEA presales                      | when the maintainer decides (phase B) | the app cloned from a **shared Git workspace** (`atlas-workspace` repo: diagrams, components, catalog), a 10-minute onboarding video, a Slack channel | do they use it for real deals; what they cannot express; what the customer said |
| **C2 — one PM + the SE team**                     | a Qlik product manager who owns one architecture | week 8, only if C1 succeeded          | protected components, publish releases, org-wide sharing (the server)                                                                                 | whether ownership/protection is what PMs need                                   |
| **C3 — another vendor**                           | a friendly ClickHouse/Snowflake contact          | later                                 | their theme + profile                                                                                                                                 | whether "per vendor" holds                                                      |

Every cohort is a **gate**: C2 does not start until C1's metric is met. The platform (server, OIDC, permissions) is built for C2, not before.

### 3.3 Release 1 — the wedge, 20 items including additions DG-67–70, 8 weeks

Kept, in order, with what was cut from each:

| Wk      | Item                                                 | Kept                                                                                                                                                                                | Cut / deferred                                                        |
| ------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1–2     | DG-20 visual pass                                    | as is — the look is the product                                                                                                                                                     | —                                                                     |
| 1–2     | DG-21 workspace service                              | files, autosave, tree, thumbnails, **contract.md**                                                                                                                                  | versions drawer (Git gives it), SSE fan-out beyond the open doc       |
| 2       | DG-22 shell v2                                       | rail, tabs, view/edit, keymap, "Atlas"                                                                                                                                              | Settings page (a stub link)                                           |
| 3       | DG-24 catalog                                        | catalog service + **Qlik, AWS, Azure, generic** metadata filled via MCP                                                                                                             | other vendors, in-app metadata editing (edit the YAML)                |
| 3       | DG-35 MCP server                                     | workspace, spec, compose, catalog tools + `author-diagram` prompt + skill                                                                                                           | render/present bridge (later), resources                              |
| 3       | DG-25 details card v2                                | as is                                                                                                                                                                               | —                                                                     |
| 4       | DG-26 composition                                    | `ref: catalog/…` / `ref: ws/…`, `expand`, dotted ids, `component:`, resolver, propagation, `description/docs/status`                                                                | `phase`, `metrics`, `volume` (move to live-ops), rename refactoring   |
| 4       | DG-27 composites                                     | collapsed + inline + drill-down                                                                                                                                                     | peek thumbnail                                                        |
| 4       | DG-28 language service                               | keys/enums, ids, icons, components, snippets                                                                                                                                        | quick-fixes (later)                                                   |
| 5       | DG-23 home                                           | recents, tree, components, start-from templates                                                                                                                                     | health tiles, search index (tree filter is enough)                    |
| 5       | DG-31 story v2                                       | `story:`, camera fit + follow-edge, dimming, captions, story bar, present full-screen                                                                                               | presenter window, recording, per-step export, autoplay kiosk          |
| 5–6     | **DG-30 particles** (back in by maintainer decision) | cadence/sprite/density profiles, reduced motion, export-excluded                                                                                                                    | volume axis, story dimming polish                                     |
| 6       | DG-36 visual layer                                   | `visual:` block, derivation, materialize                                                                                                                                            | —                                                                     |
| 6–7     | DG-37 style system                                   | schema, cascade (theme → workspace → diagram), **`atlas-clean` + `qlik-marketecture` only**, capability-list anatomy                                                                | atlas-visual, other anatomies, linter UI (validator warnings suffice) |
| 7       | DG-38 lens switch                                    | control, lane layout, **the morph**                                                                                                                                                 | profile chip swap (one profile per lens in R1)                        |
| 8       | DG-43 publish interactive HTML                       | single file, both lenses, story, customer-safe                                                                                                                                      | folder site, embed                                                    |
| 2       | **DG-67 wedge templates** (new)                      | two templates: _Qlik Cloud + customer landscape_ and _Qlik Talend Cloud pipeline_ (deck slide 4), plus the `qlik-cloud-tenant` component — content from the maintainer's 30 minutes | —                                                                     |
| phase B | **DG-66 C1 onboarding** (new)                        | shared Git workspace repo, 10-min video, feedback form, weekly office hour                                                                                                          | —                                                                     |

Later maintainer additions DG-68 (shell polish), DG-69 (generic catalog entries) and DG-70 (read-only live view) are part of R1 and delivered. Phase-B onboarding is outside the 20-item R1 count.

Moved out of R1 entirely: DG-29 catalog panel/⌘K (the inspector + YAML + templates cover it), DG-32/33, DG-39–42, DG-44–65.

Theme bindings collapse to one line in DG-37: the Qlik theme binds hero `qlik` + the two profiles; neutral binds hero none. Seven families wait for C3.

### 3.4 Release 2 — for C2, gated by C1's metric

Server (DG-57), sharing UI (DG-56), hosted publishing (DG-58), protected components with extension points (from DG-26/27), product CI (DG-61), security hardening (DG-64), brand-terms review (DG-59), present v2 (DG-32), styles page (DG-41), dialect compatibility (DG-60). Chosen and ordered by what C1 asked for.

### 3.5 Release 3 — pulled, not planned

Everything else (variants/diff, guided builder, layers, PPTX, vendor profiles, import, comments, i18n, performance harness, data classification…) stays specified and unfiled until a cohort pulls it. A pull is a sentence from a real user plus the diagram they tried to make.

## 4. How the work runs so the maintainer is not the bottleneck

- **Maintainer time budget: 2 hours per week.** One Monday review (screenshots + recordings from the agents), one Friday decision. Items are written so agents self-verify (Steps→Check, browser proof); the maintainer only accepts the visual pass (DG-20) and the R1 tour.
- **Ship every two weeks.** Each fortnight ends with a working app on `main` of the app folder, a 2-minute recorded demo, and a line in `docs/releases/CHANGELOG.md`. Nothing sits in a branch longer than a fortnight.
- **A demo script is the spec.** `docs/demo-script.md` — the wedge sentence as 12 clicks. Every fortnight the agents run it in the browser; if a step fails, that is the bug of the week.
- **Feedback loop.** C1's Slack channel + a 5-question form after each real use; the maintainer turns pulls into items on Fridays; the roadmap README shows "asked by" on every item filed after week 4.
- **Kill criteria.** Week 4: if the maintainer has not used the app for a real deal, stop and re-plan. Week 8: if phase A's metric is missed, no C1 and no platform; the next four weeks go to whatever blocked him. Phase B has its own 4-week gate before C2.

## 5. What stays true from the previous planning

The concepts (two lenses, style system, platform, security, MCP, persona gaps) remain the design of record — nothing is thrown away; the item files stay; the policies N1–N12 still bind (N2 local mode, N5 content safety, N6 brand terms, N11 a11y apply from R1; the rest from R2). What changes is **order and gating**: the wedge first, cohorts as gates, everything else pulled by evidence.

## 6. First actions (this week)

1. First real diagram (week-4 gate): the **Demo Banking / MCP Sales app landscape** — decided 2026-09-27.
2. Agents: run wave 0 — DG-20, DG-21 (slimmed), DG-22 — with the hardened items already on disk.
3. Templates' content: **decided 2026-09-27**, written into DG-67 — no session needed.
4. Create `docs/demo-script.md` and `docs/releases/CHANGELOG.md` (done with this plan).
