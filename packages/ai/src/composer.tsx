"use client";

import { useCallback, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { ArrowUp, Mic, Paperclip, Sparkles } from "lucide-react";
import { cn, Kbd, useLocale } from "@elabs-ai/components-ui";

import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputProps,
} from "./prompt-input";
import { PromptInputEffort, type PromptInputEffortProps } from "./prompt-input-effort";
import { PromptInputMode, type PromptInputModeProps } from "./prompt-input-mode";
import {
  PromptInputSlash,
  PromptInputSlashTextarea,
  type PromptInputSlashProps,
} from "./prompt-input-slash";
import { Suggestion, Suggestions } from "./suggestion";

/**
 * The slice of `PromptInputModeProps` a `Composer` owns — the vocabulary and
 * the controlled/uncontrolled seam, never the DOM props of the wrapper div.
 *
 * `defaultValue` is deliberately absent: `PromptInputMode` has no uncontrolled
 * initial-value seam (its uncontrolled default is `modes[0]`), and the
 * `defaultValue` it inherits from `HTMLAttributes<HTMLDivElement>` is the DOM
 * attribute, which would type-check and then do nothing. Omit `value` for the
 * uncontrolled default; pass `value` + `onValueChange` to drive it.
 */
export type ComposerModeProps = Pick<
  PromptInputModeProps,
  "modes" | "value" | "onValueChange" | "aria-label"
>;

/**
 * The slice of `PromptInputEffortProps` a `Composer` owns. `aria-label` stays
 * REQUIRED, exactly as on the primitive: the name of the scale ("Reasoning
 * effort", "Thinking budget") is as much the consumer's vocabulary as its
 * levels are, so `Composer` has no default to invent either. `defaultValue` is
 * absent for the same reason it is on `ComposerModeProps`.
 */
export type ComposerEffortProps = Pick<
  PromptInputEffortProps,
  "levels" | "value" | "onValueChange" | "aria-label"
>;

/**
 * One shortcut-hint row entry: the physical key(s) plus what they do, shown
 * as a `Kbd` chip beside a plain-text label — never inside a control's own
 * name (see `ComposerProps.shortcuts`).
 */
export interface ComposerShortcut {
  /** Rendered inside a `Kbd` chip, e.g. `"Enter"`, `"Shift+Enter"`. */
  keys: string;
  /** What the key does, in a word or two, e.g. `"send"`, `"newline"`. */
  label: string;
}

