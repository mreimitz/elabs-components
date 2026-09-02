/**
 * `WorkspacePicker`'s pure, directly-testable logic — kept out of the
 * component for the same reason `../model-picker/model-picker-state.ts` does
 * (see that file's header comment): an expression buried in JSX cannot be
 * unit-tested in isolation, and relative-time arithmetic in particular has
 * edge cases worth locking down on their own.
 */

/**
 * One recent workspace. Deliberately a strict subset of `ModelPickerItem`'s
 * shape (`id` / `name` → `label` / `path` → `description` / `lastOpenedAt` →
 * a formatted `meta` entry) — see the reuse note in `workspace-picker.tsx`.
 */
export interface Workspace {
  id: string;
  /** Rendered as the row's primary label and, when current, the trigger text. */
  name: string;
  /**
   * The filesystem path. Long, user-supplied content — the row truncates it,
   * never wraps or overflows.
   */
  path: string;
  /**
   * When this workspace was last opened. Rendered as a relative time via
   * `Intl.RelativeTimeFormat` (`formatLastOpened`, below) — never a
   * pre-formatted string the caller hands over.
   */
  lastOpenedAt?: Date;
}

/**
 * "2 hours ago" / "in 3 minutes" / "yesterday" — `Intl.RelativeTimeFormat`
 * picks the coarsest unit (minutes → hours → days) that still reads
 * naturally, instead of e.g. "127 minutes ago".
 *
 * @param now - injection seam for tests; defaults to the real clock.
 */
export function formatLastOpened(date: Date, locale: string, now: number = Date.now()): string {
  const diffMs = date.getTime() - now;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  const minutes = Math.round(diffMs / (60 * 1000));
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");

  const hours = Math.round(diffMs / (60 * 60 * 1000));
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");

  const days = Math.round(diffMs / (24 * 60 * 60 * 1000));
  return rtf.format(days, "day");
}
