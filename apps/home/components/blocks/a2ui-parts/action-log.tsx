// registry: a2ui-parts — copied 2026-09-19
"use client";

/**
 * What the HOST received. A surface never runs code: a button names an action ("approve-refund")
 * and the app decides what that means. This log is the proof — every entry is an `onAction`
 * call, with the event that fired, the control's value and the payload the agent attached.
 */
import type { A2uiAction, A2uiActionContext } from "@elabs-ai/components-ai";
import { Badge, EmptyState, ScrollArea } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { MousePointerClick } from "lucide-react";
import { useCallback, useState } from "react";

export interface LoggedAction {
  id: number;
  at: string;
  name: string;
  event: string;
  nodeType: string;
  value?: unknown;
  payload?: unknown;
}

const clock = () =>
  new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** Collects `onAction` calls; `record` is stable, so it can be the handler itself. */
export function useActionLog(limit = 40) {
  const [entries, setEntries] = useState<LoggedAction[]>([]);
  const record = useCallback(
    (action: A2uiAction, context: A2uiActionContext) => {
      setEntries((current) =>
        [
          {
            id: (current[0]?.id ?? 0) + 1,
            at: clock(),
            name: action.name,
            event: context.event,
            nodeType: context.node.type,
            value: context.value,
            payload: action.payload,
          },
          ...current,
        ].slice(0, limit),
      );
    },
    [limit],
  );
  const clear = useCallback(() => setEntries([]), []);
  return { entries, record, clear };
}

const compact = (value: unknown) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 64 ? `${text.slice(0, 61)}…` : text;
};

export function ActionLog({
  entries,
  className,
  emptyHint = "Click a button or change a field in the surface.",
}: {
  entries: readonly LoggedAction[];
  className?: string;
  emptyHint?: string;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        className={className}
        description={emptyHint}
        icon={<MousePointerClick aria-hidden="true" />}
        title="No actions yet"
      />
    );
  }
  return (
    <ScrollArea className={cn("h-full", className)}>
      <ol aria-label="Actions the host received" className="flex flex-col">
        {entries.map((entry) => (
          <li
            className="flex flex-col gap-1 border-b border-border px-3 py-2 last:border-b-0"
            key={entry.id}
          >
            <div className="flex items-center gap-2">
              <code className="text-code font-semibold text-foreground">{entry.name}</code>
              <Badge variant="outline">
                {entry.nodeType} · {entry.event}
              </Badge>
              <span className="ms-auto text-meta tabular-nums text-muted-foreground">
                {entry.at}
              </span>
            </div>
            {entry.value !== undefined ? (
              <p className="text-meta text-muted-foreground">
                value <code className="text-code text-foreground">{compact(entry.value)}</code>
              </p>
            ) : null}
            {entry.payload !== undefined ? (
              <p className="text-meta text-muted-foreground">
                payload <code className="text-code text-foreground">{compact(entry.payload)}</code>
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </ScrollArea>
  );
}
