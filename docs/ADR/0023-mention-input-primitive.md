# ADR 0023 — `MentionInput`: an `@`-mention primitive on a real `<textarea>`

- **Status:** Accepted
- **Date:** 2026-08-02
- **Issue:** [#368](https://github.com/qlik-coe-emea/elabs-components/issues/368)
- **Supersedes / amends:** nothing

## Context

No `@elabs/components-*` package shipped a mention-capable input.
Downstream teams that needed one were re-solving the same 500-line problem —
caret arithmetic, chip atomicity, `aria-activedescendant` wiring, popup
positioning — or reaching for a `contentEditable` escape hatch that quietly took
IME, undo, spellcheck, mobile keyboards and form values with it.

`TagInput` is the closest shipped component and does not fit: it is a
whole-field, delimiter-triggered chip list, not an at-caret popup over prose.
`Combobox` / `Command` are whole-field selectors whose keyboard model assumes
focus lives in cmdk's own input.

## Decision

Ship `MentionInput` in **`@elabs/components-ui`** as a compound
component over a real `<textarea>`, with its own listbox.

### 1. `@elabs/components-ui`, not `-ai`, not the registry

Mentions are a general text-entry capability — comments, task assignment,
descriptions — that merely _also_ suits a chat composer. The one-way dependency
graph (`tokens` → `ui`/`icons` → `ai`/`data`/…) means an `ai`-owned primitive is
permanently out of reach of `ui` and `data` consumers, and moving it later is
breaking. Precedent: `MetricCard` is owned by `ui` and re-exported by `charts`
and `editor` (ADR 0012).

It is not a registry block either. Registry items are copy-owned and divergence
is expected; an ARIA-correct combobox is the last thing that should be allowed to
drift per app.

**`@elabs/components-ai` gains no export and no source change.**
The composer binding is pure composition:
`<MentionInputTextarea asChild><PromptInputTextarea name="message" /></MentionInputTextarea>`.

### 2. A real `<textarea>`, never `contentEditable`

`contentEditable` has no form value, so it could never be the surface
`PromptInput` reads through `new FormData(form).get("message")`. More
importantly, IME composition, paste, native undo, spellcheck and mobile
keyboards come **free** from the real element and are exactly what a
`contentEditable` re-implementation has to rebuild badly.

The consequence is that **chip atomicity is selection arithmetic over a token
map, not DOM nodes**. `mention-value.ts` is that algebra — a pure, React-free
module (`insertMention` / `remapMentions` / `mentionAt` / `serializeMentions`)
that every atomicity and serialization acceptance criterion reduces to a unit
test on.

`remapMentions` treats each edit as ONE contiguous replacement (what a
keystroke, paste, cut and undo all are), shifts or drops each mention
accordingly, and then **re-validates** every survivor against the new text: the
run at its offset must still spell `trigger + label`. The arithmetic alone can
be fooled by an ambiguous prefix/suffix boundary; the re-validation cannot.

### 3. Our own listbox, not cmdk

cmdk's keyboard model assumes focus lives in cmdk's own `Input`. Here focus must
**never** leave the textarea — a popup that takes focus takes the caret with it —
and forwarding synthetic key events into a cmdk root is precisely the fragile
thing this design avoids. Only the highlight index is ours (~30 lines); Radix
`Popover` still does positioning, portalling and dismissal.

**#368 therefore does not depend on #365.** The lesson from #365 still binds,
generalised: `aria-activedescendant` must be derived from state **committed with
the DOM it describes**. So the resolved highlight index is computed _during
render_ (clamped against the current `filtered` list) rather than repaired in an
effect — a stale index can never reach the DOM, not even for one frame — and the
option row derives its own index from the provider rather than accepting one, so
its `id` and `aria-selected` cannot disagree with what the field publishes.

### 4. The trigger is DERIVED, the navigation keys are INTERCEPTED

Whether the caret sits in a `trigger + query` run is computed from the committed
text + caret (`findQuery`), not detected at keydown. A keydown-driven trigger
would have to `preventDefault()` every printable character and re-insert it by
hand — destroying the IME/undo/spellcheck properties decision 2 exists to keep.
Deriving means the popup opens identically whether the trigger arrived by
typing, pasting, an IME commit, or a click that moved the caret back into a
half-typed query.

Only these are intercepted, and only when they mean something:

| Key                                          | Intercepted when                                   |
| -------------------------------------------- | -------------------------------------------------- |
| `ArrowDown` / `ArrowUp` / `Home` / `End`     | the popup is open                                  |
| `Enter` / `Tab`                              | the popup is open **and** an option is highlighted |
| `Escape`                                     | the popup is open (closes it; never clears text)   |
| `Backspace` / `Delete` adjacent to a mention | always (removes the whole token)                   |
| `ArrowLeft` / `ArrowRight` into a mention    | always (jumps to the boundary)                     |

Everything else reaches the host untouched. In particular, **Enter with nothing
highlighted is not intercepted** — that fall-through is what lets a composer
keep Enter-to-send when the roster has nothing to offer.

### 5. `onKeyDownCapture`, not `onKeyDown` — and the exact scope of the hazard

Radix `Slot` merges **child** props over **slot** props and composes handlers
**child first, slot second** (`@radix-ui/react-slot@1.2.4`). So when the `asChild`
child binds `onKeyDown` **directly on a host element**, a bubble-phase handler
from `MentionInput` lands _after_ the child's — the child's Enter→submit wins and
the roster never sees the key.

`MentionInputTextarea` therefore binds its interception as **`onKeyDownCapture`**.
React dispatches an element's capture pass before its bubble pass and shares
**one** `SyntheticEvent` between them, so `preventDefault()` in capture is
already visible as `event.defaultPrevented` to the child's handler. Reordering
props does not fix this; `mergeProps` ignores prop order.

**Correction (fix round 1).** An earlier version of this section claimed the
hazard applied to the `PromptInputTextarea` composition and that the composer
story proved it. Both were wrong, and the counterfactual was never run.
`PromptInputTextarea` is a **component**, not a host element: it destructures
`onKeyDown` out of its own props, calls it first and bails on `defaultPrevented`
(`packages/ai/src/prompt-input.tsx`), so only its own handler ever reaches the
DOM node and that composition works with **either** binding. Mutating the source
to `onKeyDown` left the composer story green — which is what exposed the claim.

**What is actually locked, and by what:**

| Property                                                           | Locked by                                                                  |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| The capture binding itself (a child binding `onKeyDown` on a host) | unit test `T8 Slot handler-order contract` — **verified red** when flipped |
| Enter-open inserts / Enter-closed submits, across the two packages | the composer story's play function                                         |

The capture binding stays: it is what makes the raw-host case correct, and it
costs nothing for the component case.

### 6. The chip layer paints BACKGROUNDS ONLY, and sits ON TOP

Mentions are painted by an `aria-hidden`, `pointer-events-none` mirror element
whose font, padding, border widths, line-height, letter-spacing and wrap
behaviour are copied from the textarea's computed style at runtime (with the
vertical scrollbar folded into the padding, or every wrapped line would break a
few characters late). All of its text is `text-transparent`; only a mention run
paints a `bg-primary/10` wash. The real, fully visible text stays in the
textarea, so native selection, IME, spellcheck and undo are untouched.

