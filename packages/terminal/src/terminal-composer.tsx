"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Kbd,
  RadioGroup,
  RadioGroupItem,
  Textarea,
  effortRungForIndex,
  useLocale,
  type EffortLevel,
  type OperatingMode,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { CornerDownLeftIcon, SquareIcon } from "lucide-react";
import type { ChangeEventHandler, HTMLAttributes, KeyboardEventHandler, Ref } from "react";
import { forwardRef, useState } from "react";
import { TerminalSurface, type TerminalVariant } from "./terminal-surface";

/**
 * TerminalComposer — the console skin of the agent-session family's prompt
 * composer (#117, work unit T11).
 *
 * The person types their next instruction and can see, without looking
 * anything up, what mode the agent is in, how hard it will think, and which
 * keys do what right now. Anatomy: a text input well, an optional mode
 * indicator, an optional effort indicator, a shortcut-hint row, and a submit
 * affordance that follows ADR 0022's merged primary-action contract: it
 * becomes a Stop affordance only while `busy`, the well is empty, AND this
 * composer was handed `onStop` (i.e. it is the one meant to own
 * cancellation); typing a mid-turn follow-up always restores Send, and a
 * `busy` composer with no `onStop` never shows Stop at all (#128).
 *
 * ## Ground truth for this unit (no independently-verified upstream capture)
 *
 * Unlike T2-T10 in this package, this unit shipped with no named upstream
 * CLI + version to check a live capture against — so, unlike
 * `packages/terminal/references/agent-session-family.md`'s other sections,
 * nothing here claims a specific vendor source. The grammar it DOES
 * reproduce, stated in the work order: the mode indicator is a glyph plus a
 * label plus a key hint; the effort indicator is an ORDERED scale whose
 * glyph fills as the level rises (an ordinal, non-colour channel); the
 * shortcut-hint row gains a cancel hint only while this composer can
 * genuinely cancel the turn (`busy` and `onStop` both given), and loses it
 * the moment either stops holding. One noted upstream mechanic — punching the
 * mode legend into the input well's own bottom border via a
 * `<fieldset>`/`<legend>`-style
 * overlap — is deliberately NOT reproduced pixel-for-pixel: this family's
 * fidelity axis reproduces the *grammar*, not fragile positioning tricks,
 * and `TerminalBanner` already rejected a real `<fieldset>`/`<legend>` for
 * the same reason (misreports a decorative grouping as a form to assistive
 * tech). The mode indicator instead sits as an ordinary toolbar segment
 * directly below the well, separated by a plain `border-t`.
 *
 * ## No vendor union, ever (#117 acceptance criterion)
 *
 * `modes`/`effortLevels` are entirely app-supplied — `OperatingMode` and
 * `EffortLevel` (`@elabs-ai/components-ui`, promoted by work unit T0) carry
 * no vendor vocabulary. `busy` is a plain boolean, never a `status` union
 * shaped after a specific vendor/SDK's turn lifecycle (D5 — this is a
 * presentation layer, not a runtime).
 *
 * ## Reuse — promoted models, not reused mechanics
 *
 * `OperatingMode`/`EffortLevel`/`effortRungForIndex` are the SAME promoted
 * vocabulary `@elabs-ai/components-ai`'s `PromptInputMode`/`PromptInputEffort`
 * render — `@elabs-ai/components-terminal` and `@elabs-ai/components-ai` are
 * layer-2 DAG siblings and may not import each other
 * (`.claude/rules/terminal-components.md` § Reuse means promotion), so this
 * renders its OWN Radix-based mode menu and effort scale rather than
 * importing those two components. Three deliberate differences from them,
 * each with a reason:
 *
 * - **Plain `useState`, not `@radix-ui/react-use-controllable-state`.** The
 *   ai-package siblings use that hook; `@elabs-ai/components-terminal`
 *   does not declare it as a dependency, and this unit's ownership does not
 *   extend to `package.json`. Controlled/uncontrolled mirrors the platform
 *   the same way `TerminalPermission` already does in this package.
 * - **Terminal tokens recolour both controls.** The effort scale's filled
 *   rung is `border-terminal-accent`/`bg-terminal-accent`, not
 *   `border-primary`/`bg-primary` — `.claude/rules/terminal-components.md`
 *   § "Colour comes from the terminal token group, and nowhere else". The
 *   `!` (important) modifier on the filled border is load-bearing: the
 *   shared `RadioGroupItem` primitive itself ships
 *   `data-[state=checked]:border-primary`, which would otherwise win the
 *   cascade tie against a same-specificity override and repaint exactly the
 *   CURRENT rung's border back to the page's `--primary`. One residual,
 *   accepted limitation inherited from that same shared primitive: its
 *   built-in checked indicator is a small `fill-primary` dot with no
 *   `className` seam to recolour — `PromptInputEffort` (the reused ai-package
 *   sibling) carries the identical dot today, so this is not a new
 *   regression, only one this unit cannot fix from its own file.
 * - **The mode menu's floating content keeps the ordinary popover tokens.**
 *   A `DropdownMenuContent` renders through a portal, detached from the
 *   console ground it opens from — the same choice `PromptInputMode`
 *   (the sibling this mirrors) already makes for its own menu. The
 *   token-group rule is about console CONTENT (rows, ink); a transient
 *   overlay is chrome, not console output.
 *
 * ## The three things this unit owns (per the work order)
 *
 * 1. **`aria-disabled`, never native `disabled`, for "nothing to submit".**
 *    Exactly `PromptInputSubmit`'s contract (`@elabs-ai/components-ai`): a
 *    focused control that goes natively `disabled` is dropped from the tab
 *    order by the HTML focus-fixup rule, stranding keyboard/screen-reader
 *    users right after a send. The Stop affordance (while `busy`) is never
 *    auto-disabled, matching that same contract.
 * 2. **No blocked paste, native caret.** No `onPaste` handler exists here at
 *    all; the caret is the browser's own, tinted via `caret-terminal-cursor`
 *    per the fidelity axis's "Caret" row — never a hand-drawn block glyph.
 * 3. **The effort level is recoverable without colour AND as words.** The
 *    fill/hollow shape plus the growing-square ramp survive greyscale
 *    (`data-filled` is a structural attribute, not a colour class); each
 *    rung also carries `aria-label={level.label}` and the CURRENT level's
 *    name renders as real, visible text beside the scale — so the level
 *    reaches assistive tech as words, not only as a filled shape.
 */

