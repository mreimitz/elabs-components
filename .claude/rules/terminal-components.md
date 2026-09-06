---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. See `.claude/rules/quality-gates.md` "Enforcement over reminders" and
# the `rules:scoping:check` gate (scripts/check-rule-scoping.mjs).
paths:
  - "packages/terminal/**"
---

# Terminal components (`@elabs-ai/components-terminal`)

`Terminal` (ANSI log) and `InteractiveTerminal` (xterm.js) are real terminals; the
agent-session family (#117) is a React + token CLI look-alike rendering an app-supplied
model — never a terminal emulator.

## Console as a SURFACE

`TerminalSurface` sets ground, type role and the two-column grid ONCE and publishes ONE
context value, `variant`; rows are independent `TerminalRow` grids reading it (prop
override; `useTerminalVariant()` → `marker` outside a surface).

- **Nothing else may ever enter that context.** Row expansion = per-row Radix
  `Collapsible` state; elapsed time = caller-supplied `elapsedMs` prop.
- `TerminalRow` = `grid-cols-[var(--terminal-gutter)_minmax(0,1fr)]`; `--terminal-gutter`
  is a LOCAL property set by `TerminalSurface` (not a theme token — never in `themes.css`;
  caller `style` overrides). `minmax(0,1fr)` + `min-w-0` on the content cell are
  load-bearing; no `ch` arithmetic anywhere.
- Variants: `marker` (gutter glyph, default) · `rail` (rule, no glyph) · `boxed` (square
  `border-terminal-border` per block). No vendor name, logo or mode/effort union
  (`type Mode = "auto" | "accept-edits" | "plan"`) in any public type.
- `TerminalRow` hides a bare `gutter` glyph from AT; a glyph carrying MEANING gets
  `gutterLabel` (`sr-only` word, every variant incl. `rail`), locked by a smoke test on
  the announced words, not class strings.
- No scroll container here: the caller virtualizes >~50 rows and owns the viewport.
  Bottom-anchor with `[&>*:first-child]:mt-auto`, never `justify-end`; probe
  `scrollHeight`/`clientHeight` in a real browser. Defaulting it = architect decision.

## ONE frame (`docs/ADR/0033-terminal-console-frame-and-regions.md`)

- **frame** (`TerminalConsole`, or a lone `TerminalSurface`; one per console, never two
  stacked): `rounded-lg border border-terminal-border bg-terminal-background shadow-sm` +
  mono/`text-code`.
- **region** (transcript, banner, permission prompt, composer, status bar): padding +
  content only, no radius/shadow/ground/outer border. `TerminalStatusBar` is region-only.
- **seam**: one `border-t border-terminal-border` owned by the frame (`[&>*+*]:border-t`),
  never a page-background gap.
- Under a frame `TerminalSurface` omits (never negates) its frame classes and adds
  `ring-inset`, via a static one-boolean context — never a prop. `TerminalConsole` holds
  no transcript, timer, scroll container or `variant`.
- More presence = ground, seam or spacing, never a border; a recessed fill is a token
  decision via `brand-ui-design-system-architect`.

## Fidelity: faithful grammar, web-native mechanics

Never box-drawing `╭─╮` text (`boxed` is a real `border`), a hand-drawn caret (native +
`--terminal-cursor`), `<details>`/ANSI redraw (Radix `Collapsible`), index-walk focus
(`parentElement.children[i]`), a full-screen redraw (Radix `Dialog`; choice:
`RadioGroup`) or truncation at the column (wrap/clamp/"show more").

## Reuse = PROMOTION, never sideways

`terminal` (`[tokens, icons, ui]` in `scripts/check-dep-direction.mjs`) and `ai` never
import each other; shared code moves UP to `@elabs-ai/components-ui/src/lib/*`.

- Promoted — never re-declare: `SlashCommand`/`defaultSlashCommandFilter`/`stepIndex`;
  `ApprovalScope`/`ApprovalOption`/`APPROVAL_SCOPE_DESCRIPTION_KEYS`;
  `DiffLine`/`DiffLineType`/`diffLineMarker`/`diffLineAccessibleLabel`;
  `collapseDiffRows`/`useDiffRows`; `OperatingMode`/`EffortLevel`/`effortRungForIndex`;
  `AgentEventPhase`/`AgentEventOutcome`/`agentEventOutcomeStatus`;
  `SessionCapability`/`SessionWhatsNewItem`/`SessionQuickAction`.
- In `ui`, never re-implement: `formatElapsed`, `CheckResult`/`CheckSummary`,
  `findTriggerQuery`/`replaceTriggerRun`, `Status`/`StatusIcon`, `TimelineStatus`,
  `Skeleton`, `EmptyState`, `KeyboardShortcuts`, `Collapsible`, `RadioGroup`, `Dialog`,
  `Kbd`, `Textarea`, `useLocale`, `cn`.
- Promote only if AI-SDK-free, headless (type/function/hook, never a component) and two
  real consumers exist today; never duplicate a model.

## Colour: `--terminal-*` / `--terminal-ansi-*` only

Every theme defines it (`bg-`/`text-`/`border-terminal-*`, `-ansi-*`). No hex,
`rgb()`/`hsl()`, arbitrary colour, raw palette utility or inline `<style>`
(`packages/terminal/src/no-raw-color.test.ts`; sole allowance: `InteractiveTerminal`'s
xterm canvas fallbacks). Which ground is the text on?

- Console ground is NOT a page surface — `text-<tone>-text` fails there; use
  `text-terminal-foreground`/`-muted` or an ANSI ink (≥4.5:1, clamped by `readableInk()`
  in `interactive-terminal.tsx`). A status tone tints only a GLYPH (3:1); the word beside
  it is `text-terminal-foreground` (`terminal-status-bar.tsx`).
- A `ui` box painting its own `bg-background`/`bg-card` inside the console inherits
  console ink: add `text-foreground` beside its `bg-*`, with a comment
  (`terminal-permission.tsx`).
- `bg-terminal-selection` is a third ground where `text-terminal-muted` fails AA (read the
  token's `themes.css` comment): selected-row secondary text → `text-terminal-foreground`,
  resting rows keep `-muted`, never a louder band (`terminal-slash-menu.tsx`).
- jsdom sees none of this: run the browser pass in `light` and `STORYBOOK_THEME=dark`
  (quality-gates § Theme-safe).

Also: `data-slot="terminal-<name>[-<part>]"` on root and every part; a story rendering
every `cva` value (`variants:check`) and every not-ready state (`loading-states:check`);
`motion-reduce:` → static glyph, live-region text carries the state; one `INTENT` entry in
`packages/cli/lib/intent.mjs`; strings via `t()`/`useLocale()` (generic key before
`terminal.*`); one `CHANGELOG.md` `## Unreleased` line per unit.

Not-ready: `loading` / `isStreaming` only; `TerminalSurface` owns the `loading` rung,
skeletons via the real `TerminalRow`; one `role="status" aria-live="polite"` per not-ready
region; errors suppressed while streaming, `role="alert"` for settled failures only.

Provenance: `packages/terminal/references/*.md` — source surface, version, what was
checked, where we diverged.

History and measurements: docs/rules-history/terminal-components.md
