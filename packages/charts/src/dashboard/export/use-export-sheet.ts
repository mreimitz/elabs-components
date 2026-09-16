"use client";

/**
 * `useExportSheet` (RM-084) — the toolbar's seam onto `exportSheet`: reads `{ store, registry }`
 * from the dashboard context, tracks a `busy` flag while the (async, off-screen) export runs,
 * and either hands the result to `onExport` (mirrors `ChartFrame`'s own export seam) or
 * downloads it via `@elabs-ai/components-ui`'s `downloadBlob`.
 */
import { useCallback, useState } from "react";
import { downloadBlob } from "@elabs-ai/components-ui";

import { useDashboardContext } from "../dashboard-sheet/use-dashboard";
import { exportSheet, type ExportSheetFormat, type ExportSheetOptions } from "./export-sheet";

export interface UseExportSheetOptions {
  /** Routes the export to the caller instead of a local browser download. */
  onExport?: (kind: ExportSheetFormat, blob: Blob, filename: string) => void;
  /** Forwarded to `exportSheet` — export size, scale, title/source rows. */
  export?: Omit<ExportSheetOptions, "format">;
}

export interface UseExportSheetResult {
  /** `true` while an export is running (busy state for the toolbar's menu). */
  busy: boolean;
  exportSvg: () => Promise<void>;
  exportPng: () => Promise<void>;
}

/** Wires `exportSheet` to the current sheet's `{ store, registry }`, with a `busy` flag. */
export function useExportSheet(options: UseExportSheetOptions = {}): UseExportSheetResult {
  const { store, registry } = useDashboardContext();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (format: ExportSheetFormat) => {
      setBusy(true);
      try {
        const { blob, filename } = await exportSheet(store, registry, {
          format,
          ...options.export,
        });
        if (options.onExport) options.onExport(format, blob, filename);
        else downloadBlob(blob, filename);
      } finally {
        setBusy(false);
      }
    },
    [store, registry, options],
  );

  return {
    busy,
    exportSvg: () => run("svg"),
    exportPng: () => run("png"),
  };
}
