"use client";

import { forwardRef, useMemo, useState, type FocusEvent, type ReactNode } from "react";
import {
  SchemaFormFields,
  SchemaFormProvider,
  SchemaFormRoot,
  SideDock,
  findFieldByName,
  type FormSpec,
  type FormValues,
  type SideDockProps,
} from "@elabs-ai/components-ui";

import { compileCondition } from "../core/expression";
import {
  useDashboard,
  useDashboardActions,
  useDashboardContext,
} from "../dashboard-sheet/use-dashboard";
import {
  commonTileForm,
  isTextField,
  resolvePanelLabels,
  tileFormValues,
  tilePatchFromValues,
  withConfigForm,
  type DashboardPanelLabels,
} from "./common-tile-form";
import { sheetForm, sheetFormValues, sheetSpecFromValues } from "./sheet-form";

export interface DashboardPropertiesPanelProps extends Omit<
  SideDockProps,
  "title" | "side" | "children"
> {
  /** Dock heading; defaults to the sheet or tile the form edits. */
  title?: ReactNode;
  /** Strings; merged over `DEFAULT_DASHBOARD_PANEL_LABELS`. */
  labels?: Partial<DashboardPanelLabels>;
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** Keys whose value differs between two value objects. */
function changedKeys(next: FormValues, base: FormValues): string[] {
  return Object.keys(next).filter((key) => JSON.stringify(next[key]) !== JSON.stringify(base[key]));
}

interface PanelFormProps {
  form: FormSpec;
  base: FormValues;
  /** Returns an error message for `values`, or `null`. */
  validate?: (changed: FormValues) => string | null;
  onCommit: (changed: FormValues) => void;
}

/**
 * One properties form. Text controls keep a draft and commit on blur or Enter; every other control
 * commits on change. Each commit is ONE history step.
 */
function PanelForm({ form, base, validate, onCommit }: PanelFormProps) {
  const [draft, setDraft] = useState<FormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const values = draft ?? base;

  const commit = (next: FormValues) => {
    const keys = changedKeys(next, base);
    if (keys.length === 0) {
      setDraft(null);
      setError(null);
      return;
    }
    const changed = Object.fromEntries(keys.map((key) => [key, next[key]]));
    const problem = validate?.(changed) ?? null;
    setError(problem);
    if (problem) return;
    onCommit(changed);
    setDraft(null);
  };

  const onChange = (next: FormValues) => {
    const keys = changedKeys(next, values);
    const immediate = keys.some((key) => !isTextField(findFieldByName(form.fields, key)));
    if (immediate) commit(next);
    else setDraft(next);
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    // Leaving any text control commits its edit (one field per blur).
    if (draft && event.target !== event.currentTarget) commit(draft);
  };

  return (
    <SchemaFormProvider
      spec={{ ...form, fields: form.fields }}
      values={values}
      onChange={onChange}
      onSubmit={() => {
        if (draft) commit(draft);
      }}
    >
      <div data-slot="dashboard-properties-panel-form" onBlur={onBlur}>
        <SchemaFormRoot>
          {error ? (
            <p
              role="alert"
              data-slot="dashboard-properties-panel-error"
              className="text-caption text-destructive-text"
            >
              {error}
            </p>
          ) : null}
          <SchemaFormFields />
        </SchemaFormRoot>
      </div>
    </SchemaFormProvider>
  );
}

function validateCondition(changed: FormValues, key: string): string | null {
  const source = changed[key];
  if (typeof source !== "string" || source.trim() === "") return null;
  try {
    compileCondition(source);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

/**
 * The edit-mode right panel (RM-080): a `SideDock` whose `SchemaForm` edits the sheet when nothing
 * is focused, the focused tile (common sections, then the kind's `configForm`) when one is, and the
 * common sections of every focused tile when several are. Values commit on blur/Enter through the
 * store, one history step per edit; a `visibleWhen`/`showCondition` that does not compile shows the
 * error and does not commit.
 */
export const DashboardPropertiesPanel = forwardRef<HTMLElement, DashboardPropertiesPanelProps>(
  function DashboardPropertiesPanel(
    { title, labels: labelsProp, overlayBreakpoint = 1024, ...props },
    ref,
  ) {
    const { registry } = useDashboardContext();
    const actions = useDashboardActions();
    const labels = useMemo(() => resolvePanelLabels(labelsProp), [labelsProp]);
    const spec = useDashboard((s) => s.spec);
    const focus = useDashboard((s) => s.focus, sameList);
    const selectionFields = useDashboard((s) => JSON.stringify(Object.keys(s.selection.fields)));

    const knownFields = useMemo(() => {
      const names = new Set(JSON.parse(selectionFields) as string[]);
      for (const filter of spec.filters ?? []) names.add(filter.field);
      return [...names];
    }, [selectionFields, spec.filters]);

    const tiles = focus
      .map((id) => spec.tiles.find((tile) => tile.id === id))
      .filter((tile) => tile !== undefined);
    const first = tiles[0];
    const kind = tiles.length === 1 && first ? registry.get(first.kind) : undefined;

    const form = useMemo(() => {
      if (!first) return sheetForm(labels);
      const common = commonTileForm(labels, knownFields);
      if (!kind || kind.configForm.fields.length === 0) return common;
      return withConfigForm(common, kind.configForm, labels.contentSection(kind.label));
    }, [first, kind, labels, knownFields]);

    const base = first ? tileFormValues(first, form, knownFields) : sheetFormValues(spec, labels);

    const heading =
      title ??
      (tiles.length > 1
        ? labels.focusedCount(tiles.length)
        : first
          ? first.title || kind?.label || first.kind
          : labels.propertiesTitle);

    const commitSheet = (changed: FormValues) => {
      const current = sheetFormValues(spec, labels);
      actions.batch(() => actions.setSpec(sheetSpecFromValues({ ...current, ...changed }, spec)));
    };

    const commitTiles = (changed: FormValues) => {
      actions.batch(() => {
        for (const tile of tiles) {
          const values = { ...tileFormValues(tile, form, knownFields), ...changed };
          actions.patchTile(tile.id, tilePatchFromValues(values, tile, tiles.length === 1));
        }
      });
    };

    return (
      <SideDock
        ref={ref}
        side="right"
        title={heading}
        overlayBreakpoint={overlayBreakpoint}
        data-dashboard-panel="properties"
        {...props}
      >
        <PanelForm
          key={first ? `tiles:${focus.join(",")}` : "sheet"}
          form={form}
          base={base}
          validate={(changed) =>
            validateCondition(changed, first ? "visibleWhen" : "showCondition")
          }
          onCommit={first ? commitTiles : commitSheet}
        />
      </SideDock>
    );
  },
);
