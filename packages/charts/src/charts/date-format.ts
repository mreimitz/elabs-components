/**
 * date-format.ts — the span/width ladder for a chart's date labels (RM-109).
 *
 * Before this module, every axis, tooltip and date ticker in this package
 * formatted a `Date` through `shortDateFmt` ("Mon d") **whatever the span**
 * — a ten-year daily series and a 36-hour series painted the same shape of
 * label. Datawrapper's River charts instead pick a granularity from how much
 * TIME a tick has to cover and how many ticks there are to fit: a wide
 * domain with few ticks reads years, a narrow domain with many reads hours
 * or minutes.
 *
 * Pure by design, the same split as `value-format.ts`: types, a ladder and an
 * `Intl.DateTimeFormatOptions` builder, no React and no `Intl` instances
 * (those are created behind the locale-keyed cache in `chart-formatters.ts`,
 * which is also where the actual `Date → string` functions live).
 */

/**
 * One rung of the date-format ladder, coarsest first.
 *
 * - `"year"` — `2015`.
 * - `"yearShort"` — `'15`. Same annual cadence as `"year"`, a narrower
 *   string for when the tick SET is dense (many ticks want the same rung —
 *   see {@link dateFormatForSpan}).
 * - `"month"` — `Jan '24`.
 * - `"day"` — `3 Mar`.
 * - `"weekday"` — `Mon, 3 Mar`.
 * - `"hour"` — `14:00`.
 * - `"minute"` — `14:32`.
 */
export type DateFormatPreset =
  | "year"
  | "yearShort"
  | "month"
  | "day"
  | "weekday"
  | "hour"
  | "minute";

/** Every rung, coarsest first — the order {@link dateFormatForSpan} walks. */
export const DATE_FORMAT_LADDER: readonly DateFormatPreset[] = [
  "year",
  "yearShort",
  "month",
  "day",
  "weekday",
  "hour",
  "minute",
];

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const MS_PER_MONTH = 30.44 * MS_PER_DAY;
const MS_PER_YEAR = 365.25 * MS_PER_DAY;

/**
 * Ticks at or above this count share one rung's label with their neighbours
 * close enough together that the coarse tier's SHORT form (`"yearShort"`)
 * reads better than repeating the full one (`"year"`) `tickCount` times —
 * "dense", in the ladder's own vocabulary. Below it, the domain has room to
 * spell the rung out.
 */
const DENSE_TICK_COUNT_THRESHOLD = 8;

/**
 * Picks the coarsest {@link DateFormatPreset} whose natural cadence still
 * gives `tickCount` ticks across `domain` distinguishable labels — the
 * "date ladder": `year` → `yearShort` (dense) → `month` → `day` → `weekday`
 * → `hour` → `minute`.
 *
 * Pure function of the SPAN and the tick count already decided elsewhere
 * (today: the caller's `numTicks`/`tickValues`; once RM-108 lands, a
 * width-derived count) — this module never measures a container itself, so
 * it has nothing to wait on RM-107/RM-108 for.
 *
 * `locale` is accepted for callers that resolve rungs per-locale in the
 * future (e.g. a calendar system where "year" is not the coarsest natural
 * unit); the current ladder does not vary by locale.
 */
export function dateFormatForSpan(
  domain: readonly [Date, Date],
  tickCount: number,
  // Reserved for a future locale-varying ladder — part of the documented
  // signature (RM-109) even though the current rungs do not vary by locale.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- see above.
  _locale?: string,
): DateFormatPreset {
  const [start, end] = domain;
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return "day";
  }

  const spanMs = Math.abs(endMs - startMs);
  const safeTickCount = Math.max(1, tickCount);
  // Average time between two adjacent ticks — the cadence a label has to
  // stay distinguishable at, which is what actually picks the rung (a
  // hundred-year domain with 3 ticks still only needs "year").
  const gapMs = spanMs / safeTickCount;

  if (gapMs >= MS_PER_YEAR) {
    // Dense = many ticks sharing the year tier — abbreviate so `tickCount`
    // repeats of the label stay legible side by side.
    return safeTickCount >= DENSE_TICK_COUNT_THRESHOLD ? "yearShort" : "year";
  }
  if (gapMs >= MS_PER_MONTH) {
    return "month";
  }
  if (gapMs >= MS_PER_DAY) {
    return "day";
  }
  if (gapMs >= MS_PER_DAY / 4) {
    return "weekday";
  }
  if (gapMs >= MS_PER_HOUR) {
    return "hour";
  }
  return "minute";
}

/**
 * The finer sibling of `preset` — one rung down the ladder, `"minute"`
 * repeating at the end (there is no finer rung). Tooltips and `DateTicker`
 * (RM-109) show it instead of the axis' own preset: an axis showing `"year"`
 * ticks still wants a hovered point to read `"month"`, not just repeat the
 * same year the visible tick already named.
 */
export function finerDateFormatPreset(preset: DateFormatPreset): DateFormatPreset {
  const index = DATE_FORMAT_LADDER.indexOf(preset);
  if (index === -1 || index === DATE_FORMAT_LADDER.length - 1) {
    return preset;
  }
  // `"year"` → `"month"` directly: `"yearShort"` is a STRING-width variant of
  // the same annual cadence, not a finer time unit, so it is not a
  // meaningfully finer sibling of `"year"` either.
  const next = DATE_FORMAT_LADDER[index + 1];
  return next === "yearShort" ? "month" : (next ?? preset);
}

/** `Intl.DateTimeFormatOptions` for one {@link DateFormatPreset} rung. */
export function dateFormatOptionsForPreset(preset: DateFormatPreset): Intl.DateTimeFormatOptions {
  switch (preset) {
    case "year":
      return { year: "numeric" };
    case "yearShort":
      return { year: "2-digit" };
    case "month":
      return { year: "2-digit", month: "short" };
    case "day":
      return { month: "short", day: "numeric" };
    case "weekday":
      return { weekday: "short", month: "short", day: "numeric" };
    case "hour":
      return { hour: "2-digit", minute: "2-digit", hour12: false };
    case "minute":
      return { hour: "2-digit", minute: "2-digit", hour12: false };
    default:
      return { month: "short", day: "numeric" };
  }
}
