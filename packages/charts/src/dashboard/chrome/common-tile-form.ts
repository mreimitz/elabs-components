/**
 * The properties panel's tile form (RM-080): the `FormSpec` every tile shares — General, Visibility,
 * Interactions, Size — plus the mapping between a `TileSpec` and the form's flat `values`. A kind's
 * own `configForm` joins it with every field name prefixed `content.` (dotted paths address nested
 * content, e.g. `content.fields.category`).
 */
import type { FieldSpec, FormSpec, FormValue, FormValues } from "@elabs-ai/components-ui";

import type { TileSpec } from "../core/spec";
import type { TilePatch } from "../core/store";

/** Every visible string and accessible name the asset and properties panels render. */
export interface DashboardPanelLabels {
  assetsTitle: string;
  propertiesTitle: string;
  tiles: string;
  library: string;
  bookmarks: string;
  sheets: string;
  search: string;
  noResults: string;
  noRoom: string;
  /** Announced (polite) after a row places a tile; `x`/`y` are zero-based cells. */
  placed: (label: string, x: number, y: number) => string;
  sheetSection: { general: string; grid: string; theme: string; actions: string };
  sheetFields: {
    title: string;
    description: string;
    showCondition: string;
    mode: string;
    columns: string;
    rows: string;
    gap: string;
    extendable: string;
    themeFamily: string;
    themeMode: string;
    actions: string;
  };
  tileSection: { general: string; visibility: string; interactions: string; size: string };
  tileFields: {
    title: string;
    subtitle: string;
    footnote: string;
    source: string;
    visibleWhen: string;
    consumesSelection: string;
    emitsSelection: string;
    consumesHover: string;
    emitsHover: string;
    minW: string;
    minH: string;
    maxW: string;
    maxH: string;
    aspect: string;
  };
  /** Heading of the section holding a kind's own `configForm` fields. */
  contentSection: (kindLabel: string) => string;
  /** Summary of the sheet's on-open actions. */
  actionCount: (count: number) => string;
  /** Title of the properties panel while several tiles are focused. */
  focusedCount: (count: number) => string;
  // Interactions editor — RM-082
  /** The Interactions section's button opening `DashboardInteractionsDialog`. */
  editInteractions: string;
}

/** The panels' labels when the host passes none. */
export const DEFAULT_DASHBOARD_PANEL_LABELS: DashboardPanelLabels = {
  assetsTitle: "Assets",
  propertiesTitle: "Sheet properties",
  tiles: "Tiles",
  library: "Library",
  bookmarks: "Bookmarks",
  sheets: "Sheets",
  search: "Search…",
  noResults: "Nothing matches.",
  noRoom: "There is no room on the sheet for this tile.",
  placed: (label, x, y) => `${label} added at column ${x + 1}, row ${y + 1}.`,
  sheetSection: { general: "General", grid: "Grid", theme: "Theme", actions: "Actions" },
  sheetFields: {
    title: "Title",
    description: "Description",
    showCondition: "Show condition",
    mode: "Grid mode",
    columns: "Columns",
    rows: "Rows",
    gap: "Gap (px)",
    extendable: "Extendable",
    themeFamily: "Theme family",
    themeMode: "Theme mode",
    actions: "On open",
  },
  tileSection: {
    general: "General",
    visibility: "Visibility",
    interactions: "Interactions",
    size: "Size",
  },
  tileFields: {
    title: "Title",
    subtitle: "Subtitle",
    footnote: "Footnote",
    source: "Source",
    visibleWhen: "Show when",
    consumesSelection: "Listens to selections in",
    emitsSelection: "Publishes selections in",
    consumesHover: "Listens to hover",
    emitsHover: "Publishes hover",
    minW: "Minimum width (cells)",
    minH: "Minimum height (cells)",
    maxW: "Maximum width (cells)",
    maxH: "Maximum height (cells)",
    aspect: "Aspect ratio (width ÷ height)",
  },
  contentSection: (kindLabel) => kindLabel,
  actionCount: (count) => (count === 1 ? "1 action" : `${count} actions`),
  focusedCount: (count) => `${count} tiles`,
  // Interactions editor — RM-082
  editInteractions: "Edit interactions…",
};

