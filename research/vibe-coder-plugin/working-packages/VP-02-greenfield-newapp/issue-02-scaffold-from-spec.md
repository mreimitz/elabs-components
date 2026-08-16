---
TYPE: issue
TITLE: "[plugin] brand-ui scaffold — spec → born-compliant brand-ui app"
LABELS: type:tech-debt, severity:P1, area:ai, area:registry, needs-triage
WP: VP-02
---

## Summary

Implement `brand-ui scaffold` (full behavior) + a `scaffold-builder` subagent: turn `app-spec.md` into
a best-practice brand-ui app — assembled from templates + playbooks + the chosen theme, with the
agent-context handoff and the gates wired, then audited cross-theme before "done."

## Source

[`../../02-greenfield-guided-flow.md`](../../02-greenfield-guided-flow.md) ("what gets scaffolded");
[`../../04-skills-functions-architecture.md`](../../04-skills-functions-architecture.md).

## Severity & impact

**P1.** This is where the experience pays off — a real, on-brand, compliant app, not a sketch.

## Current state & why the gap exists

New (the CLI skeleton lands in VP-01). Depends on the substrate (templates/playbooks/widgets).

## Proposed solution

From the spec, generate:

- Root wiring: `@qlik-coe-emea/qlabs-components-tokens` styles + `<ThemeProvider>` in the chosen theme; semantic-tokens-only.
- The chosen **template** (WP-13) as skeleton + **playbooks** (WP-09) assembling each surface; entity
  tables/forms/detail views; charts (WP-05); `StatePanel` states; app shell + nav.
- **Agent-context handoff:** `CLAUDE.md`/`AGENTS.md` + the generated **context file** (WP-03/E7) in the
  new repo, so the user's agent keeps building on-brand.
- **Born compliant:** the WP-10 gates + quality gates wired.
- Run `brand-ui-audit` (cross-theme/a11y) as the final gate; report results.

Prefer **copy-own registry blocks/templates** for prototype surfaces and **imported `@qlik-coe-emea/qlabs-components-*`** for
stable primitives (the two consumption modes).

## Affected files

- [ ] `packages/cli/lib/*` (`scaffold` impl) ; `agents/scaffold-builder` (new subagent)
- [ ] generated app artifacts (in the user's workspace/repo)
- [ ] depends on registry templates (WP-13) + playbooks (WP-09)

## Acceptance criteria

- [ ] `brand-ui scaffold app-spec.md` produces a runnable app using real templates/playbooks/theme,
      semantic-tokens-only, with shell/nav/surfaces from the spec.
- [ ] The new repo ships `CLAUDE.md`/`AGENTS.md` + context file + gates (so the user's agent continues
      on-brand).
- [ ] `brand-ui-audit` passes across six themes; result surfaced to the user.

## Test to add

Scaffold from a fixture spec → assert the expected files/components exist, semantic-tokens-only, and
`brand-ui-audit` is green.

## Risks / ripple effects

- Quality is bounded by WP-09/WP-13/WP-05 — sequence after they exist (or scaffold a thinner app and
  note the gaps). Don't emit raw hex or bypass gates.

## References

- `../../02-greenfield-guided-flow.md`; WP-13/WP-09/WP-05/WP-03/WP-10; `skills/brand-ui-audit/`.
