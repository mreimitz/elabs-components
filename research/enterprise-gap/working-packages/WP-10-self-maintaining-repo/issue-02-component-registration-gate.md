---
TYPE: issue
TITLE: "[governance] Component-registration gate — new components auto-wired or fail loudly"
LABELS: type:tech-debt, severity:P1, area:governance, area:test, needs-triage
WP: WP-10
---

## Summary

This is the heart of the maintainer's ask: **adding a component should never require remembering to
register it.** Two halves: (a) the scaffolding skill/command already writes every required file; (b) a
**gate fails loudly** if any component is missing its registration, no matter how it was added. Today
registration (barrel export, story, test, manifest entry) is convention enforced only by review + the
maintainer skill; the existing `check-package-registered.sh` proves the gate pattern for _packages_ but
isn't extended to _components_.

## Source

Static repo analysis, 2026-06-06 (gap G2). Evidence: `.claude/hooks/check-package-registered.sh`
(packages only); `.claude/rules/quality-gates.md` lists ~8 manual registration steps for a new package;
component registration is documented but not gated.

## Severity & impact

**P1.** Eliminates the recurring "remind the agent to register / update inventory" toil and prevents
orphaned components (a `*.tsx` with no barrel export = invisible to consumers; no story = invisible to
the Storybook-MCP agent path).

## Current state & why the gap exists

The maintainer skill + `/new-component` do the right thing on the happy path, but nothing enforces it
when a component is added by hand, by a different agent, or by a partial edit. The package-level hook
shows the intended mechanism; it just needs a component-level sibling.

## Proposed solution

- **Backstop gate (primary):** a hook + CI check that, for each component `*.tsx` under
  `packages/*/src` (excluding `*.stories.tsx`/`*.test.tsx`), verifies:
  - it is re-exported from the package's `src/index.ts` (barrel),
  - it has a co-located `*.stories.tsx`,
  - it appears in `brand-ui.manifest.json` (after regeneration, issue-01),
  - (advisory, not blocking where impractical — e.g. Monaco/React-Flow) a co-located `*.test.tsx`.
    Fail with an actionable message listing exactly what's missing and the command to fix it. Model it on
    `check-package-registered.sh`; split **blocking** (barrel, story, manifest) vs **advisory** (test)
    like the existing hooks do.
- **Happy path:** confirm `/new-component` + `brand-ui-component` scaffold all of the above (they
  largely do) and run `pnpm manifest` so the gate passes by construction.
- Wire the gate into CI (WP-01) and as a pre-commit/PostToolUse hook so it's caught before review.

## Affected files

- [ ] `.claude/hooks/check-component-registered.sh` (new) + register in `.claude/settings.json`
- [ ] `.github/workflows/ci.yml` (run the check) — coordinate with WP-01
- [ ] `.claude/commands/new-component.md` / `skills/brand-ui-component/SKILL.md` (ensure full
      scaffolding incl. manifest refresh)
- [ ] `.claude/rules/quality-gates.md` (point the manual checklist at the now-enforced gate)

## Acceptance criteria

- [ ] A new component lacking a barrel export, story, or manifest entry **fails** the gate with a
      message naming the missing piece + fix command.
- [ ] The scaffolding skill/command produces a component that passes the gate with no manual steps.
- [ ] The gate runs in CI and locally (hook).
- [ ] Advisory items (test for render-incompatible components) warn, don't block.

## Test to add

A fixture: add a component without a barrel export → the check fails; scaffold via the command → it
passes. Add to the hook/CLI test surface. This is the regression lock for "no manual registration."

## Risks / ripple effects

- False positives on intentional internal-only files — support an explicit ignore/allowlist
  convention. Keep the blocking/advisory split so it doesn't block legitimate jsdom-incompatible
  components on the test requirement.

## References

- `.claude/hooks/check-package-registered.sh` (pattern to extend), `.claude/rules/quality-gates.md`
  ("Adding a new package" checklist), `skills/brand-ui-component/`; gap G2; depends on WP-01 + issue-01.
