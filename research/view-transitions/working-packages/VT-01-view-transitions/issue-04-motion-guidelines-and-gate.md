---
TYPE: issue
TITLE: "[governance] Extend MOTION_GUIDELINES to VT (CSS-vs-JS-vs-VT + Framer-vs-VT boundary) + footgun gate"
LABELS: type:tech-debt, severity:P2, area:governance, area:ui, needs-triage
WP: VT-01
---

## Summary

Make the VT lever a **documented, enforced** part of the motion system: extend the MOTION_GUIDELINES
decision rule from "CSS vs JS" to **"CSS vs JS vs VT"**, add the **Framer `layoutId` vs VT** boundary, and
turn the three footguns into review/gate checks (permanent `view-transition-name`, VT inside virtualized
lists, VT timing not bound to `--t-*`). Enforcement over reminders.

## Source

[`../../01-design.md`](../../01-design.md) §4 (decision rule + boundary), §8 (guardrails);
[`../../README.md`](../../README.md) (collision finding 3). Extends `docs/MOTION_GUIDELINES.md` and the
`interaction-guidelines.md` / `/review-interface` surfaces.

## Severity & impact

**P2.** Docs + lint/review additions; no runtime code. This is what keeps the lever from drifting into the
theme-wipe-breaking, perf-trapping anti-patterns.

## Proposed solution

**Docs — `docs/MOTION_GUIDELINES.md`:**

- Add VT as the **fourth lever** in "the model" + the lever table (mechanism, what it owns, reduced-motion
  source — mirror [`../../01-design.md`](../../01-design.md) §1).
- Extend the **CSS vs JS decision rule** to include VT (cross-swap continuity / declarative morph /
  zero-restructure state change → VT) and add the **Framer `layoutId` vs VT** table (in-tree+interruptible
  → Framer; cross-swap/cross-view → VT; overlays → CSS, never VT).
- State the **transient-naming** rule and the **perf restraint** rule (one focal VT per interaction; no VT
  on dense/virtualized surfaces) as normative.

**Gate — `interaction-guidelines.md` anti-pattern list + `/review-interface` (and the WP-10 ESLint set):**

- Warn on a **static/permanent `view-transition-name`** in component source (names must be applied
  transiently via `useViewTransition`/`<Transition>`, never hard-set at rest).
- Warn on **VT usage inside a virtualized/large list** (DataTable rows, big grids).
- Warn on **raw VT timing** (`::view-transition-*` animation durations as `ms` literals) not bound to
  `--t-*` — same spirit as the existing "no raw `duration-200`/`ease-in-out`" rule.

**Quality gates — `.claude/rules/quality-gates.md`:** add a one-line "if your component adds a VT, it
shares the motion gate (gated `--t-*`, reduced-motion via `useReducedMotion()`, transient names) and is
verified on a real six-theme + reduced-motion surface" to the Motion-tokened row.

## Affected files

- [ ] `docs/MOTION_GUIDELINES.md` (4th lever + extended decision rule + Framer-vs-VT + transient/perf
      rules)
- [ ] `.claude/rules/interaction-guidelines.md` (anti-pattern list: 3 VT footguns)
- [ ] `.claude/commands/review-interface.md` (check the 3 footguns)
- [ ] `.claude/rules/quality-gates.md` (Motion-tokened row: VT note)
- [ ] (WP-10) the anti-pattern ESLint set — add the permanent-`view-transition-name` rule when that lands

## Acceptance criteria

- [ ] MOTION_GUIDELINES documents VT as a gated lever with the CSS-vs-JS-vs-VT rule and the Framer-vs-VT
      boundary; a reader can decide which tool to use without guessing.
- [ ] `/review-interface` flags a permanent `view-transition-name`, VT in a virtualized list, and ungated
      VT timing, each with an actionable message.
- [ ] quality-gates references VT under the Motion-tokened gate (real-surface verification required).

## Test to add

A fixture file with the three footguns (a permanent `view-transition-name`, a VT in a virtualized list, a
literal-ms VT recipe) that `/review-interface` (and, once present, the ESLint rule) flags; a clean file it
passes. (Doc changes are verified by review.)

## Risks / ripple effects

- Keep the boundary crisp so contributors don't end up with **two** shared-element tools by habit — the
  Framer-vs-VT table is the anti-duplication control (WP-12 "one decision source" spirit).
- Don't over-warn: the gate targets the three concrete footguns, not all VT usage.

## References

`docs/MOTION_GUIDELINES.md`, `docs/ADR/0005-motion-system.md`; `.claude/rules/interaction-guidelines.md`,
`quality-gates.md`; `.claude/commands/review-interface.md`; WP-10 (enforcement),
doc 12 (interaction-guidelines adoption); [`../../01-design.md`](../../01-design.md).
