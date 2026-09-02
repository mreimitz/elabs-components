# Agent-session family — grammar and divergences

One section per component. Each records the upstream surface its **grammar** came from, the version
that surface was measured against, what was checked, and where this package deliberately does
something else. See [`README.md`](./README.md) for the license, the capture method and the honest
limits of this reading.

Divergences are not omissions. The fidelity axis is settled in
`.claude/rules/terminal-components.md`: reproduce the _grammar_ at high fidelity, reproduce the
_mechanics_ as web. Where a row below says "we do X instead", that is the rule being applied, not a
shortcut.

## Family-wide divergences

These apply to every component here, so they are stated once rather than repeated:

| Upstream                                                   | Here                                                | Why                                                                                                          |
| ---------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Box-drawing characters (`╭─╮`, `┃`) as borders             | `border-terminal-border`, square corners            | A screen reader reads box-drawing aloud, and it collapses at any monospace-font fallback                     |
| `ch`-unit column alignment, space padding                  | CSS grid track (`--terminal-gutter`)                | A grid keeps wrapped continuation lines aligned under the content column without breaking at a font fallback |
| Native `<details>` / `<summary>`                           | Radix `Collapsible`                                 | One disclosure mechanism across the library                                                                  |
| Focus moved by walking `parentElement.children[i]`         | Radix `RadioGroup` / real `focus-visible`           | The upstream's own weakest spot; roving focus comes free from the primitive                                  |
| Hardcoded hex per status (`#4ea96f`, `#f7768e`, `#e0af68`) | `--terminal-ansi-*` tokens                          | The console is themed, not painted                                                                           |
| No `prefers-reduced-motion` handling anywhere              | `motion-reduce:` branch on every animated indicator | An improvement over the reference, not a copy of it                                                          |
| Vendor names in labels, defaults and type unions           | Vendor-free vocabulary                              | Acceptance criterion of #117                                                                                 |

## `TerminalSurface` / `TerminalRow`

**Derived from:** the shared frame implied by every upstream family, rather than one component.

Upstream has no surface primitive — each component restates its own ground, monospace role and
column padding. The gutter here is a property of the **surface**, published as a local
`--terminal-gutter` custom property, and rows are grid children of a track list they do not own.
That is what makes "no `ch`-based alignment" possible without losing continuation-line alignment.

`gutterLabel` has no upstream equivalent. It emits the meaning of a gutter glyph as an `sr-only`
word **in every variant, including the one that hides the glyph** — the third channel WCAG 1.4.1
asks for, inherited by every row component instead of each re-deriving it.

## `TerminalWorking`

**Derived from:** `grok-working.tsx` · **Grok CLI v0.2.93**

Checked: braille spinner of **ten frames** (`⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏`) cycling every **90 ms**; a solid
diamond `◆` substituted while a tool is active; default label `"Waiting for response…"` (upstream
already uses a real ellipsis); a persistent `[stop]` control hint and an optional `[↓]` scroll hint;
the download-token marker `⇣`. Fact order: spinner or diamond, label, elapsed — then right-aligned
elapsed, `⇣`, token count, controls. Elapsed grammar: under a minute `Xs` with one decimal below
10 s; a minute or more `XmYYs` with zero-padded seconds. `role="status"` with `aria-live="polite"`,
spinner glyph `aria-hidden`.

**Diverges:** the elapsed formatter is `formatElapsed` from `@elabs-ai/components-ui`, shared with
the chat-skin sibling rather than re-derived. Token counts go through `useLocale().formatNumber`,
not a hand-rolled compacter. Under reduced motion the spinner becomes a static glyph and the state
is carried by the live-region text that is already there — upstream has no such branch. The visible
elapsed counter is **not** inside the live region; a per-second re-announcement is unusable, so the
announcement is a separate `sr-only` node that changes only at meaningful transitions.

One divergence is an **interpretation**, not a transcription, and is called out as such because a
later reader could otherwise take it for a captured fact. Upstream swaps the spinner for the solid
diamond when **a tool is actively producing output**; that is what the capture shows. This component
has no `activeTool` prop and deliberately does not gain one — `loading-states.md` allows exactly two
not-ready names and forbids minting a third — so the diamond is driven by `isStreaming`, whose
canonical meaning ("partial content is arriving incrementally") is the same condition seen from the
caller's side. The mapping is sound under the rule, but it is a mapping: the capture says _tool
active_, the prop says _streaming_, and they coincide rather than being the same field.