/** Merge partial host labels over the defaults (one level of nesting). */
export function resolvePanelLabels(labels?: Partial<DashboardPanelLabels>): DashboardPanelLabels {
  const d = DEFAULT_DASHBOARD_PANEL_LABELS;
  if (!labels) return d;
  return {
    ...d,
    ...labels,
    sheetSection: { ...d.sheetSection, ...labels.sheetSection },
    sheetFields: { ...d.sheetFields, ...labels.sheetFields },
    tileSection: { ...d.tileSection, ...labels.tileSection },
    tileFields: { ...d.tileFields, ...labels.tileFields },
  };
}

/** Prefix of every field a kind's `configForm` contributes. */
export const CONTENT_FIELD_PREFIX = "content.";

/** Field types whose edits commit on blur/Enter; every other control commits on change. */
export function isTextField(field: FieldSpec | undefined): boolean {
  return (
    field?.type === "string" ||
    field?.type === "number" ||
    field?.type === "integer" ||
    field?.type === "list" ||
    field?.type === "key-value"
  );
}

/**
 * The common tile form. `knownFields` are the selection fields the sheet knows (driver + filters);
 * the selection toggles are offered only when there are some.
 */
export function commonTileForm(labels: DashboardPanelLabels, knownFields: string[]): FormSpec {
  const f = labels.tileFields;
  const selection: FieldSpec[] =
    knownFields.length > 0
      ? [
          {
            type: "multi-enum",
            name: "consumesSelection",
            label: f.consumesSelection,
            options: knownFields,
          },
          {
            type: "multi-enum",
            name: "emitsSelection",
            label: f.emitsSelection,
            options: knownFields,
          },
        ]
      : [];
  return {
    formName: "dashboard-tile",
    fields: [
      { type: "string", name: "title", label: f.title },
      { type: "string", name: "subtitle", label: f.subtitle },
      { type: "string", name: "footnote", label: f.footnote },
      { type: "string", name: "source", label: f.source },
      { type: "string", name: "visibleWhen", label: f.visibleWhen },
      ...selection,
      { type: "boolean", name: "consumesHover", label: f.consumesHover },
      { type: "boolean", name: "emitsHover", label: f.emitsHover },
      { type: "integer", name: "minW", label: f.minW, min: 1 },
      { type: "integer", name: "minH", label: f.minH, min: 1 },
      { type: "integer", name: "maxW", label: f.maxW, min: 1 },
      { type: "integer", name: "maxH", label: f.maxH, min: 1 },
      { type: "number", name: "aspect", label: f.aspect, min: 0 },
    ],
    sections: [
      {
        id: "general",
        label: labels.tileSection.general,
        fields: ["title", "subtitle", "footnote", "source"],
      },
      { id: "visibility", label: labels.tileSection.visibility, fields: ["visibleWhen"] },
      {
        id: "interactions",
        label: labels.tileSection.interactions,
        fields: [...selection.map((field) => field.name), "consumesHover", "emitsHover"],
        collapsed: true,
      },
      {
        id: "size",
        label: labels.tileSection.size,
        fields: ["minW", "minH", "maxW", "maxH", "aspect"],
        collapsed: true,
      },
    ],
  };
}

/** The common form followed by a kind's `configForm`, its fields prefixed `content.`. */
export function withConfigForm(common: FormSpec, config: FormSpec, sectionLabel: string): FormSpec {
  const rename = (name: string) => `${CONTENT_FIELD_PREFIX}${name}`;
  const fields = config.fields.map(
    (field) => ({ ...field, name: rename(field.name) }) as FieldSpec,
  );
  const sections = config.sections?.length
    ? config.sections.map((section) => ({
        ...section,
        id: rename(section.id),
        fields: section.fields.map(rename),
      }))
    : [{ id: "content", label: sectionLabel, fields: fields.map((field) => field.name) }];
  return {
    ...common,
    fields: [...common.fields, ...fields],
    sections: [...(common.sections ?? []), ...sections],
  };
}

const fieldsOf = (value: string[] | true | undefined, known: string[]) =>
  value === true ? known : (value ?? []);

