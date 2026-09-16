import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TileSpec } from "../core/spec";
import {
  DASHBOARD_CLIPBOARD_MARKER,
  parseDashboardClipboardText,
  readDashboardClipboard,
  resetDashboardClipboardForTests,
  tilesToClipboardPayload,
  writeDashboardClipboard,
} from "./clipboard";

const TILE: TileSpec = {
  id: "chart-1",
  kind: "chart",
  title: "Revenue",
  layout: { x: 0, y: 0, w: 6, h: 4 },
  content: { type: "bar", data: [], x: "x", series: ["y"] },
};

function mockClipboard(impl: Partial<Clipboard>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: impl,
  });
}

describe("clipboard.ts (RM-081)", () => {
  const original = navigator.clipboard;

  beforeEach(() => {
    resetDashboardClipboardForTests();
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: original });
    vi.restoreAllMocks();
  });

  it("tilesToClipboardPayload marks the payload and drops id/container", () => {
    const payload = tilesToClipboardPayload([TILE]);
    expect(payload.marker).toBe(DASHBOARD_CLIPBOARD_MARKER);
    expect(payload.tiles).toEqual([
      {
        kind: "chart",
        content: TILE.content,
        layout: { w: 6, h: 4 },
        title: "Revenue",
        subtitle: undefined,
        footnote: undefined,
        source: undefined,
        ref: undefined,
      },
    ]);
  });

  it("parseDashboardClipboardText rejects non-marker text (garbage, JSON without the marker)", () => {
    expect(parseDashboardClipboardText("not json")).toBeNull();
    expect(parseDashboardClipboardText("{}")).toBeNull();
    expect(
      parseDashboardClipboardText(JSON.stringify({ marker: "something-else", tiles: [] })),
    ).toBeNull();
    expect(
      parseDashboardClipboardText(JSON.stringify({ marker: DASHBOARD_CLIPBOARD_MARKER })),
    ).toBeNull();
  });

  it("round-trips through a real navigator.clipboard", async () => {
    let written = "";
    mockClipboard({
      writeText: vi.fn(async (text: string) => {
        written = text;
      }),
      readText: vi.fn(async () => written),
    });
    await writeDashboardClipboard([TILE]);
    const tiles = await readDashboardClipboard();
    expect(tiles).toEqual(tilesToClipboardPayload([TILE]).tiles);
  });

  it("falls back to the in-memory copy when the real clipboard write/read is permission-gated", async () => {
    mockClipboard({
      writeText: vi.fn(async () => {
        throw new DOMException("denied", "NotAllowedError");
      }),
      readText: vi.fn(async () => {
        throw new DOMException("denied", "NotAllowedError");
      }),
    });
    await writeDashboardClipboard([TILE]);
    const tiles = await readDashboardClipboard();
    expect(tiles).toEqual(tilesToClipboardPayload([TILE]).tiles);
  });

  it("does not fall back to the in-memory copy when a real read succeeds with non-marker text", async () => {
    mockClipboard({
      writeText: vi.fn(async () => {
        throw new DOMException("denied", "NotAllowedError");
      }),
      readText: vi.fn(async () => "some other app's clipboard text"),
    });
    // Prime the in-memory fallback with something real...
    await writeDashboardClipboard([TILE]);
    // ...but a real (successful) read of stray OS text must never paste it as tiles.
    const tiles = await readDashboardClipboard();
    expect(tiles).toEqual([]);
  });

  it("readDashboardClipboard is empty with nothing ever copied and no real clipboard", async () => {
    mockClipboard({
      writeText: vi.fn(async () => {
        throw new Error("unavailable");
      }),
      readText: vi.fn(async () => {
        throw new Error("unavailable");
      }),
    });
    expect(await readDashboardClipboard()).toEqual([]);
  });
});
