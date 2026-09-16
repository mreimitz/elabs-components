/**
 * `CaseTable`'s default column set — RM-055.
 *
 * A column CONFIGURATION over `@elabs-ai/components-data`'s `DataTable`, not a table
 * implementation: every cell either prints a `CaseRow` field as-is or formats it with a
 * helper this package already ships (`formatDurationMs`), plus one `StatusBadge` for the
 * three-state conformance flag. See `.claude/rules/data.md` — "primitives go down,
 * compositions go up". Plain `.ts` (no JSX) — the one cell that renders a component
 * (`conformance`) builds it with `createElement`.
 *
 * Message KEYS, not resolved text, at module scope (mirrors `gantt.tsx`'s
 * `VIEW_MODE_LABEL_KEYS` — `t()` needs a hook, unavailable here); `createCaseTableColumns`
 * resolves them at the call site, which always has `useLocale()`.
 */
import { createElement } from "react";
import { CheckCircle2, AlertCircle, type LucideIcon } from "lucide-react";
import { type ColumnDef } from "@elabs-ai/components-data";
import { StatusBadge, type LocaleContextValue, type StatusTone } from "@elabs-ai/components-ui";
import type { CaseRow } from "../core/cases-from-log";
import { formatDurationMs } from "../process-map/map-model";

export const CASE_TABLE_COLUMN_LABEL_KEYS = {
  caseId: "process.caseTable.columnCaseId",
  start: "process.caseTable.columnStart",
  end: "process.caseTable.columnEnd",
  duration: "process.caseTable.columnDuration",
  eventCount: "process.caseTable.columnEventCount",
  variantId: "process.caseTable.columnVariant",
  conformance: "process.caseTable.columnConformance",
} as const;

const CONFORMANCE_LABEL_KEYS: Record<NonNullable<CaseRow["conformance"]>, string> = {
  conforming: "process.caseTable.conformanceConforming",
  nonConforming: "process.caseTable.conformanceNonConforming",
  unknown: "process.caseTable.conformanceUnknown",
};

/**
 * Maps a `CaseRow.conformance` value onto `StatusBadge`'s calm-only escape hatch (#363) —
 * a domain-specific three-state flag, not one of `StatusBadge`'s own canonical 7 statuses.
 */
function conformanceStatus(
  conformance: CaseRow["conformance"],
  t: LocaleContextValue["t"],
): { label: string; tone: StatusTone; icon?: LucideIcon } {
  switch (conformance) {
    case "conforming":
      return { label: t(CONFORMANCE_LABEL_KEYS.conforming), tone: "success", icon: CheckCircle2 };
    case "nonConforming":
      return {
        label: t(CONFORMANCE_LABEL_KEYS.nonConforming),
        tone: "destructive",
        icon: AlertCircle,
      };
    case "unknown":
    default:
      return { label: t(CONFORMANCE_LABEL_KEYS.unknown), tone: "neutral" };
  }
}

export interface CreateCaseTableColumnsOptions {
  t: LocaleContextValue["t"];
  formatDate: LocaleContextValue["formatDate"];
}

/** The default `CaseTable` column set. Reproduce this shape (or subset it) to customize. */
export function createCaseTableColumns({
  t,
  formatDate,
}: CreateCaseTableColumnsOptions): ColumnDef<CaseRow>[] {
  return [
    {
      accessorKey: "caseId",
      header: t(CASE_TABLE_COLUMN_LABEL_KEYS.caseId),
    },
    {
      accessorKey: "start",
      header: t(CASE_TABLE_COLUMN_LABEL_KEYS.start),
      cell: ({ getValue }) => {
        const value = getValue<string>();
        return value ? formatDate(new Date(value)) : "—";
      },
    },
    {
      accessorKey: "end",
      header: t(CASE_TABLE_COLUMN_LABEL_KEYS.end),
      cell: ({ getValue }) => {
        const value = getValue<string>();
        return value ? formatDate(new Date(value)) : "—";
      },
    },
    {
      accessorKey: "durationMs",
      header: t(CASE_TABLE_COLUMN_LABEL_KEYS.duration),
      meta: { numeric: true },
      cell: ({ getValue }) => formatDurationMs(getValue<number>()),
    },
    {
      accessorKey: "eventCount",
      header: t(CASE_TABLE_COLUMN_LABEL_KEYS.eventCount),
      meta: { numeric: true },
    },
    {
      accessorKey: "variantId",
      header: t(CASE_TABLE_COLUMN_LABEL_KEYS.variantId),
    },
    {
      accessorKey: "conformance",
      header: t(CASE_TABLE_COLUMN_LABEL_KEYS.conformance),
      cell: ({ getValue }) => {
        const status = conformanceStatus(getValue<CaseRow["conformance"]>(), t);
        return createElement(StatusBadge, { status, size: "sm" });
      },
    },
  ];
}
