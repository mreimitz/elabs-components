/**
 * date-format.ts — the span/width ladder for a chart's date labels (RM-109).
 *
 * Before this module, every axis, tooltip and date ticker in this package
 * formatted a `Date` through `shortDateFmt` ("Mon d") **whatever the span**
 * — a ten-year daily series and a 36-hour series painted the same shape of
 * label. Datawrapper's River charts instead pick a granularity from how much
 * TIME a tick has to cover and how many ticks there are to fit: a wide
 * domain with few ticks reads years, a narrow domain with many reads hours
 * or minutes. The year rung additionally abbreviates when the axis is
 * CRAMPED for room (an `XAxis` caller's own width signal — see the
 * `cramped` option on {@link dateFormatForSpan}), not when the tick set
 * happens to be large.
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
 * - `"yearShort"` — `’15` (elision mark, U+2019 — added by
 *   `chart-formatters.ts`'s `makeDateFmtForPreset`, since `Intl`'s 2-digit
 *   year option has no elision-mark equivalent of its own). Same annual
 *   cadence as `"year"`, a narrower string for a CRAMPED axis — see
 *   {@link dateFormatForSpan}.
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
 * Picks the coarsest {@link DateFormatPreset} whose natural cadence still
 * gives `tickCount` ticks across `domain` distinguishable labels — the
 * "date ladder": `year`/`yearShort` → `month` → `day` → `weekday` → `hour`
 * → `minute`.
 *
 * Pure function of the SPAN and the tick count already decided elsewhere
 * (RM-108's width-derived target) — this module never measures a container
 * itself, so it has nothing to wait on RM-107/RM-108 for.
 *
 * **The year rung's `"year"`/`"yearShort"` choice (date-ladder round, #478)**
 * is the one place this function is not purely a function of span + tick
 * count: it also takes `cramped`, the caller's own read of ROOM, not of TICK
 * COUNT. An earlier version keyed this off `tickCount` alone ("many ticks
 * sharing the year tier ⇒ abbreviate") — backwards from what a reader
 * actually needs: MORE ticks on a WIDE axis does not mean less room per
 * label (RM-108 targets a roughly constant ~90px per tick at every width, by
 * construction), so that rule never abbreviated at the width that is
 * actually cramped and never spelled the year out at the width that has
 * room. `cramped` is instead the caller's OWN width signal — in practice
 * `XAxis` passes RM-107's narrow breakpoint (`density === "sm"`, ADR 0039),
 * since that is the one signal the chart already publishes for "this plot
 * does not have room" and every other narrow-only decision (hiding the
 * value axis, capping the y tick count) already keys off it too. A caller
 * with a genuine per-tick pixel budget (plot width ÷ resolved tick count vs.
 * a measured/estimated four-digit-year width) may pass that instead — this
 * function only asks for a boolean, not for how it was decided.
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
  options?: {
    /**
     * The axis does not have room to spell a 4-digit year out — abbreviate
     * to `"yearShort"` instead of `"year"` when the span/tick-count gap
     * would otherwise pick the year tier. Default `false` (spell it out),
     * matching every pre-existing caller that does not pass it.
     */
    cramped?: boolean;
  },
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
    return options?.cramped ? "yearShort" : "year";
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
