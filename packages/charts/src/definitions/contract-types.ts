/**
 * contract-types — the per-family runtime value contract the `./test` doubles
 * assert (ADR 0042 §5, RM-175). Moved here verbatim from `test/contract.ts`,
 * which re-exports it, so a chart definition can carry its contract without
 * importing the test double.
 *
 * Pure: no imports.
 */

/**
 * The per-family runtime value-contract a double asserts before rendering.
 * Deliberately a DATA structure (not per-component code) so the spec table in
 * `doubles.tsx` stays a flat, auditable list.
 */
export interface ChartContractSpec {
  /** Name of the primary data prop. Default `"data"` (Gantt uses `"tasks"`). */
  dataProp?: string;
  /** Shape the data prop must have. `"none"` skips all data-prop checks (e.g. AutoChart's `spec`). */
  dataKind: "array" | "feature-collection" | "sankey" | "hierarchy" | "tree" | "none";
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
