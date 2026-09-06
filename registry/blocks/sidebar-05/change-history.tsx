/**
 * The body of the summoned right-hand dock: who changed what, most recent
 * first.
 *
 * Ink note, because the sibling blocks warn about the opposite case: `SideDock`
 * grounds itself on `bg-card`, which is CANVAS elevation, not chrome. So this
 * list reaches for `text-muted-foreground` / `text-foreground` — the canvas
 * pair — and NOT `text-sidebar-muted-foreground`, which is tuned for the dark
 * `--sidebar` ground and would measure badly here.
 */
"use client";

import { History } from "lucide-react";
import { StatePanel, cn } from "@elabs-ai/components-ui";
import { DEMO_CHANGE_LOG, type ChangeEntry } from "./settings-content";

export interface ChangeHistoryProps {
  /** Entries to render, newest first. @default DEMO_CHANGE_LOG */
  entries?: ChangeEntry[];
  className?: string;
}

export function ChangeHistory({ entries = DEMO_CHANGE_LOG, className }: ChangeHistoryProps) {
  if (entries.length === 0) {
    return (
      <StatePanel
        kind="empty"
        icon={<History />}
        title="No changes yet"
        description="Every settings change lands here with who made it."
        className={className}
      />
    );
  }

  return (
    <ol data-slot="change-history" className={cn("flex flex-col gap-4", className)}>
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-meta font-semibold text-secondary-foreground"
          >
            {entry.initials}
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="text-body text-foreground">{entry.summary}</p>
            {/* One line, three facts, in the order someone scanning wants
                them: who, where, when. */}
            <p className="text-meta text-muted-foreground">
              {entry.actor} · {entry.area} · {entry.at}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
