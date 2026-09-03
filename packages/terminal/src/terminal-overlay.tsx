"use client";

import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Kbd,
  useLocale,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { XIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";

/**
 * TerminalOverlay — the console-dress modal FRAME for the agent-session
 * family (#117, work unit T13).
 *
 * A person can call up a reference panel — the session's keyboard shortcuts,
 * say — without losing their place in the transcript, and dismiss it the way
 * they dismiss anything else in the product.
 *
 * Ground truth (as supplied for this work unit, 2026-09-01): upstream ships a
 * keyboard-shortcuts modal and a settings modal in this dress — nested
 * collapsible groups, a per-group count shown while collapsed, action-plus-
 * keys rows, a search affordance, and a footer key legend. **What this
 * component takes:** the frame — ground, title, dismissal and footer legend —
 * plus the marker-glyph convention already used package-wide (a decorative
 * glyph beside a real, announced word). **What it does not take:** the
 * settings modal itself (app composition, not a library component — a stated
 * #117 non-goal) and the full-screen ANSI redraw (a real Radix `Dialog`, per
 * this package's fidelity axis).
 *
 * ## It is a frame, not a catalogue of panels
 *
 * Its job is the ground, the dismissal and the legend; the content is the
 * caller's. The canonical filler is `KeyboardShortcuts`
 * (`@elabs-ai/components-ui`) — grouped, searchable, already built — which
 * this component HOSTS rather than re-implements
 * (`.claude/rules/terminal-components.md` § Reuse means promotion).
 *
 * ## Reuse, not a second implementation
 *
 * Built entirely on `Dialog`/`DialogContent`/`DialogBody`/`DialogTitle`/
 * `DialogClose` (`@elabs-ai/components-ui`, Radix-backed): the focus trap,
 * Escape-to-dismiss, scroll lock and `aria-modal` semantics are Radix's, not
 * hand-rolled. Two deliberate departures from `DialogContent`'s defaults,
 * both required by this package's own colour rule
 * (`.claude/rules/terminal-components.md` § "Colour comes from the terminal
 * token group, and nowhere else"):
 *
 * 1. **The panel is repainted onto the terminal ground** (`bg-terminal-background`
 *    / `text-terminal-foreground` / the `code` type role) instead of
 *    `DialogContent`'s default `bg-card`/`text-card-foreground` — this is a
 *    console surface, not an ordinary app dialog. Its elevation stays
 *    `DialogContent`'s own `shadow-ring-lg` untouched: an overlay FLOATS, so
 *    per `.claude/rules/styling-and-tokens.md` § Elevation it takes a ring
 *    rung and never a `border` (the "double edge").
 * 2. **`DialogContent`'s baked-in close icon is hidden and replaced.** That
 *    icon is styled with `text-muted-foreground` — a token calibrated against
 *    `--card`/`--background`, never against `--terminal-background` (a dark
 *    surface in EVERY theme, including light — see the terminal token group's
 *    own comment in `themes.css`). Reaching for it here would be exactly the
 *    class of WCAG failure this package's colour rule exists to prevent, so
 *    this component hides it (`**:data-[slot=dialog-close]:hidden`, targeting
 *    the stable `data-slot` `DialogContent` already publishes) and renders its
 *    own close control from the terminal token group instead.
 *
 * ## Hosting foreign (non-terminal) content safely
 *
 * The body renders directly on the terminal ground, exactly like every other
 * surface in this family — a `TerminalRow`/`TerminalSurface`-built child needs
 * no extra clothing. An ordinary `@elabs-ai/components-ui` widget (like
 * `KeyboardShortcuts`) is calibrated against `--card`/`--background`, not this
 * console ground, so IT needs its own local, correctly-paired surface — the
 * same "a chip punched out of the console" idiom `themes.css` already
 * documents for `--terminal-accent-foreground`, just inverted: an ordinary
 * card punched INTO the console frame. See the `WithKeyboardShortcuts` story.
 * This is a caller decision (D5 — the content, and how it is dressed, is the
 * caller's), not a variant this component grows.
 *
 * ## Not-ready states
 *
 * None. A reference overlay's content either exists or the caller has not
 * opened it yet — there is no fetch-then-show gap this component owns
 * (`.claude/rules/loading-states.md`).
 */

/** One footer legend entry: a real action, plus the decorative key(s) that trigger it. */
export interface TerminalOverlayHint {
  /**
   * What activating the shortcut does. This word IS the accessible name for
   * the hint — the key glyphs beside it are decorative (WCAG 1.4.1).
   */
  action: string;
  /** Ordered key tokens, e.g. `["Esc"]` or `["⌘", "K"]`. Rendered via `Kbd`. */
  keys: string[];
}

export interface TerminalOverlayProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Controlled open state — the app owns it. */
  open: boolean;
  /** Fires on the close control, Escape, an outside click, and any other Radix dismissal. */
  onOpenChange: (open: boolean) => void;
  /** The panel's heading, read by assistive tech as the dialog's accessible name. */
  title: ReactNode;
  /** One line of supporting context under the title. Omitted, the panel carries no description. */
  description?: ReactNode;
  /**
   * The footer key-hint legend, in order. Omitted or empty, no footer renders
   * at all — never an empty bar.
   */
  hints?: TerminalOverlayHint[];
  /** The panel's own content. The caller's — see the module doc. */
  children?: ReactNode;
}

