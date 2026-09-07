# Issue workflow

A problem is **fixed in the change that found it, or tracked as a GitHub issue** —
never ad hoc and forgotten. What it is NOT is an issue for everything: a backlog
nobody works is worse than no backlog, so the triage below decides per finding.

## The pipeline

```
                    ┌─▶ small + in scope ──▶ fixed in the working tree, mentioned in the PR
finding ──▶ /file-issue
(test /   (triages)  └─▶ left behind ──▶ [P0/P1 or unknown cause: brand-ui-root-cause-analyst]
 agent /                                  ──▶ dedupe ──▶ GitHub issue ──▶ brand-ui-component-builder
 feedback)                                   (search)    (capped spec)    (fixes it + adds the test)
```

Separation of duties:

- **Finders report, never fix** — the Playwright/Vitest suites, `/qa-flows`,
  `brand-ui-visual-ux-reviewer`, `brand-ui-accessibility-reviewer`, and human feedback only surface
  problems. They end their run with ONE `/file-issue` call carrying all of them.
- **`/file-issue` triages, then files** — a finding that is in scope of the current
  task and small (roughly ≤30 changed lines, one package) is fixed on the spot and
  filed nowhere. Everything else is deduped against open issues and opened as a
  capped, implementation-ready issue.
- **`brand-ui-root-cause-analyst` diagnoses the hard ones** — one BATCHED call per
  `/file-issue` run, and only for P0/P1 findings or a cause nobody has located yet.
  A P2 whose `file:line` the finder already gives is written up without it. It
  separates symptom from cause and designs the fix; it does **not** edit code.
- **`brand-ui-component-builder` / `/review-component` fix** — from the issue, and add the
  issue's "Test to add" so the bug can't regress. The PR uses `Closes #N`.

## How to use it

```text
# from a finder report
/file-issue apps/e2e/reports/qa-flows-2026-06-04.md

# from a failing test
/file-issue "Playwright: dashboard column picker toggles a column — Owner still visible"

# from plain feedback
/file-issue "the dialog overlay flickers when closing in dark mode"
```

Finder agents call `/file-issue` themselves at the end of a run, so a full
`/qa-flows` or `/visual-review` pass ends with issues filed automatically.

## What a filed issue contains

The canonical structure (see `.github/ISSUE_TEMPLATE/agent-finding.md`) — detailed
enough that a coding agent can implement without re-investigating:

Summary · Source · Severity & impact · Reproduction · Evidence · **Root cause
analysis** · **Proposed solution** · Affected files · Acceptance criteria ·
**Test to add** · Risks/ripple effects · References.

## Labels

Type (`type:bug|regression|a11y|visual|tech-debt`), severity
(`severity:P0|P1|P2`), area (`area:ui|data|ai|flow|...`). Create them once with
the snippet in `.github/labels.md`.

## Prerequisites

- **GitHub connector** authenticated in Claude Code (the `github` MCP), or the
  `gh` CLI available in CI.
- A **GitHub remote** on the repo (`origin`). Until the repo is pushed,
  `/file-issue` falls back to writing specs under `docs/issues/` — re-run
  `/file-issue docs/issues` after connecting to upload them.
- Labels created (optional; missing labels are kept in the issue body instead).

## CI

A failing E2E/unit run in `.github/workflows/ci.yml` is itself a finding: triage
it with `/file-issue "<failing test>"` to get an RCA'd issue, or wire a CI step
that calls `gh issue create` from the failure (left as a follow-up).
