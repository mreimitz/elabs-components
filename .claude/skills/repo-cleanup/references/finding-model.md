# Finding model

Load this in every mode. It defines what a finding is allowed to claim.

## The rule the whole skill rests on

**Nothing is slow, wasteful, duplicated, unused or safe to delete until evidence says so.**
A statement without a measurement or a static proof behind it is a _suspicion_, and it is reported
as one. Reporting a suspicion honestly is a success; dressing one up as a fact is the only real
failure mode this skill has.

## Identifiers

Stable, sequential per category, assigned in the order found and never reused:

| Prefix  | Domain                                                                           |
| ------- | -------------------------------------------------------------------------------- |
| `CTX-`  | Always-loaded context footprint — instruction files, listings, hooks, MCP wiring |
| `TOK-`  | Measured usage and cost — sessions, subagents, growth curves                     |
| `CFG-`  | Settings, plugins, MCP enablement, permission surface                            |
| `DOC-`  | Instruction hygiene — duplication, staleness, rule-vs-evidence misplacement      |
| `REPO-` | Dead files, dead exports, unused dependencies, disabled tests                    |
| `GIT-`  | History — churn, co-change, bloat, ownership concentration                       |
| `PERF-` | Build, test, startup and runtime timing                                          |

## Shape

```yaml
id: CTX-003
title: <one line, states the defect, not the fix>
category: context            # context | usage | config | docs | repo | git | performance
status: open                 # open | planned | fixed | wont-fix | superseded
severity: high               # critical | high | medium | low | informational
confidence: confirmed        # confirmed | high | medium | low
estimated_impact: <number + unit, or "unquantified">
estimated_effort: <trivial | small | medium | large>
risk: <low | medium | high>  # risk of the REMEDIATION, not of the defect
scope: <what it affects: every request / every subagent / one WP / one file>
summary: <2-3 sentences>
evidence:
  - method: <script + flags, or the exact command run>
    result: <the number or the proof>
    artifact: .repo-cleanup/evidence/<file>
measurement_method: <how the number was obtained, incl. estimate vs exact>
affected_files: [<paths>]
recommended_action: <smallest change that resolves it>
validation: <what must be run after the change, and what result proves it worked>
rollback: <how to undo>
limitations: <what was NOT checked; what could make this finding wrong>
```

`limitations` is mandatory and may not be empty. If nothing limits the finding, say
`none — statically proven over the full file set`, and be prepared to defend it.

## Severity

Operational or maintenance impact, never taste.

|                   | Means                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| **critical**      | Ongoing correctness, security or data risk; or a cost/latency defect large enough to change how the tool is used |
| **high**          | Material recurring cost, a real slowdown, or a maintenance hazard that has already caused a defect               |
| **medium**        | Measurable waste or friction with a clear fix                                                                    |
| **low**           | Small, safe, worth doing when nearby                                                                             |
| **informational** | A fact worth knowing; no action implied                                                                          |

A style preference is never above `low`. **Cosmetic cleanup may never outrank a confirmed cost or
reliability finding** in the prioritised list — if the ordering says otherwise, the scoring is wrong.

## Confidence

|               | Requires                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------- |
| **confirmed** | A measurement taken during this audit, or a static proof over the complete relevant file set |
| **high**      | Strong indirect evidence with one plausible alternative explanation, named                   |
| **medium**    | A pattern consistent with the claim, with unchecked alternatives                             |
| **low**       | A hypothesis worth testing; the finding's real content is the test to run                    |

**`confirmed` cannot be assigned to an estimate.** A token count derived from `chars / 4` is at best
`high`, and its `measurement_method` must say `estimated`. A number read out of a transcript's
`usage` block is exact and may be `confirmed`.

A `low`-confidence finding is not noise — it is a **measurement gap**, and it belongs in its own
section of the report with the measurement that would resolve it.

## Priority

```
priority = impact × confidence × frequency × scope ÷ effort ÷ risk
```

Not a formula to compute to three decimals — a consistent ordering to explain. `frequency` is how
often the cost is paid (per request ≫ per session ≫ per release). `scope` is how much is affected.
Findings are grouped, and the groups are ordered:

1. **Quick wins** — high impact, low effort, low risk.
2. **High-impact engineering** — worth a work package.
3. **Risky changes** — need a plan, a gate and a rollback.
4. **Measurement gaps** — what we could not determine, and how to determine it.
5. **Cosmetic** — last, always.

## Report shape

`.repo-cleanup/report.md`:

1. **Executive summary** answering exactly six questions:
   the three most important problems · the evidence for them · the likely impact · what to do
   first · what NOT to change yet · where more measurement is needed.
2. **What was not verified** — before any detail. Measurement gaps, skipped analyzers, commands
   not run, and why.
3. Findings by group, most severe first.
4. Appendix: what ran, with versions and timings.

Raw command output never goes in the report. It goes to `.repo-cleanup/evidence/` and is linked.

## Writing findings

- Title states the defect (`skill listing costs 4.8k tokens on every request`), not the remedy
  (`disable unused plugins`). The remedy is `recommended_action`.
- One defect per finding. Two causes with one symptom are two findings.
- Quantify or say `unquantified`. Never "significant", "excessive", "a lot of".
- When a number is an estimate, the word **estimate** appears next to it, every time.
- Name the counterfactual where one exists: "10 agents of 98 turns ≈ 94 M vs 478 M measured".
