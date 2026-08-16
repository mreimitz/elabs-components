/**
 * part-groups.ts — Pure, framework-free part-grouping engine.
 *
 * Derives collapsible reasoning/tool traces from an ordered list of message
 * parts. This is a CLIENT-SIDE VIEW TRANSFORM — never a model output format.
 * Adapted from assistant-ui's grouping design onto this library's idiom.
 *
 * `groupBy(part, context)` maps each part to a group-key path (`group-…`);
 * ADJACENT parts sharing a key path coalesce into synthetic group nodes
 * (`{ type: "group-…", status, indices }`); multi-element paths nest. The
 * `group-` namespace is reserved so a group key can never collide with a real
 * part `type`.
 */

/** A reserved group-key. The `group-` prefix can't collide with real part types. */
export type GroupKey = `group-${string}`;

/** Rolled-up status of a group (any member running → the group is running). */
export type GroupStatus = "pending" | "running" | "complete" | "error";

/** The minimum a groupable part must expose. */
export interface GroupablePart {
  type: string;
  [key: string]: unknown;
}

/** Context passed to `groupBy` for each part. */
export interface GroupByContext<T extends GroupablePart> {
  index: number;
  parts: readonly T[];
}

/** Maps a part to its group-key path (`[]` = not grouped, a top-level leaf). */
export type GroupBy<T extends GroupablePart> = (
  part: T,
  context: GroupByContext<T>,
) => readonly GroupKey[];

/** Extract a part's status; return `undefined` to fall back to the default. */
export type GetPartStatus<T extends GroupablePart> = (part: T) => GroupStatus | undefined;

/** The synthetic node produced for a coalesced group. */
export interface PartGroupNode {
  type: GroupKey;
  status: GroupStatus;
  /** Original indices of every leaf part under this group (recursive). */
  indices: number[];
}

/** One node in the grouped tree — a leaf part or a synthetic group. */
export type GroupedNode<T extends GroupablePart> =
  | { kind: "leaf"; key: string; index: number; part: T }
  | { kind: "group"; key: string; group: PartGroupNode; children: GroupedNode<T>[] };

// ---------------------------------------------------------------------------
// Default status extraction
// ---------------------------------------------------------------------------

const RUNNING_STATES = new Set([
  "input-streaming",
  "input-available",
  "approval-requested",
  "approval-responded",
  "calling",
  "streaming",
  "in-progress",
]);
const ERROR_STATES = new Set(["output-error", "error", "failed"]);
const COMPLETE_STATES = new Set(["output-available", "output-denied", "done", "complete"]);

/**
 * Best-effort status from common AI-SDK part shapes (tool `state`, reasoning
 * `state`, `isStreaming`). Overridable via `getStatus`.
 */
export function defaultPartStatus(part: GroupablePart): GroupStatus {
  if (part.isStreaming === true) return "running";
  const state = typeof part.state === "string" ? part.state : undefined;
  if (state) {
    if (ERROR_STATES.has(state)) return "error";
    if (RUNNING_STATES.has(state)) return "running";
    if (COMPLETE_STATES.has(state)) return "complete";
  }
  if (part.errorText || part.error) return "error";
  return "complete";
}

/** Roll several member statuses up into one group status. */
export function rollupStatus(statuses: readonly GroupStatus[]): GroupStatus {
  if (statuses.some((s) => s === "running")) return "running";
  if (statuses.some((s) => s === "error")) return "error";
  if (statuses.some((s) => s === "pending")) return "pending";
  return "complete";
}

// ---------------------------------------------------------------------------
// Stable identity keys
// ---------------------------------------------------------------------------

/** Stable leaf key so streaming rows don't remount (prefers a part id). */
function leafKey(part: GroupablePart, index: number): string {
  const id =
    (typeof part.id === "string" && part.id) ||
    (typeof part.toolCallId === "string" && part.toolCallId) ||
    null;
  return id ?? `${part.type}#${index}`;
}

// ---------------------------------------------------------------------------
// Tree building
// ---------------------------------------------------------------------------

interface Entry<T extends GroupablePart> {
  part: T;
  index: number;
  path: readonly GroupKey[];
}

