/**
 * contract.ts — the value-contract validator behind every `@elabs-ai/components-charts/test`
 * double (issue #364).
 *
 * A test double that silently swallows whatever props it is given is worse than
 * no double at all — it is exactly the failure this package exists to fix (a
 * consumer's mocked test stayed green while the real chart crashed in
 * production on a missing/mis-shaped required prop, item-8's
 * `RangeError: Invalid time value`). So every double in `./doubles.tsx` calls
 * `assertChartContract` BEFORE it renders anything, re-declaring the runtime
 * value-contract the real chart depends on — the layer TypeScript cannot cover
 * (react types don't know that `xDataKey`'s value must exist on every row, or
 * that it must parse to a valid `Date`).
 *
 * Deliberately dependency-free (no `@visx/*`, no `d3-*`) — see the "engine
 * isolation" rung of `pnpm charts:test-double:check`.
 */
"use client";

import { Children, isValidElement, type ReactNode } from "react";

import type { ChartSpec } from "../auto-chart/chart-spec";
// Direct module imports, never the `auto-chart/index.ts` barrel — the barrel
// re-exports `AutoChart`, which drags the whole `@visx`-backed engine into the
// jsdom path and would (correctly) fail `pnpm charts:test-double:check` rung (b).
// `infer-chart-type.ts` itself is pure: it imports nothing but its own types.
import {
  CHART_TYPES,
  explainChartType,
  isChartType,
  secondCategoricalField,
} from "../auto-chart/infer-chart-type";

// ── Violation mode (throw | warn) ───────────────────────────────────────────

export type ChartDoubleViolationMode = "throw" | "warn";

let violationMode: ChartDoubleViolationMode = "throw";

/**
 * Downgrade contract violations to `console.error` instead of throwing — for a
 * consumer mid-migration who wants to see every violation in one test run
 * instead of failing at the first one. Default: `"throw"`.
 */
export function configureChartTestDouble(options: {
  onViolation?: ChartDoubleViolationMode;
}): void {
  if (options.onViolation) violationMode = options.onViolation;
}

/** Restores the default (`"throw"`) mode. Exported so tests can isolate state. */
export function resetChartTestDoubleConfig(): void {
  violationMode = "throw";
}

// ── ChartContractError ──────────────────────────────────────────────────────

export class ChartContractError extends Error {
  readonly component: string;
  readonly prop: string;
  readonly received: unknown;

  constructor(component: string, prop: string, received: unknown, reason: string) {
    super(
      `@elabs-ai/components-charts/test: "${component}" violates the real component's runtime contract on ` +
        `prop "${prop}" — ${reason} (received: ${describeReceived(received)}). ` +
        `This is the contract the REAL ${component} depends on — fix the props passed in your app/test code.`,
    );
    this.name = "ChartContractError";
    this.component = component;
    this.prop = prop;
    this.received = received;
  }
}

function describeReceived(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (Array.isArray(value)) return `array(length=${value.length})`;
  if (value instanceof Date) return `Date(${value.toString()})`;
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[unserializable object]";
    }
  }
  return typeof value === "string" ? `"${value}"` : String(value);
}

function fail(component: string, prop: string, received: unknown, reason: string): void {
  const error = new ChartContractError(component, prop, received, reason);
  if (violationMode === "throw") throw error;
  // Deliberate diagnostic path (`onViolation: "warn"`) — not a stray debug log.
  console.error(error.message);
}

// ── Contract spec ────────────────────────────────────────────────────────────

/**
 * The per-family runtime value-contract a double asserts before rendering.
 * Deliberately a DATA structure (not per-component code) so the spec table in
 * `doubles.tsx` stays a flat, auditable list.
 */
