# Batch 5 — `@brand/ui`: new components

> The largest design surface in the pack. These aren't bug fixes — they're components the library
> doesn't have, each of which a consuming app had to build and now maintains.
>
> **Run last.** Item 1 pairs with batch 3 item 12 (`PageShell headerVariant="toolbar"`); item 2 pairs
> with batch 2 item 4 (`PromptInputButton`); the form kit assumes batch 1's tokens have landed.

---

You are working in the **brand-ui monorepo** (`packages/{ui,data,ai,charts,flow,tokens,editor,…}`,
registry/blocks, Storybook).

Before writing any code, read this repo's own contribution docs and follow its maintainer workflow (the
`brand-ui-component` skill if available: **dedupe gate** → component API rules → quality gates → manifest
regeneration). Everything in this brief **supplements — never overrides** — the repo's own rules.

**The dedupe gate matters more in this batch than any other.** These are net-new components; if something
partially exists (including as a registry block or an unstoried export), **extend it rather than creating
a sibling.** Record a dedupe verdict per item.

**Mandatory, every item:** (1) dedupe gate first; (2) non-breaking — these are additive by nature;
(3) **tokens only**, correct in every theme; (4) **a11y is part of Acceptance**; (5) **deliverables:**
implementation · stories for every named state · docs · exported types · tests · manifest regeneration;
(6) **honest reporting**; (7) **do not silently expand scope** — if a design choice here looks wrong for
the library, stop and report rather than improvising.

**Where these come from.** A dense operator console built entirely on `@brand/*` under a hard
"no hand-rolled UI" rule. Each item is a component it was forced to build anyway. The evidence is
unusually good: because the app couldn't just hack around things, it _measured_ the drift first.

---

## 1. `ViewToolbar` — the one row every view needs — P0 (highest leverage in the pack)

**SYMPTOM.** The library ships shell furniture (`AppShell`, `PageShell`, `TopNav`, `Breadcrumb`) but no
**grammar** for the single most repeated row in any application UI: _status / context / filters on the
left, actions on the right._ With no component and no contract, every view invents one. Measured across
~40 routes in one app before remediation:

