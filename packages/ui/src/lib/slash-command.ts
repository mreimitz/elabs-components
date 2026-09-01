/**
 * The command model behind a `/`-triggered slash-command palette
 * (`PromptInputSlash` in `@elabs-ai/components-ai`, and the terminal CLI
 * look-alike family's own palette — issue #117).
 *
 * Promoted here (not duplicated) because `@elabs-ai/components-ai` and
 * `@elabs-ai/components-terminal` are layer-2 DAG SIBLINGS and may not import
 * each other — `ui` is upstream of both, so this is the one legal shared home
 * (docs/decisions/2026-09-01-brainless-adoption-architecture.md § 4, the
 * promotion rule: "a helper shared by two layer-2 siblings moves UP to `ui`,
 * it is never duplicated sideways"). No DOM, no keyboard wiring, no rendering
 * — the popover, the caret tracking and the row markup stay in each
 * package's own presentational component.
 */
import type { ReactNode } from "react";

/** One entry a slash palette offers. Ships no vocabulary — entirely prop-driven. */
export interface SlashCommand {
  /** Stable name, WITHOUT the leading "/" (e.g. `"help"`, not `"/help"`). */
  name: string;
  /** One line shown next to the name. */
  description?: string;
  /** Extra prefix-match aids beyond `name` (matched case-insensitively). */
  keywords?: string[];
  /** Leading glyph. Decorative — the row is identified by `name`. */
  icon?: ReactNode;
}

/**
 * Case-insensitive PREFIX match on `name`, falling back to a prefix match on
 * any `keyword`. Prefix (not substring) is deliberate: `/hel` should surface
 * `/help`, not e.g. a hypothetical `/channel`.
 */
export function defaultSlashCommandFilter(command: SlashCommand, query: string): boolean {
  const q = query.toLowerCase();
  if (q.length === 0) return true;
  if (command.name.toLowerCase().startsWith(q)) return true;
  return (command.keywords ?? []).some((keyword) => keyword.toLowerCase().startsWith(q));
}

/** Next index in `[0, count)`, wrapping at both ends. `-1` when `count` is 0. */
export function stepIndex(count: number, from: number, direction: 1 | -1): number {
  if (count === 0) return -1;
  return (((from + direction) % count) + count) % count;
}