export interface ChartContractSpec {
  /** Name of the primary data prop. Default `"data"` (Gantt uses `"tasks"`). */
  dataProp?: string;
  /** Shape the data prop must have. `"none"` skips all data-prop checks (e.g. AutoChart's `spec`). */
  dataKind: "array" | "feature-collection" | "sankey" | "hierarchy" | "none";
  /** Prop names (besides the data prop) that must not be `undefined`. */
  requiredProps?: string[];
  /** True when the component accepts a `status` prop that exempts an empty data array. */
  hasStatus?: boolean;
  /** Keys every row of an array-kind data prop must own. */
  itemRequiredKeys?: string[];
  /** Row keys that, when present, must be `number | null | undefined`. */
  itemNumericKeys?: string[];
  /** Fixed-name row keys (e.g. Gantt's `start`/`end`) that must coerce to a valid `Date`. */
  dateItemKeys?: string[];
  /**
   * The x-axis key, when its NAME is itself driven by a prop (e.g. `xDataKey`).
   *
   * `requireDate` is the DEFAULT-scale requirement, not an absolute one: it is
   * waived whenever the caller passes `xScale="band"|"linear"` (#352), because on
   * those scales a non-Date x value is exactly what the real chart expects.
   */
  xKey?: { prop: string; default: string; requireDate: boolean };
  /**
   * Row keys whose NAME is itself driven by a prop, generalized past `xKey`
   * for a component with more than one prop-driven key name (DumbbellChart's
   * `category`/`startKey`/`endKey`, RM-023). Each entry checks the row has the
   * named key; `numeric: true` additionally requires the value to be
   * `number | null | undefined`, mirroring `itemNumericKeys` but for a
   * caller-named column instead of a fixed one.
   */
  dynamicKeys?: {
    prop: string;
    numeric?: boolean;
    /**
     * ParallelCoordinates — RM-034. `dynamicKeys` above covers a prop whose
     * VALUE directly IS one key name (`category`, `startKey`, …). This is the
     * plural generalization of the same idea for a prop whose value is an
     * ARRAY OF OBJECTS, each naming one more key — `ParallelCoordinatesChart`'s
     * `dimensions: { key: string }[]`. Deliberately reusing `dynamicKeys`
     * rather than adding a fourth "row key named by a prop" field alongside
     * `propNamedKeys`/`keyProps` (see the three-field debt note on those two).
     * `field` names the property each array element carries the key in
     * (default `"key"`); `min`/`max` bound the array's own length, checked
     * once per render rather than once per row.
     */
    arrayOf?: { field?: string; min?: number; max?: number };
  }[];
  /**
   * Keys whose NAME is itself a prop value, and which must be present on every
   * row — `HeatmapChart`'s `x` / `y` / `valueKey`, where the caller names all
   * three. `xKey` cannot express this: it is a single key, and its date rule is
   * gated on `xScale`, which a heatmap does not have.
   *
   * `requireDate` may be conditional, because the same prop means different
   * things per variant: a heatmap's `x` is an arbitrary label in `"matrix"` and
   * an ISO date in `"calendar"`, and only the second one can crash the real
   * chart on an unparseable value.
   */
  propNamedKeys?: {
    /** Prop carrying the key's name. */
    prop: string;
    /** Key name to fall back on when the prop is absent. */
    default?: string;
    /** Skip this key entirely unless the named prop equals this value. */
    onlyWhen?: { prop: string; equals: unknown };
    /** Require the value to coerce to a valid `Date`, under the same condition. */
    requireDate?: boolean;
  }[];
  /**
   * Row keys whose NAME is itself a prop (`valueKey`, `groupKey`) — RM-026.
   *
   * The sibling `itemRequiredKeys`/`itemNumericKeys` cannot express this: they
   * are fixed key names, and a `DistributionChart` reads whichever column the
   * caller nominated. A `required: false` entry (the default) is only checked
   * when the caller actually passed the prop, which is what makes an OPTIONAL
   * nominated column (`groupKey`) validate exactly when it exists.
   */
  keyProps?: Array<{
    /** The prop that names the column, e.g. `"valueKey"`. */
    prop: string;
    /** The column's cells must be finite numbers (numeric strings accepted). */
    numeric?: boolean;
    /** Fail when the prop itself is absent. Default `false` — an unset optional key checks nothing. */
    required?: boolean;
  }>;
  /** Props that must be finite numbers when provided. */
  numericProps?: string[];
  /** Walk `children` for elements carrying a `dataKey` prop and verify it exists on every row. */
  seriesFromChildren?: boolean;
  // Network — RM-036
  /**
   * A SECOND array prop that references the first by id — `NetworkChart`'s
   * `links`, whose `source`/`target` name nodes in `nodes`.
   *
   * None of the fields above can express it: they all validate rows of the ONE
   * data prop against fixed or prop-named keys, and a graph's failure mode is
   * relational — an edge pointing at a node that is not there. The real
   * container drops such an edge with a dev warning, which a consumer's test
   * would never see; here it is an error, on the same reasoning as the
   * empty-`data` rule above (a double is stricter than the component precisely
   * where the component's own mercy would hide a mistake in the test's data).
   */
  edgeProp?: {
    /** The prop carrying the edges, e.g. `"links"`. */
    prop: string;
    /** Endpoint keys on each edge. Default `["source", "target"]`. */
    endpointKeys?: [string, string];
    /** Key that identifies a node in the data prop. Default `"id"`. */
    nodeIdKey?: string;
  };
}

