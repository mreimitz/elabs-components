/**
 * issues — the one shape every validator in the system reports problems in.
 *
 * `SpecIssue` has the same fields as `SpecPlaygroundError` (the spec
 * playground's error list), so a validation result renders there unchanged.
 *
 * React-free.
 */

/** How serious an issue is. Missing means `"error"`. */
export type SpecIssueSeverity = "error" | "warning";

/** One problem found in an input. */
export interface SpecIssue {
  /** Where the problem is: `""` for the whole input, `"barGap"`, `"series[2].color"`. */
  readonly path: string;
  /** A stable, machine-readable code (`"unknown-prop"`, `"out-of-range"`, …). */
  readonly code: string;
  /** One plain sentence a person can act on. */
  readonly message: string;
  readonly severity?: SpecIssueSeverity;
}

/**
 * The result of validating an input. `ok` is true when no issue is an error;
 * warnings (a deprecated prop) can still be present.
 */
export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T; readonly issues: readonly SpecIssue[] }
  | { readonly ok: false; readonly issues: readonly SpecIssue[] };
