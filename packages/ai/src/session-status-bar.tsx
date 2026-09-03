"use client";

import { cn, useLocale } from "@elabs-ai/components-ui";
import { Cpu, Folder, GitBranch, Loader2Icon, PlugZapIcon } from "lucide-react";
import type { ComponentProps, ComponentType, ReactNode, SVGProps } from "react";
import { forwardRef } from "react";

export interface SessionStatusBarConnections {
  /** Number of integrations/MCP servers currently connected. */
  connected: number;
  /** Total number of configured integrations/MCP servers. */
  total: number;
  /** Renders a spinner in place of the connection icon while establishing. */
  connecting?: boolean;
}

export interface SessionStatusBarProps extends ComponentProps<"div"> {
  /** Current workspace/project name. */
  workspace?: string;
  /** Current git branch. */
  branch?: string;
  /** Active model id/label. */
  model?: string;
  /** Integration/MCP connection progress; renders a spinner while connecting. */
  connections?: SessionStatusBarConnections;
  /**
   * Docks another component alongside the ambient segments — most often
   * `<TokenUsage />` (`@elabs-ai/components-ai`), so token usage/cost keeps
   * its one owner (`token-usage.tsx`, tokenlens) instead of being re-implemented
   * here. Rendered flush to the end of the bar.
   */
  children?: ReactNode;
}

type SegmentIcon = ComponentType<SVGProps<SVGSVGElement>>;

const SessionStatusBarSegment = ({
  icon: Icon,
  slot,
  value,
}: {
  icon: SegmentIcon;
  slot: string;
  value: string;
}) => (
  <span className="inline-flex min-w-0 items-center gap-1.5" data-slot={slot}>
    <Icon aria-hidden="true" className="size-3.5 shrink-0" />
    <span className="truncate">{value}</span>
  </span>
);

/**
 * SessionStatusBar — the ambient session row: workspace, branch, model, and
 * integration-connection progress (#105). Every segment is independently
 * optional and renders only when its prop is supplied; with nothing supplied
 * the bar renders nothing at all, not an empty shell.
 *
 * Docks `Context` (or any other node) via `children` rather than
 * re-implementing token-usage/cost maths — `context.tsx` stays the one owner
 * of that calculation (tokenlens).
 */
export const SessionStatusBar = forwardRef<HTMLDivElement, SessionStatusBarProps>(
  function SessionStatusBar(
    { workspace, branch, model, connections, children, className, ...props },
    ref,
  ) {
    const { formatNumber, t } = useLocale();
    const hasContent = Boolean(workspace ?? branch ?? model ?? connections ?? children);

    if (!hasContent) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex w-full items-center gap-4 border-t bg-surface-muted px-3 py-1.5 text-meta text-muted-foreground",
          className,
        )}
        data-slot="session-status-bar"
        {...props}
      >
        {workspace ? (
          <SessionStatusBarSegment
            icon={Folder}
            slot="session-status-bar-workspace"
            value={workspace}
          />
        ) : null}
        {branch ? (
          <SessionStatusBarSegment
            icon={GitBranch}
            slot="session-status-bar-branch"
            value={branch}
          />
        ) : null}
        {model ? (
          <SessionStatusBarSegment icon={Cpu} slot="session-status-bar-model" value={model} />
        ) : null}
        {connections ? (
          <span
            aria-label={
              connections.connecting
                ? t("ai.sessionStatusBar.connecting")
                : t("ai.sessionStatusBar.connections", {
                    connected: connections.connected,
                    total: connections.total,
                  })
            }
            aria-live="polite"
            className="inline-flex shrink-0 items-center gap-1.5"
            data-slot="session-status-bar-connections"
            role="status"
          >
            {connections.connecting ? (
              <Loader2Icon
                aria-hidden="true"
                className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none"
              />
            ) : (
              <PlugZapIcon aria-hidden="true" className="size-3.5 shrink-0" />
            )}
            <span aria-hidden="true" className="tabular-nums">
              {formatNumber(connections.connected)}/{formatNumber(connections.total)}
            </span>
          </span>
        ) : null}
        {children ? (
          <div
            className="ms-auto flex shrink-0 items-center"
            data-slot="session-status-bar-context"
          >
            {children}
          </div>
        ) : null}
      </div>
    );
  },
);
