"use client";

import type { ComponentProps, ReactNode } from "react";
import { ArrowUp, ChevronDown, Globe, Mic, Paperclip, Sparkles } from "lucide-react";
import { cn, useLocale } from "@elabs-ai/components-ui";

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
import { Suggestion, Suggestions } from "./suggestion";

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
  /** Model-selector pill label. Default `"Claude Opus 4"`; pass `null` to hide it. */
  model?: ReactNode;
  /**
   * Override the left-hand tool cluster (attach + model pill) — e.g. to add a
   * web-search or connect-data control. Render `PromptInputButton`s /
   * `PromptInputActionMenu` here; when set, `showAttach`/`model` are ignored.
   */
  tools?: ReactNode;
  /** Send-button state, forwarded to `PromptInputSubmit` (ready/submitted/streaming/error). */
  sendStatus?: ComponentProps<typeof PromptInputSubmit>["status"];
  /** Stop handler used while the send button shows the generating state. */
  onStop?: ComponentProps<typeof PromptInputSubmit>["onStop"];
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
   * path is closed too, not just the click.
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
 * `PromptInput` well (sharp top, theme-rounded bottom), a model pill, voice,
 * and a circular send. Built on the real `PromptInput`, so it drops into a
 * `ChatShell` footer or stands alone as an empty-state composer. `tone`
 * (default `"surface"`, unchanged) picks the arrangement: `"surface"` keeps
 * the original outer `bg-card` frame around the standard muted well;
 * `"card"` (#254) swaps to an outer `bg-surface-muted` frame around a
 * `tone="card"` well — the well fill is theme-driven (raised on light
 * themes, recessed on dark), not universally white; see the
 * `tone` prop doc on `PromptInput`. Semantic tokens only; theme-aware radii
 * (`rounded-xl` frame / `rounded-b-lg` well); reads in every theme.
 *
 * This is the canonical chat input — reach for it instead of hand-rolling a
 * `PromptInput` footer.
 */
export function Composer({
  onSubmit,
  placeholder,
  status = "Awaiting your input",
  model = "Claude Opus 4",
  tools,
  sendStatus,
  onStop,
  submitProps,
  suggestions,
  onSuggestionClick,
  showVoice = true,
  showAttach = true,
  tone = "surface",
  className,
}: ComposerProps) {
  const { t } = useLocale();

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
          onSubmit={onSubmit ?? (() => undefined)}
          surfaceClassName="rounded-t-none rounded-b-lg"
          tone={tone}
        >
          <PromptInputBody>
            <PromptInputTextarea placeholder={placeholder ?? t("ai.composer.placeholder")} />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              {tools ?? (
                <>
                  {showAttach ? (
                    <PromptInputButton tooltip="Attach files">
                      <Paperclip className="size-4" />
                    </PromptInputButton>
                  ) : null}
                  {model != null ? (
                    <PromptInputButton variant="ghost" className="gap-1.5 rounded-full">
                      <Globe className="size-4" />
                      <span>{model}</span>
                      <ChevronDown className="size-4 opacity-60" />
                    </PromptInputButton>
                  ) : null}
                </>
              )}
            </PromptInputTools>
            <div className="flex items-center gap-1">
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
