# Issue workflow

A problem is **fixed in the change that found it, or tracked as a GitHub issue** —
never ad hoc and forgotten. What it is NOT is an issue for everything: a backlog
nobody works is worse than no backlog, so `/file-issue` decides per finding.

## The pipeline

```
                    ┌─▶ small + in scope ──▶ fixed in the working tree, mentioned in the PR
finding ──▶ /file-issue
(test /   (triages)  └─▶ left behind ──▶ [P0/P1 or unknown cause: brand-ui-reviewer root cause]
 review /                                 ──▶ dedupe ──▶ GitHub issue ──▶ brand-ui-component-builder
 feedback)                                   (search)    (capped spec)    (fixes it + adds the test)
```

- **Finders report, never fix** — tests, `/review-component` (the `brand-ui-reviewer`
  agent) and human feedback surface problems, then hand them to ONE `/file-issue` call.
- **`/file-issue` triages, then files** — a finding in scope of the current task and
  small (roughly ≤30 changed lines, one package) is fixed on the spot and filed nowhere.
  Everything else is deduped against open issues and opened as a capped issue.
- **Root cause for the hard ones** — one batched `brand-ui-reviewer` call per run, only
  for P0/P1 findings or a cause nobody has located yet.
- **`brand-ui-component-builder` / `/review-component` fix** — from the issue, adding the
  issue's "Test to add". The PR uses `Closes #N`.

The step-by-step procedure (body template, size cap, fallback) lives in
`.claude/commands/file-issue.md`.

## How to use it

```text
/file-issue reports/review-2026-09-15.md          # from a review report
/file-issue "DataTable: column picker leaves Owner visible"   # from a failing test
/file-issue "the dialog overlay flickers when closing in dark mode"  # from feedback
```

## Labels

Type (`type:bug|regression|a11y|visual|tech-debt`), severity (`severity:P0|P1|P2`),
area (`area:ui|data|ai|flow|...`). Create them once with the snippet in
`.github/labels.md`.

## Prerequisites

- The `gh` CLI authenticated, and a GitHub remote (`origin`). Without either,
  `/file-issue` writes specs under `docs/issues/` instead.
- Labels created (optional; a rejected label is kept in the issue body instead).