/** One shortcut-row entry: the physical key(s) plus what they do. */
export interface TerminalComposerShortcut {
  /** Rendered inside a `Kbd` chip, e.g. `"Enter"`, `"Shift+Enter"`. */
  keys: string;
  /** What the key does, in a word or two. */
  label: string;
}

export interface TerminalComposerProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "onSubmit"
> {
  /**
   * Composer text. Mirrors the native platform (`value`/`defaultValue`/
   * `onChange`) rather than a custom `onValueChange` — this IS a text
   * input. Omit `value` for the uncontrolled default (`defaultValue ?? ""`).
   */
  value?: string;
  defaultValue?: string;
  onChange?: ChangeEventHandler<HTMLTextAreaElement>;
  /**
   * Fires on Enter (no Shift, not composing) or the submit affordance, with
   * the current text. Fires whenever there is non-whitespace text — INCLUDING
   * while `busy` (ADR 0022 case 3, #128): a mid-turn follow-up can always be
   * composed and submitted, exactly like `PromptInputTextarea`'s own
   * contract. brand-ui asserts nothing about what a mid-turn submit MEANS
   * (queued, interleaved, or something else) — that is the app's own
   * `onSubmit`/runtime (D5). The caller decides whether/how to clear
   * `value`; uncontrolled, the composer clears itself.
   */
  onSubmit?: (value: string) => void;
  /** @default the localized "Type your next instruction…" */
  placeholder?: string;
  /**
   * True while the agent is actively working on a previous turn. The submit
   * affordance becomes Stop ONLY when the well is also empty AND `onStop` is
   * given — i.e. this composer is the one meant to own cancellation (ADR
   * 0022's four-case contract, #128). A non-empty well always shows Send, so
   * a mid-turn follow-up can still be typed and submitted; `busy` with no
   * `onStop` never shows Stop at all (some other control, e.g.
   * `TerminalWorking`, owns cancellation instead). Enter-to-submit is never
   * disabled by `busy` alone.
   */
  busy?: boolean;
  /**
   * Fires when the person activates the Stop affordance, or presses Escape,
   * while `busy`. Passing this prop is also what tells the composer it OWNS
   * cancellation — omit it when another control (e.g. `TerminalWorking`) is
   * the dedicated Stop, so the two don't both render a control named "Stop"
   * for the same action (#128).
   */
  onStop?: () => void;
  /** App-defined operating modes (#117 — no vendor union here). Omitted, no mode indicator renders. */
  modes?: OperatingMode[];
  mode?: string;
  defaultMode?: string;
  onModeChange?: (id: string) => void;
  /** App-defined reasoning-effort scale, ordered low to high. Omitted, no effort indicator renders. */
  effortLevels?: EffortLevel[];
  effort?: string;
  defaultEffort?: string;
  onEffortChange?: (id: string) => void;
  /** Accessible name for the effort scale. @default the localized "Effort" */
  effortLabel?: string;
  /**
   * The hints shown at rest, e.g. `[{ keys: "Enter", label: "send" }]`.
   * @default a localized Enter-to-send / Shift+Enter-for-newline pair.
   * The cancel hint is added automatically while this composer can actually
   * cancel the turn (`busy` AND `onStop` — see `busy`) — do not include it
   * here; override it with `cancelShortcut` instead.
   */
  shortcuts?: TerminalComposerShortcut[];
  /**
   * Overrides the cancel hint shown while this composer owns cancellation
   * (`busy` AND `onStop`, see `busy`). @default the localized "Esc" / "cancel" pair.
   */
  cancelShortcut?: TerminalComposerShortcut;
  /** Gutter grammar forwarded to the internal `TerminalSurface`. */
  variant?: TerminalVariant;
  /**
   * Ref to the underlying `<textarea>` DOM node. The `ref` this component
   * already forwards reaches the root `TerminalSurface` div, not the field
   * itself — a caller that needs caret math on every keystroke (a
   * slash-command palette, an `@`-mention overlay) reaches for this instead.
   * Additive and optional: every existing caller is unaffected. See
   * `TerminalSlashMenu` (#117 T12) for the reference consumer.
   */
  textareaRef?: Ref<HTMLTextAreaElement>;
}