Two accepted limitations, both structural:

- **Backgrounds only.** No per-run text colour is possible behind a real
  `<textarea>`; the glyphs belong to the field, not the mirror.
- **The mirror sits ON TOP of the field, not behind it.** A textarea's own
  background is opaque (`Textarea` is `bg-background`), so a layer behind it
  would be invisible. On top, the 10% wash tints the glyphs it covers by 10% of
  `--primary` — measured, not assumed, across all three themes before this
  landed.

A second, `visibility: hidden` mirror measures the caret rectangle for the
`PopoverAnchor`, so the popup opens at the caret rather than at the field's edge.

**The snapshot is re-taken, and that is locked (fix round 2).** A one-shot
snapshot shipped the bug this section exists to prevent: the first layout effect
runs before the theme attribute is applied, so it captured the `:root` fallback
font and the wash rendered in the wrong typeface, ~14% wide. The component
re-measures on a `ResizeObserver` (the field's box), a `MutationObserver` (the
field's `class`/`style` and the root's `data-theme`/`data-density`/
`data-decoration`) and `document.fonts.ready`.

Browser stories cover it, and a per-arm mutation audit in real Chromium says which
arm each one actually pins:

- **The capability is locked.** With all three arms removed, three stories go RED
  with the original symptom (the overlay stuck on the `:root` fallback `Inter`
  while the field renders `IBM Plex Mono`). The bug cannot return with CI green.
- **`ResizeObserver` is individually pinned** by `MirrorTracksFieldResize`.
- **`MutationObserver` is individually pinned** by
  `TracksThemeChangeWithNailedBox`, in its own story file — an in-place
  `data-theme` flip with every box-affecting property of the field nailed to
  absolute pixels, so `ResizeObserver` cannot fire, and `document.fonts.ready`
  awaited first so it cannot fire late.
- **`document.fonts.ready` is covered only compositely.** It survived every
  scenario attempted, by two people.

Two properties of that audit are worth carrying forward, because both cost a
round to learn:

