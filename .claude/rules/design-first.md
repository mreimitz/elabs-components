# Design first

Design pass REQUIRED before scaffolding ANY net-new screen / page / major surface
(extends @.claude/rules/conceptual-framing.md to visual design):

1. **Intent, in one sentence** — who opens this, what feeling/answer do they leave with?
2. **References, proactively** — look at 2-3 comparable products FIRST; name what this surface must match or beat. Don't wait for a pasted link.
3. **2-3 distinct concepts, not one composition** — concepts, not parameters of a chosen layout; mock the recommended one (sketch, widget, or Storybook story) before building.
4. **Full state grid is part of the design** — empty, loading, error, first-run and overflowing-content states are designed WITH the happy path, never retrofitted; empty states get the EmptyState anatomy (illustration slot, title, one sentence, one action), not a dashed box.
5. **Non-component layers, every time** — illustration, motion (what must be FELT — docs/MOTION_GUIDELINES.md), voice (microcopy per interaction-guidelines), information hierarchy (what reads first).

## Patterns over instances

A layout/anatomy that appears twice: STOP, name the pattern, extend the library or a registry
block via the dedupe gate — never a third local copy. The reuse-audit in
@.claude/rules/quality-gates.md applies to PATTERNS, not only components.

## Briefs for UI agents

Lead with the intent sentence, chosen concept, references and state grid; component lists and
API budgets come at the END.

## Verify like a designer, not only like a compiler

Not done at green typecheck: screenshot every relevant state, judge hierarchy/spacing/emptiness
against the step-2 references, and run the visual reviewer for anything bigger than a tweak.

History and measurements: docs/rules-history/design-first.md