/**
 * Elements in `children` carrying a `dataKey` string prop — the declared series.
 *
 * RECURSES into a child's own `children`, mirroring the real charts'
 * `extractLineConfigs`/`extractAreaConfigs`/… (see
 * `packages/charts/src/charts/line-chart.tsx`'s `visit()`), which walk the whole
 * subtree. A flat one-level scan would silently MISS a series declared inside a
 * Fragment or a wrapper component (`<LineChart><>{<Line dataKey="revenue" />}</></LineChart>`)
 * — the real chart registers that series and then reads a key the rows may not
 * have, so the double must see it too or it under-validates exactly where a
 * consumer composes.
 */
function collectSeriesKeys(children: ReactNode): string[] {
  const keys: string[] = [];
  const visit = (node: ReactNode) => {
    Children.forEach(node, (child) => {
      if (!isValidElement(child)) return;
      const props = child.props as Record<string, unknown> | null;
      if (props && typeof props.dataKey === "string" && props.dataKey.length > 0) {
        keys.push(props.dataKey);
        return;
      }
      if (props && props.children !== undefined) visit(props.children as ReactNode);
    });
  };
  visit(children);
  return keys;
}

/** `true` iff `raw` does NOT coerce to a valid `Date` (the item-8 `RangeError` class). */
function isInvalidDate(raw: unknown): boolean {
  const coerced = raw instanceof Date ? raw : new Date(raw as string | number);
  return Number.isNaN(coerced.getTime());
}

/**
 * Structural check for a `"hierarchy"`-kind data prop (RM-025's `TreemapNode`:
 * `{ name: string; value?: number; children?: TreemapNode[] }`, recursive).
 * Mirrors `computeTreemapLayout`'s own shape assumptions — a leaf owns a
 * `value`, a branch owns `children`, and every node owns a non-negative
 * `value` when it has one — without duplicating the sum-equals-children rule
 * (that is a dev-only invariant of the real component, not a runtime
 * value-contract shape check).
 */
