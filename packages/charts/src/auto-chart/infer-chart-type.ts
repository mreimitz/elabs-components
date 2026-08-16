/**
 * infer-chart-type.ts — Conservative chart-type inference for AutoChart.
 *
 * Called only when `spec.type` is omitted. The ordering is deliberate:
 * 1. Temporal x (ISO date strings or Date objects, or xType === "time") → line
 * 2. Numeric x + exactly one numeric series → scatter
 * 3. Single positive numeric series + categorical x + ≤ 8 rows → pie
 * 4. Default (categorical x, one or more numeric series) → bar
 *
 * Every branch returns a Core-7 type; inference never yields a fallback.
 *
 * OHLC detection is wired but returns "line" in v1 — one-line edit when
 * "candlestick" is added to ChartType.
 */

import type { ChartSpec, ChartType } from "./chart-spec";

// ---------------------------------------------------------------------------
// Field-level helpers
// ---------------------------------------------------------------------------

/** Returns true when every non-null x value parses as a valid Date. */
export function isTemporalField(data: Record<string, unknown>[], key: string): boolean {
  if (data.length === 0) {
    return false;
  }
  const values = data.map((row) => row[key]).filter((v) => v !== null && v !== undefined);
  if (values.length === 0) {
    return false;
  }
  return values.every((v) => {
    if (v instanceof Date) {
      return !Number.isNaN(v.getTime());
    }
    if (typeof v === "string") {
      // Accept ISO-8601 date strings (YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss…)
      if (!/^\d{4}-\d{2}-\d{2}/.test(v)) {
        return false;
      }
      const d = new Date(v);
      return !Number.isNaN(d.getTime());
    }
    return false;
  });
}

/** Returns true when every non-null value for the given key is a finite number. */
export function isNumericField(data: Record<string, unknown>[], key: string): boolean {
  if (data.length === 0) {
    return false;
  }
  const values = data.map((row) => row[key]).filter((v) => v !== null && v !== undefined);
  if (values.length === 0) {
    return false;
  }
  return values.every((v) => typeof v === "number" && Number.isFinite(v));
}

// ---------------------------------------------------------------------------
// OHLC detector (deferred to v1 — returns "line" until candlestick lands)
// ---------------------------------------------------------------------------

/**
 * Detects OHLC data by looking for open/high/low/close field names.
 * v1: always returns false — "candlestick" is not yet in ChartType.
 * v2: replace the body with the OHLC key + field check below when the type lands.
 *
 *   const keys = new Set(series.map((k) => k.toLowerCase()));
 *   return keys.has("open") && keys.has("high") && keys.has("low") && keys.has("close")
 *       && isNumericField(data, "open") && isNumericField(data, "high")
 *       && isNumericField(data, "low") && isNumericField(data, "close");
 */
function _hasOHLCKeys(_data: Record<string, unknown>[], _series: string[]): boolean {
  return false;
}

// ---------------------------------------------------------------------------
// Main inference function
// ---------------------------------------------------------------------------

/**
 * Infers the best chart type for a given `ChartSpec`.
 * Called only when `spec.type` is absent — explicit type always wins.
 */
export function inferChartType(spec: ChartSpec): ChartType {
  const { data, x, xType, series, stacked: _stacked } = spec;

  // Normalize series to string keys for field checks
  const seriesKeys = series.map((s) => (typeof s === "string" ? s : s.key));

  // ── 1. OHLC detection (wired, deferred) ────────────────────────────────────
  // v1: this always returns false — left in place for v2 candlestick support.
  if (_hasOHLCKeys(data, seriesKeys)) {
    // When candlestick is added: return "candlestick";
    return "line";
  }

  // ── 2. Temporal x → line ───────────────────────────────────────────────────
  //    xType:"time" is an explicit hint; also detect from data values.
  if (xType === "time" || isTemporalField(data, x)) {
    return "line";
  }

  // ── 3. Numeric x + exactly one numeric series → scatter ────────────────────
  //    "scatter" only fires when the x-axis itself is numeric, not just values.
  if (xType === "number" || (xType == null && isNumericField(data, x))) {
    if (seriesKeys.length === 1 && seriesKeys[0] && isNumericField(data, seriesKeys[0])) {
      return "scatter";
    }
  }

  // ── 4. Single positive numeric series + categorical x + ≤ 8 rows → pie ────
  if (
    data.length <= 8 &&
    seriesKeys.length === 1 &&
    seriesKeys[0] !== undefined &&
    isNumericField(data, seriesKeys[0])
  ) {
    const key = seriesKeys[0];
    const allPositive = data.every((row) => {
      const v = row[key];
      return typeof v === "number" && v >= 0;
    });
    if (allPositive) {
      return "pie";
    }
  }

  // ── 5. Default → bar ────────────────────────────────────────────────────────
  return "bar";
}