/** Read a dotted path (`fields.category`) from a content object. */
function getPath(source: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (at, key) =>
        at && typeof at === "object" ? (at as Record<string, unknown>)[key] : undefined,
      source,
    );
}

/** A content value as a form value: a series object list reads as its keys. */
function toFormValue(value: unknown): FormValue {
  if (Array.isArray(value))
    return value.map((item) =>
      item && typeof item === "object" && "key" in item ? String(item.key) : String(item),
    );
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return value;
  return undefined;
}

/** The form values for one tile (common fields plus the `content.` fields of `form`). */
export function tileFormValues(tile: TileSpec, form: FormSpec, knownFields: string[]): FormValues {
  const values: FormValues = {
    title: tile.title ?? "",
    subtitle: tile.subtitle ?? "",
    footnote: tile.footnote ?? "",
    source: tile.source ?? "",
    visibleWhen: tile.visibleWhen ?? "",
    consumesSelection: fieldsOf(tile.consumes?.selection, knownFields),
    emitsSelection: tile.emits?.selection ?? [],
    consumesHover: Boolean(tile.consumes?.hover),
    emitsHover: Boolean(tile.emits?.hover),
    minW: tile.layout.minW,
    minH: tile.layout.minH,
    maxW: tile.layout.maxW,
    maxH: tile.layout.maxH,
    aspect: tile.layout.aspect,
  };
  for (const field of form.fields) {
    if (!field.name.startsWith(CONTENT_FIELD_PREFIX)) continue;
    values[field.name] = toFormValue(
      getPath(tile.content, field.name.slice(CONTENT_FIELD_PREFIX.length)),
    );
  }
  return values;
}

const text = (value: FormValue) =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;
const count = (value: FormValue) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
const list = (value: FormValue) =>
  Array.isArray(value) && value.length > 0 ? (value as string[]) : undefined;

/** Drop `undefined` keys so an emptied field removes the property instead of writing `undefined`. */
function defined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/** Write a dotted path into a copy of `target`; `undefined` removes the key. */
function setPath(target: unknown, path: string, value: unknown): unknown {
  const [head, ...rest] = path.split(".") as [string, ...string[]];
  const base =
    target && typeof target === "object" && !Array.isArray(target)
      ? { ...(target as Record<string, unknown>) }
      : {};
  const next = rest.length > 0 ? setPath(base[head], rest.join("."), value) : value;
  if (next === undefined) delete base[head];
  else base[head] = next;
  return base;
}

/**
 * The patch the common fields of `values` make to `tile`. With `withContent`, the `content.` fields
 * are written into a copy of `tile.content` too. Only keys present in `values` are touched, so
 * several focused tiles keep their own content.
 */
export function tilePatchFromValues(
  values: FormValues,
  tile: TileSpec,
  withContent: boolean,
): TilePatch {
  const consumes = defined({
    ...tile.consumes,
    selection:
      "consumesSelection" in values ? list(values.consumesSelection) : tile.consumes?.selection,
    hover: values.consumesHover === true ? true : undefined,
  });
  const emits = defined({
    ...tile.emits,
    selection: "emitsSelection" in values ? list(values.emitsSelection) : tile.emits?.selection,
    hover: values.emitsHover === true ? true : undefined,
  });
  const patch: TilePatch = {
    title: text(values.title),
    subtitle: text(values.subtitle),
    footnote: text(values.footnote),
    source: text(values.source),
    visibleWhen: text(values.visibleWhen),
    consumes: Object.keys(consumes).length > 0 ? consumes : undefined,
    emits: Object.keys(emits).length > 0 ? emits : undefined,
    layout: defined({
      ...tile.layout,
      minW: count(values.minW),
      minH: count(values.minH),
      maxW: count(values.maxW),
      maxH: count(values.maxH),
      aspect: count(values.aspect),
    }),
  };
  if (withContent) {
    let content: unknown = tile.content;
    for (const [name, value] of Object.entries(values)) {
      if (!name.startsWith(CONTENT_FIELD_PREFIX)) continue;
      const empty = value === "" || (Array.isArray(value) && value.length === 0);
      content = setPath(
        content,
        name.slice(CONTENT_FIELD_PREFIX.length),
        empty ? undefined : value,
      );
    }
    patch.content = content;
  }
  return patch;
}