/** The mode indicator: a Radix menu whose trigger shows the current mode's glyph + label + key hint. */
function TerminalComposerMode({
  modes,
  selected,
  onSelect,
}: {
  modes: OperatingMode[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const current = modes.find((mode) => mode.id === selected) ?? modes[0];

  const handleChange = (next: string) => {
    // Radix would otherwise allow an empty-string commit if a caller wires a
    // deselectable radio group elsewhere — a mode picker always has an
    // active mode (mirrors PromptInputMode).
    if (!next) return;
    onSelect(next);
  };

  return (
    <DropdownMenu modal={false}>
      {/*
       * `modal={false}` is load-bearing, not a preference — matches
       * PromptInputMode exactly. Radix's modal dropdown marks the rest of
       * the document `aria-hidden` while open, including this trigger,
       * which axe flags as `aria-hidden-focus`.
       */}
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-slot="terminal-composer-mode-trigger"
          // Overrides the accessible name to just the mode label — otherwise
          // it would also swallow the `Kbd` key-hint text, so an AT user
          // hears "Auto ⇧Tab" instead of "Auto" (matches PromptInputMode).
          aria-label={current?.label}
          className="h-auto gap-1.5 rounded-full px-2 py-1 text-terminal-foreground hover:bg-terminal-selection hover:text-terminal-foreground"
        >
          {current?.icon}
          <span aria-hidden="true">{current?.label}</span>
          {current?.keyHint !== undefined ? (
            <Kbd className="ms-0.5" aria-hidden="true">
              {current.keyHint}
            </Kbd>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        data-slot="terminal-composer-mode-content"
        className="w-72"
      >
        <DropdownMenuRadioGroup value={selected} onValueChange={handleChange}>
          {modes.map((mode) => (
            <DropdownMenuRadioItem
              key={mode.id}
              value={mode.id}
              data-slot="terminal-composer-mode-item"
              className="gap-2"
            >
              {mode.icon}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body">{mode.label}</span>
                {mode.description === undefined ? null : (
                  <span className="truncate text-meta text-muted-foreground">
                    {mode.description}
                  </span>
                )}
              </span>
              {mode.keyHint === undefined ? null : <Kbd className="shrink-0">{mode.keyHint}</Kbd>}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The effort indicator: same-shape squares that GROW in size, low to high,
 * filling up to and including the current level. The size ramp and the
 * solid/hollow fill are both non-colour channels — the level is recoverable
 * in greyscale — and the current level's name renders as real text besides
 * each rung's own `aria-label`, so it reaches assistive tech as words too.
 */
function TerminalComposerEffort({
  levels,
  selected,
  onSelect,
  ariaLabel,
}: {
  levels: EffortLevel[];
  selected: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
}) {
  const currentIndex = levels.findIndex((level) => level.id === selected);
  const current = currentIndex >= 0 ? levels[currentIndex] : levels[0];

  const handleChange = (next: string) => {
    if (!next) return;
    onSelect(next);
  };

  return (
    <div data-slot="terminal-composer-effort" className="inline-flex items-center gap-2">
      <RadioGroup
        value={selected}
        onValueChange={handleChange}
        orientation="horizontal"
        aria-label={ariaLabel}
        data-slot="terminal-composer-effort-scale"
        className="flex items-end gap-1"
      >
        {levels.map((level, index) => {
          const filled = currentIndex >= 0 && index <= currentIndex;
          return (
            <RadioGroupItem
              key={level.id}
              value={level.id}
              aria-label={level.label}
              data-slot="terminal-composer-effort-item"
              data-filled={filled ? "true" : "false"}
              className={cn(
                effortRungForIndex(index, levels.length),
                "rounded-sm border-2",
                // `!` defeats the shared RadioGroupItem's own
                // `data-[state=checked]:border-primary` — see the module
                // doc's "Reuse — promoted models, not reused mechanics".
                filled
                  ? "border-terminal-accent! bg-terminal-accent"
                  : "border-terminal-border! bg-transparent",
              )}
            />
          );
        })}
      </RadioGroup>
      <span className="text-terminal-foreground" data-slot="terminal-composer-effort-label">
        {current?.label}
      </span>
    </div>
  );
}

export const TerminalComposer = forwardRef<HTMLDivElement, TerminalComposerProps>(
  function TerminalComposer(
    {
      value,
      defaultValue,
      onChange,
      onSubmit,
      placeholder,
      busy = false,
      onStop,
      modes,
      mode,
      defaultMode,
      onModeChange,
      effortLevels,
      effort,
      defaultEffort,
      onEffortChange,
      effortLabel,
      shortcuts,
      cancelShortcut,
      variant,
      textareaRef,
      className,
      ...props
    },
    ref,
  ) {
    const { t } = useLocale();
    const [isComposing, setIsComposing] = useState(false);

    // Text — mirrors the native platform, never flips modes.
    const isControlled = value !== undefined;
    const [uncontrolledText, setUncontrolledText] = useState(defaultValue ?? "");
    const textValue = isControlled ? (value ?? "") : uncontrolledText;

    // Mode / effort — plain useState-based controlled/uncontrolled, same
    // shape TerminalPermission already uses in this package (see the module
    // doc for why `useControllableState` is not reached for here).
    const hasModes = modes !== undefined && modes.length > 0;
    const [uncontrolledMode, setUncontrolledMode] = useState(
      () => mode ?? defaultMode ?? modes?.[0]?.id ?? "",
    );
    const selectedMode = mode ?? uncontrolledMode;
    const handleModeSelect = (id: string) => {
      setUncontrolledMode(id);
      onModeChange?.(id);
    };

    const hasEffort = effortLevels !== undefined && effortLevels.length > 0;
    const [uncontrolledEffort, setUncontrolledEffort] = useState(
      () => effort ?? defaultEffort ?? effortLevels?.[0]?.id ?? "",
    );
    const selectedEffort = effort ?? uncontrolledEffort;
    const handleEffortSelect = (id: string) => {
      setUncontrolledEffort(id);
      onEffortChange?.(id);
    };

    // Mirrors PromptInputSubmit's four-case primary-action contract (ADR 0022 /
    // #128), substituting composition for the chat family's context lookup:
    // `Boolean(onStop)` plays the role of "this control owns cancellation"
    // where the chat side reads `!hasDedicatedStop` off a mounted
    // PromptInputStop. `canCancel` is the ONE derived value the button, the
    // Escape path and the shortcut-hint row all read — do not let them drift
    // back into three different conditions.
    //   1. not busy                              → Send (unchanged)
    //   2. busy + empty + this control owns Stop  → Stop
    //   3. busy + non-empty                       → Send (the fix — a
    //      mid-turn follow-up can always be composed and submitted)
    //   4. busy + no onStop (someone else, e.g. TerminalWorking, owns
    //      cancellation) → Send, always
    const canSubmit = textValue.trim().length > 0;
    const canCancel = busy && Boolean(onStop);
    const action: "send" | "stop" = canCancel && !canSubmit ? "stop" : "send";

    const commitSubmit = () => {
      if (!canSubmit) return;
      onSubmit?.(textValue);
      if (!isControlled) setUncontrolledText("");
    };

    const handleTextChange: ChangeEventHandler<HTMLTextAreaElement> = (event) => {
      if (!isControlled) setUncontrolledText(event.target.value);
      onChange?.(event);
    };

    const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !isComposing &&
        !event.nativeEvent.isComposing
      ) {
        // Always prevented, even when blocked — mirrors PromptInputTextarea:
        // a blocked Enter is swallowed, never falls through to a newline.
        event.preventDefault();
        commitSubmit();
        return;
      }
      if (event.key === "Escape" && canCancel) {
        event.preventDefault();
        onStop?.();
      }
    };

    const handleActionClick = () => {
      if (action === "stop") {
        onStop?.();
        return;
      }
      commitSubmit();
    };

    const defaultShortcuts: TerminalComposerShortcut[] = [
      { keys: "Enter", label: t("terminal.composer.shortcutSend") },
      { keys: "Shift+Enter", label: t("terminal.composer.shortcutNewline") },
    ];
    const restShortcuts = shortcuts ?? defaultShortcuts;
    // Gated on the SAME `canCancel` the Escape handler reads (#128) — a
    // composer with no `onStop` can never cancel, so it must never advertise
    // an "Esc" hint it cannot honour.
    const allShortcuts = canCancel
      ? [
          ...restShortcuts,
          cancelShortcut ?? { keys: "Esc", label: t("terminal.composer.shortcutCancel") },
        ]
      : restShortcuts;

    return (
      <TerminalSurface
        ref={ref}
        variant={variant}
        data-slot="terminal-composer"
        data-busy={busy || undefined}
        className={cn("gap-0 overflow-hidden p-0 focus-ring-within", className)}
        {...props}
      >
        <div data-slot="terminal-composer-well" className="p-3">
          <Textarea
            ref={textareaRef}
            data-slot="terminal-composer-textarea"
            value={textValue}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder={placeholder ?? t("terminal.composer.placeholder")}
            className="field-sizing-content max-h-48 min-h-10 resize-none border-0 bg-transparent p-0 text-code text-terminal-foreground shadow-none caret-terminal-cursor placeholder:text-terminal-muted focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>

        {hasModes || hasEffort ? (
          <div
            data-slot="terminal-composer-controls"
            className="flex flex-wrap items-center gap-3 border-t border-terminal-border px-3 py-2"
          >
            {hasModes && modes ? (
              <TerminalComposerMode
                modes={modes}
                selected={selectedMode}
                onSelect={handleModeSelect}
              />
            ) : null}
            {hasEffort && effortLevels ? (
              <TerminalComposerEffort
                levels={effortLevels}
                selected={selectedEffort}
                onSelect={handleEffortSelect}
                ariaLabel={effortLabel ?? t("terminal.composer.effort")}
              />
            ) : null}
          </div>
        ) : null}

        <div
          data-slot="terminal-composer-footer"
          className="flex items-center justify-between gap-3 border-t border-terminal-border px-3 py-2"
        >
          <div
            data-slot="terminal-composer-shortcuts"
            className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-meta text-terminal-muted"
          >
            {allShortcuts.map((shortcut, index) => (
              <span
                key={`${shortcut.keys}-${index}`}
                className="inline-flex shrink-0 items-center gap-1"
                data-slot="terminal-composer-shortcut"
              >
                <Kbd>{shortcut.keys}</Kbd>
                <span>{shortcut.label}</span>
              </span>
            ))}
          </div>

          <Button
            type="button"
            data-slot="terminal-composer-submit"
            data-action={action}
            aria-label={
              action === "stop" ? t("terminal.composer.stop") : t("terminal.composer.submit")
            }
            // `aria-disabled`, NOT the native `disabled` attribute, for the
            // resting empty-composer state — see the module doc's "The
            // three things this unit owns" #1.
            aria-disabled={action === "send" && !canSubmit ? true : undefined}
            onClick={handleActionClick}
            size="icon-sm"
            className={cn(
              "shrink-0 rounded-full bg-terminal-accent text-terminal-accent-foreground hover:bg-terminal-accent/90",
              action === "send" &&
                !canSubmit &&
                "cursor-not-allowed opacity-50 hover:bg-terminal-accent",
            )}
          >
            {action === "stop" ? (
              <SquareIcon aria-hidden="true" className="size-4" />
            ) : (
              <CornerDownLeftIcon aria-hidden="true" className="size-4" data-rtl-flip />
            )}
          </Button>
        </div>
      </TerminalSurface>
    );
  },
);

TerminalComposer.displayName = "TerminalComposer";
