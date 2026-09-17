"use client";

/**
 * `WorkbookNav` (RM-087) — the sheet navigator (analysis §2.0's 16-sheet tenant app): a
 * `ui/Tabs` tablist, one trigger per VISIBLE sheet (a `showCondition: false` sheet is simply
 * absent — never disabled, never announced). `DashboardWorkbook` owns which sheet is actually
 * mounted; this only picks the id.
 */
import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
} from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@elabs-ai/components-ui";

import type { DashboardSpec } from "../core/spec";
import type { WorkbookProgrammaticSwitch } from "./use-workbook";

export interface WorkbookNavLabels {
  /** Accessible name of a sheet with no title. */
  untitledSheet: (id: string) => string;
  /** Announced (polite) after a drill or a `sheetId`-bearing bookmark switches the active sheet
   * — never for a direct tab click/arrow, which needs no announcement (#429). */
  showingSheet: (title: string) => string;
}

export const DEFAULT_WORKBOOK_NAV_LABELS: WorkbookNavLabels = {
  untitledSheet: (id) => id,
  showingSheet: (title) => `Showing sheet ${title}.`,
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
  /** `useWorkbook`'s `programmaticSwitch` (#429) — a drill/bookmark switch focuses the newly
   * active tab and announces it here; a direct tab click/arrow (which never sets this) does
   * neither, so it never gets a double announcement or an unexpected focus jump. */
  switchSignal?: WorkbookProgrammaticSwitch | null;
}

export const WorkbookNav = forwardRef<ElementRef<typeof Tabs>, WorkbookNavProps>(
  function WorkbookNav(
    { sheets, activeSheetId, onActiveSheetChange, labels, switchSignal, className, ...props },
    ref,
  ) {
    const mergedLabels = { ...DEFAULT_WORKBOOK_NAV_LABELS, ...labels };
    const triggerRefs = useRef(new Map<string, HTMLButtonElement | null>());
    const lastNonceRef = useRef<number | undefined>(undefined);
    const [announcement, setAnnouncement] = useState("");
    const sheetTitle = useMemo(() => {
      const map = new Map<string, string>();
      for (const sheet of sheets)
        map.set(sheet.id, sheet.title ?? mergedLabels.untitledSheet(sheet.id));
      return map;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sheets]);

    // Fires only for a PROGRAMMATIC switch (drill/bookmark) — a direct tab click/arrow leaves
    // `switchSignal` untouched, so Radix's own click/keyboard focus handling is never overridden
    // and nothing is announced twice.
    useEffect(() => {
      if (!switchSignal || switchSignal.nonce === lastNonceRef.current) return;
      lastNonceRef.current = switchSignal.nonce;
      triggerRefs.current.get(switchSignal.sheetId)?.focus();
      const title = sheetTitle.get(switchSignal.sheetId) ?? switchSignal.sheetId;
      const message = mergedLabels.showingSheet(title);
      // A repeat switch to the same sheet still re-announces: alternate a trailing no-break space.
      setAnnouncement((prev) => (prev === message ? `${message}\u00a0` : message));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [switchSignal, sheetTitle]);

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
            <TabsTrigger
              key={sheet.id}
              value={sheet.id}
              ref={(el) => {
                triggerRefs.current.set(sheet.id, el);
              }}
            >
              {sheetTitle.get(sheet.id)}
            </TabsTrigger>
          ))}
        </TabsList>
        {/* Empty — `DashboardWorkbook` renders the active sheet itself, elsewhere in the tree.
         * Each `TabsTrigger`'s `aria-controls` still needs a real target of a matching id
         * (`aria-valid-attr-value`); this supplies one without duplicating any content. */}
        {sheets.map((sheet) => (
          <TabsContent key={sheet.id} value={sheet.id} className="hidden" />
        ))}
        {/* One polite live region for this nav (#429) — a direct tab click/arrow never sets
         * `switchSignal`, so it never fires this region. */}
        <div role="status" aria-live="polite" data-slot="workbook-nav-status" className="sr-only">
          {announcement}
        </div>
      </Tabs>
    );
  },
);
