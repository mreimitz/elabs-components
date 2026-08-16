# Issue workflow

Every problem — found by an automated test, a finder agent, or entered by a
person as feedback — becomes a **fully-diagnosed GitHub issue** before anyone
fixes it. This keeps fixes deliberate, traceable, and root-cause-driven.

## The pipeline

```
finding ──▶ /file-issue ──▶ brand-ui-root-cause-analyst ──▶ dedupe ──▶ GitHub issue ──▶ brand-ui-component-builder
(test /     (orchestrates)   (deep RCA +            (search    (implementation-   (fixes from the
 agent /                      proposed solution)     existing)   ready spec)         issue + adds test)
 feedback)
```

Separation of duties:

- **Finders report, never fix** — the Playwright/Vitest suites, `/qa-flows`,
  `brand-ui-visual-ux-reviewer`, `brand-ui-accessibility-reviewer`, and human feedback only surface
  problems.
- **`brand-ui-root-cause-analyst` (the architect/expert) diagnoses** — deep root-cause
  analysis (sequential reasoning + 5-Whys + the `engineering:debug` method),
  separates symptom from cause, and designs the fix. It does **not** edit code.
- **`/file-issue` files** — dedupes against existing issues, then opens an
  implementation-ready issue via the GitHub connector (or queues it locally).
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