| Drift                                               | Count                                                                                                                                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distinct **filter-chip idioms**                     | **6** — `FacetFilter` dropdown chip · a split button with attached ✕ · `Badge` + ghost ✕ + "Clear all" · hand-rolled `Badge` + ✕ · `ToggleGroup` segmented · `Label` + `Checkbox` inline |
| Distinct **result-count renderings**                | **5** — `Badge variant="secondary"` · a bare `<span className="tabular-nums">` · a plain unwrapped string · `Text variant="meta"` · **absent entirely**                                  |
| Control heights in one filter row                   | **3** (~11 px of vertical scatter, in the app's most-visited row)                                                                                                                        |
| Views stacking **two** toolbars, top one near-empty | several                                                                                                                                                                                  |

None of that is carelessness — there was simply nothing to conform to. The app eventually wrote its own
`ViewToolbar` (~200 lines, mostly contract documentation), a `ResultCount` primitive, **and** had to
_delete_ a predecessor component because having two competing toolbar contracts was itself the root cause
of the inconsistency.

**FIX.** Ship a `ViewToolbar` in `@brand/ui`:

- One fixed-height row. Slots: `info` (a ⓘ tooltip carrying the page description, so it doesn't need an
  in-page `<h1>` + paragraph block) · left cluster for **status / context / active filters / result
  count** · right cluster for **actions**.
- **One** filter-chip component — a removable chip with a label written label-in-value
  (`"Status: Failed"`, not `"Status = failed"`) and an `onRemove` — plus a "clear all" affordance. This
  single decision collapses the six idioms.
- **One** result-count rendering (`tabular-nums`, and it must be able to express _filtered of total_
  rather than a bare number that lies when a filter is active).
- Responsive: the row must degrade at narrow widths without clipping actions out of reach.

**Design with batch 3 item 12** (`PageShell headerVariant="toolbar"`) — they're two halves of one
contract.

**ACCEPTANCE.** Stories: minimal (actions only) · with filters + counts · overflowing at narrow width ·
every theme. Keyboard: every control reachable, chips removable by keyboard, visible focus. A docs page
stating the grammar explicitly — **the written contract is as much the deliverable as the component**,
because the failure mode here was ambiguity, not capability.

---

## 2. `IconButton` — one affordance for icon-only controls — P1 (second-highest leverage)

**SYMPTOM.** The library ships `Button size="icon"` and `Tooltip` as separate pieces, and offers no
guidance on combining them. Consumers drift. Audited in one app across **~124 icon-only buttons**:

| Mechanism           | Count | Problem                                                                 |
| ------------------- | ----- | ----------------------------------------------------------------------- |
| Radix `Tooltip`     | ~14   | correct                                                                 |
| Bare native `title` | ~20   | **invisible to assistive tech**, ~1.5 s OS delay, unstyleable           |
| `aria-label` only   | ~89   | **nothing at all on hover** — a sighted user cannot discover the action |

So ~88% of icon buttons were wrong, in three different ways, in an app that was actively trying to get
this right.

**FIX.** An `IconButton` primitive whose API makes divergence impossible:

- **One `label` prop** becomes **both** the `aria-label` **and** the tooltip text. They cannot drift and
  the tooltip cannot be forgotten. This single-source-of-truth API is the whole point — two props would
  reintroduce the bug.
- **No `title` prop.** Omit it from the type.
- `disabledReason?: string` — shown in the tooltip **and** wired via `aria-describedby` through an
  always-present `sr-only` node, so it reaches AT even while the tooltip is closed.
- The tooltip must open on a **disabled** control. A disabled `@brand/ui` `Button` carries
  `pointer-events-none`, so hover never fires — the Radix trigger has to be a focusable/hoverable wrapper
  `<span>`, not the disabled `<button>`. Get this right in the library; it's fiddly and every consumer
  will get it wrong.
- Tooltip opens on **focus**, not hover alone.

**One design note from production use:** the downstream implementation deliberately has **no `asChild`** —
it would dissolve into a Slot and break the tooltip wrapper. That's a real constraint worth designing for
explicitly rather than discovering later; consumers _will_ want `asChild` for link-buttons.

Once this exists, `@brand/ai`'s `PromptInputButton` should be built on it (batch 2 item 4).

**ACCEPTANCE.** `<IconButton label="Refresh" icon={<RefreshCw />} />` renders `aria-label="Refresh"` and
a tooltip reading "Refresh", on hover **and** focus. Disabled + `disabledReason` still shows the tooltip
and exposes `aria-describedby`. No `title` in the output. Story covering enabled/disabled/focus states.

---

## 3. Dialog tiers — a size and scroll contract for modals — P1

**SYMPTOM.** `Dialog` / `AlertDialog` / `Sheet` are primitives with no guidance on size, scroll ownership,
footer order, section headings or dirty-state handling. Left to individual judgement, dialogs converge on
"512 px scroll tube" regardless of content, and destructive confirmations get built as plain `Dialog`s
(so initial focus lands on the _destructive_ action rather than the safe one).

Downstream built a **four-tier kit** and made it mandatory:

| Tier          | When                                             | Shape                                                                                            |
| ------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **Confirm**   | yes/no, ≤2 actions, no fields                    | `AlertDialog` (focus traps on the **safe** action)                                               |
| **Form**      | ≤6 fields, fits without internal scroll          | ~640 px; body is a `<form>` so Enter submits                                                     |
| **Wide**      | grouped fields / advanced section / >8 fields    | ≥960 px, left-rail **or** top-tab sections; header+footer fixed, only the active section scrolls |
| **Workbench** | full working surface (editor + live result pane) | ~95vw × 90vh; body owns its own scroll/split                                                     |

Plus shared furniture: a `DialogSection` that renders a **real section heading** (the recurring defect was
section labels rendering at the same size as field labels), an `AdvancedGroup` collapsed by default that
**summarizes its non-default values while collapsed**, and a dirty-state guard intercepting Escape /
overlay / X into a discard-changes confirmation.

Baked-in conventions worth adopting wholesale: primary action bottom-right, Cancel to its left; the
primary label states the **consequence** ("Delete skill", "Save as new version") never "OK"/"Save";
submit stays **enabled until the request starts**, then shows a spinner.

**FIX.** Ship the tiers as named components (or one `Dialog` with a `tier`/`size` + `scroll` contract),
plus `DialogSection`, `AdvancedGroup`, and a `dirty` prop with the discard guard.

**ACCEPTANCE.** One story per tier at its intended content volume. The Wide tier with a deliberately long
form: header and footer stay fixed, only the section scrolls, primary action always visible. Dirty-guard
story: Escape with unsaved changes prompts; a programmatic close after save does not. Confirm tier: initial
focus is on the **safe** action.

---

## 4. `ScrollableTabsList` — `TabsList` clips instead of scrolling — P1

**SYMPTOM.** A 5–6 tab strip is simply **cut off** inside a phone viewport or a narrow pane/sheet. No
scroll, no wrap, no hint — the later tabs are unreachable.

**UPSTREAM.** `ui/src/components/tabs/tabs.tsx:12-16`:

```tsx
className={cn("inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground", className)}
```

`inline-flex` with no wrap and no overflow handling.

**FIX.** Handle overflow in `TabsList` — an `overflow-x-auto` container, ideally with edge fades and
optional scroll buttons. **One non-obvious trap** worth encoding: for a centered full-width strip, plain
`justify-center` **strands the first tab off the left edge** when the set overflows. Use
`justify-center-safe` (`justify-content: safe center`), which is visually identical while things fit and
falls back to start-alignment on overflow. Downstream lost time to exactly this.

**ACCEPTANCE.** A 8-tab strip in a 320 px container: all tabs reachable by scroll/keyboard, first tab
never stranded, active tab scrolled into view on change. Wide viewport rendering unchanged.

---

## 5. The form kit — six primitives the library stops short of — P1

**SYMPTOM.** `@brand/ui` covers `Input`/`Select`/`Checkbox`/`Switch`/`Textarea` and stops. Everything a
real configuration UI needs above that gets rebuilt per consumer. Downstream built six, each with tests,
and each replaced something genuinely bad:

| Component            | What it does                                                                                                                                    | What it replaced                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **`TagInput`**       | chips committed on Enter/comma; **a paste containing commas splits into several chips**; backspace on empty removes the last chip               | free-text blobs                                        |
| **`KeyValueEditor`** | key/value rows, per-row secret masking + reveal toggle                                                                                          | a raw **`Env JSON` textarea**                          |
| **`ListEditor`**     | one string per row → `string[]`                                                                                                                 | a raw **`Args JSON` textarea** with a leftover example |
| **`SliderNumber`**   | slider + synced numeric input, both clamped and rounded in lockstep, with an explicit **"provider default" (`null`)** state and a reset control | `−/+` steppers on 0–1 floats (temperature, top-p)      |
| **`BoundedNumber`**  | bounded numeric where **empty is a real, meaningful state** ("No limit" / "No cap"), clamped **on blur, not per keystroke**                     | a stepper you increment away from ∞                    |
| **`SegmentedField`** | label + segmented control with **sticky** selection                                                                                             | dropdowns for ordered 3-value scales                   |

Three design details that are easy to miss and cost real debugging:

- **`SegmentedField` sticky selection.** Radix `ToggleGroup` (single) emits `""` when you click the
  already-active segment, silently clearing a field that should always have exactly one value. Any
  segmented-control wrapper must swallow that.
- **Clamp on blur, not per keystroke.** `NumberInput` clamping per keystroke actively fights someone
  typing a long value (typing "500000" into a `max: 100000` field gets mangled mid-entry). **This applies
  to the existing `NumberInput` too — it's a live papercut in the library today, worth fixing regardless
  of whether the new components ship.**
- **Empty as a state.** "No limit" is semantically different from 0 and from the field's max. A numeric
  input that can't express it forces sentinel values into the data model.

**FIX.** Ship the six. They compose entirely from existing primitives — no new dependencies.

**ACCEPTANCE.** Per component: controlled + uncontrolled stories, keyboard operability, and the specific
behaviours called out above tested (paste-splits-into-chips; clamp-on-blur-not-keystroke; empty→`null`;
sticky segment selection; secret masking never logs or exposes the value). Never block paste anywhere.

---

## 6. `FieldRow` — label + control + help + error — P1

**SYMPTOM.** Field composition is left entirely to consumers: the clickable-label association, help text,
inline error placement, and the `aria-describedby` wiring that ties help/error to the control. Every app
rebuilds it, and most get the `aria-describedby` part wrong.

**FIX.** A `FieldRow` (or extend the existing `Form*` components) owning: `htmlFor`/`id` association so
the label is a real click target sharing one hit region with its control; help text; inline error
rendered **next to the field**, not collected at the top of the form; automatic `aria-describedby`
composition from whichever of help/error are present; and `aria-invalid` on error.

**ACCEPTANCE.** Clicking the label focuses the control. Help and error are both announced via
`aria-describedby`. On submit, focus moves to the first invalid field. Stories: default · with help ·
with error · with both.

---

## 7. No free-text-plus-suggestions input — P2

**SYMPTOM.** A field where a **custom value is valid** but a roster of known values should be suggested
has no `@brand` answer. `Select` forbids custom values; `Combobox` is selection-oriented. Downstream had
to use a native `<datalist>` — an escape hatch from its own no-raw-HTML rule.

**FIX.** Either a documented `Combobox` mode that accepts arbitrary input (`allowCustomValue`), or a
dedicated component. Must make clear in the UI that a non-listed value is acceptable.

**ACCEPTANCE.** Typing a value not in the list is accepted and emitted. Suggestions filter as you type.
Keyboard: arrows navigate suggestions, Enter accepts either a suggestion or the typed value, Esc dismisses
without clearing. Full combobox ARIA.

---

## 8. Two smaller chrome gaps — P2

**8a. `Toaster` replaces `toastOptions` wholesale instead of merging.**
`ui/src/components/sonner/sonner.tsx:36-45` sets its own `toastOptions` and then spreads `{...props}`
**after** it. Any consumer passing `toastOptions` therefore **discards the library's defaults entirely**
and must re-declare `description`, `actionButton` and `cancelButton` from scratch just to change one
thing. _Fix:_ deep-merge `toastOptions` (and note this also affects the `shadow-lg` on `:39`, which per
batch 1 item 3 has never rendered).

_Related, worth deciding upstream:_ sonner's `richColors` palette is hardcoded and theme-agnostic — its
error plate measured **4.35:1 (below AA)** against one consuming app's light theme, forcing that app to
drop `richColors` and hand-map all four toast types onto semantic tokens. Consider shipping token-driven
type plates so `richColors` isn't the only path to coloured toasts.

**8b. `ThemeSwitcher` is uncontrolled and has no "System" option.**
It calls `useTheme()` internally and cycles on click (`theme-switcher.tsx:67-68`), with no
`value`/`onValueChange`. An app whose source of truth is a persisted _preference_ (including
"follow the OS") can't drive it, and has to compose a `DropdownMenu` instead — losing the component's
view-transition animation. _Fix:_ add controlled mode, and a first-class `system` preference distinct
from a concrete theme (pairs with batch 1 item 6's `allowedThemes`).

**ACCEPTANCE.** 8a: passing `toastOptions={{classNames:{toast:"…"}}}` preserves the library's
`description`/`actionButton`/`cancelButton` defaults. 8b: `<ThemeSwitcher value onValueChange />` works
as a controlled component; "System" tracks `prefers-color-scheme` live.

---

## Batch definition of done

Per item: dedupe verdict · implementation · stories for every named state · tests · **docs page stating
the contract** · manifest regeneration · honest report of what shipped, what you left out, and what you
did not verify.

**If you can only do two:** items 1 and 2. `ViewToolbar` collapses six filter idioms + five count idioms

- three toolbar heights into one grammar; `IconButton` collapses three hover-hint mechanisms across ~124
  controls into one. Both are cases where **the missing contract, not the missing capability, was the
  actual defect** — which is why the docs page matters as much as the component.
