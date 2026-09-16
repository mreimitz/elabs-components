/**
 * clipboard.ts (RM-081) — copy/cut/paste across sheets and browser tabs. Round-trips through
 * `navigator.clipboard` as JSON, tagged with a marker so paste never accepts stray OS clipboard
 * text; an in-memory fallback keeps copy/paste working within one session when the real
 * clipboard is permission-gated (a sandboxed Storybook/test runner) or unavailable — a play
 * never depends on the browser actually granting clipboard access.
 */
import type { TileSpec } from "../core/spec";

/** Tags a clipboard payload as brand-ui dashboard tiles, never plain OS clipboard text. */
export const DASHBOARD_CLIPBOARD_MARKER = "brand-ui/dashboard-tiles";

/** One copied tile, stripped of its id (paste always regenerates ids) but keeping its size. */
export interface DashboardClipboardTile {
  kind: string;
  content: unknown;
  layout: { w: number; h: number };
  title?: string;
  subtitle?: string;
  footnote?: string;
  source?: string;
  /** A library-backed tile keeps its `ref` (R25); paste still instantiates a fresh id. */
  ref?: string;
}

/** The JSON shape written to `navigator.clipboard` and the in-memory fallback. */
export interface DashboardClipboardPayload {
  marker: typeof DASHBOARD_CLIPBOARD_MARKER;
  version: 1;
  tiles: DashboardClipboardTile[];
}

// The in-memory fallback: module-scoped, so it survives only for this session/tab, never
// persisted — the marker'd `navigator.clipboard` text is the cross-tab/cross-sheet channel.
let memoryClipboard: DashboardClipboardPayload | null = null;

/** Real `TileSpec`s (as focus holds them) → a clipboard payload, dropping `id` and `container`. */
export function tilesToClipboardPayload(tiles: readonly TileSpec[]): DashboardClipboardPayload {
  return {
    marker: DASHBOARD_CLIPBOARD_MARKER,
    version: 1,
    tiles: tiles.map((tile) => ({
      kind: tile.kind,
      content: tile.content,
      layout: { w: tile.layout.w, h: tile.layout.h },
      title: tile.title,
      subtitle: tile.subtitle,
      footnote: tile.footnote,
      source: tile.source,
      ref: tile.ref,
    })),
  };
}

/** Parse clipboard text; `null` for anything that is not this marker's JSON (never throws). */
export function parseDashboardClipboardText(text: string): DashboardClipboardPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as Partial<DashboardClipboardPayload>).marker !== DASHBOARD_CLIPBOARD_MARKER ||
    !Array.isArray((parsed as Partial<DashboardClipboardPayload>).tiles)
  )
    return null;
  return parsed as DashboardClipboardPayload;
}

/** Copy: writes the marker'd JSON to the real clipboard, and always to the in-memory fallback. */
export async function writeDashboardClipboard(tiles: readonly TileSpec[]): Promise<void> {
  const payload = tilesToClipboardPayload(tiles);
  memoryClipboard = payload;
  try {
    if (!navigator.clipboard) throw new Error("navigator.clipboard unavailable");
    await navigator.clipboard.writeText(JSON.stringify(payload));
  } catch {
    // Permission-gated or unavailable — the in-memory fallback (already set above) still
    // round-trips a same-session copy/paste.
  }
}

/**
 * Paste: reads the real clipboard first (marker'd JSON → its tiles, anything else → `[]`, so a
 * stray OS clipboard string never pastes tiles); falls back to the in-memory copy only when the
 * real read itself fails (permission denial), never when it succeeds with non-marker text.
 */
export async function readDashboardClipboard(): Promise<DashboardClipboardTile[]> {
  try {
    if (!navigator.clipboard) throw new Error("navigator.clipboard unavailable");
    const text = await navigator.clipboard.readText();
    return parseDashboardClipboardText(text)?.tiles ?? [];
  } catch {
    return memoryClipboard?.tiles ?? [];
  }
}

/** Test-only: clear the in-memory fallback between cases. Never called by app code. */
export function resetDashboardClipboardForTests(): void {
  memoryClipboard = null;
}
