---
description: Turn a finding or feedback into a fully-diagnosed GitHub issue (deep root-cause analysis first), with dedupe. Finders report; this files. No code is changed.
argument-hint: <a report path, failing test name, or a description of the problem>
allowed-tools: Task, Skill, Read, Write, Grep, Glob, Bash(git remote:*), Bash(git config:*), Bash(pnpm:*), mcp__github__create_issue, mcp__github__search_issues, mcp__github__list_issues, mcp__github__add_issue_comment, mcp__github__get_issue
---

Register one or more findings as **implementation-ready GitHub issues**. The
input `$ARGUMENTS` may be: a path to a finder report (e.g.
`apps/e2e/reports/qa-flows-*.md` or `visual-ux-*.md`), a failing test name, or a
plain-language description of feedback/a bug.

**Golden rule:** finders and this command **never fix code** — they diagnose and
file. Implementation happens later from the issue.

## 1. Resolve the repository

```bash
git config --get remote.origin.url   # parse owner/repo (github.com/<owner>/<repo>)
```

If there is no GitHub remote, or the GitHub connector is not available, skip
to the **fallback** (step 6) instead of failing.

## 2. Split the input into distinct findings

If the input is a report with several findings, treat each as its own issue
(don't bundle unrelated problems). Deduplicate trivially-identical ones.

For any finding from a story-based check (`/qa-flows`, `/visual-review`, or a
Storybook MCP run), make sure the evidence carries the exact **story ID** (e.g.
`data-data-table--filtered`) and **theme slug** (e.g. `dark`) — plus the
`preview-stories` URL if available — so `brand-ui-root-cause-analyst` can reproduce it
precisely. See @.claude/rules/storybook-mcp.md for the story-ID format and slugs.

## 3. Deep root-cause analysis (per finding)

For each finding, launch the **brand-ui-root-cause-analyst** agent (Task tool) and pass it
the finding text + any evidence (screenshots, console errors, failing test). It
returns a complete issue spec (TITLE / LABELS / DUPLICATE_OF / structured body).
Do not shortcut this — the analyst's job is the deep reasoning and the solution
design.

## 4. Dedupe against existing issues

Use `mcp__github__search_issues` (repo-scoped, keywords from the root cause) and
honor the analyst's `DUPLICATE_OF`. If a strong match exists and is open, add a
comment (`mcp__github__add_issue_comment`) linking the new evidence INSTEAD of
opening a duplicate, and report that issue's URL.

## 5. Create the issue

Call `mcp__github__create_issue` with:

- `owner`, `repo` (from step 1)
- `title` = the analyst's TITLE
- `body` = the analyst's full structured spec (Summary → References). Append a
  trailing line: `Filed by /file-issue · source: <agent/test/feedback>`.
- `labels` = the analyst's LABELS. If the connector rejects unknown labels,
  retry creation WITHOUT labels and keep the `LABELS:` line inside the body.
  (Standard taxonomy lives in `.github/labels.md`.)

Report each created issue's number + URL.

## 6. Fallback (no remote / connector)

Write each spec to `docs/issues/<severity>-<slug>.md` and tell the user these are
queued locally; they can push the repo / connect the GitHub connector and re-run
`/file-issue docs/issues` to upload them.

## 7. Summary

Output a table: finding → action (created #/commented #/queued locally) → URL/path
→ severity. Remind the user that fixes are done separately via
`brand-ui-component-builder` / `/review-component`, and that the fix PR should add the
"Test to add" from each issue.
