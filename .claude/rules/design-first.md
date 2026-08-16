# Design first (end-user surfaces start as design, not as assembly)

The 2026-06-11 workbench retro found a recurring failure: screens built
function-first, visual design treated as styling, components assembled
because they exist ("list + card slop"). This rule makes the design pass a
REQUIRED first step for net-new user-facing surfaces. It extends
@.claude/rules/conceptual-framing.md from architecture to visual design.

## Before scaffolding ANY net-new screen / page / major surface

1. **Intent, in one sentence.** Who opens this and what feeling/answer do
   they leave with? ("A directory of repos" is not an intent. "Tells the
   writer what changed while they were away" is.)
2. **References, proactively.** Look at 2-3 comparable products FIRST (web
   access exists — use it). Name what they do that this surface should match
   or beat. Don't wait for the user to paste a link.
3. **2-3 distinct concepts, not one composition.** Per conceptual-framing:
   offer concepts ("reading desk" vs "mission control"), not parameters of an
   already-chosen layout. Mock the recommended one (sketch, widget, or
   Storybook story) before building.
4. **The full state grid is part of the design**: empty, loading, error,
   first-run, and overflowing-content states are designed WITH the happy
   path — never retrofitted. Empty states get the EmptyState anatomy
   (illustration slot, title, one sentence, one action), not a dashed box.
5. **Consider the non-component layers every time**: illustration (does this
   moment deserve one?), motion (what state change must be FELT — see
   docs/MOTION_GUIDELINES.md), voice (microcopy per interaction-guidelines),
   and information hierarchy (what reads first — is that right?).

## Patterns over instances

If a layout/anatomy appears twice (banners, section eyebrows, page scaffolds,
list rows), STOP and name the pattern: extend the library or a registry block
via the dedupe gate — never a third local copy. The reuse-audit in
@.claude/rules/quality-gates.md applies to PATTERNS, not only components.

## Delegating UI work to agents

Briefs for UI-building agents must lead with: the intent sentence, the chosen
concept, references, and the state grid. Component lists and API budgets are
constraints at the END of the brief — an agent given only mechanics will
return mechanics.

## Verify like a designer, not only like a compiler

A surface isn't done at green typecheck: screenshot it (all relevant states),
judge hierarchy/spacing/emptiness against the references from step 2, and run
the visual reviewer for anything bigger than a tweak. Code gates prove
conformance; only looking proves design.