## `TerminalStatusBar`

**Derived from:** `grok-status.tsx` · **Grok CLI v0.2.93**

Checked: branch then working directory on the left; on the right, each segment independently
optional and in this order — connection progress `⠴ MCP ({n}/{total})` shown only when a total is
given, context usage `{used} / {limit}`, then a `│` separator and turn progress `{turn}/{turnTotal} ✓`.
An `sr-only` `"steps complete"` pairs with the `aria-hidden` checkmark. Container carries
`role="status"` and an accessible name.

**Diverges:** upstream's vendor defaults (`"main"`, `"~/dev/brainless"`, `"16K"`, `"500K"`) are not
copied and no vendor vocabulary appears in a public type. Prop names mirror
`@elabs-ai/components-ai`'s `SessionStatusBar` so a consumer swapping the chat skin for the console
skin renames nothing. The disconnected state is recoverable in greyscale and by a screen reader —
glyph plus words, never colour alone.

## `TerminalTodoList`

**Derived from:** `claude-todo-list.tsx` · **Claude Code v2.1.207**

Checked: three mutually exclusive states with one glyph each — `done` `✔`, `active` `◼`, `todo`
`◻`; an `sr-only` state word appended per row (`"(completed)"`, `"(in progress)"`, `"(pending)"`);
semantic `<ol>`/`<li>`; glyphs `aria-hidden` so the state is announced once, from the `sr-only`
span, not twice. Treatments: done struck through and dimmed, active bold, todo default ink.

**Diverges:** upstream prefixes the first item `"  ⎿ "` and later items with four spaces. That is
character-width alignment; the gutter track does the same job. The reading is reproduced, the
padding is not. The state word rides `TerminalRow`'s `gutterLabel` rather than a second hand-rolled
`sr-only` span, so the family keeps one convention.

## `TerminalEventLine`

**Derived from:** `grok-event.tsx` · Grok CLI — **the upstream file names no version** (re-checked against upstream 2026-09-02)

Checked: marker glyph `◆`, `aria-hidden`; hook counts rendered `[hooks: 3]` when only a total is
known and `[hooks: 3/1]` for total over succeeded. Captured lines quoted upstream:
`◆ Thought for 0.2s`, `◆ user_prompt_submit [hooks: 3/1]`, `◆ stop [hooks: 3/1]`, `◆ List . [hooks: 3]`.
Upstream props: `label` (required), `hooks`, `hooksOk`, `elapsed`.

**Diverges:** the models are the promoted `AgentEventPhase` / `AgentEventOutcome` /
`agentEventOutcomeStatus` and `CheckResult` in `@elabs-ai/components-ui`, shared with the chat-skin
`AgentEvent` rather than duplicated. A mixed outcome such as `3/1` reads as bad without colour.

## `TerminalTranscriptRow`

**Derived from:** the transcript grammar common to all three upstream families.

Checked: `⏺` as the agent status marker, `⎿` as the result and continuation branch marker.

**Diverges:** an `error` kind is a settled-failure rung with `role="alert"`, a distinct glyph and a
leading text label — errors never fire while streaming, and a half-arrived line is not an error.

## `TerminalToolCall`

**Derived from:** `claude-tool-call.tsx` · Claude Code — **the upstream file names no version** (re-checked against upstream 2026-09-02)

Checked: tool name plus optional argument in parentheses, a result summary on a continuation line,
then expandable detail. Glyphs `⏺` for status and `⎿` for the result branch. Status vocabulary
`success` / `error` / `pending`. Expand hint `"(ctrl+o to expand)"`, hidden once open.

**Diverges:** Radix `Collapsible` replaces the native `<details>`; the three statuses read from the
token group instead of the three hardcoded hex values.

Two further divergences, recorded because they change what the component MEANS rather than only
how it is built:

- **One glyph recoloured three ways becomes three glyphs.** Upstream keeps a single `⏺` bullet for
  every status and distinguishes them purely by hue (`#4ea96f` / `#f7768e` / `#e0af68`) — colour as
  the only channel, the WCAG 1.4.1 failure this family exists to avoid. Here `⏺` stays for
  `success`, `error` takes `✗` (the same mark `TerminalTranscriptRow` uses, so the family reads
  consistently) and `pending` takes `○`. Colour rides along as a redundant cue, and each status
  also announces its own word.