export interface ComposerProps {
  /** Submit handler — receives the assembled message (text + attachments). */
  onSubmit?: PromptInputProps["onSubmit"];
  /** Textarea placeholder. Default `"Ask me anything…"`. */
  placeholder?: string;
  /**
   * Muted status line shown above the input well. Default `"Awaiting your
   * input"`. Drive it from chat state ("Thinking…", "Generating…") or pass
   * `null` to hide the strip entirely.
   */
  status?: ReactNode;
  /**
   * The model control, rendered first in the tools cluster after `attach`.
   * Pass a `<ModelPicker>` from `@elabs-ai/components-ui` (it is sized to sit
   * in a composer footer) — or anything else. Default: nothing renders.
   *
   * This replaces the old `model` prop, which rendered a static, non-interactive
   * pill defaulted to a hard-coded model name. A composer that shows a model
   * name it cannot change is a lie about what the control does; the slot now
   * takes the real picker instead.
   */
  modelPicker?: ReactNode;
  /**
   * App-defined operating mode control — renders a `PromptInputMode` in the
   * tools cluster. Omitted, nothing renders. `brand-ui` ships no mode
   * vocabulary: `modes` is entirely yours.
   */
  mode?: ComposerModeProps;
  /**
   * Ordered reasoning-effort control — renders a `PromptInputEffort` in the
   * tools cluster. Omitted, nothing renders. `levels` is ordered low → high
   * and is entirely yours; `aria-label` names the scale.
   */
  effort?: ComposerEffortProps;
  /**
   * Slash-command palette. When set (and non-empty) the textarea becomes a
   * `PromptInputSlashTextarea` wrapped in a `PromptInputSlash`, so typing `/`
   * at the start of a line opens a filtered command list — nothing else about
   * the composer changes.
   *
   * Note this makes the textarea REACT-CONTROLLED (the palette needs to read
   * and splice the text), which is why `Composer` clears its own copy of the
   * text on submit: `PromptInput`'s `form.reset()` reaches the DOM node, not
   * React state.
   */
  slashCommands?: PromptInputSlashProps["commands"];
  /** Fires with the chosen slash command (alongside the text splice). */
  onSlashCommand?: PromptInputSlashProps["onSelect"];
  /**
   * Override the DEFAULT tool buttons (today: the attach button) — e.g. to add
   * a web-search or connect-data control. Render `PromptInputButton`s /
   * `PromptInputActionMenu` here; when set, `showAttach` is ignored.
   *
   * The explicit `modelPicker` / `mode` / `effort` slots are NOT part of this
   * override — they render after whatever this puts in the cluster, so passing
   * `tools` can never silently swallow a control you asked for by name.
   */
  tools?: ReactNode;
  /** Send-button state, forwarded to `PromptInputSubmit` (ready/submitted/streaming/error). */
  sendStatus?: ComponentProps<typeof PromptInputSubmit>["status"];
  /** Stop handler used while the send button shows the generating state. */
  onStop?: ComponentProps<typeof PromptInputSubmit>["onStop"];
  /**
   * Keyboard-shortcut hints shown as a row beneath the input well — plain
   * `Kbd` + label pairs, e.g. `[{ keys: "Enter", label: "send" }]`. Omitted,
   * nothing renders (opt-in, like every other Composer slot); the row is
   * never invented, since the real bindings are the host app's.
   */
  shortcuts?: ComposerShortcut[];
  /**
   * A second, busy-only hint appended to `shortcuts` (#107) — shown ONLY
   * once the composer is actually generating (`sendStatus` is `"submitted"`
   * or `"streaming"`) AND a real `onStop` handler is set, so the hint never
   * describes an affordance that isn't there. Mirrors
   * `TerminalComposer`'s `canCancel = busy && Boolean(onStop)` shape.
   */
  cancelShortcut?: ComposerShortcut;
  /**
   * Extra props spread onto the send button — `disabled`, `aria-label`,
   * `variant`, `id`, `className`. `status` and `onStop` are excluded because
   * `Composer` owns them via `sendStatus` / `onStop` above. (A `data-*` key is
   * not assignable through this object: TypeScript only permits arbitrary
   * `data-*` on a JSX element directly, not on a typed props object. Reach for
   * `id` or `aria-label` as the test hook.)
   *
   * **`disabled` is the one that matters for correctness.** `PromptInput`'s
   * submit handler calls `form.reset()` as soon as it ACCEPTS a submit, so a
   * consumer that refuses the send inside `onSubmit` — an app doing async setup
   * on the first message, say — has already had the textarea cleared and the
   * user's text destroyed, with nothing to restore from. Disabling the control
   * is what actually prevents it: `PromptInputTextarea`'s Enter handler checks
   * `submitControl?.disabled` and bails before `requestSubmit()`, so the Enter
   * path is closed too, not just the click. It holds with a slash palette open
   * as well — the palette's own Enter handling only ever inserts a command.
   *
   * Leave it UNSET rather than passing `false` when you have no opinion —
   * `PromptInputSubmit` resolves `disabled ?? autoDisabled`, so a literal
   * `false` opts out of the library's own empty-composer guard.
   */
  submitProps?: Omit<ComponentProps<typeof PromptInputSubmit>, "status" | "onStop">;
  /**
   * The two-tone arrangement, forwarded to the `tone` prop of `PromptInput`.
   * `"surface"` (default, unchanged) is the original Composer look — an outer
   * `bg-card` frame around the standard muted `PromptInput` well — so every
   * existing usage is unaffected. `"card"` swaps to the tinted-outer/
   * distinct-inner "double card" (#254): an outer `bg-surface-muted` frame
   * around a `tone="card"` well. The well fill relative to the frame is
   * theme-driven, not universally "white" — raised on light themes, recessed
   * on dark; see the `tone` prop doc on `PromptInput`.
   */
  tone?: PromptInputProps["tone"];
  /** Optional suggestion chips rendered beneath the composer. */
  suggestions?: string[];
  /** Click handler for a suggestion chip. */
  onSuggestionClick?: (suggestion: string) => void;
  /** Show the voice button. Default `true`. */
  showVoice?: boolean;
  /** Show the attach button. Default `true`. */
  showAttach?: boolean;
  /** Extra classes for the outer card frame. */
  className?: string;
}