function assertHierarchyNode(
  component: string,
  dataProp: string,
  node: unknown,
  path: string[],
): void {
  if (typeof node !== "object" || node === null || Array.isArray(node)) {
    fail(
      component,
      dataProp,
      node,
      `node at "${path.join(" › ") || "root"}" must be a plain object`,
    );
    return;
  }
  const record = node as Record<string, unknown>;
  if (typeof record.name !== "string" || record.name.length === 0) {
    fail(
      component,
      dataProp,
      node,
      `node at "${path.join(" › ") || "root"}" is missing a non-empty "name"`,
    );
  }
  if (record.value !== undefined) {
    if (typeof record.value !== "number" || record.value < 0) {
      fail(
        component,
        dataProp,
        node,
        `node "${record.name as string}"'s "value" must be a non-negative number`,
      );
    }
  }
  if (record.children !== undefined) {
    if (!Array.isArray(record.children)) {
      fail(
        component,
        dataProp,
        node,
        `node "${record.name as string}"'s "children" must be an array`,
      );
      return;
    }
    for (const child of record.children) {
      assertHierarchyNode(component, dataProp, child, [
        ...path,
        typeof record.name === "string" ? record.name : "?",
      ]);
    }
  } else if (record.value === undefined) {
    fail(
      component,
      dataProp,
      node,
      `node "${record.name as string}" has neither a "value" nor "children"`,
    );
  }
}

/**
 * Assert `props` against `spec`, throwing (or warning — see
 * `configureChartTestDouble`) a `ChartContractError` on the FIRST violation
 * found for a given (component, prop) pair.
 */
