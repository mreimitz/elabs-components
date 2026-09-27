/**
 * DG-15 — the text edits of manual layout (plan D2, D6): switch to `layout: manual` with
 * every position, write moved positions, move a node to another zone, switch back to auto.
 * Each returns a DG-14 `TextEditFn` for `editActions.applyEdit`, so one gesture is one
 * text edit. Positions are integers and relative to the parent, as DG-10 reads them.
 * React-free.
 */
import { normalizeArch } from "../spec/dialect/normalize";
import { parseArchYaml } from "../spec/dialect/parse";
import {
  moveEntry,
  setEntriesKeys,
  type EntryKeysPatch,
  type EntryPatch,
} from "../spec/dialect/write-back";
import type { CompiledDiagram } from "../state/compile-text";
import type { TextEditFn } from "../state/diagram-store";
import { entryOf } from "../state/entries";

export interface Point {
  x: number;
  y: number;
}

/** A zone or node and its position as the canvas draws it, relative to its parent. */
export interface Placement {
  id: string;
  position: Point;
}

/** A node dropped into another zone (`into: null` = the top level), at `position` in it. */
export interface Move {
  id: string;
  into: string | null;
  position: Point;
}

const round = (p: Point): Point => ({ x: Math.round(p.x), y: Math.round(p.y) });
const samePoint = (a: Point | undefined, b: Point) => a !== undefined && a.x === b.x && a.y === b.y;

/** `layout:` goes after the first of these the text has (the header block). */
const LAYOUT_AFTER = ["legend", "nodeStyle", "direction", "description", "title", "diagram"];

/** The text path of zone or node `id` in `text` (paths shift as entries move). */
function pathIn(text: string, id: string): string | null {
  const { raw, sourceMap } = parseArchYaml(text);
  const ast = raw === undefined ? null : normalizeArch(raw, sourceMap).ast;
  const hit = ast?.zones.find((z) => z.id === id) ?? ast?.nodes.find((n) => n.id === id);
  return hit?.path ?? null;
}

/** The zone or node `id` was compiled from, with its text position. */
function writable(compiled: CompiledDiagram, id: string) {
  const entry = entryOf(compiled, id);
  if (entry?.kind === "zone") return { path: entry.path, position: entry.zone.position };
  if (entry?.kind === "node") return { path: entry.path, position: entry.node.position };
  return null; // a note (no position in the dialect) or a flow
}

/**
 * One gesture, one edit: `switchOn` adds `layout: manual`; every placement whose integer
 * position differs from the text's is written (with `switchOn`, all of them); each move
 * then sets `parent:` (a top-level `nodes:` entry) or moves the entry's lines into the
 * target zone's `children:` (a nested entry).
 */
export function manualEdit(
  placements: readonly Placement[],
  moves: readonly Move[],
  switchOn: boolean,
): TextEditFn {
  return (text, compiled) => {
    const moving = new Map(moves.map((move) => [move.id, move]));
    const patches: EntryKeysPatch[] = [];
    if (switchOn) {
      const { raw } = parseArchYaml(text);
      const keys = raw !== null && typeof raw === "object" ? Object.keys(raw) : [];
      const after = LAYOUT_AFTER.find((key) => keys.includes(key));
      patches.push({ path: "", patch: { layout: "manual" }, options: { after } });
    }
    for (const { id, position } of placements) {
      const entry = writable(compiled, id);
      if (!entry) continue;
      const move = moving.get(id);
      const at = round(move ? move.position : position);
      const patch: Record<string, EntryPatch[string]> = {};
      if (switchOn || !samePoint(entry.position, at)) patch.position = at;
      if (move) {
        const flat = entry.path.startsWith("nodes[");
        // A flat entry says where it lives; a nested one drops a `parent:` it may repeat.
        patch.parent = flat && move.into !== null ? move.into : undefined;
      }
      if (Object.keys(patch).length > 0) patches.push({ path: entry.path, patch });
    }
    let next = patches.length > 0 ? setEntriesKeys(text, patches) : text;
    for (const move of moves) {
      if (next === null) return null;
      const from = pathIn(next, move.id);
      if (from === null || from.startsWith("nodes[")) continue; // flat: `parent:` did it
      const into = move.into === null ? null : pathIn(next, move.into);
      if (move.into !== null && into === null) return null;
      next = moveEntry(next, from, into);
    }
    return next;
  };
}

/** `layout: manual` → auto: `layout:` and every `position:` go (the validator warns on them). */
export const autoEdit: TextEditFn = (text, compiled) => {
  const { ast } = compiled;
  if (!ast) return null;
  const patches: EntryKeysPatch[] = [{ path: "", patch: { layout: undefined } }];
  for (const entry of [...ast.zones, ...ast.nodes]) {
    if (entry.position) patches.push({ path: entry.path, patch: { position: undefined } });
  }
  return setEntriesKeys(text, patches);
};
