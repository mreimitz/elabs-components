/**
 * Minimal ambient typings for `d3-regression` (MIT, no `@types` package).
 * Only the surface `analytics/regression.ts` uses is declared.
 */
declare module "d3-regression" {
  export type RegressionPoint = [number, number];

  export interface RegressionResult extends Array<RegressionPoint> {
    /** Coefficient of determination. */
    rSquared: number;
    predict: (x: number) => number;
    a?: number;
    b?: number;
    c?: number;
    d?: number;
    e?: number;
    /** Polynomial: coefficients ordered from the constant term upward. */
    coefficients?: number[];
  }

  export interface Regression<D = unknown, R extends RegressionResult = RegressionResult> {
    (data: D[]): R;
    x(): (d: D, i: number, data: D[]) => number;
    x(accessor: (d: D, i: number, data: D[]) => number): this;
    y(): (d: D, i: number, data: D[]) => number;
    y(accessor: (d: D, i: number, data: D[]) => number): this;
    domain(): [number, number] | undefined;
    domain(domain: [number, number]): this;
  }

  export interface PolyRegression<D = unknown> extends Regression<D> {
    order(): number;
    order(order: number): this;
  }

  export interface LoessRegression<D = unknown> extends Regression<D> {
    bandwidth(): number;
    bandwidth(bandwidth: number): this;
  }

  export interface LogRegression<D = unknown> extends Regression<D> {
    base(): number;
    base(base: number): this;
  }

  export function regressionLinear<D = unknown>(): Regression<D>;
  export function regressionExp<D = unknown>(): Regression<D>;
  export function regressionLog<D = unknown>(): LogRegression<D>;
  export function regressionPow<D = unknown>(): Regression<D>;
  export function regressionQuad<D = unknown>(): Regression<D>;
  export function regressionPoly<D = unknown>(): PolyRegression<D>;
  export function regressionLoess<D = unknown>(): LoessRegression<D>;
}
