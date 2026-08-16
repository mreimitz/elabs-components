# Batch 2 — `@brand/ai`: the composer

> Independent of batch 1 — **these can run in parallel.** Item 1 is a one-line fix for the worst
> user-facing defect found in this whole review, and it is worth shipping on its own, today.

---

You are working in the **brand-ui monorepo** (`packages/{ui,data,ai,charts,flow,tokens,editor,…}`,
registry/blocks, Storybook).

Before writing any code, read this repo's own contribution docs and follow its maintainer workflow (the
`brand-ui-component` skill if available: dedupe gate → component API rules → quality gates → manifest
regeneration). Everything in this brief **supplements — never overrides** — the repo's own rules.

**Mandatory, every item:**

1. **Dedupe gate first.** Verify the gap still exists at HEAD. Verified against **v1.9.0**; HEAD may have
   moved. Record a verdict per item; if already fixed, say so and move on.
2. **Non-breaking by default.** All additive. If an item can't be done without a break, **stop and report**.
3. **Tokens only.** No raw colors. Correct in every shipped theme.
4. **A11y is part of Acceptance.**
5. **Deliverables per item:** implementation · stories for the named states · docs · types · tests ·
   manifest regeneration.
6. **Honest reporting:** what shipped · what you left out · what you did **not** verify.
7. **Do not silently expand scope.**

**Context.** A downstream product shipped two production assistant surfaces (a docked page-assistant and
a full-page multi-agent workspace) on `@brand/ai`. It had to **abandon the `Composer` wrapper in both**
and re-compose an identical frame from the underlying `PromptInput*` primitives — solely because of item 1.
That's the shape of the problem: the primitives are good, the wrapper undoes them.

---

## 1. `Composer` passes `<ArrowUp>` as children, which overrides the send-state icon — **the Stop button is invisible** — P0

**SYMPTOM.** While a turn is generating, the composer's primary button _behaves_ correctly as Stop —
clicking it stops the stream — but it **still shows an up-arrow**. There is no visible indication that
generation is running or that the button now means "stop". Users hit Enter again, or click expecting to
send. A downstream team read this as "the assistant is un-interruptible" and rebuilt the whole composer.

**UPSTREAM.** `ai/src/composer.tsx:125-127` and `ai/src/prompt-input.tsx:1126-1178`.

**CURRENT.** `PromptInputSubmit` is **correct and well-built** — this is worth saying plainly, because the
bug is not here:

```tsx
// ai/src/prompt-input.tsx:1136-1170
const isGenerating = status === "submitted" || status === "streaming";

let Icon = <CornerDownLeftIcon className="size-4" data-rtl-flip />;
if (status === "submitted")      Icon = <Spinner />;
else if (status === "streaming") Icon = <SquareIcon className="size-4" />;
else if (status === "error")     Icon = <XIcon className="size-4" />;

const handleClick = useCallback((e) => {
  if (isGenerating && onStop) { e.preventDefault(); onStop(); return; }
  onClick?.(e);
}, [isGenerating, onStop, onClick]);

return (
  <InputGroupButton
    aria-label={isGenerating ? "Stop" : "Submit"}      // ✅ correct
    onClick={handleClick}                              // ✅ correct
    type={isGenerating && onStop ? "button" : "submit"}// ✅ correct
    …
  >
    {children ?? (<span key={status ?? "ready"}>{Icon}</span>)}   // ⬅️ children WINS
  </InputGroupButton>
);
```

Correct aria-label, correct click routing, correct type switching, a complete four-state icon machine.
**The bug is exclusively the wrapper's call site:**

```tsx
// ai/src/composer.tsx:125-127
<PromptInputSubmit status={sendStatus} onStop={onStop} className="rounded-full">
  <ArrowUp className="size-4" /> {/* ⬅️ hardcoded child beats `children ?? Icon` */}
</PromptInputSubmit>
```

`Composer` forwards `status` and `onStop` perfectly, then passes a static `<ArrowUp>` as `children` —
which, by `children ?? Icon`, permanently suppresses the icon state machine it just correctly wired up.
Net effect: **every consumer of `Composer` gets a stop button that looks like a send button.**

Note the a11y asymmetry — screen-reader users are told "Stop" correctly; sighted users are not. So this
does not show up in an automated a11y audit, which is likely why it survived.

**FIX.** Delete the `<ArrowUp>` child at `composer.tsx:126` so the status icon renders. If the arrow glyph
is wanted for the idle state specifically, change `PromptInputSubmit`'s default `Icon` for the ready state
rather than hardcoding a child at the call site (currently ready renders `CornerDownLeftIcon` — pick one
intentionally and document it).

