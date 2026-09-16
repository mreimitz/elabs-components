import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DashboardSpec } from "../../core/spec";
import { DashboardProvider, DashboardSheet } from "../../dashboard-sheet";
import { qlikObjectTileKind } from "./qlik-object-tile";

const SPEC: DashboardSpec = {
  version: 1,
  id: "qlik-object-test",
  title: "Qlik object skeleton",
  grid: { mode: "fit", columns: 12, rows: 6 },
  tiles: [
    {
      id: "obj-1",
      kind: "qlik-object",
      layout: { x: 0, y: 0, w: 6, h: 6 },
      content: { objectId: "obj-1" },
    },
  ],
};

function renderSheet(host?: { renderObject?: ReturnType<typeof vi.fn> }) {
  return render(
    <DashboardProvider spec={SPEC} tiles={[qlikObjectTileKind]} host={host}>
      <DashboardSheet />
    </DashboardProvider>,
  );
}

describe("qlikObjectTileKind", () => {
  it('renders a "host renderer missing" StatePanel when host.renderObject is absent', async () => {
    renderSheet();
    expect(await screen.findByText("Host renderer missing")).toBeInTheDocument();
  });

  it("does nothing when host is passed but renderObject is not", async () => {
    renderSheet({});
    expect(await screen.findByText("Host renderer missing")).toBeInTheDocument();
  });

  it("calls host.renderObject with the element, the tile's objectId and { interactions } matching view mode", async () => {
    const renderObject = vi.fn();
    renderSheet({ renderObject });
    await waitFor(() => expect(renderObject).toHaveBeenCalledTimes(1));
    const [element, objectId, options] = renderObject.mock.calls[0] as [
      HTMLElement,
      string,
      { interactions: Record<string, boolean> },
    ];
    expect(element).toBeInstanceOf(HTMLElement);
    expect(element).toHaveAttribute("data-tile-kind", "qlik-object");
    expect(objectId).toBe("obj-1");
    // View mode: passive/active/select mount, edit does not (`dashboard-tile.tsx`).
    expect(options.interactions).toEqual({
      passive: true,
      active: true,
      select: true,
      edit: false,
    });
  });

  it("calls the teardown function returned by renderObject on unmount", async () => {
    const teardown = vi.fn();
    const renderObject = vi.fn().mockReturnValue(teardown);
    const { unmount } = renderSheet({ renderObject });
    await waitFor(() => expect(renderObject).toHaveBeenCalledTimes(1));
    unmount();
    expect(teardown).toHaveBeenCalledTimes(1);
  });
});
