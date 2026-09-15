---
description: Triage a finding — fix what is small and in scope in the working tree; diagnose the rest and file each as a capped, deduped GitHub issue.
argument-hint: <a report path, failing test name, or a description of the problem>
allowed-tools: Task, Read, Write, Grep, Glob, Bash(git remote:*), Bash(git config:*), Bash(gh issue:*), Bash(gh label:*), Bash(pnpm:*)
---

Input `$ARGUMENTS`: a review report path, a failing test name, or a description.
Goal: fewer, smaller issues. Fix what you can now; file only what is left behind.

## 1. Split and triage

Split the input into distinct findings; drop trivially identical ones. For each:

- **FIX NOW** — in scope of the current task AND small (≤30 changed lines, one package):
  fix it in the working tree, record `fixed`, file nothing.
- **FILE AS-IS** — P2 with a known cause (the finding already has `file:line`): write the
  spec yourself (template below).
- **FILE + ANALYSE** — P0/P1, or the cause is unknown. A story-based finding carries the
  exact story ID and theme slug (`data-data-table--filtered`, `dark`).

## 2. One batched analysis

ONE `Task` call to **`brand-ui-reviewer`**, asking for its section 4 (root cause) on the
FILE + ANALYSE list. Skip the call when that list is empty. Never one call per finding.

## 3. Dedupe

`gh issue list --state open --search "<root-cause keywords>"`; honour `DUPLICATE_OF`. An open
match gets the new evidence as a comment instead of a new issue: write the comment to a file,
then `gh issue comment <n> --body-file <abs path>`.

## 4. Create — body ≤ ~2,500 characters

Write each body to a file, then
`gh issue create --title "<title>" --label "<type>,<severity>,<area>" --body-file <abs path>`
(taxonomy: `.github/labels.md`; if a label is rejected, retry without labels and keep the
`Labels` line in the body).

```
## Summary       2 lines
## Repro         story ID + theme slug, or the command / test name
## Root cause    file:line, 2–4 lines
## Fix           3–6 lines
## Test to add   1–2 lines
## Labels        type:… severity:… area:…
```

No Evidence / Risks / References essays — cut, never append.

## 5. Fallback (no remote or no `gh` auth)

Write each spec to `docs/issues/<severity>-<slug>.md` and say they are queued locally.

## 6. Summary

Table: finding → action (`fixed` / created #n / commented #n / queued) → URL or path →
severity. Filed issues are fixed later from the issue (`Closes #n` + its "Test to add").
