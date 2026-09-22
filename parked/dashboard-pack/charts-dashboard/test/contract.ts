/**
 * `assertDashboardSpec` / `DashboardSpecError` — the dashboard test double's validating half
 * (`.claude/rules/dashboard.md`; `.claude/rules/charts.md` "Test double"). Throws instead of
 * silently accepting a broken spec, the contract `assertChartContract` keeps for a chart
 * double.
 *
 * Distinct from the core `DashboardSpecError` TYPE (`../core/spec`, one problem's `{ path,
 * code, message }`): this is a runtime `Error` CLASS carrying every problem
 * `validateDashboardSpec` found, thrown by `assertDashboardSpec`.
 */
import { validateDashboardSpec } from "../core/validate";
import type { DashboardSpec, DashboardSpecError as SpecProblem } from "../core/spec";

export class DashboardSpecError extends Error {
  /** Every problem `validateDashboardSpec` found, in report order. */
  readonly errors: readonly SpecProblem[];
  /** The first problem's JSON-path-like address (`tiles[3].layout.w`). */
  readonly path: string;
  /** The first problem's code. */
  readonly code: SpecProblem["code"];

  constructor(errors: readonly SpecProblem[]) {
    const first = errors[0];
    super(first ? `${first.path}: ${first.message}` : "invalid DashboardSpec");
    this.name = "DashboardSpecError";
    this.errors = errors;
    this.path = first?.path ?? "$";
    this.code = first?.code ?? "type";
  }
}

/** Validate `input` and return the typed spec, or throw `DashboardSpecError`. */
export function assertDashboardSpec(input: unknown): DashboardSpec {
  const result = validateDashboardSpec(input);
  if (!result.ok) throw new DashboardSpecError(result.errors);
  return result.spec;
}
