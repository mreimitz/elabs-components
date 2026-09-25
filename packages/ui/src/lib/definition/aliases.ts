/**
 * aliases — renamed props as data.
 *
 * A rename keeps the old name working for a deprecation window. Each rename is
 * one `AliasRow`: plain data (no functions), so it serialises into the
 * definition snapshot and a codemod can read it. The value is carried over by
 * a transform picked from a closed table, `ALIAS_TRANSFORMS`.
 *
 * `applyAliases` is pure and cheap on the hot path: when no old name is
 * present it returns the very object it was given.
 *
 * React-free.
 */

/** The closed set of value transforms an alias row can name. */
export type AliasTransformId =
  | "identity"
  | "loading-to-status"
  | "boolean-to-labels"
  | "invert-boolean";

/**
 * Which name wins when a caller passes both. `new-wins` is the default;
 * `old-wins` records code that already lets the old name win today.
 */
export type AliasPrecedence = "new-wins" | "old-wins";

/** One renamed prop: `from` (old name) now means `to` (new name), until `removeIn`. */
export interface AliasRow {
  readonly from: string;
  readonly to: string;
  readonly transform: AliasTransformId;
  readonly precedence?: AliasPrecedence;
  /** The version the old name was deprecated in. */
  readonly since: string;
  /** The version the old name goes away in. */
  readonly removeIn: string;
}

/** An alias row with every optional part filled in. */
export type NormalizedAliasRow = Required<AliasRow>;

/**
 * How a definition lists its aliases: full rows, or the `{ oldName: "newName" }`
 * shorthand for a plain rename (identity transform, new name wins).
 */
export type AliasInput = readonly AliasRow[] | Readonly<Record<string, string>>;

/** One entry of `ALIAS_TRANSFORMS`. `apply` passes a value of an unexpected type through unchanged. */
export interface AliasTransform {
  readonly description: string;
  apply(value: unknown): unknown;
}

/** The value transforms alias rows can name. Closed: a new transform is a code change here. */
export const ALIAS_TRANSFORMS: Readonly<Record<AliasTransformId, AliasTransform>> = Object.freeze({
  identity: {
    description: "The value is carried over unchanged.",
    apply: (value: unknown) => value,
  },
  "loading-to-status": {
    description: 'A loading flag becomes a status: true is "loading", false is "ready".',
    apply: (value: unknown) => (value === true ? "loading" : value === false ? "ready" : value),
  },
  "boolean-to-labels": {
    description: "A show/hide flag becomes a labels config: true is { show: true }.",
    apply: (value: unknown) => (typeof value === "boolean" ? { show: value } : value),
  },
  "invert-boolean": {
    description: "A flag whose meaning flipped: true becomes false and false becomes true.",
    apply: (value: unknown) => (typeof value === "boolean" ? !value : value),
  },
});

/** `since` and `removeIn` a shorthand alias gets when none is given. */
export interface AliasShorthandVersions {
  readonly since: string;
  readonly removeIn: string;
}

const SHORTHAND_VERSIONS: AliasShorthandVersions = { since: "", removeIn: "next major" };

const normalizedCache = new WeakMap<object, readonly NormalizedAliasRow[]>();

/**
 * Turns either alias form into full rows. The shorthand becomes an identity,
 * new-wins row with `versions` (default: `since: ""`, `removeIn: "next major"`).
 */
export function normalizeAliases(
  input: AliasInput | undefined,
  versions: AliasShorthandVersions = SHORTHAND_VERSIONS,
): readonly NormalizedAliasRow[] {
  if (!input) return [];
  const useCache = versions === SHORTHAND_VERSIONS;
  if (useCache) {
    const cached = normalizedCache.get(input);
    if (cached) return cached;
  }
  const rows: NormalizedAliasRow[] = isAliasRowList(input)
    ? input.map((row) => ({ ...row, precedence: row.precedence ?? "new-wins" }))
    : Object.keys(input).map((from) => ({
        from,
        to: input[from] as string,
        transform: "identity",
        precedence: "new-wins",
        since: versions.since,
        removeIn: versions.removeIn,
      }));
  const frozen = Object.freeze(rows.map((row) => Object.freeze(row)));
  if (useCache) normalizedCache.set(input, frozen);
  return frozen;
}

function isAliasRowList(input: AliasInput): input is readonly AliasRow[] {
  return Array.isArray(input);
}

/** Anything that carries aliases: the aliases themselves, or a definition with an `aliases` key. */
export type AliasSource =
  | AliasInput
  | { readonly aliases?: AliasInput; readonly codeOnly: readonly string[] };

function aliasesOf(source: AliasSource | undefined): AliasInput | undefined {
  if (!source || Array.isArray(source)) return source as AliasInput | undefined;
  const record = source as Record<string, unknown>;
  if (Array.isArray(record.codeOnly) && typeof record.fields === "object") {
    return record.aliases as AliasInput | undefined;
  }
  return source as AliasInput;
}

/**
 * Maps old prop names to new ones. Pure.
 *
 * - No old name present (with a defined value): returns `props` itself.
 * - Otherwise returns a copy with each old name removed and its transformed
 *   value written to the new name — unless the caller also passed the new
 *   name and the row is `new-wins`, in which case the new value stays.
 * - `onAlias(row)` is called once per old name used (the place to `warnOnce`).
 *
 * `source` is the aliases (either form) or a definition that has them.
 */
export function applyAliases<Props extends object>(
  source: AliasSource | undefined,
  props: Props,
  onAlias?: (row: NormalizedAliasRow) => void,
): Props {
  const rows = normalizeAliases(aliasesOf(source));
  const input = props as Record<string, unknown>;
  let out: Record<string, unknown> | undefined;
  for (const row of rows) {
    if (input[row.from] === undefined) continue;
    out ??= { ...input };
    onAlias?.(row);
    const value = ALIAS_TRANSFORMS[row.transform].apply(input[row.from]);
    delete out[row.from];
    if (row.precedence === "old-wins" || input[row.to] === undefined) out[row.to] = value;
  }
  return (out ?? props) as Props;
}
