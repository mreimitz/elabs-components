---
description: Triage a finding — fix what is small and in scope in the working tree; batch-diagnose the rest and file each as a capped, deduped, machine-attributed GitHub issue.
argument-hint: <a report path, failing test name, or a description of the problem>
allowed-tools: Task, Skill, Read, Write, Grep, Glob, Bash(git remote:*), Bash(git config:*), Bash(pnpm:*), mcp__github__create_issue, mcp__github__search_issues, mcp__github__list_issues, mcp__github__add_issue_comment, mcp__github__get_issue
---

Input `$ARGUMENTS`: a finder report path, a failing test name, or a description.
Goal: fewer, smaller issues. Fix what you can now; file only what is left behind.

## 1. Split and triage

Split the input into distinct findings; drop trivially identical ones. For each:

- **FIX NOW** — in scope of the current task AND small (≤30 changed lines, one
  package): fix it in the working tree, record `fixed` in the summary, file nothing.
- **FILE AS-IS** — P2 with a KNOWN cause: the finder already gives `file:line`, so
  write the capped spec yourself (template in step 4). No analyst.
- **FILE + ANALYSE** — P0/P1, or the cause is genuinely unknown (no `file:line`).
  A story-based finding must carry the exact story ID and theme slug
  (`data-data-table--filtered`, `dark`) so it can be reproduced.

## 2. One batched analysis

ONE `Task` call to `brand-ui-root-cause-analyst` with the FILE + ANALYSE list —
**skip the call entirely when that list is empty**. It returns one spec per finding
(TITLE / LABELS / DUPLICATE_OF / capped body, template below). Never one call per
finding, and never a call for a P2 whose cause the finder already located.

## 3. Dedupe against open issues

`mcp__github__search_issues` (repo parsed from `git config --get remote.origin.url`)
with root-cause keywords; honor `DUPLICATE_OF`. An open match gets the new evidence
as a comment via `node scripts/post-issue-comment.mjs <n> --command file-issue
--body-file <abs path>` (it renders the machine-attribution marker, #78) instead of
a new issue; report that issue's URL.

## 4. Create — body ≤ ~2,500 characters

`mcp__github__create_issue` with `title`, `labels` (taxonomy: `.github/labels.md`;
if rejected, retry without labels and keep the `Labels` line) and `body` =
`render("file-issue")` from `scripts/lib/comment-attribution.mjs` prepended to:

```
## Summary       2 lines
## Repro         story ID + theme slug, or the command / test name
## Root cause    file:line, 2–4 lines
## Fix           3–6 lines
## Test to add   1–2 lines
## Labels        type:… severity:… area:…
```

No Evidence / Risks / References essays — cut, never append.

## 5. Fallback (no remote or connector)

Write each spec to `docs/issues/<severity>-<slug>.md` and say they are queued
locally (re-run `/file-issue docs/issues` once a remote exists).

## 6. Summary

Table: finding → action (`fixed` / created #n / commented #n / queued) → URL or path
→ severity. Filed issues are fixed later from the issue (`Closes #n` + its
"Test to add").
