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
 * isolation" rung of `pnpm charts:test-double:check`. `@elabs-ai/components-ui/definition`
 * (RM-177) is the one bare import: the same React-free base every chart
 * definition is built on. That rung is a FORBID-list (`@visx/*`, `d3-*`,
 * `motion`, …, plus any package/family barrel) — nothing on it allow-lists a
 * specifier, so `@elabs-ai/components-ui/definition` passing is simply not
 * being on that forbidden list, the same way the root `@elabs-ai/components-ui`
 * barrel passes for `doubles.tsx`'s `MetricCard`.
 */
"use client";

import { Children, isValidElement, type ReactNode } from "react";

import {
  applyAliases,
  warnOnce,
  type AliasInput,
  type NormalizedAliasRow,
} from "@elabs-ai/components-ui/definition";

// `ChartSpec` is not imported here — `assertChartSpecContract` below delegates
// the whole spec shape to `validateChartSpec`, never casting to `ChartSpec` itself.
import type { ChartContractGate, ChartContractSpec } from "../definitions/contract-types";
// Direct module imports, never the `auto-chart/index.ts` barrel — the barrel
// re-exports `AutoChart`, which drags the whole `@visx`-backed engine into the
// jsdom path and would (correctly) fail `pnpm charts:test-double:check` rung (b).
// `validate-chart-spec.ts` itself is pure: React-free, engine-free.
import { validateChartSpec } from "../auto-chart/validate-chart-spec";

// ── Violation mode (throw | warn) ───────────────────────────────────────────

export type ChartDoubleViolationMode = "throw" | "warn";

/** RM-177: how the double treats a caller still using a renamed prop's OLD name. */
export type ChartDeprecatedPropsMode = "ignore" | "warn" | "throw";

let violationMode: ChartDoubleViolationMode = "throw";
let deprecatedPropsMode: ChartDeprecatedPropsMode = "ignore";

/**
 * Downgrade contract violations to `console.error` instead of throwing — for a
 * consumer mid-migration who wants to see every violation in one test run
 * instead of failing at the first one. Default: `"throw"`.
 *
 * `deprecatedProps` (RM-177) is the separate switch for a renamed prop's OLD
 * name: `"ignore"` (default) keeps the double silent — the same default every
 * rename item's own per-alias test relies on (`docs/DEPRECATION.md`) — `"warn"`
 * reports every deprecated prop found on a render via `console.warn`, once per
 * (component, old-prop-name) pair for the life of the module (the same
 * `warnOnce` a real renamed component uses, not once per render), `"throw"`
 * fails the render on the first one found. It never follows `onViolation`:
 * downgrading a genuine contract violation to a warning must not also
 * downgrade a deprecation failure a consumer opted into.
 */
export function configureChartTestDouble(options: {
  onViolation?: ChartDoubleViolationMode;
  deprecatedProps?: ChartDeprecatedPropsMode;
}): void {
  if (options.onViolation) violationMode = options.onViolation;
  if (options.deprecatedProps) deprecatedPropsMode = options.deprecatedProps;
}

