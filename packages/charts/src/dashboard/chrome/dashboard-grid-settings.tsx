"use client";

/**
 * `DashboardGridSettings` (RM-079, analysis §2.0's sheet-properties panel: Grid spacing,
 * Sheet size, Extend sheet) — the form `DashboardToolbar`'s "Grid" popover renders. A plain
 * controlled form over one `GridSpec`: every edit calls `onChange` with the fields that
 * actually changed, so the caller can route them through `actions.setGrid` as ONE history
 * entry (RM-071's `setGrid`, extended here to rescale layouts when the density changes —
 * `core/store.ts`).
 *
 * "Extend sheet" is not a persistent flag alone: flipping it on also grows the grid by 50 %
 * of its ORIGINAL rows right away (`core/layout.ts`'s `extendRows`), matching the maintainer
 * tenant's own "Extend sheet" toggle (docs/review/2026-09-16-dashboard-surface-analysis.md
 * §2.0/§4 R17). Flipping it off only stops future auto-growth; it never shrinks rows back.
 */
import { useMemo } from "react";
import {
  SchemaFormFields,
  SchemaFormProvider,
  SchemaFormRoot,
  useLocale,
  type FormSpec,
  type FormValues,
} from "@elabs-ai/components-ui";

import { extendRows } from "../core/layout";
import type { GridSpec } from "../core/spec";

export interface DashboardGridSettingsProps {
  /** The sheet's current grid. */
  grid: GridSpec;
  /** Called with only the fields that changed — route it through `actions.setGrid`. */
  onChange: (patch: Partial<GridSpec>) => void;
  className?: string;
}

function gridToValues(grid: GridSpec): FormValues {
  return {
    mode: grid.mode,
    density: grid.density ?? "custom",
    columns: grid.columns,
    rows: grid.rows ?? 12,
    rowHeight: grid.rowHeight ?? 30,
    gap: grid.gap ?? 8,
    extendable: grid.extendable ?? false,
  };
}

/** The grid-settings form: mode, density (or custom columns/rows), row height, gap, extend. */
export function DashboardGridSettings({ grid, onChange, className }: DashboardGridSettingsProps) {
  const { t } = useLocale();

  const spec: FormSpec = useMemo(
    () => ({
      formName: "dashboard-grid-settings",
      title: t("charts.dashboard.toolbar.gridSettings"),
      fields: [
        {
          type: "enum",
          name: "mode",
          label: t("charts.dashboard.grid.mode"),
          options: [
            { const: "fit", title: t("charts.dashboard.grid.modeFit") },
            { const: "flow", title: t("charts.dashboard.grid.modeFlow") },
          ],
        },
        {
          type: "enum",
          name: "density",
          label: t("charts.dashboard.grid.density"),
          options: [
            { const: "wide", title: t("charts.dashboard.grid.densityWide") },
            { const: "medium", title: t("charts.dashboard.grid.densityMedium") },
            { const: "narrow", title: t("charts.dashboard.grid.densityNarrow") },
            { const: "custom", title: t("charts.dashboard.grid.densityCustom") },
          ],
        },
        {
          type: "integer",
          name: "columns",
          label: t("charts.dashboard.grid.columns"),
          min: 1,
          max: 200,
          visibleWhen: { field: "density", equals: "custom" },
        },
        {
          type: "integer",
          name: "rows",
          label: t("charts.dashboard.grid.rows"),
          min: 1,
          max: 200,
          visibleWhen: { field: "density", equals: "custom" },
        },
        {
          type: "integer",
          name: "rowHeight",
          label: t("charts.dashboard.grid.rowHeight"),
          min: 1,
          max: 400,
          visibleWhen: { field: "mode", equals: "flow" },
        },
        {
          type: "integer",
          name: "gap",
          label: t("charts.dashboard.grid.gap"),
          min: 0,
          max: 64,
        },
        {
          type: "boolean",
          name: "extendable",
          label: t("charts.dashboard.grid.extendable"),
          description: t("charts.dashboard.grid.extendableDescription"),
        },
      ],
    }),
    [t],
  );

  function handleChange(next: FormValues) {
    const nextExtendable = Boolean(next.extendable);
    if (nextExtendable !== (grid.extendable ?? false)) {
      if (nextExtendable) {
        const grown = extendRows(grid);
        // Force `density: "custom"` in the SAME patch: `core/store.ts`'s `commit()` runs the
        // spec normaliser, whose `resolveGrid` re-locks `rows` to the density preset's own
        // value on every commit — growing `rows` while a NAMED preset (wide/medium/narrow)
        // is still set would silently snap straight back. This also keeps `setGrid`'s
        // rescale (a PRESET-to-PRESET switch only, see `store.ts`) from firing here: it
        // would stretch every tile instead of simply adding empty room below them.
        onChange({
          extendable: true,
          density: "custom",
          rows: grown.rows,
          extensions: grown.extensions,
        });
      } else {
        onChange({ extendable: false });
      }
      return;
    }

    const patch: Partial<GridSpec> = {};
    if (next.mode !== grid.mode) patch.mode = next.mode as GridSpec["mode"];
    const nextDensity = (next.density as GridSpec["density"]) ?? "custom";
    if (nextDensity !== (grid.density ?? "custom")) patch.density = nextDensity;
    if (nextDensity === "custom") {
      if (Number(next.columns) !== grid.columns) patch.columns = Number(next.columns);
      if (Number(next.rows) !== (grid.rows ?? 12)) patch.rows = Number(next.rows);
    }
    if (Number(next.rowHeight) !== (grid.rowHeight ?? 30)) patch.rowHeight = Number(next.rowHeight);
    if (Number(next.gap) !== (grid.gap ?? 8)) patch.gap = Number(next.gap);
    if (Object.keys(patch).length > 0) onChange(patch);
  }

  return (
    <div data-slot="dashboard-grid-settings" className={className}>
      <SchemaFormProvider spec={spec} values={gridToValues(grid)} onChange={handleChange}>
        <SchemaFormRoot>
          <SchemaFormFields />
        </SchemaFormRoot>
      </SchemaFormProvider>
    </div>
  );
}
