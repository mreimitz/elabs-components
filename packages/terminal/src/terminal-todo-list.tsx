"use client";

import { useLocale, type TimelineStatus } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { cva } from "class-variance-authority";
import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { TerminalRow } from "./terminal-row";
import type { TerminalVariant } from "./terminal-surface";

/**
 * TerminalTodoList — the coding-agent CLI three-state checklist (#117).
 *
 * **Derived from:** `claude-todo-list.tsx`, Claude Code v2.1.207. See
 * `packages/terminal/references/agent-session-family.md` for the full
 * checked/diverges note; the summary that matters here is that the *reading*
 * is reproduced (one glyph plus one announced word per state) and the
 * upstream's character-width padding is not — `TerminalRow`'s gutter track
 * does that job without breaking at a font fallback.
 *
 * ## Why this reuses `TimelineStatus` instead of a fourth vocabulary
 *
 * The three states here are exactly `@elabs-ai/components-ui`'s
 * `done | active | pending` (`TimelineStatus`, status-badge.tsx) — a todo
 * item that has not been started yet is "pending" in that vocabulary, which
 * is what upstream calls "todo". Reusing the type rather than minting
 * `"done" | "active" | "todo"` means this list can never drift from
 * `Timeline`'s vocabulary, and it is a genuine reuse: `TimelineStatus` is
 * already headless (a type + `fromTimelineStatus`, no component), so
 * borrowing it costs nothing structurally.
 *
 * What does NOT get reused is `StatusBadge`/`StatusIcon`/`fromTimelineStatus`
 * themselves — this list's glyphs (`✔ ◼ ◻`) and treatments (strikethrough,
 * bold, default ink) are the specific grammar a CLI todo list reads as, not
 * the canonical 7-state Lucide-icon/colour treatment those are built for.
 *
 * ## The gutter glyph is never the only channel
 *
 * Each row's state rides `TerminalRow`'s `gutterLabel`, exactly like every
 * other row in this family — an `sr-only` word survives greyscale AND a
 * variant (`rail`) that suppresses the glyph entirely. Colour is not used to
 * carry the state at all here; the glyph shape and the strikethrough/bold
 * treatment already do that, so no third crutch is needed on top of the
 * announced word.
 */

/** One checklist entry. `status` reuses `TimelineStatus` — see the module doc. */
export interface TerminalTodoItem {
  /** Stable key. Falls back to the item's index when omitted. */
  id?: string | number;
  /** The task's own text. */
  text: ReactNode;
  /** `done` | `active` | `pending` — `pending` reads as "not started yet". */
  status: TimelineStatus;
}

/**
 * Glyph per state — the upstream grammar, verified 2026-09-01 against Claude
 * Code v2.1.207. Never a Lucide icon: the fidelity axis
 * (`.claude/rules/terminal-components.md`) reproduces this grammar at high
 * fidelity, and the grammar IS this exact character.
 */
const TERMINAL_TODO_GLYPH: Record<TimelineStatus, string> = {
  done: "✔",
  active: "◼",
  pending: "◻",
};

/**
 * Text treatment per state. `done` and `active` both need a visual channel
 * distinct from the announced word (WCAG 1.4.1 "not colour alone" — here,
 * not GLYPH alone either): strikethrough + dimmed ink for a finished item,
 * bold for the one in flight. `pending` is deliberately empty — default ink,
 * no treatment — matching the upstream's own restraint on the not-yet state.
 */
export const terminalTodoItemVariants = cva("", {
  variants: {
    status: {
      done: "text-terminal-muted line-through",
      active: "font-semibold",
      pending: "",
    } satisfies Record<TimelineStatus, string>,
  },
  defaultVariants: {
    status: "pending",
  },
});

export interface TerminalTodoListProps extends Omit<HTMLAttributes<HTMLOListElement>, "children"> {
  /** The checklist, in display order. */
  items: TerminalTodoItem[];
  /**
   * Gutter grammar for every row. Omitted, each row inherits the surrounding
   * `TerminalSurface`; passed, it overrides it for the whole list — the same
   * override contract `TerminalRow` itself exposes.
   */
  variant?: TerminalVariant;
}

/**
 * The state word announced beside each glyph. `t()` is resolved once per
 * item so a consumer's own `LocaleProvider` messages/`translate` resolver
 * can override any of the three independently.
 */
function useTerminalTodoStateLabel(): (status: TimelineStatus) => string {
  const { t } = useLocale();
  return (status: TimelineStatus) => {
    switch (status) {
      case "done":
        return t("terminal.todoList.done");
      case "active":
        return t("terminal.todoList.active");
      case "pending":
        return t("terminal.todoList.pending");
    }
  };
}

export const TerminalTodoList = forwardRef<HTMLOListElement, TerminalTodoListProps>(
  function TerminalTodoList({ items, variant, className, ...props }, ref) {
    const stateLabel = useTerminalTodoStateLabel();

    return (
      <ol
        ref={ref}
        data-slot="terminal-todo-list"
        // `role="list"` restores the list semantics Safari/VoiceOver drop the
        // moment `list-style` is reset — the same pattern `Transfer` already
        // uses (`transfer.tsx`), not a one-off.
        role="list"
        className={cn("flex list-none flex-col gap-1 ps-0", className)}
        {...props}
      >
        {items.map((item, index) => (
          <li key={item.id ?? index} data-slot="terminal-todo-list-item" data-status={item.status}>
            <TerminalRow
              variant={variant}
              gutter={TERMINAL_TODO_GLYPH[item.status]}
              gutterLabel={stateLabel(item.status)}
            >
              <span
                data-slot="terminal-todo-list-text"
                className={terminalTodoItemVariants({ status: item.status })}
              >
                {item.text}
              </span>
            </TerminalRow>
          </li>
        ))}
      </ol>
    );
  },
);

TerminalTodoList.displayName = "TerminalTodoList";
