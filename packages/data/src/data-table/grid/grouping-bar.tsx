"use client";

/**
 * grouping-bar.tsx — names a grid's row grouping ("Grouped by Desk › Trader"),
 * each level removable, with Expand all / Collapse all. Rendered only while
 * rows are grouped: the ungrouped state is the bar's absence.
 */
import { ChevronRight, X } from "lucide-react";
import { Button, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export interface GroupingBarProps {
  groups: Array<{ id: string; label: string }>;
  onRemove: (id: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export function GroupingBar({ groups, onRemove, onExpandAll, onCollapseAll }: GroupingBarProps) {
  const { t } = useLocale();
  return (
    <div
      role="group"
      aria-label={t("data.table.groupingBar")}
      data-slot="data-table-grouping-bar"
      className="flex min-w-0 flex-wrap items-center gap-1.5"
    >
      <span className="text-meta text-muted-foreground">{t("data.table.groupedBy")}</span>
      {groups.map((group, index) => (
        <span key={group.id} className="inline-flex items-center gap-1.5">
          {index > 0 && (
            <ChevronRight
              aria-hidden="true"
              className="size-3 text-muted-foreground rtl:rotate-180"
            />
          )}
          <button
            type="button"
            data-slot="data-table-grouping-chip"
            aria-label={t("data.table.removeGrouping", { name: group.label })}
            onClick={() => onRemove(group.id)}
            className={cn(
              "group inline-flex min-h-6 items-center gap-1 rounded-full bg-secondary ps-2.5 pe-1.5 text-meta font-medium text-secondary-foreground",
              "transition-colors duration-fast ease-standard hover:bg-secondary/70 focus-ring",
            )}
          >
            <span className="min-w-0 truncate">{group.label}</span>
            <X
              aria-hidden="true"
              className="size-3 shrink-0 opacity-60 transition-opacity duration-fast ease-standard group-hover:opacity-100"
            />
          </button>
        </span>
      ))}
      <Button variant="ghost" size="sm" className="h-6 px-2" onClick={onExpandAll}>
        {t("data.table.expandAll")}
      </Button>
      <Button variant="ghost" size="sm" className="h-6 px-2" onClick={onCollapseAll}>
        {t("data.table.collapseAll")}
      </Button>
    </div>
  );
}
