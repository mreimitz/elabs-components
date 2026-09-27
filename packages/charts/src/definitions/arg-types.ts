/**
 * arg-types — `argTypesFromDefinition(def)`: a chart definition's own props as Storybook
 * `argTypes`, generated instead of hand-kept (ADR 0042 §10, RM-199).
 *
 * STORIES-ONLY. Nothing under `charts/**` or this package's `index.ts` imports this module —
 * only a `*.stories.tsx` does — so it must never reach a shipped bundle;
 * `packages/cli/scripts/check-chart-treeshake.mjs` verifies that after every build. It lives
 * under `definitions/` on purpose: `charts-definitions-pure` (ADR 0042 §11) walks this whole
 * directory's runtime import closure, so this module is held to the same purity bar as a real
 * definition — it imports only `toSnapshot` from `@elabs-ai/components-ui/definition` at
 * runtime, nothing else (no React, no Storybook itself).
 *
 * `ArgTypeEntry` below is deliberately a small LOCAL type, not an import of Storybook's own
 * `InputType` — this package has no direct Storybook dependency (only `apps/docs` does), and a
 * value-level import of one would fail the purity walk regardless. TypeScript's structural
 * typing accepts this shape wherever a real `Meta<typeof Component>["argTypes"]` value is
 * expected, the same way the hand-written `argTypes` blocks already in this package's stories
 * (e.g. `gauge.stories.tsx`'s deprecated-prop note) do.
 *
 * `controlFor` omits `control` entirely (never sets it to `false`) for `enum`/`union`/
 * `responsive` fields, so Storybook's own type-based inference stands — a fixed mapping
 * either picks the wrong widget (`union`/`responsive` losing an inferred object control to a
 * blanket `false`) or overrides a better one (`enum` forcing `select` over an inferred
 * `radio` for a small literal union). See `controlFor`'s own docblock.
 */
import { toSnapshot, type AnyComponentDefinition } from "@elabs-ai/components-ui/definition";

/** One `argTypes` entry — a structural subset of Storybook's own `InputType`. */
export interface ArgTypeEntry {
  readonly description?: string;
  readonly control?:
    | false
    | "text"
    | "boolean"
    | "color"
    | "object"
    | {
        readonly type: "number";
        readonly min?: number;
        readonly max?: number;
        readonly step?: number;
      }
    | { readonly type: "select" };
  readonly options?: readonly (string | number | boolean)[];
  readonly table?: {
    readonly category?: string;
    readonly type?: { readonly summary?: string };
    readonly defaultValue?: { readonly summary?: string };
  };
}

/** `argTypesFromDefinition(def)`'s return: one entry per described prop, keyed by prop name. */
export type ArgTypesFromDefinition = Readonly<Record<string, ArgTypeEntry>>;

/** The slice of a snapshot field entry this module reads — `toSnapshot`'s return type is
 *  deliberately generic JSON (`SnapshotValue`), so this widens it back to the shape its own
 *  `fieldData` always writes (`generate/snapshot.ts`). */
interface SnapshotField {
  readonly kind: string;
  readonly group?: string | null;
  readonly description?: string;
  readonly required?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly unit?: string;
  readonly values?: readonly (string | number | boolean)[];
  readonly default?: unknown;
  readonly deprecated?: {
    readonly since?: string;
    readonly replacement?: string;
    readonly removeIn?: string;
  };
}

const isContextDefaultMarker = (v: unknown): v is { defaultFrom: "context" } =>
  typeof v === "object" && v !== null && (v as { defaultFrom?: unknown }).defaultFrom === "context";

/** A short "Category" column label from a group id — `null` (an own field) reads as "Own". */
function categoryFor(group: string | null | undefined): string {
  if (!group) return "Own";
  return group.charAt(0).toUpperCase() + group.slice(1).replace(/-/g, " ");
}

/** The "Type" column summary — the field's kind, an enum's own values, or a numeric unit. */
function typeSummaryFor(f: SnapshotField): string {
  if (f.kind === "enum" && f.values?.length)
    return f.values.map((v) => JSON.stringify(v)).join(" | ");
  if ((f.kind === "number" || f.kind === "integer") && f.unit) return `${f.kind} (${f.unit})`;
  return f.kind;
}

