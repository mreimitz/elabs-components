---
TYPE: issue
TITLE: "[ui] Collapse empty/error/loading-state into one parameterized StatePanel"
LABELS: type:tech-debt, severity:P1, area:ui, needs-triage
WP: WP-13
---

## Summary

`empty-state` (33 lines), `error-state` (49), `loading-state` (34) are near-twins — same imports, same
`{ title, description, icon?, actions?, className }` shape, same layout. Three components to learn and
maintain where one parameterized component is clearer. This is the easiest consolidation win in the
library.

## Source

Component audit ([`../../07-component-audit.md`](../../07-component-audit.md) C-1); verified by reading
the three sources.

## Severity & impact

**P1** (clarity/maintainability). Fewer APIs for humans + agents to learn; one place to theme/fix;
removes the "which state component?" ambiguity.

## Current state & why the gap exists

They were authored separately early on. They've stayed small but parallel; `loading-state` also
overlaps `spinner`.

## Proposed solution

- Add `StatePanel` with `kind="empty" | "error" | "loading"` (shared layout: icon/title/description/
  actions; `loading` renders the spinner + ARIA live region; `error` defaults the "Something went
  wrong" copy).
- Keep `EmptyState`/`ErrorState`/`LoadingState` as **thin named wrappers** over `StatePanel` for
  back-compat (or deprecate per the WP-07 deprecation policy).
- Update the `brand-ui-audit` "9-state inventory" guidance + the skill to point at `StatePanel`.

## Affected files

- [ ] `packages/ui/src/components/state-panel/**` (new) + barrel export
- [ ] `packages/ui/src/components/{empty,error,loading}-state/*` (re-implement as wrappers or deprecate)
- [ ] stories + tests (six themes); update any registry blocks that used the old ones

## Acceptance criteria

- [ ] `StatePanel kind=...` covers all three states; old names still work (wrappers) or are deprecated
      with a migration note.
- [ ] Story covers empty/error/loading across six themes; smoke test passes.
- [ ] Auto-registered + green via the WP-10 gates.

## Test to add

Render test asserting each `kind` renders its expected role/structure (e.g. `loading` exposes
`role="status"`).

## Risks / ripple effects

- Don't break existing imports — ship wrappers first, deprecate per policy (WP-07).

## References

- `../../07-component-audit.md` C-1; `.claude/rules/quality-gates.md`; `skills/brand-ui-audit/`.