export const TerminalOverlay = forwardRef<HTMLDivElement, TerminalOverlayProps>(
  function TerminalOverlay(
    { open, onOpenChange, title, description, hints, className, children, ...props },
    ref,
  ) {
    const { t } = useLocale();
    const visibleHints = hints ?? [];

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          ref={ref}
          data-slot="terminal-overlay"
          // Radix warns without either a rendered Description or an explicit
          // opt-out — mirrors `voice-selector.tsx` in `@elabs-ai/components-ai`.
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            // Hides DialogContent's own baked-in close icon — see the module
            // doc. Targets the STABLE data-slot DialogContent already
            // publishes, never DOM position.
            "**:data-[slot=dialog-close]:hidden",
            // Repaint onto the terminal ground; `shadow-ring-lg` (no border)
            // rides through from DialogContent's own base classes untouched.
            "gap-0 rounded-lg bg-terminal-background p-0 text-terminal-foreground",
            "text-code font-mono",
            className,
          )}
          {...props}
        >
          <div
            data-slot="terminal-overlay-header"
            className="flex items-start justify-between gap-3 border-b border-terminal-border px-4 py-3"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <DialogTitle
                data-slot="terminal-overlay-title"
                className="text-body font-semibold text-terminal-foreground"
              >
                {title}
              </DialogTitle>
              {description ? (
                <DialogDescription
                  data-slot="terminal-overlay-description"
                  className="text-meta text-terminal-muted"
                >
                  {description}
                </DialogDescription>
              ) : null}
            </div>
            <DialogClose asChild>
              <button
                type="button"
                data-slot="terminal-overlay-close"
                aria-label={t("close")}
                className={cn(
                  "shrink-0 rounded-md p-1 text-terminal-muted transition-colors duration-fast ease-standard",
                  "hover:text-terminal-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <XIcon aria-hidden="true" className="size-4" />
              </button>
            </DialogClose>
          </div>

          <DialogBody>
            <div data-slot="terminal-overlay-body" className="flex flex-col gap-3 px-4 py-4">
              {children}
            </div>
          </DialogBody>

          {visibleHints.length > 0 ? (
            <div
              data-slot="terminal-overlay-legend"
              className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-terminal-border px-4 py-2.5 text-meta text-terminal-muted"
            >
              {visibleHints.map((hint, index) => (
                <span
                  key={index}
                  data-slot="terminal-overlay-hint"
                  className="inline-flex items-center gap-1.5"
                >
                  {/*
                   * The keys are NOT decorative and are NOT hidden from
                   * assistive tech. `TerminalRow`'s gutter glyph is hidden
                   * because `gutterLabel` says the same thing in words — the
                   * glyph is redundant. Here the key IS the answer to "which
                   * key does this?", and `hint.action` does not restate it, so
                   * hiding it would leave a non-visual user with the action and
                   * no shortcut. `KeyboardShortcuts` (`@elabs-ai/components-ui`),
                   * which this frame exists to host, announces its own `Kbd`s
                   * for the same reason. No accessible-name hazard here: this
                   * is a legend row, not a control, so there is no name for the
                   * key text to pollute.
                   */}
                  <span className="inline-flex items-center gap-1">
                    {hint.keys.map((key, keyIndex) => (
                      <Kbd
                        key={keyIndex}
                        className="border-terminal-border bg-terminal-selection text-terminal-foreground"
                      >
                        {key}
                      </Kbd>
                    ))}
                  </span>
                  <span>{hint.action}</span>
                </span>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    );
  },
);

TerminalOverlay.displayName = "TerminalOverlay";