/** Restores the defaults (`"throw"`, `"ignore"`). Exported so tests can isolate state. */
export function resetChartTestDoubleConfig(): void {
  violationMode = "throw";
  deprecatedPropsMode = "ignore";
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

// ── Alias normalisation (RM-177, ADR 0042 §8) ───────────────────────────────

/**
 * Runs `props` through `aliases` (a chart definition's own `AliasInput`, as
 * `CHART_DEFINITIONS` carries it) before the contract is checked — the same
 * step the real component's `useResolvedChartProps` takes — so a caller still
 * on a renamed prop's OLD name validates exactly like one already on the new
 * one. The row's value moves onto the new key; the OLD key is never deleted
 * from the record this returns, so BOTH spellings stay readable off it until
 * 7.0 — a consumer's own assertion on either name keeps passing, per ADR 0042
 * §8. `aliases` is `undefined` for every family until its rename item lands
 * (wave 4), so this is a no-op today: it returns `props` itself, unchanged.
 *
 * `deprecatedPropsMode` (`configureChartTestDouble`) decides what happens
 * when the caller actually used an old name: silent (`"ignore"`, default), a
 * `console.warn` per flagged prop, once per (component, old-prop-name) pair
 * via `@elabs-ai/components-ui/definition`'s `warnOnce` — the same helper a
 * real renamed component uses — for `"warn"`, or a thrown `ChartContractError`
 * on the first one found for `"throw"`. A render passing TWO old names under
 * `"warn"` reports both (each once), not only the first.
 * Exported for this package's own tests (`contract.test.tsx`) to exercise
 * `deprecatedProps` directly — it is not part of the `./test` double's public
 * surface (`index.ts` re-exports only the `ChartDeprecatedPropsMode` type).
 */
export function resolveChartDoubleProps(
  component: string,
  props: Record<string, unknown>,
  aliases: AliasInput | undefined,
): Record<string, unknown> {
  if (!aliases) return props;
  const flaggedRows: NormalizedAliasRow[] = [];
  const resolved = applyAliases(aliases, props, (row) => {
    flaggedRows.push(row);
  });
  const first = flaggedRows[0];
  if (!first) return props;
  if (deprecatedPropsMode === "throw") {
    const reason = `"${first.from}" is deprecated — use "${first.to}" instead (removed in ${first.removeIn})`;
    throw new ChartContractError(component, first.from, props[first.from], reason);
  }
  if (deprecatedPropsMode === "warn") {
    for (const row of flaggedRows) {
      const reason = `"${row.from}" is deprecated — use "${row.to}" instead (removed in ${row.removeIn})`;
      warnOnce(
        `${component}.${row.from}`,
        `@elabs-ai/components-charts/test: "${component}" received the deprecated prop ${reason} ` +
          `(received: ${describeReceived(props[row.from])}).`,
      );
    }
  }
  return { ...props, ...resolved };
}

// ── Contract spec ────────────────────────────────────────────────────────────

// `ChartContractSpec` lives with the chart definitions (RM-175); re-exported
// here so every existing import of it keeps working.
export type { ChartContractSpec } from "../definitions/contract-types";

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
 * Structural check for a `"tree"`-kind data prop (`TreeChart`'s `TreeNode`:
 * `{ name: string; id?: string; data?: unknown; children?: TreeNode[] }`,
 * recursive). Unlike a treemap node, a tree node carries no `value` at all
 * (membership only), so a bare `{ name }` leaf is valid; `data` is the
 * caller's payload and is never inspected.
 */
function assertTreeNode(component: string, dataProp: string, node: unknown, path: string[]): void {
  const where = path.join(" › ") || "root";
  if (typeof node !== "object" || node === null || Array.isArray(node)) {
    fail(component, dataProp, node, `node at "${where}" must be a plain object`);
    return;
  }
  const record = node as Record<string, unknown>;
  if (typeof record.name !== "string" || record.name.length === 0) {
    fail(component, dataProp, node, `node at "${where}" is missing a non-empty "name"`);
  }
  if (record.id !== undefined && typeof record.id !== "string") {
    fail(component, dataProp, node, `node "${String(record.name)}"'s "id" must be a string`);
  }
  if (record.children !== undefined) {
    if (!Array.isArray(record.children)) {
      fail(
        component,
        dataProp,
        node,
        `node "${String(record.name)}"'s "children" must be an array`,
      );
      return;
    }
    for (const child of record.children) {
      assertTreeNode(component, dataProp, child, [
        ...path,
        typeof record.name === "string" ? record.name : "?",
      ]);
    }
  }
}

/**
 * `props[gate.prop]` matches `gate.equals` — an unset gate prop falls back to
 * `gate.default` first, so a caller who never set the prop is judged against
 * its REAL default, never treated as "doesn't match anything" (an unset
 * `variant`, the common case, must be judged as `variant="matrix"`, not
 * silently exempted from every check gated on it).
 */
function gateMatches(props: Record<string, unknown>, gate: ChartContractGate): boolean {
  const value = props[gate.prop] ?? gate.default;
  return value === gate.equals;
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
  /**
   * RM-196: the caller's ORIGINAL, pre-alias-resolution props — `props` above is
   * already resolved (both old and new names readable, ADR 0042 §8), so it cannot
   * tell which one the caller actually wrote. Only `propNamedKeys`' `aliasOf` reads
   * this; every other check keeps reading the resolved `props`. Defaults to `props`
   * itself, so a caller with no alias-aware rows (every family but Heatmap today)
   * is unaffected.
   */
  raw: Record<string, unknown> = props,
): void {
  for (const p of spec.requiredProps ?? []) {
    if (props[p] === undefined) {
      fail(component, p, undefined, `required prop "${p}" is missing`);
    }
  }
  for (const { prop, onlyWhen } of spec.requiredPropsWhen ?? []) {
    if (!gateMatches(props, onlyWhen)) continue;
    if (props[prop] === undefined) {
      fail(component, prop, undefined, `required prop "${prop}" is missing`);
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
        if (named.onlyWhen && !gateMatches(props, named.onlyWhen)) continue;
        const keyName = (props[named.prop] as string) || named.default;
        if (!keyName) continue;
        // RM-196: name the violation after whichever of the pair the caller actually
        // set — `raw` (pre-resolution) has the old name only when the caller wrote it.
        const displayProp =
          named.aliasOf && raw[named.aliasOf] !== undefined ? named.aliasOf : named.prop;
        if (!(keyName in record)) {
          fail(
            component,
            displayProp,
            row,
            `row ${index} of "${dataProp}" is missing the key "${keyName}" named by prop "${displayProp}"`,
          );
        } else if (named.requireDate && isInvalidDate(record[keyName])) {
          fail(
            component,
            displayProp,
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
  } else if (spec.dataKind === "tree") {
    const value = props[dataProp];
    if (value === undefined) return;
    assertTreeNode(component, dataProp, value, []);
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

  // Selection/Hover inputs — RM-073
  assertLinkInputs(component, props);
  // Selection gestures + chrome — RM-142 / RM-145
  assertSelectionGestureInputs(component, props);
}

// Selection gestures + chrome — RM-142 / RM-145
const SELECTION_GESTURES = ["range", "rect", "lasso", "radial"];

/**
 * The gesture props (`ChartSelectionGestureProps`). The real chart mounts its
 * engine only when gestures AND a handler are set, so an `onSelectionIntent`
 * without `selectionGestures` is a handler that can never fire — a wiring bug
 * the double reports instead of hiding.
 */
function assertSelectionGestureInputs(component: string, props: Record<string, unknown>): void {
  // AutoChart carries its gestures in `spec.selection` — `assertSelectionSpecContract`.
  if (component === "AutoChart") return;
  const gestures = props.selectionGestures;
  if (gestures !== undefined) {
    if (!Array.isArray(gestures)) {
      fail(component, "selectionGestures", gestures, `"selectionGestures" must be an array`);
    } else {
      const bad = gestures.find((g) => !SELECTION_GESTURES.includes(g as string));
      if (bad !== undefined) {
        fail(
          component,
          "selectionGestures",
          gestures,
          `every gesture must be one of ${SELECTION_GESTURES.join(" | ")}`,
        );
      }
    }
  }
  const handler = props.onSelectionIntent;
  if (handler !== undefined && typeof handler !== "function") {
    fail(component, "onSelectionIntent", handler, `"onSelectionIntent" must be a function`);
  }
  if (typeof handler === "function" && (!Array.isArray(gestures) || gestures.length === 0)) {
    fail(
      component,
      "onSelectionIntent",
      handler,
      `"onSelectionIntent" is set but "selectionGestures" lists no gesture — the handler can never fire`,
    );
  }
  const enums: Array<[string, readonly string[]]> = [
    ["selectionConfirm", ["immediate", "explicit"]],
    ["selectionHitRule", ["overlap", "contain"]],
    ["selectionToolbar", ["auto", "none"]],
  ];
  for (const [p, allowed] of enums) {
    const v = props[p];
    if (v !== undefined && !allowed.includes(v as string)) {
      fail(component, p, v, `"${p}" must be one of ${allowed.join(" | ")}`);
    }
  }
  if (props.selectionField !== undefined && typeof props.selectionField !== "string") {
    fail(component, "selectionField", props.selectionField, `"selectionField" must be a string`);
  }
}

/**
 * `ChartSpec.selection` (RM-145) plus `AutoChart`'s `onSelectionIntent`: the
 * spec's gestures and confirm mode, and the same "a handler that can never
 * fire" rule the containers get.
 */
export function assertSelectionSpecContract(selection: unknown, onSelectionIntent: unknown): void {
  if (selection !== undefined) {
    if (typeof selection !== "object" || selection === null) {
      fail("AutoChart", "spec.selection", selection, `"selection" must be an object`);
      return;
    }
    const s = selection as Record<string, unknown>;
    assertSelectionGestureInputs("AutoChart.spec.selection", {
      selectionGestures: s.gestures,
      selectionConfirm: s.confirm,
      selectionField: s.field,
    });
  }
  if (onSelectionIntent !== undefined) {
    const gestures = (selection as { gestures?: unknown } | undefined)?.gestures;
    if (typeof onSelectionIntent !== "function") {
      fail(
        "AutoChart",
        "onSelectionIntent",
        onSelectionIntent,
        `"onSelectionIntent" must be a function`,
      );
    } else if (!Array.isArray(gestures) || gestures.length === 0) {
      fail(
        "AutoChart",
        "onSelectionIntent",
        onSelectionIntent,
        `"onSelectionIntent" is set but "spec.selection.gestures" lists no gesture — the handler can never fire`,
      );
    }
  }
}

// Selection/Hover inputs — RM-073
/**
 * The selection + shared-hover inputs every family accepts. Checked for every
 * double regardless of spec: a non-function resolver would throw inside the
 * real chart's render loop on the first mark.
 */
function assertLinkInputs(component: string, props: Record<string, unknown>): void {
  for (const p of ["selectionStates", "onHoverCategory"] as const) {
    const v = props[p];
    if (v !== undefined && typeof v !== "function") {
      fail(component, p, v, `"${p}" must be a function`);
    }
  }
  if (props.dimExcluded !== undefined && typeof props.dimExcluded !== "boolean") {
    fail(component, "dimExcluded", props.dimExcluded, `"dimExcluded" must be a boolean`);
  }
  const hover = props.hoverCategory;
  if (
    hover !== undefined &&
    hover !== null &&
    typeof hover !== "string" &&
    typeof hover !== "number" &&
    !(hover instanceof Date)
  ) {
    fail(
      component,
      "hoverCategory",
      hover,
      `"hoverCategory" must be a string, number, Date or null`,
    );
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
  } else if (
    (spec.dataKind === "hierarchy" || spec.dataKind === "tree") &&
    dataValue &&
    typeof dataValue === "object"
  ) {
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
 * The checks themselves live in the pure, never-throwing `validateChartSpec`
 * (`../auto-chart/validate-chart-spec`) — this function is a thin wrapper
 * that keeps the double's "throw on the first violation" shape and message
 * text. A `"warning"`-severity issue (an unrecognised `spec.version`) never
 * throws — same as `deprecatedPropsMode: "ignore"` for a renamed prop.
 * `NON_THROWING_ISSUE_CODES` below is the second, narrower exemption: an
 * `"error"`-severity issue `validateChartSpec` did not check for when this
 * wrapper's message/prop/received contract was pinned. Keeping a check like
 * that OUT of the throw path (while it still fails `validateChartSpec`
 * itself) means growing `validateChartSpec` never silently starts throwing
 * for an existing double-backed consumer test that rendered fine before.
 */
const NON_THROWING_ISSUE_CODES: ReadonlySet<string> = new Set([
  // "too few series for this type" (below the type's own derived minimum,
  // including `series: []`) did not exist as a check at all before this
  // wrapper's message/prop/received contract was pinned — a spec this thin
  // rendered (something degenerate, but real) through the double without
  // throwing, and must keep doing so. `validateChartSpec` still reports it
  // (`ok: false`, bar the one type it is warning-only for already).
  "too-few-series",
]);

export function assertChartSpecContract(spec: unknown): void {
  const result = validateChartSpec(spec);
  const violation = result.issues.find(
    (i) => i.severity !== "warning" && !NON_THROWING_ISSUE_CODES.has(i.code),
  );
  if (!violation) return;

  // `validateChartSpec` reports a bad series entry at its own
  // index-qualified path (`series[i]`, so a caller can point at the ONE bad
  // entry) — this double instead reports every series defect at the flat
  // `spec.series` prop, with `received` the entry's own derived key (a
  // string, or `undefined`/non-string for a missing/empty one), never the
  // path itself or the whole series array. Recompute that key the same way
  // `validateChartSpec` derives it, so the double's messages stay exactly
  // what every existing caller already asserts against.
  const seriesEntryMatch = /^series\[(\d+)\]$/.exec(violation.path ?? "");
  if (seriesEntryMatch) {
    const seriesArray =
      typeof spec === "object" &&
      spec !== null &&
      Array.isArray((spec as Record<string, unknown>).series)
        ? ((spec as Record<string, unknown>).series as unknown[])
        : [];
    const entry = seriesArray[Number(seriesEntryMatch[1])];
    const key = typeof entry === "string" ? entry : (entry as { key?: unknown } | undefined)?.key;
    fail("AutoChart", "spec.series", key, violation.message);
    return;
  }

  const prop = violation.path ? `spec.${violation.path}` : "spec";
  const received =
    violation.path && typeof spec === "object" && spec !== null
      ? (spec as Record<string, unknown>)[violation.path]
      : spec;
  fail("AutoChart", prop, received, violation.message);
}