export function assertChartContract(
  component: string,
  props: Record<string, unknown>,
  spec: ChartContractSpec,
): void {
  for (const p of spec.requiredProps ?? []) {
    if (props[p] === undefined) {
      fail(component, p, undefined, `required prop "${p}" is missing`);
    }
  }

  const dataProp = spec.dataProp ?? "data";

  if (spec.dataKind === "array") {
    const value = props[dataProp];
    if (value === undefined) return; // already reported above when dataProp is required
    if (!Array.isArray(value)) {
      fail(component, dataProp, value, `"${dataProp}" must be an array of plain objects`);
      return;
    }
    if (value.length === 0) {
      if (spec.hasStatus && props.status !== "loading") {
        fail(
          component,
          dataProp,
          value,
          `"${dataProp}" is an empty array — pass status="loading" while fetching, or provide real rows`,
        );
      }
      return;
    }
    const xKeyName = spec.xKey ? (props[spec.xKey.prop] as string) || spec.xKey.default : null;
    const seriesKeys = spec.seriesFromChildren
      ? collectSeriesKeys(props.children as ReactNode)
      : [];
    // ParallelCoordinates — RM-034. Expand each `dynamicKeys` entry that
    // carries `arrayOf` into its concrete list of row-key names, once, before
    // the per-row walk below — `dimensions: { key }[]` becomes an ordinary
    // dynamic-key list. The array's own shape/length is checked here (once
    // per render), not once per row.
    const dynamicArrayKeys: { prop: string; numeric?: boolean; keys: string[] }[] = [];
    for (const dynamicKey of spec.dynamicKeys ?? []) {
      if (!dynamicKey.arrayOf) continue;
      const arr = props[dynamicKey.prop];
      if (arr === undefined) continue; // presence of the prop itself is `requiredProps`'s job
      if (!Array.isArray(arr)) {
        fail(component, dynamicKey.prop, arr, `"${dynamicKey.prop}" must be an array`);
        continue;
      }
      const { field = "key", min, max } = dynamicKey.arrayOf;
      if (min !== undefined && arr.length < min) {
        fail(
          component,
          dynamicKey.prop,
          arr,
          `"${dynamicKey.prop}" must have at least ${min} entries (received ${arr.length})`,
        );
      }
      if (max !== undefined && arr.length > max) {
        fail(
          component,
          dynamicKey.prop,
          arr,
          `"${dynamicKey.prop}" must have at most ${max} entries (received ${arr.length})`,
        );
      }
      const keys = arr
        .map((entry: unknown) =>
          entry && typeof entry === "object"
            ? (entry as Record<string, unknown>)[field]
            : undefined,
        )
        .filter((key): key is string => typeof key === "string" && key.length > 0);
      dynamicArrayKeys.push({ prop: dynamicKey.prop, numeric: dynamicKey.numeric, keys });
    }
    value.forEach((row: unknown, index: number) => {
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        fail(component, dataProp, row, `row ${index} of "${dataProp}" must be a plain object`);
        return;
      }
      const record = row as Record<string, unknown>;

      for (const key of spec.itemRequiredKeys ?? []) {
        if (!(key in record)) {
          fail(
            component,
            dataProp,
            row,
            `row ${index} of "${dataProp}" is missing required key "${key}"`,
          );
        }
      }
      for (const key of spec.itemNumericKeys ?? []) {
        const v = record[key];
        if (v != null && typeof v !== "number") {
          fail(
            component,
            dataProp,
            row,
            `row ${index}'s "${key}" must be number | null | undefined`,
          );
        }
      }
      for (const key of spec.dateItemKeys ?? []) {
        if (key in record && isInvalidDate(record[key])) {
          fail(
            component,
            key,
            record[key],
            `row ${index}'s "${key}" is not coercible to a valid Date — this is the ` +
              `"RangeError: Invalid time value" class of bug`,
          );
        }
      }
      for (const named of spec.propNamedKeys ?? []) {
        if (named.onlyWhen && props[named.onlyWhen.prop] !== named.onlyWhen.equals) continue;
        const keyName = (props[named.prop] as string) || named.default;
        if (!keyName) continue;
        if (!(keyName in record)) {
          fail(
            component,
            named.prop,
            row,
            `row ${index} of "${dataProp}" is missing the key "${keyName}" named by prop "${named.prop}"`,
          );
        } else if (named.requireDate && isInvalidDate(record[keyName])) {
          fail(
            component,
            named.prop,
            record[keyName],
            `row ${index}'s "${keyName}" is not coercible to a valid Date — this is the ` +
              `"RangeError: Invalid time value" class of bug`,
          );
        }
      }
      // RM-026: columns nominated BY a prop (`valueKey`, `groupKey`).
      for (const keyProp of spec.keyProps ?? []) {
        const keyName = props[keyProp.prop];
        if (typeof keyName !== "string" || keyName.length === 0) {
          if (keyProp.required) {
            fail(
              component,
              keyProp.prop,
              keyName,
              `"${keyProp.prop}" must name a column on every row`,
            );
          }
          continue;
        }
        if (!(keyName in record)) {
          fail(
            component,
            keyProp.prop,
            row,
            `row ${index} of "${dataProp}" is missing the column "${keyName}" named by "${keyProp.prop}"`,
          );
          continue;
        }
        if (keyProp.numeric) {
          const cell = record[keyName];
          const coerced = typeof cell === "string" ? Number(cell) : cell;
          if (typeof coerced !== "number" || !Number.isFinite(coerced)) {
            fail(
              component,
              keyProp.prop,
              cell,
              `row ${index}'s "${keyName}" must be a finite number — a distribution puts this ` +
                "column on a numeric scale, and a non-numeric cell has no position on it",
            );
          }
        }
      }
      if (xKeyName) {
        if (!(xKeyName in record)) {
          fail(
            component,
            spec.xKey!.prop,
            row,
            `row ${index} of "${dataProp}" is missing the x-axis key "${xKeyName}"`,
          );
        } else if (
          spec.xKey!.requireDate &&
          // #352: `xScale="band"|"linear"` makes a non-Date x value FIRST-CLASS on
          // Line/Area/Composed — the real chart projects it onto a synthetic instant
          // and labels the axis from the caller's own value. Only the default,
          // implicit `"time"` scale still needs a parseable Date, so the double must
          // not be stricter than the component it stands in for.
          (props.xScale ?? "time") === "time" &&
          isInvalidDate(record[xKeyName])
        ) {
          fail(
            component,
            spec.xKey!.prop,
            record[xKeyName],
            `row ${index}'s "${xKeyName}" is not coercible to a valid Date — this is the ` +
              `"RangeError: Invalid time value" class of bug`,
          );
        }
      }
      for (const dynamicKey of spec.dynamicKeys ?? []) {
        if (dynamicKey.arrayOf) continue; // handled by `dynamicArrayKeys` below
        const keyName = props[dynamicKey.prop] as string | undefined;
        if (!keyName) continue; // presence of the prop itself is `requiredProps`'s job
        if (!(keyName in record)) {
          fail(
            component,
            dynamicKey.prop,
            row,
            `row ${index} of "${dataProp}" is missing the key named by "${dynamicKey.prop}" ("${keyName}")`,
          );
        } else if (dynamicKey.numeric) {
          const v = record[keyName];
          if (v != null && typeof v !== "number") {
            fail(
              component,
              dynamicKey.prop,
              row,
              `row ${index}'s "${keyName}" (named by "${dynamicKey.prop}") must be number | null | undefined`,
            );
          }
        }
      }
      // ParallelCoordinates — RM-034: one or more keys per row, all named by
      // ONE array-shaped prop (`dynamicArrayKeys`, expanded above).
      for (const arrayKey of dynamicArrayKeys) {
        for (const keyName of arrayKey.keys) {
          if (!(keyName in record)) {
            fail(
              component,
              arrayKey.prop,
              row,
              `row ${index} of "${dataProp}" is missing the key named by "${arrayKey.prop}" ("${keyName}")`,
            );
            continue;
          }
          if (arrayKey.numeric) {
            const v = record[keyName];
            if (v != null && typeof v !== "number") {
              fail(
                component,
                arrayKey.prop,
                row,
                `row ${index}'s "${keyName}" (named by "${arrayKey.prop}") must be number | null | undefined`,
              );
            }
          }
        }
      }
      for (const key of seriesKeys) {
        const v = record[key];
        if (v === undefined) {
          fail(
            component,
            key,
            row,
            `row ${index} of "${dataProp}" is missing declared series key "${key}" (from a child's dataKey prop)`,
          );
        } else if (v !== null && typeof v !== "number") {
          fail(
            component,
            key,
            row,
            `row ${index}'s declared series key "${key}" must be number | null | undefined`,
          );
        }
      }
    });
  } else if (spec.dataKind === "feature-collection") {
    const value = props[dataProp] as { type?: unknown; features?: unknown } | undefined;
    if (value === undefined) return;
    if (value.type !== "FeatureCollection" || !Array.isArray(value.features)) {
      fail(
        component,
        dataProp,
        value,
        `"${dataProp}" must be a GeoJSON FeatureCollection ({ type: "FeatureCollection", features: [] })`,
      );
    }
  } else if (spec.dataKind === "sankey") {
    const value = props[dataProp] as { nodes?: unknown; links?: unknown } | undefined;
    if (value === undefined) return;
    if (!Array.isArray(value.nodes) || !Array.isArray(value.links)) {
      fail(component, dataProp, value, `"${dataProp}" must be { nodes: [], links: [] }`);
    }
  } else if (spec.dataKind === "hierarchy") {
    const value = props[dataProp];
    if (value === undefined) return;
    assertHierarchyNode(component, dataProp, value, []);
  }

  for (const p of spec.numericProps ?? []) {
    const v = props[p];
    if (v !== undefined && !Number.isFinite(v)) {
      fail(component, p, v, `"${p}" must be a finite number`);
    }
  }

  // Network — RM-036
  if (spec.edgeProp) {
    assertEdges(component, props, spec.edgeProp, dataProp);
  }
}

