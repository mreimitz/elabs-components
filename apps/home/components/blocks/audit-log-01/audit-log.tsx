// registry: audit-log-01 — copied 2026-09-19
"use client";

import {
  Card,
  CardContent,
  STATUS_TONE_ICONS,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@elabs-ai/components-ui";
import type { CustomStatus } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { auditEntries, type AuditEntry, type AuditResult } from "../agent-ops-parts/data/atlas-ops";
import { formatClock, formatCount } from "../agent-ops-parts/format";
import { ActorAvatar } from "../agent-ops-parts/provenance";

/**
 * The four audit outcomes mapped ONCE to `StatusBadge`’s tone hatch. "Held"
 * is deliberately the warning rung, not destructive: a held run is the flow
 * refusing to do something a person should decide, counted separately from
 * failures so the success rate stays honest.
 */
const RESULT_STATUS: Record<AuditResult, CustomStatus> = {
  applied: { label: "Applied", tone: "success", icon: STATUS_TONE_ICONS.success },
  held: { label: "Held", tone: "warning", icon: STATUS_TONE_ICONS.warning },
  stopped: { label: "Stopped", tone: "destructive", icon: STATUS_TONE_ICONS.destructive },
  reverted: { label: "Reverted", tone: "neutral" },
};

export interface AuditLogProps {
  entries?: AuditEntry[];
  /** Total entries in the log today, for the header count (the table may show a page of them). */
  totalToday?: number;
  /** Retention statement shown under the title, e.g. "Append-only · retained seven years". */
  retention?: string;
  locale?: string;
  className?: string;
}

/**
 * An audit log where the ACTOR column tells three kinds of author apart by
 * glyph — the copilot (sparkle), a delegated agent (bot) and a person
 * (monogram) — and the RESULT column is a status badge with an icon, so a
 * row still reads in greyscale. Timestamps are monospace and tabular so the
 * column scans as a column; the action is one plain sentence with the
 * number it wrote in it ("Set close date to 12 Sep; kept the pinned value").
 */
export function AuditLog({
  entries = auditEntries,
  totalToday = 1_284,
  retention = "Append-only · retained seven years",
  locale = "en-US",
  className,
}: AuditLogProps) {
  return (
    <Card className={cn("@container", className)} data-slot="audit-log">
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-subtitle text-foreground">Entries</h3>
            <p className="text-caption text-muted-foreground">
              {retention} · {formatCount(totalToday, locale)} entries today
            </p>
          </div>
          <p className="text-caption text-muted-foreground">newest first</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Time</TableHead>
              <TableHead className="w-44">Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead className="hidden @2xl:table-cell">Object</TableHead>
              <TableHead className="w-28 text-end">Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow data-slot="audit-log-row" key={e.id}>
                <TableCell className="font-mono text-code tabular-nums text-muted-foreground">
                  {formatClock(e.at, locale, true)}
                </TableCell>
                <TableCell>
                  <ActorAvatar actor={e.actor} />
                </TableCell>
                <TableCell className="text-body text-foreground">
                  <span>{e.action}</span>
                  <span className="block text-caption text-muted-foreground @2xl:hidden">
                    {e.object}
                  </span>
                </TableCell>
                <TableCell className="hidden text-body text-muted-foreground @2xl:table-cell">
                  {e.object}
                </TableCell>
                <TableCell className="text-end">
                  <StatusBadge status={RESULT_STATUS[e.result]} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
