import type { Edge, Node } from "@elabs-ai/components-flow";

/** Gap between a note and the node it annotates, in manual layout. */
export const NOTE_GAP = 24;

/** The id prefix of a layout-only note edge. Never rendered. */
const NOTE_EDGE_PREFIX = "layout-note__";

/**
 * Auto layout: one layout-only edge per note, from the node it annotates to the note, so
 * ELK puts the note in the next layer beside it and inside the same zone (DG-10 gives the
 * note its anchor's parent). ELK spaces it like any node, so a note never overlaps.
 * Only for notes whose anchor and note are both in `visible`.
 */
export function noteLayoutEdges(
  noteAnchors: Readonly<Record<string, string>>,
  visible: ReadonlySet<string>,
): Edge[] {
  return Object.entries(noteAnchors)
    .filter(([note, anchor]) => visible.has(note) && visible.has(anchor))
    .map(([note, anchor]) => ({
      id: `${NOTE_EDGE_PREFIX}${note}`,
      source: anchor,
      target: note,
    }));
}

/**
 * Manual layout: DG-10 gives a note its anchor's `position`; move it `NOTE_GAP` to the
 * right of the anchor's measured box, top-aligned. Same parent, so the same frame.
 */
export function placeNotesBeside(
  nodes: Node[],
  noteAnchors: Readonly<Record<string, string>>,
): Node[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return nodes.map((node) => {
    const anchorId = noteAnchors[node.id];
    const anchor = anchorId === undefined ? undefined : byId.get(anchorId);
    if (!anchor) return node;
    const width = anchor.measured?.width ?? anchor.width ?? 0;
    return {
      ...node,
      position: {
        x: anchor.position.x + width + NOTE_GAP,
        y: anchor.position.y,
      },
    };
  });
}
