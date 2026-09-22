"use client";

import { forwardRef, useMemo, useState, type FocusEvent, type ReactNode } from "react";
import {
  Label,
  NumberInput,
  SchemaFormFields,
  SchemaFormProvider,
  SchemaFormRoot,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SideDock,
  Switch,
  findFieldByName,
  toast,
  useLocale,
  type FormSpec,
  type FormValues,
  type SideDockProps,
} from "@elabs-ai/components-ui";
import { Lock } from "lucide-react";

import { compileCondition } from "../core/expression";
import type { TileSpec } from "../core/spec";
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
// interaction graph — RM-082
import { DashboardInteractionsDialog } from "./dashboard-interactions-editor";
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

// responsive layout — RM-084 follow-up 1
/**
 * "Edit layout for: Base / Medium (md) / Small (sm)" — which layout `moveTile`/`resizeTile`
 * write to (`ui.layoutTarget`, `core/store.ts`). Sheet-wide, not tied to the focused tile, so
 * it sits above the per-tile/per-sheet `PanelForm` rather than inside one of its sections.
 */
function LayoutTargetSelect({ labels }: { labels: DashboardPanelLabels }) {
  const actions = useDashboardActions();
  const target = useDashboard((s) => s.ui.layoutTarget);
  const options = labels.layoutTargetOptions;
  return (
    <div
      data-slot="dashboard-properties-panel-layout-target"
      className="flex items-center justify-between gap-2 px-1 pb-2"
    >
      <span className="text-caption whitespace-nowrap text-muted-foreground">
        {labels.editLayoutFor}
      </span>
      <Select
        value={target}
        onValueChange={(next) => actions.setLayoutTarget(next as "base" | "md" | "sm")}
      >
        <SelectTrigger size="sm" className="min-w-28" aria-label={labels.editLayoutFor}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="base">{options.base}</SelectItem>
          <SelectItem value="md">{options.md}</SelectItem>
          <SelectItem value="sm">{options.sm}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * The focused tile's cells as four numbers (1-based column/row for the reader, whole cells)
 * plus the lock. Each change is one `moveTile`/`resizeTile` (push strategy, one history
 * step); a size or place with no room is refused with a toast and the field snaps back.
 */
function TileLayoutFields({ tile }: { tile: TileSpec }) {
  const { t } = useLocale();
  const actions = useDashboardActions();
  const columns = useDashboard((s) => s.spec.grid.columns);
  const rows = useDashboard((s) => (s.spec.grid.mode === "fit" ? (s.spec.grid.rows ?? 12) : 999));
  const locked = Boolean(tile.layout.static);
  const refuse = () => toast(t("charts.dashboard.properties.noRoom"));
  const field = (
    key: "x" | "y" | "w" | "h",
    label: string,
    value: number,
    min: number,
    max: number,
    apply: (next: number) => boolean,
  ) => {
    const id = `tile-layout-${tile.id}-${key}`;
    return (
      <div className="flex flex-col gap-1">
        <Label htmlFor={id} className="text-meta text-muted-foreground">
          {label}
        </Label>
        <NumberInput
          id={id}
          value={value}
          min={min}
          max={max}
          disabled={locked}
          onValueChange={(next) => {
            if (next === null || next === value) return;
            if (!apply(Math.round(next))) refuse();
          }}
        />
      </div>
    );
  };
  const { x, y, w, h } = tile.layout;
  return (
    <section
      data-slot="dashboard-properties-panel-layout"
      aria-label={t("charts.dashboard.properties.layout")}
      className="space-y-3 border-b border-border pb-3"
    >
      <h3 className="text-subtitle text-foreground">{t("charts.dashboard.properties.layout")}</h3>
      <div className="grid grid-cols-2 gap-2">
        {field("x", t("charts.dashboard.properties.column"), x + 1, 1, columns, (n) =>
          actions.moveTile(tile.id, { x: n - 1, y }),
        )}
        {field("y", t("charts.dashboard.properties.row"), y + 1, 1, rows, (n) =>
          actions.moveTile(tile.id, { x, y: n - 1 }),
        )}
        {field("w", t("charts.dashboard.properties.width"), w, 1, columns, (n) =>
          actions.resizeTile(tile.id, { w: n, h }),
        )}
        {field("h", t("charts.dashboard.properties.height"), h, 1, rows, (n) =>
          actions.resizeTile(tile.id, { w, h: n }),
        )}
      </div>
      <label className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="inline-flex items-center gap-1.5 text-body text-foreground">
            <Lock aria-hidden="true" className="size-3.5 text-muted-foreground" />
            {t("charts.dashboard.edit.lock")}
          </span>
          <span className="text-meta text-muted-foreground">
            {t("charts.dashboard.properties.lockedDescription")}
          </span>
        </span>
        <Switch
          checked={locked}
          onCheckedChange={(checked) => {
            const { static: _was, ...rest } = tile.layout;
            actions.patchTile(tile.id, { layout: checked ? { ...rest, static: true } : rest });
          }}
        />
      </label>
    </section>
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
        // The sheet mounts inside a host layout that may itself pin an app
        // `Sidebar`/chrome to the SAME viewport edge — "inset" keeps this
        // dock's fixed container scoped to its own layout slot instead of
        // racing that chrome for the viewport edge (#432).
        containerPosition="inset"
        data-dashboard-panel="properties"
        {...props}
      >
        <LayoutTargetSelect labels={labels} />
        {tiles.length === 1 && first && !first.container ? <TileLayoutFields tile={first} /> : null}
        <PanelForm
          key={first ? `tiles:${focus.join(",")}` : "sheet"}
          form={form}
          base={base}
          validate={(changed) =>
            validateCondition(changed, first ? "visibleWhen" : "showCondition")
          }
          onCommit={first ? commitTiles : commitSheet}
        />
        {/* interaction graph — RM-082: exactly one focused tile edits its own interaction row. */}
        {tiles.length === 1 && first ? (
          <div data-slot="dashboard-properties-panel-interactions" className="px-1 pt-2">
            <DashboardInteractionsDialog
              key={first.id}
              triggerLabel={labels.editInteractions}
              tileId={first.id}
            />
          </div>
        ) : null}
      </SideDock>
    );
  },
);