// Network — RM-036
/**
 * Validate an edge list against the node list it references (`NetworkChart`).
 * Shape first, then the relational rule: every endpoint must name a node that
 * exists, because an edge to nowhere is a mistake in the test's data rather
 * than a state the chart is being asked to render.
 */
function assertEdges(
  component: string,
  props: Record<string, unknown>,
  edge: NonNullable<ChartContractSpec["edgeProp"]>,
  dataProp: string,
): void {
  const value = props[edge.prop];
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    fail(component, edge.prop, value, `"${edge.prop}" must be an array of plain objects`);
    return;
  }
  const [sourceKey, targetKey] = edge.endpointKeys ?? ["source", "target"];
  const nodeIdKey = edge.nodeIdKey ?? "id";
  const nodes = props[dataProp];
  const ids = new Set<unknown>(
    Array.isArray(nodes)
      ? nodes
          .filter((n): n is Record<string, unknown> => typeof n === "object" && n !== null)
          .map((n) => n[nodeIdKey])
      : [],
  );

  value.forEach((row: unknown, index: number) => {
    if (typeof row !== "object" || row === null || Array.isArray(row)) {
      fail(component, edge.prop, row, `row ${index} of "${edge.prop}" must be a plain object`);
      return;
    }
    const record = row as Record<string, unknown>;
    for (const key of [sourceKey, targetKey]) {
      const endpoint = record[key];
      if (typeof endpoint !== "string" || endpoint.length === 0) {
        fail(
          component,
          edge.prop,
          row,
          `row ${index} of "${edge.prop}" must carry a non-empty string "${key}"`,
        );
        continue;
      }
      if (ids.size > 0 && !ids.has(endpoint)) {
        fail(
          component,
          edge.prop,
          row,
          `row ${index} of "${edge.prop}" names "${endpoint}" in "${key}", which is not a "${dataProp}" ${nodeIdKey}`,
        );
      }
    }
  });
}

