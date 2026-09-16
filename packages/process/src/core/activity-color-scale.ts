/**
 * Activity colour scale — RM-054.
 *
 * One activity, one colour, across every process view. `ProcessMap` paints the colour as
 * a small accent mark on the activity node; `VariantExplorer` paints it on the sequence
 * chips. Both read the SAME scale instance built from one graph, so "Create Order" is the
 * same swatch in the map and in the variant list.
 *
 * ## The colour budget
 *
 * The chart palette ships twelve series tokens (`--chart-1` … `--chart-12`). The eleven
 * most frequent activities (ranked by the number of cases they occur in) take
 * `--chart-1` … `--chart-11`; every remaining activity shares `--chart-12` and is flagged
 * `pattern: "other"`, which the views render as a hatch so "other" never reads as a
 * twelfth distinct activity. Colour is never the only channel: every view that paints a
 * swatch also prints the activity label (or its two-letter {@link ActivityColorScale.codeFor}
 * code) as text.
 *
 * Pure and framework-free: returns token NAMES, never resolved colours, so a theme switch
 * re-inks every swatch with no recomputation.
 */
import type { ProcessGraph } from "./types";

/** How many activities get a distinct palette slot before the rest share "other". */
export const ACTIVITY_COLOR_SLOTS = 11;

/** The token every activity outside the top {@link ACTIVITY_COLOR_SLOTS} shares. */
export const ACTIVITY_OTHER_TOKEN = "--chart-12";

/** The colour one activity is painted with. */
export interface ActivityColor {
  /** A CSS custom-property NAME, e.g. `"--chart-3"`. Paint with `var(${token})`. */
  token: string;
  /** Present for the shared "other" bucket — render the hatch, not a flat swatch. */
  pattern?: "other";
}

/** One legend entry, in rank order. */
export interface ActivityColorLegendEntry extends ActivityColor {
  activityId: string;
  label: string;
  /** A two-character code unique within the scale, for abbreviated ("DNA strip") chips. */
  code: string;
}

/** The shared activity→colour mapping. */
export interface ActivityColorScale {
  /** The colour for an activity. An id the graph never contained is "other". */
  colorFor(activityId: string): ActivityColor;
  /** The two-character code for an activity; derived from the id when it is unknown. */
  codeFor(activityId: string): string;
  /** The activity's display label; the id itself when it is unknown. */
  labelFor(activityId: string): string;
  /** Every activity in the graph, ranked by case count descending, ties by id. */
  legend: ActivityColorLegendEntry[];
}

const OTHER: ActivityColor = Object.freeze({ token: ACTIVITY_OTHER_TOKEN, pattern: "other" });

/** Upper-cased letters and digits of a label — the material codes are built from. */
function alphanumerics(label: string): string {
  return label.replace(/[^\p{L}\p{N}]/gu, "").toUpperCase();
}

/**
 * Candidate two-character codes for a label, most readable first: initials of the first
 * two words ("Create Order" → "CO"), the first two letters ("Approve" → "AP"), then the
 * first letter paired with every later letter, then the first letter plus a digit.
 */
function codeCandidates(label: string): string[] {
  const out: string[] = [];
  const words = label.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const first = words[0];
  const second = words[1];
  if (first && second) out.push(`${first[0]}${second[0]}`.toUpperCase());
  const letters = alphanumerics(label);
  const head = letters[0] ?? "?";
  if (letters.length >= 2) out.push(letters.slice(0, 2));
  for (let i = 2; i < letters.length; i += 1) out.push(`${head}${letters[i]}`);
  for (let digit = 1; digit <= 9; digit += 1) out.push(`${head}${digit}`);
  return out;
}

/** A code for a label, avoiding every code already in `taken`. */
function uniqueCode(label: string, taken: Set<string>): string {
  for (const candidate of codeCandidates(label)) {
    if (!taken.has(candidate)) return candidate;
  }
  // Pathological: more than ~40 activities sharing one first letter. Fall back to a
  // base-36 counter so the code is still two characters and still unique.
  for (let n = 0; n < 36 * 36; n += 1) {
    const candidate = n.toString(36).toUpperCase().padStart(2, "0");
    if (!taken.has(candidate)) return candidate;
  }
  return (alphanumerics(label).slice(0, 2) || "??").padEnd(2, "?");
}

/**
 * Build the shared colour scale for a graph.
 *
 * Deterministic: the same graph always yields the same assignment, regardless of the
 * order `graph.activities` arrives in. Build it from the FULL (unfiltered, unabstracted)
 * graph so colours stay put while a reader filters or abstracts.
 */
export function activityColorScale(graph: ProcessGraph): ActivityColorScale {
  const ranked = [...graph.activities].sort(
    (a, b) => b.cases - a.cases || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  const colors = new Map<string, ActivityColor>();
  const codes = new Map<string, string>();
  const labels = new Map<string, string>();
  const taken = new Set<string>();
  const legend: ActivityColorLegendEntry[] = ranked.map((activity, index) => {
    const color: ActivityColor =
      index < ACTIVITY_COLOR_SLOTS ? { token: `--chart-${index + 1}` } : OTHER;
    const label = activity.label || activity.id;
    const code = uniqueCode(label, taken);
    taken.add(code);
    colors.set(activity.id, color);
    codes.set(activity.id, code);
    labels.set(activity.id, label);
    return { activityId: activity.id, label, code, ...color };
  });

  return {
    colorFor: (activityId) => colors.get(activityId) ?? OTHER,
    codeFor: (activityId) =>
      codes.get(activityId) ?? (alphanumerics(activityId).slice(0, 2) || "??").padEnd(2, "?"),
    labelFor: (activityId) => labels.get(activityId) ?? activityId,
    legend,
  };
}
