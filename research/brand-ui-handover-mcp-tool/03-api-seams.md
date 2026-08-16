# Batch 3 — `@brand/ui`: closed API seams

> **Best value-per-hour in the pack.** Thirteen issues, almost all small additive diffs — add an `as`,
> add a `title`, add a `max-w`, open a closed props interface. One (item 4) is a genuine library-wide
> rendering bug reproducible in a single line.
>
> Assumes batch 1 has landed (several items are verified visually against tokens).

---

You are working in the **brand-ui monorepo** (`packages/{ui,data,ai,charts,flow,tokens,editor,…}`,
registry/blocks, Storybook).

Before writing any code, read this repo's own contribution docs and follow its maintainer workflow (the
`brand-ui-component` skill if available: dedupe gate → component API rules → quality gates → manifest
regeneration). Everything in this brief **supplements — never overrides** — the repo's own rules.

**Mandatory, every item:** (1) **dedupe gate first** — verified against v1.9.0, HEAD may have moved,
record a verdict per item; (2) **non-breaking by default** — all additive, stop and report if not;
(3) **tokens only**, correct in every theme; (4) **a11y is part of Acceptance**; (5) **deliverables:**
implementation · stories · docs · types · tests · manifest; (6) **honest reporting** — what shipped, what
you left out, what you did **not** verify; (7) **do not silently expand scope.**

**The pattern across this whole batch:** the component renders the right _thing_, but exposes no seam to
correct its _semantics_. Consumers can see what's wrong and cannot reach it.

---

## 1. `CardTitle` renders a `<div>` — a card-based app has no document outline — P0 (a11y)

**SYMPTOM.** In a consuming app built on cards, live DOM inspection returned **one heading per page** (an
`sr-only` h1). Every section title was a `<div>`. A screen-reader user cannot navigate between sections
of any page — heading navigation, the primary AT wayfinding mechanism, returns nothing.

**UPSTREAM.** `ui/src/components/card/card.tsx:261-263`.

**CURRENT.**

```tsx
function CardTitle({ className, ...props }, ref) {
  return <div ref={ref} className={cn("text-title leading-none", className)} {...props} />;
}
```

**FIX.** Add `as?: "h1"|"h2"|"h3"|"h4"|"h5"|"h6"|"div"` (or `level?: 1..6`), defaulting to **`div`** so
existing consumers are byte-identical. The visual (`text-title leading-none`) must be identical across
every value — a card that titles a real section should look the same and simply _be_ a heading. Consider
the same seam on `SectionHeader` and any other title-ish component for consistency.

**ACCEPTANCE.** `<CardTitle as="h2">` emits `<h2 class="text-title leading-none">`. A visual-regression
story proving `div` and `h2` render identically. Default unchanged.

---

## 2. `AlertTitle` hardcodes `<h5>`, with a mismatched type signature — P1

**SYMPTOM.** An alert used as an inline form error lands at `h5` regardless of surrounding document
structure, producing skipped heading levels.

**UPSTREAM.** `ui/src/components/alert/alert.tsx:38-47`.

**CURRENT.** Note the signature says _paragraph_ while the element is a _heading_:

```tsx
export const AlertTitle = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLHeadingElement>>(
  function AlertTitle({ className, ...props }, ref) {
    return (
      <h5
        ref={ref}
        className={cn("mb-1 font-medium leading-none tracking-tight", className)}
        {...props}
      />
    );
  },
);
```

**FIX.** Add `as`/`level` (default `h5`, preserving current behaviour) and fix the `forwardRef` generic to
`HTMLHeadingElement`. Same treatment for `AlertDescription` if it has a comparable mismatch.

**ACCEPTANCE.** `<AlertTitle as="h3">` emits `<h3>`; default still `<h5>`; the ref type matches the
rendered element; visual identical across levels.

---

## 3. `SelectTrigger` clips its value with **no recovery path** — P1

**SYMPTOM.** Every select in a consuming app truncates its selected value with no way to read the full
text — no tooltip, no title, no expansion. Worst on composed labels (`"<server> · <date> · <n> tools"`),
where the _discriminating_ token is the one cut off, so two different selections look identical.

**UPSTREAM.** `ui/src/components/select/select.tsx:22`.

**CURRENT.** `[&>span]:line-clamp-1` is applied, and nothing sets `title` or otherwise exposes the value.

**FIX.** Set `title` to the selected item's text content by default (the trigger can read it from the
rendered `SelectValue`), **or** expose the resolved selected label so consumers can attach their own
recovery. Downstream had to build a wrapper that _requires_ a `selectedLabel` prop specifically so a call
site cannot forget it — that's a signal the default is wrong.