Then **make this class of bug impossible**: `children ?? Icon` is a footgun on a component whose entire
job is a state machine. Either drop `children` support on `PromptInputSubmit`, or keep it but render the
status icon _alongside_ an explicit `icon` prop, so overriding the label can't silently disable the state.

**ACCEPTANCE.** A `Composer` story cycling `sendStatus` through `undefined → submitted → streaming →
error` shows four **visibly different** buttons. A test asserts the streaming state renders the square
glyph (not an arrow) _when rendered via `Composer`_, not just via bare `PromptInputSubmit` — the existing
`composer.test.tsx` should gain that case. Confirm the fix in `blocks-ai-composer.stories.tsx` too.

---

## 2. No contract for "what does the primary action do while a turn is running?" — P0

**SYMPTOM.** Item 1 is the visible bug; this is the design gap under it. The library has no answer for the
central interaction question of any streaming composer: while generating, is the primary control Send or
Stop, and what happens if the user types a follow-up? Two downstream surfaces had to design, implement and
test this themselves — and any two consumers will answer it differently.

**UPSTREAM.** `ai/src/prompt-input.tsx`, `ai/src/composer.tsx`.

**CURRENT.** `PromptInputSubmit` exposes `status` + `onStop` and stops there. There is no guidance,
no story, and no supported pattern for the follow-up-while-running case.

**FIX.** Ship the merged-action contract as a first-class, documented behaviour. The pattern that survived
production use downstream:

- Turn running **and** composer empty → the control is **Stop** (square glyph, `aria-label="Stop"`,
  click → `onStop`, and it must **never** also submit).
- Turn running **and** the user has typed → the control flips back to **Send**; submitting **queues** the
  follow-up rather than interleaving it into the running turn.
- Not running → **Send**.

Expose it as something like `mode="merged" | "separate"` (a two-button variant is legitimate for surfaces
with room), with `canQueueWhileRunning` gating the queue behaviour. The `aria-label` must track the
_current_ meaning — it already does in `PromptInputSubmit`; the wrapper needs to preserve that.

**ACCEPTANCE.** Stories for all four states (idle · running+empty · running+typed · error). A test proving
that clicking Stop while running calls `onStop` **exactly once and does not call `onSubmit`** — that
specific assertion caught a real regression downstream.

---

## 3. `PromptInput`'s Enter handler submits even while the button means Stop — P1

**SYMPTOM.** Enter routes to submit regardless of `sendStatus`. Pressing Enter during a running turn
queues a message and mis-buckets the running turn's late streamed events. Every consumer must add the
same guard.