/** The "Default" column summary — `undefined` when the field has none to show. */
function defaultSummaryFor(f: SnapshotField): string | undefined {
  if (f.default === undefined) return undefined;
  if (isContextDefaultMarker(f.default)) return "theme default";
  return JSON.stringify(f.default);
}

/**
 * The interactive `control`, by field kind. `undefined` (the key is omitted from the entry
 * entirely, never set to `false`) for `enum`/`union`/`responsive` — a fixed mapping either
 * picks the wrong widget outright (`union`/`responsive`, e.g. `plotHeight`, `margin`,
 * `valueFormat`, `labels`, would lose their inferred object control to a blanket `false`) or
 * overrides a better one Storybook's own type-based docgen already infers from the
 * component's real TS prop type (`enum`, e.g. `orientation`/`connectors`/`dataFormat`/`sort`
 * — radio for a small literal union, select for a larger one — would flatten to `select`
 * here). Omitting the key lets that inference stand; `options` is still populated below for
 * an `enum` field so the control (whichever Storybook infers) has values to offer.
 *
 * One named exception: `palette` is spread into every chart's props from the shared
 * `paletteGroup` field group rather than declared inline, so per-component docgen doesn't
 * reliably resolve it to the `ChartPalette` union the way an inline literal prop does — it
 * gets an explicit select instead of relying on inference.
 *
 * `false` stays explicit only for a deprecated field (`entryFor`) and for any other kind this
 * package has no described shape for.
 */
function controlFor(f: SnapshotField, key: string): ArgTypeEntry["control"] | undefined {
  switch (f.kind) {
    case "string":
      return "text";
    case "boolean":
      return "boolean";
    case "color":
      return "color";
    case "number":
    case "integer":
      return { type: "number", min: f.min, max: f.max, step: f.kind === "integer" ? 1 : undefined };
    case "object":
    case "array":
      return "object";
    case "enum":
      return key === "palette" ? { type: "select" } : undefined;
    case "union":
    case "responsive":
      return undefined;
    default:
      return false;
  }
}

function entryFor(f: SnapshotField, key: string): ArgTypeEntry {
  const deprecated = f.deprecated;
  if (deprecated) {
    const replacement = deprecated.replacement
      ? ` — use \`${deprecated.replacement}\` instead`
      : "";
    const removeIn = deprecated.removeIn ? ` (removed in ${deprecated.removeIn})` : "";
    return {
      description: `Deprecated${removeIn}${replacement}.${f.description ? ` ${f.description}` : ""}`,
      control: false,
      table: { category: "Deprecated" },
    };
  }
  // A `control` of `undefined` is omitted, not set — an explicit `control: undefined` key
  // would still win the merge against Storybook's own inferred argType.
  const control = controlFor(f, key);
  return {
    description: f.required ? `Required. ${f.description ?? ""}`.trim() : f.description,
    ...(control !== undefined ? { control } : {}),
    options: f.kind === "enum" ? f.values : undefined,
    table: {
      category: categoryFor(f.group),
      type: { summary: typeSummaryFor(f) },
      defaultValue:
        defaultSummaryFor(f) === undefined ? undefined : { summary: defaultSummaryFor(f) },
    },
  };
}

/**
 * A chart definition's own described props as Storybook `argTypes` — one entry per
 * `toSnapshot(def).fields` key, grouped into a "Category" column by the field's prop group (or
 * "Own"), with a deprecated field routed to a "Deprecated" category and its control disabled
 * (mirrors the hand-written note this replaces, e.g. `gauge.stories.tsx`'s `labels` entry).
 * `codeOnly` props (children, callbacks) never appear — they have no field to describe.
 *
 * A story spreads this under its own `argTypes`, so a story-specific override (a custom control,
 * an extra note) still wins:
 *
 * ```ts
 * const meta = {
 *   component: BarChart,
 *   argTypes: { ...argTypesFromDefinition(BAR_CHART), barGap: { control: { type: "range" } } },
 * } satisfies Meta<typeof BarChart>;
 * ```
 */
export function argTypesFromDefinition(def: AnyComponentDefinition): ArgTypesFromDefinition {
  const snapshot = toSnapshot(def);
  const fields = snapshot.fields as unknown as Readonly<Record<string, SnapshotField>>;
  const out: Record<string, ArgTypeEntry> = {};
  for (const [key, field] of Object.entries(fields)) out[key] = entryFor(field, key);
  return out;
}