function buildLevel<T extends GroupablePart>(
  entries: Entry<T>[],
  statusOf: (part: T) => GroupStatus,
): GroupedNode<T>[] {
  const out: GroupedNode<T>[] = [];
  let i = 0;
  while (i < entries.length) {
    const entry = entries[i]!;
    if (entry.path.length === 0) {
      out.push({
        kind: "leaf",
        key: leafKey(entry.part, entry.index),
        index: entry.index,
        part: entry.part,
      });
      i += 1;
      continue;
    }

    // Coalesce the adjacent run of entries sharing this level's key.
    const key0 = entry.path[0]!;
    const run: Entry<T>[] = [];
    let j = i;
    while (j < entries.length && entries[j]!.path.length > 0 && entries[j]!.path[0] === key0) {
      run.push(entries[j]!);
      j += 1;
    }

    // Recurse with each member's path shifted one level down (nesting).
    const childEntries: Entry<T>[] = run.map((r) => ({
      part: r.part,
      index: r.index,
      path: r.path.slice(1),
    }));
    const children = buildLevel(childEntries, statusOf);
    const indices = run.map((r) => r.index);
    const status = rollupStatus(run.map((r) => statusOf(r.part)));

    out.push({
      kind: "group",
      // First member index keeps the group key stable across append-only streams.
      key: `${key0}@${run[0]!.index}`,
      group: { type: key0, status, indices },
      children,
    });
    i = j;
  }
  return out;
}

/**
 * Build the grouped tree from an ordered part list. Pure + deterministic —
 * never throws. Adjacent parts with a shared group-key path coalesce; multi-key
 * paths nest; ungrouped parts (path `[]`) stay as top-level leaves.
 */
export function buildPartGroups<T extends GroupablePart>(
  parts: readonly T[],
  groupBy: GroupBy<T>,
  getStatus?: GetPartStatus<T>,
): GroupedNode<T>[] {
  const statusOf = (part: T): GroupStatus => getStatus?.(part) ?? defaultPartStatus(part);
  const entries: Entry<T>[] = parts.map((part, index) => {
    let path: readonly GroupKey[] = [];
    try {
      path = groupBy(part, { index, parts }) ?? [];
    } catch {
      path = []; // a throwing groupBy must not break the transcript
    }
    return { part, index, path };
  });
  return buildLevel(entries, statusOf);
}

/**
 * A cheap fingerprint of the parts' identity + type + status. Feed it to a
 * `useMemo` so the grouped tree only rebuilds when something structural
 * changed — streaming token updates that don't change status won't churn it.
 */
export function partsFingerprint<T extends GroupablePart>(
  parts: readonly T[],
  getStatus?: GetPartStatus<T>,
): string {
  return parts
    .map((part, index) => {
      const status = getStatus?.(part) ?? defaultPartStatus(part);
      return `${leafKey(part, index)}:${part.type}:${status}`;
    })
    .join("|");
}

// ---------------------------------------------------------------------------
// groupPartByType — the default grouping strategy + classification hint
// ---------------------------------------------------------------------------

/** Whether a part folds into a trace (`inline`) or always stands alone. */
export type PartDisplay = "inline" | "standalone";

export interface GroupPartByTypeOptions<T extends GroupablePart> {
  /** Group key for the collapsible trace. @default "group-work" */
  groupKey?: GroupKey;
  /** Part types folded into the trace. @default reasoning + tool-* + dynamic-tool + step-start */
  inline?: (string | RegExp)[];
  /** Part types forced standalone (never folded). @default approval / human / confirmation */
  standalone?: (string | RegExp)[];
  /** Explicit per-part classification; overrides the type lists. */
  classify?: (part: T) => PartDisplay | undefined;
}

const DEFAULT_INLINE: (string | RegExp)[] = [/^reasoning$/, /^tool-/, "dynamic-tool", "step-start"];
const DEFAULT_STANDALONE: (string | RegExp)[] = [/approval/i, /human/i, "confirmation"];

function matchesAny(type: string, patterns: (string | RegExp)[]): boolean {
  return patterns.some((p) => (typeof p === "string" ? p === type : p.test(type)));
}

/**
 * Build a `groupBy` that folds reasoning/tool parts into ONE collapsible trace
 * while forcing human/approval-style parts to stand alone — an interaction card
 * must never fold into a thinking accordion. The classification maps to the
 * `display: "inline" | "standalone"` hint.
 */
export function groupPartByType<T extends GroupablePart>(
  options: GroupPartByTypeOptions<T> = {},
): GroupBy<T> {
  const groupKey = options.groupKey ?? "group-work";
  const inline = options.inline ?? DEFAULT_INLINE;
  const standalone = options.standalone ?? DEFAULT_STANDALONE;
  return (part) => {
    const explicit = options.classify?.(part);
    if (explicit === "standalone") return [];
    if (explicit === "inline") return [groupKey];
    if (matchesAny(part.type, standalone)) return []; // forced standalone
    if (matchesAny(part.type, inline)) return [groupKey];
    return []; // ungrouped (text, sources, files, …) stays top-level
  };
}

/** Type guard: is this render subject a synthetic group node? */
export function isGroupNode(part: { type: string }): part is PartGroupNode {
  return part.type.startsWith("group-");
}
