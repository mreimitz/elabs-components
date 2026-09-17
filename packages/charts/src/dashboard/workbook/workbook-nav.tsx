"use client";

/**
 * `WorkbookNav` (RM-087) — the sheet navigator (analysis §2.0's 16-sheet tenant app): a
 * `ui/Tabs` tablist, one trigger per VISIBLE sheet (a `showCondition: false` sheet is simply
 * absent — never disabled, never announced). `DashboardWorkbook` owns which sheet is actually
 * mounted; this only picks the id.
 */
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@elabs-ai/components-ui";

import type { DashboardSpec } from "../core/spec";

export interface WorkbookNavLabels {
  /** Accessible name of a sheet with no title. */
  untitledSheet: (id: string) => string;
}

export const DEFAULT_WORKBOOK_NAV_LABELS: WorkbookNavLabels = {
  untitledSheet: (id) => id,
};

export interface WorkbookNavProps extends Omit<
  ComponentPropsWithoutRef<typeof Tabs>,
  "value" | "onValueChange" | "defaultValue" | "children"
> {
  /** Sheets to show as tabs — already filtered to visible ones (`visibleWorkbookSheets`). */
  sheets: DashboardSpec[];
  activeSheetId: string;
  onActiveSheetChange: (sheetId: string) => void;
  labels?: Partial<WorkbookNavLabels>;
}

export const WorkbookNav = forwardRef<ElementRef<typeof Tabs>, WorkbookNavProps>(
  function WorkbookNav(
    { sheets, activeSheetId, onActiveSheetChange, labels, className, ...props },
    ref,
  ) {
    const mergedLabels = { ...DEFAULT_WORKBOOK_NAV_LABELS, ...labels };
    return (
      <Tabs
        ref={ref}
        data-slot="workbook-nav"
        value={activeSheetId}
        onValueChange={onActiveSheetChange}
        className={cn(className)}
        {...props}
      >
        <TabsList>
          {sheets.map((sheet) => (
            <TabsTrigger key={sheet.id} value={sheet.id}>
              {sheet.title ?? mergedLabels.untitledSheet(sheet.id)}
            </TabsTrigger>
          ))}
        </TabsList>
        {/* Empty — `DashboardWorkbook` renders the active sheet itself, elsewhere in the tree.
         * Each `TabsTrigger`'s `aria-controls` still needs a real target of a matching id
         * (`aria-valid-attr-value`); this supplies one without duplicating any content. */}
        {sheets.map((sheet) => (
          <TabsContent key={sheet.id} value={sheet.id} className="hidden" />
        ))}
      </Tabs>
    );
  },
);
