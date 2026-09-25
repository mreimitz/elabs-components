/**
 * column-actions.ts — column moves, auto-sizing and fit-to-width for
 * DataTable / DataGrid. Moves respect pinning: a pinned column moves inside
 * its own pinned block (the pin arrays ARE its order), an unpinned one moves
 * among the unpinned columns (TanStack's `columnOrder`).
 */

/** The slice of a TanStack v9 table these helpers need. */
export interface ColumnActionTable {
  getAllLeafColumns(): Array<{ id: string; getIsVisible(): boolean }>;
}

export interface PinState {
  left: string[];
  right: string[];
}

export interface MoveResult {
  columnOrder?: string[];
  columnPinning?: PinState;
}

function regionOf(pinning: PinState, id: string): "left" | "right" | "center" {
  if (pinning.left.includes(id)) return "left";
  if (pinning.right.includes(id)) return "right";
  return "center";
}

/**
 * Moves `columnId` one visible step (`delta` = -1 toward the start, +1 toward
 * the end) or onto `targetId`'s slot, within its pinning region. Returns only
 * the slice that changes, or `null` when the column cannot move that way.
 */
export function moveColumn(
  table: ColumnActionTable,
  pinning: PinState,
  columnId: string,
  to: { delta: -1 | 1 } | { targetId: string; side: "before" | "after" },
): MoveResult | null {
  const region = regionOf(pinning, columnId);
  if ("targetId" in to && regionOf(pinning, to.targetId) !== region) return null;
  if (region !== "center") {
    const list = [...pinning[region]];
    const from = list.indexOf(columnId);
    let target: number;
    if ("delta" in to) {
      target = from + to.delta;
      if (target < 0 || target >= list.length) return null;
    } else {
      list.splice(from, 1);
      const at = list.indexOf(to.targetId);
      target = to.side === "before" ? at : at + 1;
      list.splice(target, 0, columnId);
      return { columnPinning: { ...pinning, [region]: list } };
    }
    list.splice(from, 1);
    list.splice(target, 0, columnId);
    return { columnPinning: { ...pinning, [region]: list } };
  }
  const all = table.getAllLeafColumns();
  const order = all.map((c) => c.id);
  const movable = all
    .filter((c) => c.getIsVisible() && regionOf(pinning, c.id) === "center")
    .map((c) => c.id);
  const pos = movable.indexOf(columnId);
  if (pos < 0) return null;
  let targetId: string;
  let side: "before" | "after";
  if ("delta" in to) {
    const neighbour = movable[pos + to.delta];
    if (!neighbour) return null;
    targetId = neighbour;
    side = to.delta < 0 ? "before" : "after";
  } else {
    targetId = to.targetId;
    side = to.side;
  }
  if (targetId === columnId) return null;
  const next = order.filter((id) => id !== columnId);
  const at = next.indexOf(targetId);
  next.splice(side === "before" ? at : at + 1, 0, columnId);
  if (next.every((id, i) => id === order[i])) return null;
  return { columnOrder: next };
}

/**
 * Natural (unwrapped) content width of every rendered cell in a column, in
 * px, including the cell's horizontal padding. Measures the live DOM, so only
 * rendered rows count — the same rule AG Grid's auto-size uses — and restores
 * every style it touches before returning.
 */
export function measureColumnWidths(
  root: HTMLElement,
  columnIds: readonly string[],
  options: { skipHeader?: boolean } = {},
): Map<string, number> {
  const widths = new Map<string, number>();
  // Measure a max-content CLONE of each cell: a cell's own box (and any
  // block / flex wrapper inside it) is as wide as the column already is, so
  // only an unconstrained copy reports what the content actually needs. The
  // probe lives inside `root` so theme variables and fonts resolve the same.
  const probe = root.ownerDocument.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  root.appendChild(probe);
  try {
    for (const id of columnIds) {
      const selector = options.skipHeader
        ? `td[data-column="${CSS.escape(id)}"]`
        : `[data-column="${CSS.escape(id)}"]`;
      let max = 0;
      for (const cell of root.querySelectorAll<HTMLElement>(selector)) {
        probe.className = cell.className;
        // Clone the nodes (never an HTML string: Trusted Types sites forbid
        // `innerHTML` assignment).
        probe.replaceChildren(...Array.from(cell.childNodes, (node) => node.cloneNode(true)));
        probe.style.cssText =
          "position:absolute;visibility:hidden;inset-inline-start:-100000px;top:0;width:max-content;white-space:nowrap;display:block";
        // Absolutely positioned parts (resize handle, drop line) are not content.
        for (const part of probe.querySelectorAll<HTMLElement>(
          '[role="separator"], [data-slot="data-table-column-drop"]',
        )) {
          part.remove();
        }
        max = Math.max(max, Math.ceil(probe.getBoundingClientRect().width) + 1);
      }
      if (max > 0) widths.set(id, max);
    }
  } finally {
    probe.remove();
  }
  return widths;
}

/**
 * Scales column widths proportionally so they fill `available` px, honouring
 * each column's min / max. Columns listed in `fixed` keep their width.
 */
export function fitWidths(
  sizes: ReadonlyMap<string, { size: number; min: number; max: number }>,
  available: number,
  fixed: ReadonlySet<string> = new Set(),
): Record<string, number> {
  let fixedTotal = 0;
  let flexTotal = 0;
  for (const [id, s] of sizes) {
    if (fixed.has(id)) fixedTotal += s.size;
    else flexTotal += s.size;
  }
  const room = Math.max(0, available - fixedTotal);
  const out: Record<string, number> = {};
  if (flexTotal <= 0) return out;
  const factor = room / flexTotal;
  let used = 0;
  const flexIds = [...sizes.keys()].filter((id) => !fixed.has(id));
  flexIds.forEach((id, i) => {
    const s = sizes.get(id)!;
    const last = i === flexIds.length - 1;
    const raw = last ? room - used : Math.floor(s.size * factor);
    const size = Math.min(s.max, Math.max(s.min, raw));
    out[id] = size;
    used += size;
  });
  return out;
}