- **The expand trigger keeps its accessible name while open.** Upstream hides the
  `"(ctrl+o to expand)"` hint once the section is revealed, which is fine for a one-shot TTY
  redraw. A Radix `Collapsible` trigger is bidirectional and must stay focusable and named so a
  keyboard user can close what they opened; `aria-expanded` carries the open state instead of the
  label disappearing.

## `TerminalDiffHunk`

**Derived from:** `claude-diff.tsx` · Claude Code — **names no version** — plus `grok-write.tsx` · **Grok CLI v0.2.93** (re-checked against upstream 2026-09-02)

Checked: line types `add` / `del` / `ctx` with markers `+`, `-` and a **space** for context; line
numbers right-aligned in a fixed nine-character column; `sr-only` polarity prefixes verbatim
`"added: "` and `"removed: "`, with none on context lines. Header: `⏺`, the word `Update`, then the
file in parentheses; an optional summary on a second line prefixed `⎿`. From the write preview: a
`┃` gutter with line-numbered before and after rows, a `───` rule, then optional check sections;
pass and fail glyphs `✓` (U+2713) and `✗` (U+2717); durations rendered ` (42ms)`; each result is a
glyph, a label, an optional duration and an optional detail line.

**Diverges:** the polarity labels come from the promoted `diffLineAccessibleLabel()`, shared with
`ChangeReview`; the fixed number column and the `┃`/`───` rules are grid tracks and real borders.

## `TerminalPermission`

**Derived from:** `claude-permission.tsx` · Claude Code — **the upstream file names no version** (re-checked against upstream 2026-09-02)

Checked: anatomy order title, command preview, question, then numbered options, with no footer.
Default title `"Bash command"`, default question `"Do you want to proceed?"`. The three scoped
option labels verbatim: `"Yes"`, `"Yes, and don't ask again this session"`, and a third that
declines and redirects the agent. Active-option glyph `❯`. Upstream is a real `radiogroup` with
`aria-checked` and roving `tabIndex`.

**Diverges:** the scope vocabulary is the promoted, vendor-free `ApprovalScope`
(`once` / `session` / `always` / `deny`), so the third label loses the vendor name. Roving focus
comes from Radix `RadioGroup` — upstream moves focus by walking the parent container's children,
which is the named anti-pattern this family exists to improve on.

Three further divergences, recorded because each one is a decision a reader could otherwise mistake
for an oversight:

- **The default preset ships three options, not four.** The promoted `ApprovalScope` model carries
  four rungs (`once` / `session` / `always` / `deny`) because `@elabs-ai/components-ai`'s
  `ApprovalCard` needs the standing-permission rung. The console preset offers `once` / `session` /
  `deny`, matching the captured three-option prompt; `always` stays reachable by passing your own
  `options`. The model is shared, the default is not.
- **A key hint sits BESIDE the option's label, never inside it.** Nesting the `Kbd` inside the
  `Label` folds the key glyph into the radio's accessible name, so the option announces as
  "Yes, and don't ask again this session 2" — the shortcut leaks into the name of the choice.
  It is a sibling instead, and the same pattern is already used in `permission-mode-select.tsx`.
- **The deny-reason field carries an explicit app ink.** It is a `Textarea` with its own opaque
  `bg-background`, so it is an app box inside the console rather than a patch of console ground,
  and it must not inherit `text-terminal-foreground`. Axe measured 1.2:1 before the override. The
  general form of this is in `.claude/rules/terminal-components.md` § "Colour comes from the
  terminal token group".

## `TerminalComposer`

**Derived from:** `claude-prompt.tsx`, `codex-prompt.tsx` and `grok-prompt.tsx` — **none of the three names a version** (re-checked against upstream 2026-09-02)

Checked: the text well with the mode indicator and its key hint below it; an effort chip whose
glyph **fills** as the level rises rather than changing hue; a shortcut-hint row that gains a
cancel hint only while busy; the submit affordance replaced by a stop affordance for the same
period. Upstream draws a block caret by hand and punches the mode legend into the bottom border.

**Diverges:**