// ── data-chart-props payload (the `readChartDoubleProps` round trip) ────────

export interface ChartDoublePayload {
  component: string;
  dataLength?: number;
  status?: string;
  xDataKey?: string;
  series?: string[];
}

/** Build the summary payload every double stamps into `data-chart-props`. */
export function buildChartDoublePayload(
  component: string,
  props: Record<string, unknown>,
  spec: ChartContractSpec,
): ChartDoublePayload {
  const dataProp = spec.dataProp ?? "data";
  const dataValue = props[dataProp];
  const payload: ChartDoublePayload = { component };

  if (spec.dataKind === "array" && Array.isArray(dataValue)) {
    payload.dataLength = dataValue.length;
  } else if (spec.dataKind === "feature-collection" && dataValue && typeof dataValue === "object") {
    const features = (dataValue as { features?: unknown }).features;
    if (Array.isArray(features)) payload.dataLength = features.length;
  } else if (spec.dataKind === "sankey" && dataValue && typeof dataValue === "object") {
    const nodes = (dataValue as { nodes?: unknown }).nodes;
    if (Array.isArray(nodes)) payload.dataLength = nodes.length;
  } else if (spec.dataKind === "hierarchy" && dataValue && typeof dataValue === "object") {
    const children = (dataValue as { children?: unknown }).children;
    payload.dataLength = Array.isArray(children) ? children.length : 1;
  }

  if (typeof props.status === "string") payload.status = props.status;
  if (spec.xKey) payload.xDataKey = (props[spec.xKey.prop] as string) || spec.xKey.default;
  if (spec.seriesFromChildren) {
    const series = collectSeriesKeys(props.children as ReactNode);
    if (series.length) payload.series = series;
  }

  return payload;
}

/**
 * Read a double's props back out of the DOM (the escape hatch a consumer's
 * assertions use instead of reaching into React internals). Reads the
 * `data-chart-props` JSON payload a double's root element carries.
 */
export function readChartDoubleProps(el: Element | null | undefined): ChartDoublePayload {
  const raw = el?.getAttribute("data-chart-props");
  if (!raw) return { component: "" };
  try {
    return JSON.parse(raw) as ChartDoublePayload;
  } catch {
    return { component: "" };
  }
}

// ── AutoChart's spec contract (RM-038) ───────────────────────────────────────

/**
 * The runtime value-contract of a `ChartSpec`, asserted by the `AutoChart`
 * double before it renders.
 *
 * `AutoChart` is the one container that DOES NOT throw on bad input — it
 * renders `ChartFallback` instead. That mercy is right in production and wrong
 * in a test: a spec naming a column the rows do not have, or a `type` a model
 * invented, would show a consumer a grey box and a green test. Same reasoning
 * as the empty-`data` rule above — the double is stricter than the component
 * exactly where the component's own leniency hides a mistake in the test data.
 *
 * The family-specific rungs are resolved through the SAME inference the real
 * component uses, so a spec that would silently fall back there fails here.
 */
