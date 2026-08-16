# ADR 0021 — Dialog "tiers" decompose into size, anatomy and named behaviour

**Status:** Accepted
**Date:** 2026-08-02
**Issue:** #341 (Dialog has no size/tier/scroll/dirty-state contract)

## Context

`Dialog` / `AlertDialog` shipped as primitives with no guidance on size, scroll ownership,
section-heading hierarchy or dirty-state handling. Left to individual judgement, dialogs
converge on a "512px scroll tube" regardless of content, and destructive confirmations get
built as a plain `Dialog` — so initial focus lands on the destructive action.

A consuming app (MCP Token Footprint) solved this downstream with a bespoke **four-tier
kit**: `ConfirmDialog`, `FormDialog`, `WideDialog`, `WorkbenchDialog`, plus shared furniture
(`DialogSection`, `AdvancedGroup`, a dirty guard). #341 asked whether brand-ui should ship
those four names (option 1) or a single `Dialog` with a `tier` / `scroll` prop (option 2).

Neither, as posed. "Tier" bundles four separable things — width, scroll ownership, footer
button set, and initial-focus target — and each has a different right answer in this
library's idiom:

- `packages/ui/src/components/dialog/dialog.tsx` already shipped a `size` cva axis
  (`sm`/`lg`/`xl`/`full`), so the width half of the complaint was stale.
- `.claude/rules/component-api.md` bans exactly option 2: _"Don't add `isThread`/`isEditing`/
  `isMini` flags to fork behaviour … `cva` is for visual axes (size/tone), NOT behavioural
  modes."_ A `tier` prop is that anti-pattern with a nicer name.
- The same rule prefers compound parts over prop explosions, which is where scroll belongs.

## Decision

**Decompose the tier concept three ways. Do not ship a `tier` prop, and do not ship four
tier components.**

1. **Width → the existing `size` cva axis.** `sm` / `lg` (default) / `xl` / `full`. Nothing
   new; this is what `cva` is for.
2. **Scroll ownership → ANATOMY, not a prop.** A new **`DialogBody`** part is the scroll
   owner. When one is present, `dialogContentVariants` switches the content box into a
   3-row grid (`auto | minmax(0,1fr) | auto`) and stops scrolling itself, via a
   `has-[[data-slot=dialog-body]]:` variant — so the header and footer stay put and the
   primary action never scrolls out of view. Dialogs with no `DialogBody` are unaffected;
   the variant pair is inert for them.

   `DialogBody` takes `tabIndex={0}`, because a scroll container with only static content
   inside is otherwise unreachable from the keyboard — measured, not assumed: axe's
   `scrollable-region-focusable` fails a text-only body at `tabIndex={-1}` and passes at
   `0`. Being the first tab stop would also make the scroll WRAPPER the dialog's opening
   focus target, which paints a focus ring around the whole body on open (observed in all
   three themes) and skips the first field, so `DialogContent` composes
   `onOpenAutoFocus` to step past the wrapper to the first real control INSIDE the body.
   That redirect is gated on a `DialogBody` being present, so no dialog that shipped
   before changes.

   The redirect only suppresses Radix's own autofocus once a candidate has **actually
   taken** focus, and it gives up entirely when the body holds nothing focusable. Both
   guards are load-bearing, and both were found by driving a real browser:
   - A selector match is not proof of focusability. A `display:none` candidate — the
     everyday `<input type="file" hidden>` — swallows `.focus()`, so preventing Radix's
     default for it left focus on the TRIGGER, i.e. **outside the modal**. Locked by the
     `HiddenFirstControl` story (jsdom does no layout and focuses hidden inputs happily,
     so this cannot be a unit test).
   - Reaching past a control-less body landed the keyboard on the footer's PRIMARY action.
     Falling through lets Radix focus the body, which is the right target for a text-only
     scroll region and the reason the body is focusable at all.

3. **Behaviour → explicitly named components, one per genuine contract.**
   - **`ConfirmDialog`** — wraps `AlertDialog` and ALWAYS renders an `AlertDialogCancel`.
     This is load-bearing: `@radix-ui/react-alert-dialog`'s Content prevents its own
     open-autofocus and focuses `cancelRef` instead, which is a no-op when no Cancel is
     mounted. Guaranteeing one makes "initial focus lands on the destructive action"
     unrepresentable.
   - **`useDialogDismissGuard`** — the dirty-state guard as a HOOK, because the component
     must not own app state (D5): the app owns `open` and decides what `dirty` means.
   - **`DialogSection`** — a real section heading rung between `DialogTitle` and the field
     `Label`s (`text-title` 1.25rem > `text-subtitle` 1rem > `text-body` 0.875rem).
   - **`AdvancedGroup`** — a collapsed-by-default disclosure that summarises its non-default
     values while collapsed.

## Explicitly NOT shipped (so the four-tier ask does not come back)

- **`WideDialog` / `WorkbenchDialog`** — they carry no behaviour beyond width and scroll,
  and both are already expressible: `<DialogContent size="xl"|"full">` plus a `DialogBody`.
  Naming them would duplicate the `size` axis as an import name with zero behavioural delta.
- **`FormDialog`** — its only claimed behaviour is "the body is a real `<form>` so Enter
  submits", which is one JSX element at the call site; a wrapper would also collide with the
  shipped `Form` (react-hook-form `FormProvider` + `FormField`). Shipped as a documented
  recipe + the `FormRecipe` story instead.
- **A `tier` or `scroll` prop in any form** — `.claude/rules/component-api.md`.

## The dirty-guard asymmetry is structural

Radix routes Escape, overlay click, the built-in ✕ and every `DialogClose` through one
`onOpenChange(false)`, so intercepting that single seam covers all four dismissals. A
programmatic close after a successful save — the app setting its own `open` to `false` —
never reaches the guard and therefore never prompts. That is exactly #341's required
asymmetry, and it falls out of the wiring rather than out of a "skip the guard" flag that
could be got wrong.

## Consequences

**Positive:**

- Purely additive: no `Dialog` / `AlertDialog` prop is removed or renamed.
- Four new exports (`DialogBody`, `DialogSection`, `ConfirmDialog`, `AdvancedGroup`) plus one
  hook (`useDialogDismissGuard`) — versus the seven the four-tier kit would have needed.
- The wrong confirmation is now unrepresentable rather than merely discouraged.

**Visible behaviour change (one):** `dialogContentVariants`' base gained
`max-h-[calc(100dvh-2rem)] overflow-y-auto`, so a dialog whose content exceeds the viewport
now scrolls internally. Previously it overflowed past both viewport edges with its top
unreachable (the `-translate-y-1/2` centring) — a defect fix, but a visible one. A consumer
who worked around it with their own `max-h`/`overflow` still wins, because `cn()` resolves
later utilities over the base. `size="full"` is unaffected for the same reason.

**Follow-up (deliberately out of scope):** apply the same `DialogBody` anatomy to `Sheet` and
`Drawer`.