/**
 * Composer — the standard brand-ui AI chat input.
 *
 * A rounded two-tone "double card": a status strip wrapping a recessed
 * `PromptInput` well (sharp top, theme-rounded bottom), a tools cluster,
 * voice, and a circular send. Built on the real `PromptInput`, so it drops
 * into a `ChatShell` footer or stands alone as an empty-state composer. `tone`
 * (default `"surface"`, unchanged) picks the arrangement: `"surface"` keeps
 * the original outer `bg-card` frame around the standard muted well;
 * `"card"` (#254) swaps to an outer `bg-surface-muted` frame around a
 * `tone="card"` well — the well fill is theme-driven (raised on light
 * themes, recessed on dark), not universally white; see the
 * `tone` prop doc on `PromptInput`. Semantic tokens only; theme-aware radii
 * (`rounded-xl` frame / `rounded-b-lg` well); reads in every theme.
 *
 * **Composer is the chat input. Every control the `PromptInput` family ships
 * is reachable from a `Composer` prop; drop to `PromptInput` only for a
 * bespoke shell.** `modelPicker`, `mode`, `effort` and `slashCommands` are the
 * four slots that make that true — they render `ModelPicker`,
 * `PromptInputMode`, `PromptInputEffort` and `PromptInputSlash` respectively,
 * in the footer order `attach · modelPicker · mode · effort │ voice · send`
 * (the same left-to-right arrangement `TerminalComposer` uses, so the chat and
 * console skins agree).
 */