**ACCEPTANCE.** A long selected value is fully readable on hover **and** on keyboard focus (title alone
doesn't satisfy keyboard users — consider a tooltip). Story with a deliberately over-long composed label.

---

## 4. `CardDescription` **silently drops its own `text-muted-foreground`** — P1 (real bug)

> **Errata (post-fix, #336):** an independent validator later proved the class named below in
> **CURRENT** was never a real Tailwind utility — it was an invalid, misspelled class name (the
> correct one balances a paragraph's line wraps) that emitted zero CSS. `tailwind-merge` was not
> misconfigured; it correctly classified the unrecognized token as an unknown text-color value,
> per its documented behavior, and dropped `text-muted-foreground` in favor of it. The shipped fix
> uses the real, already-registered utility (which `tailwind-merge` groups independently of text
> color by default) — no custom `tailwind-merge` class-group registration was needed. See
> `CHANGELOG.md` (Unreleased → Fixed) for the corrected writeup.

**SYMPTOM.** Every `CardDescription` in every consuming app renders at **default foreground, not muted**.
Nobody notices because it looks like a deliberate choice — but it isn't; the class is being applied and
then discarded.

**UPSTREAM.** `ui/src/components/card/card.tsx:269-277`.

**CURRENT.**

```tsx
<p className={cn("text-sm text-muted-foreground text-wrap-<invalid-value>", className)} … />
```

The trailing token above is not a real Tailwind class (it doesn't exist, so it emits zero CSS).
`tailwind-merge` groups `text-muted-foreground` and any unrecognized `text-<value>` token as
conflicting `text-*` utilities and keeps only the last. **Reproduce in one line** (verified against
`tailwind-merge@3.6.0`):

```js
twMerge("text-sm text-muted-foreground text-wrap-<invalid-value>");
// → "text-sm text-wrap-<invalid-value>"      ← text-muted-foreground is gone, AND the surviving
//                                                class renders no CSS at all
```

No consumer `className` and no wrapper is involved — this is purely the component's own class string
fighting itself.

**FIX.** Use the real, registered Tailwind utility instead of the invalid one — it already lives in
`tailwind-merge`'s own conflict group, independent of `text-<color>`, so ordering no longer matters
and no custom `tailwind-merge` config is needed. Audit the codebase for any other invalid/misspelled
`text-wrap-*`-style class names sitting next to colour utilities (this can mask itself as a
tailwind-merge conflict when it is really a dead class).

**ACCEPTANCE.** A unit test asserting the final rendered `class` on `CardDescription` contains
`text-muted-foreground` **and** the real wrap-balance utility. Grep the repo for the same pattern
elsewhere and report what you found.

---

## 5. `CardDescription` has no measure cap — P1

**SYMPTOM.** Genuine prose in a full-width card runs edge to edge — **measured 190 characters per line**
on a wide viewport in a consuming app. Well past the ~45–75ch readable range.

**UPSTREAM.** `ui/src/components/card/card.tsx:269-277` (no `max-w`).

**FIX.** Either cap prose components by default (`max-w-prose` / `max-w-[68ch]`) or ship a
`prose`/`measure` variant. **Caution:** a default cap is a visual change for existing consumers, and
`CardDescription` is also used for short non-prose strings where a cap is irrelevant. An opt-in variant
is the safer call; if you default it, flag it in the changelog. `AlertDescription` has the same question.

**ACCEPTANCE.** A story at 1600 px showing capped vs uncapped; measured line length ≤ ~75ch in the capped
case. Whichever route, document which components are "prose" and which aren't.

---

## 6. `Combobox` has no `disabled` prop — P1

**SYMPTOM.** A combobox that should be disabled (dependent field not yet satisfied) can't be. Downstream
shipped **a disabled `Input` standing in for a disabled `Combobox`** — visibly a different control, so
the form's layout shifts as it enables.

**UPSTREAM.** `ui/src/components/combobox/combobox.tsx:20-28`.

**FIX.** Add `disabled?: boolean`, forwarded to the trigger, with proper `aria-disabled`, focus behaviour
and the same disabled styling every other `@brand/ui` control uses.

**ACCEPTANCE.** Disabled combobox is not focusable-into, doesn't open on click or Enter, reads as disabled
to AT, and matches `Select`'s disabled appearance. Story showing enabled/disabled side by side.

---

## 7. `Combobox` exposes no accessible-name passthrough and doesn't spread props — P1 (a11y)

**SYMPTOM.** The trigger's accessible name is the **selected value** (e.g. a session title), so AT
announces _what is selected_ but never _what the control is for_. There is no way to add the purpose.

**UPSTREAM.** `ui/src/components/combobox/combobox.tsx:20-28` — the props interface is fully closed:

```ts
export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
}
```

No `aria-label`, no `aria-labelledby`, no `id`, and no `...rest` spread. A wrapping `<label>` doesn't
work either — it **clobbers** the value-based name, trading one problem for a worse one. Downstream's
only clean option was wrapping the whole control in a `role="group"` with a label.

**FIX.** Add `aria-label` / `aria-labelledby` / `id` passthrough, or a `triggerProps` escape hatch (the
more general fix — it also covers `data-*`, `name`, and test hooks). Preferably both: named a11y props
for the common case, `triggerProps` for the rest.

**ACCEPTANCE.** `<Combobox aria-label="Session switcher" />` announces purpose _and_ current value.
Verified with a screen reader, not just an ARIA snapshot.

---

## 8. `Checkbox` has **no indeterminate glyph** — mixed looks identical to checked — P1 (a11y)

**SYMPTOM.** A tri-state "select all" master checkbox is unreadable to sighted users: `indeterminate`
draws the same checkmark as `checked`. The ARIA is correct (`aria-checked="mixed"`), so AT users are
fine and automated audits pass — sighted users get no signal at all. Downstream had to add an adjacent
"N / M selected" badge purely to disambiguate.

**UPSTREAM.** `ui/src/components/checkbox/checkbox.tsx:22-24`.

**CURRENT.** The indicator renders one glyph unconditionally:

```tsx
<CheckboxPrimitive.Indicator className="…">
  <Check className="size-3.5" />
</CheckboxPrimitive.Indicator>
```

`Check` is the only icon imported in the file.

**FIX.** Branch on `checked === "indeterminate"` and render a distinct mark — a `Minus` dash is the
convention. Radix exposes the state via `data-state="indeterminate"` on the indicator, so this can also
be done purely in CSS if you prefer no JS branch.

**ACCEPTANCE.** Three visually distinct states (unchecked · checked · indeterminate) in every theme.
A story with a working tri-state master/child group. `aria-checked="mixed"` preserved.

---

## 9. `Slider` doesn't forward anything to its hardcoded thumb — P1 (a11y)

**SYMPTOM.** `aria-valuetext` can't be set. A replay scrubber that should announce "step 3 of 12"
announces a bare number instead. Downstream reached the thumb through a scoped ref-effect after mount.

**UPSTREAM.** `ui/src/components/slider/slider.tsx:18`.

**CURRENT.** The thumb is a fixed element with a className and nothing else:

```tsx
<SliderPrimitive.Thumb className="block size-4 rounded-full border border-primary/50 bg-background shadow …" />
```

**FIX.** Add a `thumbProps` passthrough (and, for multi-thumb ranges, accept an array or a
`getThumbProps(index)` callback). At minimum `aria-valuetext`, `aria-label` and `data-*` must be reachable.

**ACCEPTANCE.** `<Slider thumbProps={{ "aria-valuetext": "step 3 of 12" }} />` renders it on the thumb;
a screen reader announces the text rather than the raw value. Range/multi-thumb case covered.

---

## 10. `Progress` has no destructive/exceeded variant — P1

**SYMPTOM.** A guardrail meter (token budget, cost cap, quota) that has been **exceeded** looks exactly
like one at 40%. Downstream signalled the tripped state with a `text-destructive` _label_ beside a
still-normal-coloured bar — the bar itself, the thing the eye goes to, stays reassuring while the
guardrail is blown.

**UPSTREAM.** `ui/src/components/progress/progress.tsx` — verified: **no `cva`, no `variant` prop, no
tone handling of any kind.**

**FIX.** Add `variant`/`tone` (`default | success | warning | destructive`) driving the indicator fill
from the corresponding semantic tokens. Colour must not be the _only_ signal — pair it with an
`aria-valuetext` or a documented pattern so the state is non-visually available too.

**ACCEPTANCE.** Story showing all tones in every theme, each passing contrast against the track (this
depends on batch 1 item 1). Tone is announced or otherwise available to AT.

---

## 11. `StatusBadge`'s 7-state enum is closed, and there's no density mode — P1

**SYMPTOM.** Two separate problems that together made downstream rebuild the component from `Badge` +
tokens:

- **The vocabulary doesn't fit.** A run engine's real states include `aborted` (user-cancelled — neutral,
  not a failure), `stopped_guardrail` (a cap tripped — warning, not a failure) and a "not run yet" dashed
  state distinct from `pending`. Mapping these onto the closed enum either lies about severity or
  collapses distinct outcomes together.
- **No quiet mode.** In a dense table, rendering _success_ as a filled chip produces an all-green wall
  that buries the two rows that need attention. The right rendering is: success → quiet muted text,
  every other tone → the tone-filled chip, **in the same table**.

**UPSTREAM.** `ui/src/components/status-badge/status-badge.tsx:34-44`.

**CURRENT.**

```ts
/** The canonical, closed 7-state status enum (research 10 §B.1). */
export const STATUSES = [
  "pending",
  "running",
  "complete",
  "awaiting-approval",
  "denied",
  "failed",
  "skipped",
] as const;
```

**FIX.** Two additive changes, neither breaking the enum for existing users:

1. Accept a `{ label, tone, icon? }` object as an alternative to a `Status` string, so a consumer with a
   richer vocabulary maps it once and still renders through this component.
2. Add a `quiet?: boolean` prop implementing the "success goes text-only, other tones stay chips"
   behaviour. This keeps "every status renders through `StatusBadge`" true instead of pushing consumers
   into ad-hoc `<Text>` exceptions.

The closed enum is a defensible default — the ask is an escape hatch that doesn't require abandoning the
component. **Note the library's own docblock already describes the calm/loud distinction** ("`complete`
renders the quiet alpha-wash… `failed` gets the solid fill"), so `quiet` is an extension of existing
thinking, not a new idea.

**ACCEPTANCE.** A custom `{label:"Stopped (guardrail)", tone:"warning"}` renders correctly. `quiet` story
showing a dense table where only the non-success rows carry chips. Existing `Status` string API unchanged.

---

## 12. `PageShell` has no toolbar header variant — P1

**SYMPTOM.** A consuming app needed one standard row per view (state/context/filters left, actions
right — see batch 5 item 1). `PageShell`'s `header` slot is an unstyled `ReactNode` with no height, no
alignment contract and no scroll behaviour, so every view invented its own. The app ended up maintaining
a **local `PageShell` fork** that every view must import — and two views accidentally imported the real
one and silently lost their toolbar. A library component that's _almost_ right is worse than one that's
absent, because the wrong import still compiles and renders.

**UPSTREAM.** `ui/src/components/page-shell/page-shell.tsx:4-12`.

**CURRENT.**

```ts
export interface PageShellProps {
  children: ReactNode;
  header?: ReactNode; // no height/alignment/scroll contract
  width?: "md" | "lg" | "xl" | "full";
  className?: string;
  contentClassName?: string;
}
```

**FIX.** Add `headerVariant?: "default" | "toolbar"` giving the toolbar case a fixed height, baseline
alignment, and a defined scroll relationship with the content region (header pinned, content scrolls).
Pairs directly with the `ViewToolbar` component proposed in **batch 5 item 1** — ideally design them
together.

**ACCEPTANCE.** A `headerVariant="toolbar"` story with a long scrolling body: the header stays pinned and
aligned. Default behaviour unchanged.

---

## 13. `Tree`'s interactive label can't right-align accessories — P1

**SYMPTOM.** A file explorer wanting a per-file size/token badge trailing each row can't place one — the
interactive label consumes the row. Downstream **dropped the feature**.

**UPSTREAM.** `ui/src/components/tree/`.

**FIX.** An `accessory`/`trailing` slot per node, rendered outside the interactive label so it doesn't
become part of the item's accessible name and doesn't capture the row's click. Same question applies to
any other row-like interactive component (`NavMain` items, list rows).

**ACCEPTANCE.** A file-tree story with trailing badges; the accessible name is still just the file name;
clicking the badge does not trigger row selection; keyboard nav unaffected.

---

## Batch definition of done

Per item: dedupe verdict · implementation · stories · tests · docs · manifest regeneration · honest report.

**Two cross-cutting observations worth acting on beyond the individual fixes:**

1. **Items 1, 2, 7, 9, 13 are all the same root cause** — a component owns an internal element and
   exposes no way to reach it. Consider adopting a house convention (`asChild` / `as` for elements,
   `<part>Props` for internals) and auditing every component against it. That convention would have
   prevented five of the thirteen issues here.
2. **Item 4 is a class of bug, not an instance.** `tailwind-merge` silently discarding a component's own
   utility can happen anywhere two same-prefix utilities coexist. A test that renders each component and
   asserts its intended base classes actually survive `cn()` would catch the whole family.
