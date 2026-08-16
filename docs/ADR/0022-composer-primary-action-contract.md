# ADR 0022 — The composer's primary-action contract while a turn is running

- **Status:** Accepted
- **Date:** 2026-08-02
- **Context:** issue #351 — "No contract for what the composer's primary action does
  while a turn is running"
- **Deciders:** architect design pass (structural/public-API question, per
  `.claude/rules/quality-gates.md` DoD battery)

## Context

`PromptInputSubmit`/`Composer` already flip their glyph to a Stop square while a turn is
generating (`status="submitted"|"streaming"`) — but that flip was **unconditional**: the
control stayed Stop even once the user typed a follow-up message, and Enter was blocked
outright while generating (`prompt-input.tsx` ~:1020, pre-fix). A user with a genuinely
new message to send mid-turn had **no way to submit it at all** — not "it queues", not "it
interleaves", simply nothing happened. Two downstream production consumers each had to
design, implement and test their own answer to "what does Send/Stop mean while running",
and any two consumers of `Composer`/`PromptInput` would answer it differently.

The issue's own proposed API — `mode?: "merged" | "separate"` plus a `canQueueWhileRunning`
boolean — does not survive **D5** (`docs/DECISIONS.md` §D5 / `scope-and-non-goals.md`):
brand-ui is a presentation layer, it never owns model calls, transport, or what a mid-turn
submit actually MEANS to the app's runtime. A prop named `canQueueWhileRunning` promises a
guarantee brand-ui cannot keep — whether the message is queued, interleaved, or dropped is
entirely a property of the consumer's own `onSubmit` handler. Naming the prop for a
behaviour the component doesn't control is exactly the kind of scope creep D5 exists to
prevent.

`mode="merged"|"separate"` is a second, independent problem:
`.claude/rules/component-api.md` ("Composition patterns") explicitly bans a
behavioural-mode prop for this shape — `cva` variants are for **visual** axes
(size/tone), never behavioural forks; a genuinely different arrangement (one merged
control vs. two separate controls) is a **composition** decision, not a prop.

## Decision

Ship the **merged primary-action contract** as `PromptInputSubmit`'s default, derived
behaviour — no new boolean/mode prop — plus a new, purely additive `PromptInputStop` part
for the composed "two buttons" arrangement.

| #   | Turn status                     | Composer      | `PromptInputSubmit` shows | Notes                                                                               |
| --- | ------------------------------- | ------------- | ------------------------- | ----------------------------------------------------------------------------------- |
| 1   | `ready` / `undefined` / `error` | any           | **Send**                  | unchanged                                                                           |
| 2   | `submitted` / `streaming`       | **empty**     | **Stop**                  | unchanged — `onStop` fires, never `onSubmit`                                        |
| 3   | `submitted` / `streaming`       | **non-empty** | **Send**                  | **the fix** — click/Enter fires `onSubmit`, exactly like case 1                     |
| 4   | any                             | any           | **Send**, always          | when a `PromptInputStop` is mounted alongside — the dedicated control owns stopping |

What brand-ui owns: the **affordance** (which glyph, `aria-label`, `data-action`, whether
Enter/click routes to `onStop` or lets the form submit). What brand-ui explicitly does
**not** own: what a case-3 submit MEANS. `onSubmit` fires exactly as it does at rest; the
app's own handler decides whether that's a queue, an interleaved follow-up, or something
else. No prop asserts or configures that decision.

`canSubmit` (non-whitespace text, or ≥1 attachment) was already lifted into
`PromptInput`'s `PromptInputSubmitStateContextValue` — case 3 needed no new state, only a
derivation the component already had the inputs for:

```
action = isGenerating && !canSubmit && !hasDedicatedStop ? "stop" : "send"
```

`PromptInputStop` is the answer to "two buttons": a dedicated, composed control
(`data-slot="prompt-input-stop"`) that renders `null` unless the turn is running. Its mere
presence in the tree (`registerStop()`, ref-counted) flips `PromptInputSubmit` to
permanently-Send — case 4. This is composition, not a `mode` prop: an app that wants the
separate arrangement renders both controls; an app that wants the merged one renders only
`PromptInputSubmit`.

**The opt-out for an app that genuinely cannot accept a mid-turn submit already existed and
needed no new prop:** pass `disabled` to `PromptInputSubmit` — both the affordance and the
Enter guard already honour it, so the app gets an honest disabled Send instead of a
live-looking Stop that silently swallowed Enter.

## Consequences

- **Purely additive API.** `sendIcon` (a new optional prop — the Send-only glyph slot that
  survives the send↔stop flip) and `PromptInputStop`/`PromptInputSubmitAction` are new
  exports; no existing prop was removed or renamed. `children` still works exactly as
  before (replaces the glyph for every status — now documented `@deprecated` in favour of
  `sendIcon`).
- **One behavioural change, and it is a defect fix.** Case 3 (running + typed) previously
  rendered Stop and silently swallowed Enter — dead, unreachable behaviour. It now renders
  Send and lets the message through. This is observable, so it ships with a `CHANGELOG.md`
  entry and a migration note (see below), but it is not a breaking API change — nothing
  that worked before stops working.
- **`data-generating`'s meaning narrows.** It used to mean "the turn is running"; it now
  means "THIS control is currently the Stop action" (`data-action="stop"` implies
  `data-generating="true"`, and vice versa). Existing tests/CSS keyed on
  `[data-generating="true"]` to detect "a turn is running" should move to the app's own
  `status`, or to `[data-action="stop"]` if they specifically mean "this control stops".
- **`Composer` adopts `sendIcon` instead of `children`.** Its circular `ArrowUp` used to be
  passed as `children`, which is why it disappeared once `PromptInputSubmit` became Send
  again mid-turn (a `sendIcon`-shaped bug, fixed as part of this same change).
- **Migration for an app that needs the OLD unconditional-Stop-while-running behaviour:**
  render a `PromptInputStop` alongside `PromptInputSubmit` (case 4) — `PromptInputSubmit`
  becomes permanently Send, and the dedicated Stop control keeps the old always-visible
  Stop affordance for the running+empty state, PLUS lets a running+typed follow-up be sent.
  There is no way to fully restore the pre-fix "Enter does nothing while running and typed"
  behaviour, because that was the bug.

## Alternatives considered and rejected

- **`canQueueWhileRunning: boolean`** (the issue's literal proposal). Rejected — see
  Context: the name promises a guarantee (queueing semantics) that brand-ui, as a
  presentation layer, cannot make or verify. D5 settles this.
- **`mode?: "merged" | "separate"`.** Rejected — a behavioural-mode prop for an
  arrangement decision that composition already expresses better; `component-api.md`'s
  "avoid boolean/mode-prop proliferation" rule names this exact anti-pattern.
- **Owning a queue inside `PromptInput`** (buffering a case-3 submit and re-firing it once
  the turn ends). Rejected outright — this is model/runtime behaviour, squarely on the
  "consuming app" side of the D5 boundary table, and would make `PromptInput` stateful in a
  way no other brand-ui component is (see `scope-and-non-goals.md`).