export function Composer({
  onSubmit,
  placeholder,
  status = "Awaiting your input",
  modelPicker,
  mode,
  effort,
  slashCommands,
  onSlashCommand,
  tools,
  sendStatus,
  onStop,
  submitProps,
  shortcuts,
  cancelShortcut,
  suggestions,
  onSuggestionClick,
  showVoice = true,
  showAttach = true,
  tone = "surface",
  className,
}: ComposerProps) {
  const { t } = useLocale();

  // Only read when `slashCommands` is set — the palette needs the live text and
  // a handle on the field to do its caret math. Without it the textarea stays
  // uncontrolled, exactly as before.
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const hasSlash = slashCommands !== undefined && slashCommands.length > 0;

  // #107: "Composer shortcut hints change with a busy state" — derived from
  // the existing canonical `sendStatus`, never a second boolean prop. The
  // cancel hint only ever joins the row once there is a real Stop affordance
  // it can describe (mirrors `TerminalComposer`'s `canCancel` derivation).
  const busy = sendStatus === "submitted" || sendStatus === "streaming";
  const canCancel = busy && Boolean(onStop);
  const allShortcuts = [
    ...(shortcuts ?? []),
    ...(canCancel && cancelShortcut ? [cancelShortcut] : []),
  ];

  const handleSubmit = useCallback<PromptInputProps["onSubmit"]>(
    (message, event) => {
      // `PromptInput.handleSubmit` calls `form.reset()`, which clears the DOM
      // node but cannot touch React state — so the slash-mode textarea would
      // keep rendering the sent text straight back. Clearing here is a no-op in
      // the uncontrolled (non-slash) arrangement.
      setText("");
      return onSubmit?.(message, event);
    },
    [onSubmit],
  );

  const resolvedPlaceholder = placeholder ?? t("ai.composer.placeholder");

  return (
    <div className="w-full">
      <div
        className={cn(
          "rounded-xl p-1.5 border",
          tone === "card" ? "bg-surface-muted" : "bg-card shadow-sm",
          className,
        )}
      >
        {/* Muted status strip — sits in the outer frame above the input well. */}
        {status != null ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-meta text-muted-foreground">
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span>{status}</span>
          </div>
        ) : null}

        {/* Inner well — sharp top (nests under the strip), theme-rounded bottom. */}
        <PromptInput
          onSubmit={handleSubmit}
          surfaceClassName="rounded-t-none rounded-b-lg"
          tone={tone}
        >
          <PromptInputBody>
            {hasSlash && slashCommands ? (
              <PromptInputSlash
                commands={slashCommands}
                value={text}
                textareaRef={textareaRef}
                onValueChange={(next) => setText(next.text)}
                onSelect={onSlashCommand}
              >
                {/* No `ref` here on purpose: PromptInputSlashTextarea merges the
                    palette's own `textareaRef` in for us. */}
                <PromptInputSlashTextarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={resolvedPlaceholder}
                />
              </PromptInputSlash>
            ) : (
              <PromptInputTextarea placeholder={resolvedPlaceholder} />
            )}
          </PromptInputBody>
          <PromptInputFooter>
            {/* `flex-wrap` so a full cluster (attach + picker + mode + effort)
                wraps instead of overflowing a narrow composer. */}
            <PromptInputTools className="flex-wrap gap-y-1">
              {tools ??
                (showAttach ? (
                  <PromptInputButton tooltip="Attach files">
                    <Paperclip className="size-4" />
                  </PromptInputButton>
                ) : null)}
              {modelPicker}
              {mode ? <PromptInputMode {...mode} /> : null}
              {effort ? <PromptInputEffort {...effort} /> : null}
            </PromptInputTools>
            <div className="flex shrink-0 items-center gap-1">
              {showVoice ? (
                <PromptInputButton tooltip="Voice">
                  <Mic className="size-4" />
                </PromptInputButton>
              ) : null}
              {/* `sendIcon` (not `children`) survives the send↔stop flip: the
                  circular ArrowUp shows at rest AND once a follow-up is typed
                  during a running turn (#351), while PromptInputSubmit's own
                  status glyphs (spinner / stop square / error) still render
                  whenever the control IS the Stop action. */}
              <PromptInputSubmit
                status={sendStatus}
                onStop={onStop}
                sendIcon={<ArrowUp className="size-4" />}
                {...submitProps}
                // After the spread so a caller's `className` EXTENDS the round
                // shape instead of replacing it; every other key still wins.
                className={cn("rounded-full", submitProps?.className)}
              />
            </div>
          </PromptInputFooter>
        </PromptInput>

        {/* #107: the hint row itself — plain SIBLING `Kbd` + label pairs, never
            nested inside `PromptInputSubmit` (which already names itself via its
            own `aria-label`), so the row cannot pollute any control's accessible
            name (the #153-style trap). */}
        {allShortcuts.length > 0 ? (
          <div
            className="flex flex-wrap items-center gap-3 px-3 pt-1.5 text-meta text-muted-foreground"
            data-slot="composer-shortcuts"
          >
            {allShortcuts.map((shortcut, index) => (
              <span
                className="inline-flex items-center gap-1.5"
                // Shortcut rows are a fixed, non-reorderable list per render —
                // `keys` alone isn't guaranteed unique (a caller could offer the
                // same key for two purposes), so index is a stable, honest key.
                key={index}
              >
                <Kbd>{shortcut.keys}</Kbd>
                <span>{shortcut.label}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {suggestions && suggestions.length > 0 ? (
        <Suggestions className="mt-4 justify-center">
          {suggestions.map((s) => (
            <Suggestion key={s} suggestion={s} onClick={() => onSuggestionClick?.(s)} />
          ))}
        </Suggestions>
      ) : null}
    </div>
  );
}
