/**
 * The properties panel's sheet form (RM-080): what the right panel shows with nothing focused —
 * title, description, show condition, grid, theme override and the on-open actions (read-only
 * here) — plus the mapping between a `DashboardSpec` and the form's flat `values`.
 */
import type { FormSpec, FormValues } from "@elabs-ai/components-ui";

import type { DashboardSpec, DashboardTheme } from "../core/spec";
import type { DashboardPanelLabels } from "./common-tile-form";

/** The sheet `FormSpec`. */
export function sheetForm(labels: DashboardPanelLabels): FormSpec {
  const f = labels.sheetFields;
  return {
    formName: "dashboard-sheet",
    fields: [
      { type: "string", name: "title", label: f.title },
      { type: "string", name: "description", label: f.description },
      { type: "string", name: "showCondition", label: f.showCondition },
      { type: "enum", name: "mode", label: f.mode, options: ["fit", "flow"] },
      { type: "integer", name: "columns", label: f.columns, min: 1 },
      { type: "integer", name: "rows", label: f.rows, min: 1 },
      { type: "integer", name: "gap", label: f.gap, min: 0 },
      { type: "boolean", name: "extendable", label: f.extendable },
      { type: "string", name: "themeFamily", label: f.themeFamily },
      { type: "enum", name: "themeMode", label: f.themeMode, options: ["light", "dark"] },
      { type: "string", name: "actions", label: f.actions, readOnly: true },
    ],
    sections: [
      {
        id: "general",
        label: labels.sheetSection.general,
        fields: ["title", "description", "showCondition"],
      },
      {
        id: "grid",
        label: labels.sheetSection.grid,
        fields: ["mode", "columns", "rows", "gap", "extendable"],
        collapsed: true,
      },
      {
        id: "theme",
        label: labels.sheetSection.theme,
        fields: ["themeFamily", "themeMode"],
        collapsed: true,
      },
      { id: "actions", label: labels.sheetSection.actions, fields: ["actions"], collapsed: true },
    ],
  };
}

/** The form values for a sheet. */
export function sheetFormValues(spec: DashboardSpec, labels: DashboardPanelLabels): FormValues {
  return {
    title: spec.title ?? "",
    description: spec.description ?? "",
    showCondition: spec.showCondition ?? "",
    mode: spec.grid.mode,
    columns: spec.grid.columns,
    rows: spec.grid.rows,
    gap: spec.grid.gap,
    extendable: Boolean(spec.grid.extendable),
    themeFamily: spec.theme?.family ?? "",
    themeMode: spec.theme?.mode,
    actions: labels.actionCount(spec.actions?.length ?? 0),
  };
}

const text = (value: unknown) =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;
const whole = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/** The next spec after applying the sheet form's `values`. */
export function sheetSpecFromValues(values: FormValues, spec: DashboardSpec): DashboardSpec {
  const next: DashboardSpec = {
    ...spec,
    title: text(values.title),
    description: text(values.description),
    showCondition: text(values.showCondition),
    grid: {
      ...spec.grid,
      mode: values.mode === "flow" ? "flow" : "fit",
      columns: whole(values.columns) ?? spec.grid.columns,
      rows: whole(values.rows) ?? spec.grid.rows,
      gap: whole(values.gap) ?? spec.grid.gap,
      extendable: values.extendable === true ? true : undefined,
    },
  };
  const theme: DashboardTheme = {
    ...spec.theme,
    family: text(values.themeFamily),
    mode:
      values.themeMode === "light" || values.themeMode === "dark" ? values.themeMode : undefined,
  };
  if (theme.family === undefined) delete theme.family;
  if (theme.mode === undefined) delete theme.mode;
  if (Object.keys(theme).length > 0) next.theme = theme;
  else delete next.theme;
  for (const key of ["title", "description", "showCondition"] as const)
    if (next[key] === undefined) delete next[key];
  if (next.grid.extendable === undefined) delete next.grid.extendable;
  return next;
}
