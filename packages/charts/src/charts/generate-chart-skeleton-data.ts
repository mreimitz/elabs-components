const DEFAULT_SKELETON_DATA_KEY = "value";
const DEFAULT_SKELETON_POINT_COUNT = 7;

export interface GenerateChartSkeletonDataOptions {
  /** Key used for y values in each row. Default: `"value"`. */
  dataKey?: string;
  /** Number of points. Default: 7. */
  pointCount?: number;
  /** Start date for the x axis. Default: 2025-01-01. */
  baseDate?: Date;
}

/** Placeholder series used while `status="loading"` and data is empty. */
export function generateChartSkeletonData(
  options: GenerateChartSkeletonDataOptions = {},
): Record<string, unknown>[] {
  const dataKey = options.dataKey ?? DEFAULT_SKELETON_DATA_KEY;
  const pointCount = options.pointCount ?? DEFAULT_SKELETON_POINT_COUNT;
  const baseDate = options.baseDate ?? new Date("2025-01-01");

  return Array.from({ length: pointCount }, (_, index) => {
    const date = new Date(baseDate);
    date.setDate(baseDate.getDate() + index);
    return {
      date,
      [dataKey]: Math.round(110 + Math.sin(index * 1.15) * 36 + index * 9),
    };
  });
}

/** Skeleton rows that mirror target dates/count with lower magnitudes for Y tween. */
export function generateChartSkeletonFromTarget(
  targetData: Record<string, unknown>[],
  dataKey: string,
): Record<string, unknown>[] {
  return targetData.map((row, index) => ({
    ...row,
    [dataKey]: Math.round(95 + Math.sin(index * 1.05) * 28 + index * 7),
  }));
}

const DEFAULT_SKELETON_CATEGORY_KEY = "name";
const DEFAULT_SKELETON_CATEGORY_COUNT = 6;
const DEFAULT_SKELETON_CATEGORY_LABEL = "—";
/** Zero-width space, used to keep placeholder category values unique (see below). */
const ZERO_WIDTH_SPACE = "​";

export interface GenerateCategoricalSkeletonDataOptions {
  /** Key used for the numeric value in each row. Default: `"value"`. Ignored when `dataKeys` is set. */
  dataKey?: string;
  /** Keys for multiple numeric series (e.g. grouped/stacked bars). Overrides `dataKey` when set. */
  dataKeys?: string[];
  /** Key used for the categorical (x) axis in each row. Default: `"name"`. */
  categoryKey?: string;
  /** Number of placeholder categories/rows. Default: 6. */
  categoryCount?: number;
}

/**
 * Placeholder categorical rows for a `scaleBand` chart (BarChart/ComposedChart)
 * while `status="loading"`. Category values render as an em dash but are made
 * unique per row via trailing zero-width spaces, so `scaleBand` doesn't
 * collapse every placeholder category onto the same band position.
 */
export function generateCategoricalSkeletonData(
  options: GenerateCategoricalSkeletonDataOptions = {},
): Record<string, unknown>[] {
  const categoryKey = options.categoryKey ?? DEFAULT_SKELETON_CATEGORY_KEY;
  const categoryCount = options.categoryCount ?? DEFAULT_SKELETON_CATEGORY_COUNT;
  const dataKeys =
    options.dataKeys && options.dataKeys.length > 0
      ? options.dataKeys
      : [options.dataKey ?? DEFAULT_SKELETON_DATA_KEY];

  return Array.from({ length: categoryCount }, (_, index) => {
    const row: Record<string, unknown> = {
      [categoryKey]: DEFAULT_SKELETON_CATEGORY_LABEL + ZERO_WIDTH_SPACE.repeat(index),
    };
    for (const [keyIndex, key] of dataKeys.entries()) {
      row[key] = Math.round(60 + Math.sin(index * 1.15 + keyIndex * 1.7) * 30 + index * 6);
    }
    return row;
  });
}

export {
  DEFAULT_SKELETON_CATEGORY_COUNT,
  DEFAULT_SKELETON_CATEGORY_KEY,
  DEFAULT_SKELETON_CATEGORY_LABEL,
  DEFAULT_SKELETON_DATA_KEY,
  DEFAULT_SKELETON_POINT_COUNT,
};
