"use client";

import { useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  CheckIcon,
  FolderIcon,
  GitBranchIcon,
  Loader2Icon,
  PlugZapIcon,
  UnplugIcon,
} from "lucide-react";
import type { ComponentType, HTMLAttributes, SVGProps } from "react";
import { forwardRef } from "react";

/**
 * TerminalStatusBar — the ambient chrome row that answers "where am I, what
 * am I connected to, and how far through this turn am I" without the human
 * asking (#117 T4).
 *
 * Ground truth (verified live against the real upstream, 2026-09-01 — a Grok
 * CLI look-alike, v0.2.93): a LEFT cluster (branch, then working directory)
 * and a RIGHT cluster (connection progress, context usage, a divider, turn
 * progress), every one of the five facts independently optional. Vendor
 * example values (its default branch/path/token numbers) are never
 * reproduced here, and no vendor name appears in any public type — an
 * acceptance criterion of #117.
 *
 * **Mirrors `SessionStatusBarProps`** (`@elabs-ai/components-ai`, #105) —
 * `branch`, `workspace`, and `connections.{connected,total,connecting}` are
 * the SAME names for the SAME facts, so swapping the chat skin for the
 * console skin renames nothing. Two deliberate differences from it:
 *
 * 1. **`connections.disconnected`** — a rung `SessionStatusBar` has no
 *    reason to model (a chat header never shows a LOST integration), but a
 *    console status bar does. Recoverable in greyscale AND by a screen
 *    reader: a distinct glyph (`UnplugIcon`, not `PlugZapIcon`) plus its own
 *    VISIBLE text label — colour is a redundant enhancement here, never the
 *    only channel (`.claude/rules/accessibility.md`).
 * 2. **`context` is a pair of ALREADY-FORMATTED strings**, not numbers this
 *    component derives. `SessionStatusBar` docks a whole `<TokenUsage />` via
 *    `children` because `token-usage.tsx` (tokenlens) owns that abbreviation
 *    math; `@elabs-ai/components-terminal` cannot import
 *    `@elabs-ai/components-ai` (sibling packages — see
 *    `.claude/rules/terminal-components.md` § Reuse means promotion), so it
 *    renders the two display strings the caller already computed rather than
 *    re-deriving them (D5 — a presentation layer renders facts, it does not
 *    own the model behind them).
 *
 * The container itself carries `role="status"`/`aria-label` per the verified
 * ground truth, so the WHOLE bar is already one live region — an inner
 * segment must never add a second, nested `role="status"` the way
 * `SessionStatusBar`'s connections segment does (that component has no root
 * live region of its own).
 */

export interface TerminalStatusBarConnections {
  /** Number of integrations/MCP servers currently connected. */
  connected: number;
  /** Total number of configured integrations/MCP servers. */
  total: number;
  /** Renders a spinner in place of the connection icon while establishing. */
  connecting?: boolean;
  /**
   * The connection was lost, or never established. Renders a distinct glyph
   * (`UnplugIcon`) plus its own text label instead of the connected/total
   * count — never colour alone (WCAG 1.4.1).
   */
  disconnected?: boolean;
}

export interface TerminalStatusBarContext {
  /**
   * Already-formatted "used" display value (e.g. `"16K"`). `Context`
   * (`@elabs-ai/components-ai`) owns the abbreviation math — this renders
   * what the caller computed, it does not re-derive it.
   */
  used: string;
  /** Already-formatted context-window limit display value (e.g. `"500K"`). */
  limit: string;
}

export interface TerminalStatusBarTurn {
  /** The current turn/step number. */
  current: number;
  /** The total number of turns/steps. */
  total: number;
}

export interface TerminalStatusBarProps extends HTMLAttributes<HTMLDivElement> {
  /** Current git branch. */
  branch?: string;
  /**
   * Current working directory. A long path truncates in place; the full
   * value is still reachable via its native `title`.
   */
  workspace?: string;
  /** Integration/MCP connection progress. */
  connections?: TerminalStatusBarConnections;
  /** Context-window usage, already formatted by the caller. */
  context?: TerminalStatusBarContext;
  /** Progress through the current turn's steps. */
  turn?: TerminalStatusBarTurn;
}

type SegmentIcon = ComponentType<SVGProps<SVGSVGElement>>;

/** A left-cluster fact: an icon plus its value, optionally allowed to shrink and truncate. */
function StatusBarSegment({
  icon: Icon,
  shrink,
  slot,
  title,
  value,
}: {
  icon: SegmentIcon;
  shrink?: boolean;
  slot: string;
  title?: string;
  value: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", shrink ? "min-w-0 shrink" : "shrink-0")}
      data-slot={slot}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span className={cn(shrink && "min-w-0 truncate")} title={title}>
        {value}
      </span>
    </span>
  );
}

