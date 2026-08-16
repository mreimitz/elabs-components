---
TYPE: issue
TITLE: "[docs] Make AGENTS.md self-validating — list the runnable command contract"
LABELS: type:tech-debt, severity:P1, area:docs, area:governance, needs-triage
WP: WP-01
---

## Summary

`AGENTS.md` exists (good — it's the cross-tool standard, read by Cursor/Codex/Copilot/Gemini), but it
under-uses the one behavioral guarantee that makes AGENTS.md powerful: **compliant agents will
auto-run the build/test commands listed in it and fix failures before finishing.** Today it mirrors
`CLAUDE.md` prose and carries the "four themes" inaccuracy (see issue-02; the false `ci.yml` claim is
in `README.md`, **not** AGENTS.md), but it doesn't present a crisp,
canonical _command contract_ an agent is expected to run to self-validate. Adding that turns
AGENTS.md from documentation into a guardrail.

## Source

Static repo analysis, 2026-06-06 (gap E4); cross-referenced with agents.md guidance (research doc 02,
lever 6).

## Severity & impact

**P1.** Non-Claude agents (and Claude) get more reliable, self-checking behavior; reduces "claimed
done but not validated" failures across every future contribution. Low cost, broad payoff.

## Current state & why the gap exists

AGENTS.md was created as a tool-agnostic mirror of CLAUDE.md, before the team leaned into the
auto-run-commands convention. It also predates (or ignores) the fact that CI doesn't exist, so its
validation story is incomplete.

## Proposed solution

Update `AGENTS.md` to include an explicit, copy-pasteable **"Validate before you finish"** section
naming the exact commands, e.g.:

```
Before completing any change, run and make green:
  pnpm typecheck && pnpm lint && pnpm test && pnpm build
  pnpm registry:validate   # if registry/ touched
  pnpm --filter @qlik-coe-emea/qlabs-components-docs test-storybook   # if a component/story changed
Add a story + smoke test for any new component (see .claude/rules/quality-gates.md).
Never report "done"/"validated" for a path you didn't run (see honest-completion rule).
```

Also:

- Fix the "four themes" reference (→ six; coordinate with issue-02).
- Add a one-line pointer to the per-package scoping (`pnpm --filter @qlik-coe-emea/qlabs-components-<pkg> …`).
- Keep it lean; link `.claude/rules/*` for detail (the established import pattern).

## Affected files

- [ ] `AGENTS.md`

## Acceptance criteria

- [ ] AGENTS.md contains an explicit runnable command contract covering typecheck/lint/test/build,
      registry validation, and Storybook tests (conditional).
- [ ] It states the honest-completion expectation.
- [ ] AGENTS.md's "four themes" reference is corrected to six (coordinate with issue-02).
- [ ] Commands listed actually exist in root `package.json` scripts (verified).

## Test to add

N/A (docs). The CI from issue-01 is the backstop that the listed commands actually pass.

## References

- research doc 02 §6 (`../../02-ai-agentic-friendliness-research.md`); `agents.md`; gap E4
- `.claude/rules/quality-gates.md` (honest-completion reporting)
