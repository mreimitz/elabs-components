/**
 * contract.ts — the value-contract validator behind every `@elabs/components-charts/test`
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
      `@elabs/components-charts/test: "${component}" violates the real component's runtime contract on ` +
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
  dataKind: "array" | "feature-collection" | "sankey" | "none";
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
  /** Props that must be finite numbers when provided. */
  numericProps?: string[];
  /** Walk `children` for elements carrying a `dataKey` prop and verify it exists on every row. */
  seriesFromChildren?: boolean;
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
  }

  for (const p of spec.numericProps ?? []) {
    const v = props[p];
    if (v !== undefined && !Number.isFinite(v)) {
      fail(component, p, v, `"${p}" must be a finite number`);
    }
  }
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