export const TerminalStatusBar = forwardRef<HTMLDivElement, TerminalStatusBarProps>(
  function TerminalStatusBar(
    {
      branch,
      className,
      connections,
      context,
      turn,
      workspace,
      "aria-label": ariaLabelProp,
      role: roleProp,
      ...props
    },
    ref,
  ) {
    const { formatNumber, t } = useLocale();
    const hasContent = Boolean(branch ?? workspace ?? connections ?? context ?? turn);

    if (!hasContent) {
      return null;
    }

    const hasRightCluster = Boolean(connections ?? context ?? turn);
    // The `│` divider is documented ground truth as sitting between context
    // usage and turn progress specifically — never between connections and
    // context, and never in front of turn when turn is the only right-hand
    // fact. It is a plain rule (`bg-terminal-border`), never a box-drawing
    // character as text (`.claude/rules/terminal-components.md` § fidelity).
    const showTurnDivider = Boolean(turn) && Boolean(connections ?? context);

    return (
      <div
        ref={ref}
        aria-label={ariaLabelProp ?? t("terminal.statusBar.label")}
        aria-live="polite"
        className={cn(
          "flex w-full items-center gap-4 border-t border-terminal-border bg-terminal-background px-3 py-1.5 font-mono text-meta text-terminal-muted",
          className,
        )}
        data-slot="terminal-status-bar"
        role={roleProp ?? "status"}
        {...props}
      >
        {branch ? (
          <StatusBarSegment icon={GitBranchIcon} slot="terminal-status-bar-branch" value={branch} />
        ) : null}
        {workspace ? (
          <StatusBarSegment
            icon={FolderIcon}
            shrink
            slot="terminal-status-bar-workspace"
            title={workspace}
            value={workspace}
          />
        ) : null}
        {hasRightCluster ? (
          <div className="ms-auto flex shrink-0 items-center gap-3">
            {connections ? (
              <span
                className="inline-flex shrink-0 items-center gap-1.5"
                data-slot="terminal-status-bar-connections"
              >
                {connections.disconnected ? (
                  <>
                    <UnplugIcon
                      aria-hidden="true"
                      className="size-3.5 shrink-0 text-terminal-ansi-bright-red"
                    />
                    {/*
                     * The glyph and this word are the load-bearing channels
                     * (greyscale + screen reader); colour is a bonus, never
                     * the only cue. `text-destructive-text` (calibrated
                     * against `--background`/`--card`) measures 2.57:1 here —
                     * `--terminal-foreground` is the token actually
                     * calibrated for THIS ground, so the word itself stays a
                     * neutral, always-legible high-contrast tone and only the
                     * icon carries the accent colour.
                     */}
                    <span className="text-terminal-foreground">
                      {t("terminal.statusBar.disconnected")}
                    </span>
                  </>
                ) : connections.connecting ? (
                  <>
                    <Loader2Icon
                      aria-hidden="true"
                      className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
                    />
                    <span aria-hidden="true" className="tabular-nums">
                      {formatNumber(connections.connected)}/{formatNumber(connections.total)}
                    </span>
                    <span className="sr-only">{t("terminal.statusBar.connecting")}</span>
                  </>
                ) : (
                  <>
                    <PlugZapIcon aria-hidden="true" className="size-3.5 shrink-0" />
                    <span aria-hidden="true" className="tabular-nums">
                      {formatNumber(connections.connected)}/{formatNumber(connections.total)}
                    </span>
                    <span className="sr-only">
                      {t("terminal.statusBar.connections", {
                        connected: connections.connected,
                        total: connections.total,
                      })}
                    </span>
                  </>
                )}
              </span>
            ) : null}
            {context ? (
              <span
                className="inline-flex shrink-0 items-center tabular-nums"
                data-slot="terminal-status-bar-context"
              >
                <span aria-hidden="true">
                  {context.used} / {context.limit}
                </span>
                <span className="sr-only">
                  {t("terminal.statusBar.context", { limit: context.limit, used: context.used })}
                </span>
              </span>
            ) : null}
            {showTurnDivider ? (
              <span
                aria-hidden="true"
                className="h-3 w-px shrink-0 bg-terminal-border"
                data-slot="terminal-status-bar-divider"
              />
            ) : null}
            {turn ? (
              <span
                className="inline-flex shrink-0 items-center gap-1"
                data-slot="terminal-status-bar-turn"
              >
                <span aria-hidden="true" className="tabular-nums">
                  {formatNumber(turn.current)}/{formatNumber(turn.total)}
                </span>
                <CheckIcon aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="sr-only">
                  {t("terminal.statusBar.stepsComplete", {
                    current: turn.current,
                    total: turn.total,
                  })}
                </span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  },
);

TerminalStatusBar.displayName = "TerminalStatusBar";
