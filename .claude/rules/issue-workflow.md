# Issue workflow (find → diagnose → file → fix)

Every defect, regression, visual/UX problem or accessibility violation — whether
found by an agent during testing or entered by a person as feedback — is tracked
as a **GitHub issue**. Nothing is fixed ad hoc and forgotten.

## Separation of duties

1. **Finders report, they do not fix.** The E2E suite, `/qa-flows`,
   `brand-ui-visual-ux-reviewer`, `brand-ui-accessibility-reviewer`, and human feedback only
   _surface_ problems. They never edit product code.
2. **The analyst diagnoses.** Every finding goes through the
   `brand-ui-root-cause-analyst` agent (via `/file-issue`), which performs deep root-cause
   analysis and designs the solution. No issue is filed without this.
3. **The builder fixes — from the issue.** `brand-ui-component-builder` /
   `/review-component` implement the fix described in the issue and add the
   "Test to add" so the bug can't return.

## Rules

- **No fix without an issue.** If you find something while doing other work, file
  it with `/file-issue` rather than silently patching it (unless it's the task
  you were explicitly asked to do).
- **Deep RCA is mandatory** before filing: symptom → why-chain → true root cause
  (with `file:line`), then a concrete, rule-aligned solution. Symptom ≠ root cause.
- **Dedupe first.** Search existing issues; comment/link instead of opening a
  duplicate.
- **Implementation-ready.** The body must follow the canonical structure (see
  `.github/ISSUE_TEMPLATE/agent-finding.md`) and be detailed enough that a coding
  agent can implement it without re-investigating: reproduction, root cause,
  proposed solution, affected files, acceptance criteria, the test to add.
- **Labels** follow `.github/labels.md` (type / severity / area).
- **The fix PR references the issue** (`Closes #N`) and includes the locking test.

## Entry points

- `/file-issue <report|test|description>` — the pipeline (RCA → dedupe → create).
- Finder agents end their run by routing each finding through `/file-issue`.