export function assertChartSpecContract(spec: unknown): void {
  if (typeof spec !== "object" || spec === null) {
    fail("AutoChart", "spec", spec, `"spec" must be a ChartSpec object`);
    return;
  }
  const s = spec as ChartSpec;

  // A type the union does not have renders "not supported yet" — never a chart.
  if (s.type !== undefined && !isChartType(s.type)) {
    fail(
      "AutoChart",
      "spec.type",
      s.type,
      `"type" must be one of ${CHART_TYPES.join(" | ")} (an unlisted type renders ChartFallback)`,
    );
    return;
  }

  const hasHierarchy = Boolean(s.hierarchy);

  if (!hasHierarchy && !Array.isArray(s.data)) {
    fail("AutoChart", "spec.data", s.data, `"data" must be an array of rows`);
    return;
  }
  if (!hasHierarchy && !Array.isArray(s.series)) {
    fail("AutoChart", "spec.series", s.series, `"series" must be an array`);
    return;
  }
  if (!hasHierarchy && typeof s.x !== "string") {
    fail("AutoChart", "spec.x", s.x, `"x" must name a column in every row`);
    return;
  }

  const rows = Array.isArray(s.data) ? s.data : [];
  const seriesKeys = (Array.isArray(s.series) ? s.series : []).map((entry) =>
    typeof entry === "string" ? entry : entry?.key,
  );

  // A declared series naming a column the rows do not have is the same defect
  // `seriesFromChildren` catches for the cartesian containers.
  if (rows.length > 0) {
    for (const key of seriesKeys) {
      if (typeof key !== "string" || key.length === 0) {
        fail("AutoChart", "spec.series", key, `every series needs a string "key"`);
        return;
      }
      if (!rows.some((row) => row && key in row)) {
        fail(
          "AutoChart",
          "spec.series",
          key,
          `series "${key}" names a column that no row has — the real chart would plot nothing`,
        );
        return;
      }
    }
    if (typeof s.x === "string" && !hasHierarchy && !rows.some((row) => row && s.x in row)) {
      fail("AutoChart", "spec.x", s.x, `"x" names a column that no row has`);
      return;
    }
  }

  // Family-specific rungs, resolved the way the component resolves them.
  const type = s.type ?? (rows.length > 0 ? explainChartType(s).type : undefined);

  if (type === "treemap" && !hasHierarchy) {
    fail(
      "AutoChart",
      "spec.hierarchy",
      s.hierarchy,
      `a "treemap" spec carries its nodes in "hierarchy", not in "data"`,
    );
    return;
  }

  if ((type === "heatmap" || type === "bump") && rows.length > 0) {
    if (!secondCategoricalField(s)) {
      fail(
        "AutoChart",
        "spec.y2",
        s.y2,
        `a "${type}" needs a SECOND categorical column (the heatmap row / the ranked entity) — ` +
          `name it with "y2", or leave exactly one unused label column in the rows`,
      );
      return;
    }
  }

  if (type === "candlestick" && rows.length > 0) {
    for (const column of ["open", "high", "low", "close"]) {
      const key = seriesKeys.find((k) => typeof k === "string" && k.toLowerCase() === column);
      if (!key) {
        fail(
          "AutoChart",
          "spec.series",
          seriesKeys,
          `a "candlestick" needs open/high/low/close series — "${column}" is missing`,
        );
        return;
      }
    }
  }

  if (
    (type === "histogram" || type === "box" || type === "strip") &&
    s.group !== undefined &&
    rows.length > 0 &&
    !rows.some((row) => row && s.group !== undefined && s.group in row)
  ) {
    fail(
      "AutoChart",
      "spec.group",
      s.group,
      `"group" names a column that no row has — the distribution would collapse to one group`,
    );
  }
}