- **The native caret, not a drawn one.** A hand-drawn block caret has to fight the real one, and
  it cannot follow IME composition, selection or RTL. The `--terminal-cursor` token colours the
  native caret instead (the fidelity table's "Caret" row).
- **No vendor mode or effort vocabulary in any public type.** `modes` and `effortLevels` are
  entirely caller-supplied `OperatingMode` / `EffortLevel` values from
  `@elabs-ai/components-ui`. Upstream ships `auto` / `accept-edits` / `plan` as a union; that
  union is a product's vocabulary, and #117 makes shipping it a review failure.
- **The effort scale's fill is the load-bearing channel, not its colour.** Upstream's chip
  changes hue as effort rises. Here the glyph fills — an ordinal cue that survives greyscale —
  and the level is also a word, so a screen reader gets it too.
- **Mode and effort props are named for what they set** (`mode` / `onModeChange`, `effort` /
  `onEffortChange`) rather than the chat skin's bare `value` / `onValueChange`. Not a stylistic
  choice: this component already has a text `value`, and a second bare `value` would collide with
  it. Recorded here because a later reader comparing the two skins will notice the asymmetry and
  should find the reason rather than "fix" it.
- **The mode trigger's accessible name is set explicitly.** Its visible label sits next to a
  `Kbd` shortcut, and without an `aria-label` the two concatenate — the control announced as
  "Auto ⇧Tab", with the shortcut folded into the name of the mode. The label and the `Kbd` are
  `aria-hidden` and the name is authored. This is the same failure shape as `TerminalPermission`'s
  key hints, found independently, in two components, by two different agents: a `Kbd` beside a
  control's own text is a standing hazard to that control's accessible name, not a one-off.

## `TerminalOverlay`

**Derived from:** `grok-shortcuts.tsx` — **names no version** — and the same frame under `grok-settings.tsx` · **Grok CLI v0.2.93** (re-checked against upstream 2026-09-02)

Checked: a titled panel drawn over the transcript, a body of arbitrary rows, and a footer legend of
key hints along the bottom edge. Upstream is not a modal at all — a TTY has no z-axis, so the panel
is a **full-screen redraw**: the transcript is painted over, and the only way out is the key the
legend names.

**Diverges** — and this one is a genuine capability difference, not a re-dress:

- **A real Radix `Dialog`, so the transcript is still there underneath.** Focus moves into the
  panel on open, is trapped while it is up, returns to the trigger on close, and Escape dismisses —
  none of which a redraw can offer. The footer legend survives as an affordance, but it is now a
  hint rather than the sole exit.
- **The base dialog's own close icon is hidden and re-drawn.** `DialogContent` ships a close
  control inked for `--card`/`--background`; on the console ground that is the wrong ink, so it is
  hidden and replaced with one from the `--terminal-*` group. **Consequence worth recording:** the
  hide is a CSS `display:none`, and every package in this repo runs Vitest with `css: false`, so no
  unit test in this package can see it. "Exactly one accessible close control" is therefore a claim
  the real-browser pass owns; the unit test can only assert the class is applied. A component that
  hides something with CSS has moved a claim out of jsdom's reach, and should say so rather than
  imply the unit suite covers it.
- **A hosted `ui` component keeps its own ground.** `KeyboardShortcuts` is calibrated for the app
  surface, so the story wraps it in a `bg-card text-card-foreground` island inside the overlay
  rather than letting it inherit the console ink — the nested-app-box case in
  `.claude/rules/terminal-components.md` § "Colour comes from the terminal token group".

## `TerminalSlashMenu`

**Ground truth for this unit (no independently-verified upstream capture)** — like
`TerminalComposer` (T11), this unit shipped with no named upstream CLI + version to
check a live capture against. The grammar it reproduces is stated in the work order,
not read off a captured frame: typing `/` at the start of a line opens a filtered
listbox of app-defined commands; arrow keys move the highlight, wrapping at both ends
and clamping into a narrowed list; Enter splices the chosen command into the text;
Escape dismisses without selecting. This is the same trigger-driven-palette grammar
`MentionInput` (`@`) and `PromptInputSlash` (`/`, `@elabs-ai/components-ai`) already
ship in this repo — the closest thing this unit has to a reference surface is those
two siblings, not an external CLI.

**Checked (against the two in-repo siblings, not an external capture):** `/` opens
only at the start of a line (`findTriggerQuery(..., { boundary: "line-start" })`) —
`cd /usr` does not open it; prefix-only, case-insensitive filtering
(`defaultSlashCommandFilter`); arrow-key wrap at both ends and clamp into a shrinking
list (`stepIndex`); Enter splices `"/" + name + " "` and closes; Escape closes and
returns focus to the field, changing nothing; the field's caret never leaves the
textarea in any state; `role="listbox"`/`role="option"`/`aria-selected"`/
`aria-activedescendant"`/`aria-controls"` wired throughout, matching the ai-package
sibling's contract; a real empty state as a sibling (never a child) of the listbox.

**Diverges:**

- **Not a compound component, unlike `PromptInputSlash`.** `TerminalComposer` (T11)
  is a single, already-landed component that owns its whole card and forwards only
  one ref (to its root `TerminalSurface` div) — restructuring it into a Root +
  Textarea compound pair was out of scope for this unit. `TerminalSlashMenu`
  therefore renders the WHOLE `TerminalComposer` internally and layers the popover
  around it via a **virtual anchor** (`PopoverAnchor virtualRef={textareaRef}`,
  which renders no DOM node), using the one additive prop authorised for this unit —
  `TerminalComposerProps.textareaRef`.
- **`onValueChange`, not `onChange`, carries BOTH typing and selection.**
  `PromptInputSlash` already makes this same trade for the same reason (selecting a
  command has to splice text programmatically, with no real keystroke behind it) —
  but its compound `Textarea` sub-part lets ordinary typing bypass the root and use
  native `onChange` directly. `TerminalComposer` is monolithic, so this wrapper has
  no sub-part for typing to bypass through: both typing and selection funnel through
  the one `onValueChange` channel here, which `PromptInputSlash` does not need to do.
- **Arrow/Enter/Escape interception is a raw, capture-phase `addEventListener`, not
  a React `onKeyDown` prop — because `TerminalComposer` exposes none for its
  internal textarea.** `stopPropagation()` (not only `preventDefault()`) is
  necessary here specifically because `TerminalComposer`'s own `onKeyDown` does not
  check `event.defaultPrevented` before calling `commitSubmit()`/`onStop()` — a
  sibling React handler alone would not stop it. `PromptInputSlash`, being
  compound, does not need this: it owns the textarea's own props directly.
- **The combobox ARIA quintet is written with `setAttribute`/`removeAttribute` in a
  `useLayoutEffect`**, for the identical "no prop seam" reason as the keyboard
  interception above — never `querySelector`, which the work order explicitly
  forbade (the T11 `textareaRef` prop exists precisely so this wrapper never needs
  one).
- **Colour is repainted onto the terminal ground, like `TerminalOverlay`, not left
  as the ordinary popover tokens `TerminalComposer`'s own mode menu uses.** The list
  is registered-command CONTENT (console output), not app chrome — unlike picking
  an operating mode, which stays chrome even though it also renders in a popover.
- **A real, measured contrast bug this package's own colour rule warned about, and
  a unit test could not catch.** The first real-browser pass (`test-storybook`,
  Chromium + axe) failed `color-contrast`: the active row's description text
  (`text-terminal-muted`) measured **3.61:1** against `bg-terminal-selection`
  (needs 4.5:1). `--terminal-muted` is authored against `--terminal-background`;
  `--terminal-selection`'s own comment in `themes.css` only guarantees AA for
  `--terminal-foreground` (9.80:1) and `--terminal-ansi-white` (6.09:1) — muted ink
  was never covered by that guarantee. Fix: the active row's description upgrades to
  `text-terminal-foreground`; resting rows keep `text-terminal-muted`. jsdom computed
  no contrast at all, so every unit test passed straight over this — exactly the
  failure mode `.claude/rules/terminal-components.md` names for this package.
- **The active row's second, non-colour channel is a reserved-width `❯` marker**,
  mirroring `TerminalPermission`'s already-reviewed `ACTIVE_OPTION_GLYPH` pattern —
  genuine presence/absence in a fixed-width slot, `aria-hidden` since
  `aria-selected` already carries the meaning to assistive tech.
- **Home/End and Tab-to-select — both present in `PromptInputSlash` — are
  deliberately NOT added here.** The work order scoped exactly the arrow/Enter/
  Escape set; the promoted `SlashCommand` vocabulary also carries no `disabled`
  state for this component to invent handling for.