**UPSTREAM.** `ai/src/prompt-input.tsx` (the textarea's keydown handler).

**CURRENT.** Downstream had to write, in application code:

```ts
if (sending || streaming || trimmed.length === 0) return;
```

**FIX.** Gate the built-in Enter handler on `status` using the same `isGenerating` predicate
`PromptInputSubmit` already computes — and route it through whatever item 2 lands as the merged-action
policy, so keyboard and pointer paths cannot diverge. Enter during a running turn should either queue
(if queueing is enabled) or no-op — never silently submit into the running turn.

**ACCEPTANCE.** A test: with `status="streaming"`, `keyDown{Enter}` on the textarea does not fire
`onSubmit`. Keyboard behaviour matches clicking the button in all four states of item 2.

---

## 4. `PromptInputButton` isn't a `Button`, so it can't take a standard tooltip — P1

**SYMPTOM.** `PromptInputButton` accepts a `tooltip` prop (see `composer.tsx:120` —
`<PromptInputButton tooltip="Voice">`), but because it isn't the `@brand/ui` `Button`, it sits outside
any consumer-side icon-button standard. In the downstream app — which enforces "every icon-only control
carries a Radix tooltip whose text equals its `aria-label`" via a lint rule over ~124 controls — the
composer's voice button is the **single control in the entire application** still relying on a bare
native `title`. Native `title` is invisible to assistive tech, has a ~1.5 s OS delay, and can't be styled.

**UPSTREAM.** `ai/src/prompt-input.tsx` (`PromptInputButton`), used in `ai/src/composer.tsx:120-123`.

**FIX.** Compose `PromptInputButton` from the `@brand/ui` `Button` and make its `tooltip` prop render a
real Radix `Tooltip` **and** set `aria-label` from the same string — so the accessible name and the hover
hint are the same value by construction and neither can be forgotten. (Batch 5 proposes an `IconButton`
primitive with exactly this single-`label`-prop API; if that lands, `PromptInputButton` should be built
on it rather than duplicating the logic.)

**ACCEPTANCE.** `<PromptInputButton tooltip="Voice">` renders a Radix tooltip on hover **and** focus, and
exposes `aria-label="Voice"`. No `title` attribute anywhere in the rendered output. Keyboard-only users
can reach the tooltip.

---

## 5. `MessageBranch*` is uncontrolled — `defaultBranch` is read once at mount — P1

**SYMPTOM.** There is no controlled mode, so a host that owns branch state (from a URL param, a
regenerate action, or restored session state) cannot drive the component. The downstream app remounts it
via `key` to force a branch change — which discards internal state and remounts the whole subtree.

**UPSTREAM.** `ai/src/` message-branch components.

**FIX.** Add controlled + uncontrolled modes: `branch` / `onBranchChange` alongside the existing
`defaultBranch`. This is the pattern the library already ships elsewhere — `AI/ChangeReview` does exactly
this (compound component, lifted state, controlled **and** uncontrolled). Match it.

**ACCEPTANCE.** A controlled story where an external button changes the branch without remounting.
A test asserting `branch` updates are reflected without a `key` change, and that uncontrolled behaviour
is unchanged for existing consumers.

---

## 6. `PromptInputCommandItem` spreads consumer props **before** its own `id`/`role`/`aria-selected` — P1

**SYMPTOM.** Those three attributes cannot be set from outside, because the component's own values
overwrite whatever the consumer passed. Building an `@`-mention popup with correct
`aria-activedescendant` wiring therefore requires reading the **committed DOM back** — querying
`[role="option"]` and matching the Nth node positionally against the filtered list — because there is no
way to assign known ids up front.

**UPSTREAM.** `ai/src/prompt-input.tsx` (`PromptInputCommandItem`), which wraps cmdk's item; cmdk
generates opaque per-item ids via `useId()` internally.

**FIX.** Spread consumer props **last** so `id` / `role` / `aria-selected` can be overridden, or expose an
explicit `id` prop that is threaded through to the rendered element. Either unblocks standard
`aria-activedescendant` wiring for combobox patterns built on the command list.

**ACCEPTANCE.** `<PromptInputCommandItem id="opt-3">` renders `id="opt-3"` on the element carrying
`role="option"`. A story wiring `aria-activedescendant` on the input to the highlighted item, verified
with a screen reader or an ARIA snapshot.

---

## 7. No mention-capable input anywhere in `@brand/*` — P1

**SYMPTOM.** `@`-mentions (typing `@` opens a filtered roster; selecting inserts an atomic, styled,
non-editable chip; the value serializes to text + referenced ids) are table stakes for any multi-agent or
collaborative assistant. Nothing in the system provides it. The downstream app — under a hard rule that
every visible element must be a `@brand` component — had to grant its **only content-editable escape
hatch of the entire project** for this: a 523-line component plus a 190-line test, hand-rolling caret
tracking, chip atomicity, backspace-deletes-whole-chip, popup filtering and the `aria-activedescendant`
wiring that item 6 makes awkward.

**UPSTREAM.** New component in `packages/ai`.

**FIX.** A `MentionInput` (or `PromptInputMention`) primitive:

- Trigger character configurable (default `@`); opens a filtered popup over a supplied option list.
- Selection inserts an **atomic** chip: single caret step past it, backspace removes the whole chip,
  it can't be partially edited.
- Serializes to `{ text, mentionedIds }` — the text with each chip rendered inline (e.g. `@Name`) plus
  the deduped ids in document order.
- Controlled and uncontrolled; composes with `PromptInput` so it can _be_ the composer's text surface.
- Full combobox a11y: `role="combobox"` on the input, `aria-expanded`, `aria-controls`,
  `aria-activedescendant` tracking the highlighted option (depends on item 6).

**ACCEPTANCE.** Stories: empty · typing a query · popup open with keyboard navigation · chips inserted ·
serialization output shown. Keyboard-only: ↑/↓ to navigate, Enter to select, Esc to dismiss. Tests for
backspace-removes-whole-chip and for the serialized `{text, mentionedIds}` shape. Verified with a screen
reader that the highlighted option is announced.

---

## Batch definition of done

Per item: dedupe verdict · implementation · stories covering every named state · tests · docs · manifest
regeneration · honest report.

**Ship item 1 first and separately if you ship nothing else from this batch.** It is a one-line deletion
that fixes a defect every consumer of `Composer` currently has in production, and it needs no design
discussion.

**A note on quality bar:** `AI/ChangeReview` is the reference this batch should match — compound
component, lifted state, controlled **and** uncontrolled, per-part override renderers. Items 2 and 5 are
essentially "make the composer as well-specified as `ChangeReview` already is."
