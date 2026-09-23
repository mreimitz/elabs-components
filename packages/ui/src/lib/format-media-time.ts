const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

export interface FormatMediaTimeOptions {
  /**
   * Force the `h:mm:ss` shape even below an hour — pass it for every time on a
   * player whose duration reaches an hour, so "0:05:00" and "1:02:03" line up.
   */
  hours?: boolean;
}

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * A media clock: `m:ss` below an hour (minutes unpadded), `h:mm:ss` at an hour
 * or with `hours: true`. Seconds are floored, so the clock never reads ahead of
 * the playhead. `NaN`, `±Infinity` and negative input read `"0:00"` — a player
 * before `loadedmetadata`, or a live stream, shows a neutral clock.
 */
export function formatMediaTime(seconds: number, options: FormatMediaTimeOptions = {}): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const secs = total % SECONDS_PER_MINUTE;
  if (options.hours || hours > 0) return `${hours}:${pad(minutes)}:${pad(secs)}`;
  return `${minutes}:${pad(secs)}`;
}
