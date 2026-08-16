# Working packages — backlog for the enterprise-gap program

This folder turns the gaps in [`../03-gap-analysis.md`](../03-gap-analysis.md) and the sequencing in
[`../04-roadmap.md`](../04-roadmap.md) into **issue- and PR-shaped markdown**, organized by working
package (WP). It is designed to be handed to a coding agent that will create the GitHub issues/PRs —
nothing here touches GitHub itself.

> **Executing the backlog?** Follow the single runbook: **[`../00-HANDOVER.md`](../00-HANDOVER.md)** —
> it has the complete worklist (all 43 files → 13 epics + 29 issues + 1 PR), the build order, the
> file→GitHub mapping, and the guardrails. This README is the index; `00-HANDOVER.md` is the procedure.

## How a later agent should use this

1. **Create labels first** (once) from [`.github/labels.md`](../../../.github/labels.md). Each issue
   file lists the labels it needs on a `LABELS:` line in its front-matter block.
2. **One file → one GitHub artifact.** Files named `issue-*.md` become issues; `pr-*.md` are PR
   plans (create the PR when the work is done, using the file as the description). `epic.md` is the
   working-package tracking issue — create it first in each WP and link its children.
3. **Respect the order.** Push in WP-number order; within the roadmap, **WP-01 must land before the
   rest** (it adds the CI that gives every other package teeth). Dependencies are noted per file.
4. **Bodies follow the repo template.** Issue files mirror
   [`.github/ISSUE_TEMPLATE/agent-finding.md`](../../../.github/ISSUE_TEMPLATE/agent-finding.md)
   (adapted for enhancements: "Root cause analysis" → "Current state & why the gap exists"). PR files
   mirror [`.github/PULL_REQUEST_TEMPLATE.md`](../../../.github/PULL_REQUEST_TEMPLATE.md).
5. **The fix is separate from the issue** (repo rule): issues describe; PRs implement and reference
   `Closes #N`.
6. **Enforcement over reminders (the spine).** Every WP's Definition of Done includes wiring its rule
   into a **generator + gate/hook/CI + skill** — not just code. **WP-10** builds the shared machinery
   (manifest stale-gate, component-registration gate, generated inventories); its gates are a **NOW**
   priority despite the high number, because they deliver the maintainer's "never remind me to register
   a component / update an inventory" requirement. Treat WP-10 issue-01/02 as part of the first sprint.

## Working packages

| WP        | Title                                                                            | Phase                | Closes (gap IDs)                                     | Files                  |
| --------- | -------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------- | ---------------------- |
| **WP-01** | CI, gates & doc-truth                                                            | NOW (P0)             | C1, C5, E4, D3(p)                                    | epic + 3 issues + 1 PR |
| **WP-02** | Coverage to the documented bar                                                   | NOW (P1)             | C2, C2b, C3, C4, A4, B4                              | epic + 3 issues        |
| **WP-03** | Agent ground-truth: manifest + context gen + MCP + index                         | NEXT (P1)            | E1, E3, E7, D1, D2                                   | epic + 4 issues        |
| **WP-04** | DTCG token source of truth                                                       | NEXT (P1)            | E2, B3                                               | epic (issue inline)    |
| **WP-05** | Hard widgets (grid / pickers / tree / charts)                                    | LATER (P1)           | A1, A2, A3                                           | epic (issues inline)   |
| **WP-06** | Density & i18n/RTL                                                               | LATER (P1/P0\*)      | B1, B2                                               | epic (issues inline)   |
| **WP-07** | Versioning, release & governance                                                 | LATER (P1)           | F1, F2, F3, F4                                       | epic (issues inline)   |
| **WP-08** | Figma Code Connect (optional)                                                    | LATER (P2)           | E6                                                   | epic (deferred)        |
| **WP-09** | Playbooks (composition recipes as agent skills)                                  | NEXT (P1)            | E8                                                   | epic + 2 issues        |
| **WP-10** | Self-maintaining repo (enforcement over reminders)                               | NOW→NEXT (P1)        | G1, G2, G3                                           | epic + 4 issues        |
| **WP-11** | A2UI support (build the A2UI baseline into `@qlik-coe-emea/qlabs-components-ai`) | LATER (P2, R&D)      | doc 02 §C / [`05`](../05-a2ui-concept.md)            | epic + 5 issues        |
| **WP-12** | Guidance consistency ("how & when to use what", generated + gated)               | NEXT (P1)            | C5 / area G / [`06`](../06-guidance-architecture.md) | epic + 3 issues        |
| **WP-13** | Component consolidation + net-new widgets + templates/icons                      | NEXT (P1)            | audit C-1…C-4 / [`07`](../07-component-audit.md)     | epic + 5 issues        |
| **WP-14** | Release pipeline (validate → version → snapshot → publish; plugin + library)     | LATER (P1, capstone) | [`08`](../08-release-process.md)                     | epic + 4 issues        |
| **WP-15** | Taste / anti-slop adoption (audit catalog + token-backed taste profile)          | NEXT (P1)            | [`09`](../09-taste-adoption.md)                      | epic + 3 issues        |

_(The **soft-skill** / brand-register elevation was evaluated and **cut** — marketing-only, out of
scope for an app-first library. See the decision record [`10-soft-skill-adoption.md`](../10-soft-skill-adoption.md).)_

\* B2 (i18n/RTL) is P0 if non-English or EU-facing products are in scope; P1 otherwise. WP-10's gates
(issue-01/02) are **NOW**; its generated-inventory work (issue-03) expands as WP-03/WP-09 land.

## Label quick-reference

- **type:** `type:bug` · `type:regression` · `type:a11y` · `type:visual` · `type:tech-debt` ·
  `type:process`. (This backlog is mostly enhancement/tech-debt; use `type:tech-debt` for
  infra/quality work and `type:a11y` where accessibility is the point.)
- **severity:** `severity:P0` · `severity:P1` · `severity:P2`.
- **area:** `area:ui|data|ai|flow|charts|tokens|icons|marketing|docs|test|registry|governance`.

## Note on scope

These are **proposals from a static analysis** (no toolchain was run — see the caveat in
[`../03-gap-analysis.md`](../03-gap-analysis.md#method--honest-scope)). Before implementing, the
acting agent should confirm the "needs-run" items (e.g. that the manifest generator currently
succeeds, that the six-theme AA audit actually fails anywhere) rather than assuming. Each file flags
its needs-run assumptions.
