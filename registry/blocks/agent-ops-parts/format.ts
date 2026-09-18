/**
 * `Intl.*` formatting helpers shared by every agent-ops block. Every function
 * takes an explicit `locale` (default `"en-US"`) rather than calling a bare
 * `toLocaleString()` — see `.claude/rules/conventions.md` § locale-formatting.
 */

const DEFAULT_LOCALE = "en-US";

/** "$12,840" — whole units, no compaction: an envelope or a ledger amount is read exactly. */
export function formatMoney(
  value: number,
  currency = "USD",
  locale: string = DEFAULT_LOCALE,
  fractionDigits = 0,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);
}

/** "$1.48M" — compact, for a headline figure whose magnitude matters more than its cents. */
export function formatMoneyCompact(
  value: number,
  currency = "USD",
  locale: string = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

/** "1,284" */
export function formatCount(value: number, locale: string = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

/** "92.3%" from a 0–1 fraction. */
export function formatShare(
  fraction: number,
  locale: string = DEFAULT_LOCALE,
  fractionDigits = 1,
): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(fraction);
}

/** Signed "+12.4%" / "−2.1%" relative change, or `null` when the prior is zero. */
export function formatSignedChange(
  actual: number,
  prior: number,
  locale: string = DEFAULT_LOCALE,
): string | null {
  if (prior === 0) return null;
  const pct = (actual - prior) / Math.abs(prior);
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(Math.abs(pct))}`;
}

/** Signed "+18" / "−6" score points. */
export function formatSignedPoints(points: number, locale: string = DEFAULT_LOCALE): string {
  const sign = points > 0 ? "+" : points < 0 ? "−" : "";
  return `${sign}${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.abs(points))}`;
}

/** "2 min ago" / "3 h ago" / "yesterday" — relative to `now`, never to the wall clock. */
export function formatRelative(at: Date, now: Date, locale: string = DEFAULT_LOCALE): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" });
  const diffMs = at.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return rtf.format(0, "second");
  if (abs < hour) return rtf.format(Math.round(diffMs / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diffMs / hour), "hour");
  return rtf.format(Math.round(diffMs / day), "day");
}

/** "06:02" — a run stamp; UTC so the fixture renders the same in every timezone. */
export function formatClock(at: Date, locale: string = DEFAULT_LOCALE, seconds = false): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
    hour12: false,
    timeZone: "UTC",
  }).format(at);
}

/** "4 Aug" */
export function formatDayMonth(at: Date, locale: string = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(at);
}

/** "3.28 s" / "188 ms" — one unit per value, chosen by magnitude. */
export function formatDuration(ms: number, locale: string = DEFAULT_LOCALE): string {
  if (ms >= 1_000) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(ms / 1_000)} s`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(ms)} ms`;
}