1. **A lock can be order-dependent.** The nailed-box story pins the
   `MutationObserver` when it runs alone, and _stops_ pinning it when it shares a
   page with the other mention stories — something a preceding story leaves behind
   re-measures the mirror. That is why it lives in its own story file. A lock that
   only holds in isolation is not a lock in CI.
2. **"No scenario can distinguish it" is a claim about the scenarios, not the
   code.** An earlier version of this section asserted that `ResizeObserver` alone
   re-measures in "every scenario that could be constructed" and that it was the
   only individually-pinnable arm. A reviewer built a counterexample on the first
   try. The surviving `document.fonts.ready` statement is therefore phrased as
   what was _attempted_, not as a property of the arm — and it is kept as defence
   in depth, not deleted, precisely because "no test notices" is not proof.

**Maintainer decision (issue #405):** five separate isolation attempts across two
agents failed to construct a scenario where removing the `document.fonts.ready`
arm alone turns any test red — it is covered only compositely by the other two
arms. The decision is **Option A: keep it**, as accepted, intentionally unpinned
defence-in-depth. This is the durable record so a future reader does not
re-attempt the same five scenarios; see #405 for the full mutation-audit table.

### 7. The field is a `textbox`, NOT `role="combobox"` — measured, not assumed

The obvious shape for this widget is `role="combobox"` + `aria-expanded` on the
field. **Both are invalid on a `<textarea>`, and axe rejects them**, so the
component does not use either. This was settled empirically against axe-core
4.12.0 (the version the repo's blocking `a11y.test: "error"` gate runs), with a
four-variant probe on a bare page, scoped exactly the way
`@storybook/addon-a11y` scopes its run:

| Variant                                                                          | Result                                               |
| -------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `<textarea role="combobox" aria-expanded …>`                                     | `aria-allowed-role` (minor) — **enabled by default** |
| `<textarea aria-expanded …>` (no role)                                           | `aria-allowed-attr` — **CRITICAL**                   |
| `<textarea aria-autocomplete aria-haspopup aria-controls aria-activedescendant>` | **clean**                                            |
| `<div role="combobox"><textarea …></div>` (the deprecated ARIA 1.1 shape)        | `aria-input-field-name` (serious)                    |

ARIA in HTML gives `<textarea>` no permitted role override, and `aria-expanded`
is absent from the `textbox` role's supported-property set — so the two obvious
attributes are the two the spec forbids. `role="combobox"` alone reddened **all
27** story × theme runs of the mention stories.

The shipped field therefore carries only properties `textbox` genuinely
supports: `aria-autocomplete="list"`, `aria-haspopup="listbox"`,
`aria-controls` (while the popup is mounted) and `aria-activedescendant`. **The
announcement the acceptance criterion actually names is fully preserved**:
`aria-activedescendant` is supported on `textbox`, so AT reads the highlighted
option as the user arrows through the roster. What is lost is the
collapsed/expanded announcement — the smaller of the two, and the only one the
spec would not let us have.

The open state is still machine-readable, as `data-state="open" | "closed"` on
the field — which is what the stories' play functions and the unit tests assert
on. A consumer wanting an expanded/collapsed announcement can add a visually
hidden live region; the component does not, because an unrequested live region
on every mention field is noisier than the gap it fills.

### 8. `aria-controls` is set only while the popup is open

The listbox lives in a Radix portal that unmounts on close. Rather than let
`aria-controls` name a removed node, the attribute is dropped when closed. This
is a deliberate divergence from the "always-mounted listbox" shape used by
`VirtualSelect`, whose popup content is likewise portalled.

`MentionInputContent` also overrides Radix's default `role="dialog"` with
`role="presentation"`: a combobox popup is not a dialog, and an unnamed one is a
serious `aria-dialog-name` violation. The `role="listbox"` inside carries all
the semantics.

## Consequences

- One primitive replaces every downstream re-implementation; the ARIA model is
  fixed in one place and locked by `T6`, which asserts the invariant
  _`aria-activedescendant` always equals the `id` of the element carrying
  `aria-selected="true"`_ on mount, after a filter keystroke, and after an arrow
  move.
- Consumers get `{ text, mentions }` and `serializeMentions()` →
  `{ text, mentionedIds }` (deduped, document order).
- Because `MentionInput` controls the textarea's `value`, `PromptInput`'s
  uncontrolled `form.reset()` cannot clear the mention state — an app composing
  the two resets the `MentionValue` in its own `onSubmit`. Documented on the
  composition story.
- No `loading` prop: for async rosters the consumer passes `filter={() => true}`
  and renders whatever placeholder it wants inside `MentionInputEmpty`
  (`loading-states.md` — a not-ready prop would pull in a story gate for no
  user-visible gain).
