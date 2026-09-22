import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createLocalSelectionDriver } from "../core/local-selection-driver";
import type { DashboardSpec } from "../core/spec";
import { DashboardProvider } from "../dashboard-sheet";
import { DashboardSelectionBar } from "./dashboard-selection-bar";

const SPEC: DashboardSpec = {
  version: 1,
  id: "bar-test",
  grid: { mode: "fit", columns: 12, rows: 6 },
  bookmarks: [{ id: "b1", label: "EMEA saved", selection: { Region: ["EMEA"] } }],
  tiles: [],
};

function renderBar(props: Partial<React.ComponentProps<typeof DashboardSelectionBar>> = {}) {
  const driver = createLocalSelectionDriver();
  render(
    <DashboardProvider spec={SPEC} driver={driver} tiles={[]}>
      <DashboardSelectionBar driver={driver} {...props} />
    </DashboardProvider>,
  );
  return driver;
}

describe("DashboardSelectionBar", () => {
  it("Clear all is disabled with no selection and no chips render", () => {
    renderBar();
    expect(screen.getByRole("button", { name: "Clear all" })).toBeDisabled();
    expect(screen.queryByText("Region")).toBeNull();
  });

  it("shows one chip per selected field, with up to two values and a +n overflow", async () => {
    const driver = renderBar();
    act(() => driver.select("Region", ["EMEA", "APAC", "LATAM"], { replace: true }));
    await waitFor(() => expect(screen.getByText("Region")).toBeInTheDocument());
    expect(screen.getByText("EMEA, APAC, +1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear all" })).not.toBeDisabled();
  });

  it("a chip's × clears only that field", async () => {
    const user = userEvent.setup();
    const driver = renderBar();
    act(() => driver.select("Region", ["EMEA"], { replace: true }));
    act(() => driver.select("Product", ["Widget"], { replace: true }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Clear Region" })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Clear Region" }));
    await waitFor(() => expect(driver.getSnapshot().count("Region")).toBe(0));
    expect(driver.getSnapshot().count("Product")).toBe(1);
  });

  it("a locked field's × is disabled and Clear all leaves it in place", async () => {
    const user = userEvent.setup();
    const driver = renderBar();
    act(() => driver.select("Region", ["EMEA"], { replace: true }));
    act(() => driver.lock("Region", true));
    act(() => driver.select("Product", ["Widget"], { replace: true }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Clear Region" })).toBeDisabled(),
    );
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    await waitFor(() => expect(driver.getSnapshot().count("Product")).toBe(0));
    expect(driver.getSnapshot().fields.Region?.values).toEqual(["EMEA"]);
  });

  it("a locked field with nothing selected still shows a chip with the locked word", async () => {
    const driver = renderBar();
    act(() => driver.lock("Region", true));
    await waitFor(() => expect(screen.getByText("Region")).toBeInTheDocument());
    expect(screen.getByText("Locked")).toBeInTheDocument();
  });

  it("Step back/forward follow the driver's canBack/canForward when a driver is given", async () => {
    const user = userEvent.setup();
    const driver = renderBar();
    const back = screen.getByRole("button", { name: "Step back" });
    const forward = screen.getByRole("button", { name: "Step forward" });
    expect(back).toBeDisabled();
    expect(forward).toBeDisabled();
    act(() => driver.select("Region", ["EMEA"], { replace: true }));
    await waitFor(() => expect(back).not.toBeDisabled());
    await user.click(back);
    await waitFor(() => expect(forward).not.toBeDisabled());
    await waitFor(() => expect(back).toBeDisabled());
  });

  it("without a driver prop, Step back/forward stay enabled (documented gap: no canBack/canForward mirror)", () => {
    render(
      <DashboardProvider spec={SPEC} tiles={[]}>
        <DashboardSelectionBar />
      </DashboardProvider>,
    );
    expect(screen.getByRole("button", { name: "Step back" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Step forward" })).not.toBeDisabled();
  });

  it("hides the Bookmarks menu when bookmarks is false", () => {
    renderBar({ bookmarks: false });
    expect(screen.queryByRole("button", { name: "Bookmarks" })).not.toBeInTheDocument();
  });

  it("the Bookmarks menu applies a saved bookmark", async () => {
    const user = userEvent.setup();
    const driver = renderBar();
    await user.click(screen.getByRole("button", { name: "Bookmarks" }));
    await user.click(await screen.findByRole("menuitem", { name: "EMEA saved" }));
    await waitFor(() => expect(driver.getSnapshot().fields.Region?.values).toEqual(["EMEA"]));
  });

  it('omits "Save bookmark…" (but keeps existing bookmarks) with no onSaveBookmark', async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole("button", { name: "Bookmarks" }));
    expect(await screen.findByRole("menuitem", { name: "EMEA saved" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Save bookmark…" })).not.toBeInTheDocument();
  });

  it("hides the Bookmarks trigger entirely with no bookmarks and no onSaveBookmark", () => {
    const driver = createLocalSelectionDriver();
    const spec: DashboardSpec = { ...SPEC, bookmarks: [] };
    render(
      <DashboardProvider spec={spec} driver={driver} tiles={[]}>
        <DashboardSelectionBar driver={driver} />
      </DashboardProvider>,
    );
    expect(screen.queryByRole("button", { name: "Bookmarks" })).not.toBeInTheDocument();
  });

  it('"Save bookmark…" calls onSaveBookmark with the current snapshot and variables', async () => {
    const user = userEvent.setup();
    const onSaveBookmark = vi.fn();
    const driver = createLocalSelectionDriver();
    render(
      <DashboardProvider spec={SPEC} driver={driver} tiles={[]}>
        <DashboardSelectionBar driver={driver} onSaveBookmark={onSaveBookmark} />
      </DashboardProvider>,
    );
    act(() => driver.select("Region", ["EMEA"], { replace: true }));
    await user.click(screen.getByRole("button", { name: "Bookmarks" }));
    await user.click(await screen.findByRole("menuitem", { name: "Save bookmark…" }));
    expect(onSaveBookmark).toHaveBeenCalledTimes(1);
    const [snapshot, variables] = onSaveBookmark.mock.calls[0] as [unknown, unknown];
    expect((snapshot as { count: (f?: string) => number }).count("Region")).toBe(1);
    expect(variables).toEqual({});
  });

  it('announces "<field> selected: <values>" and "All selections cleared" in the live region', async () => {
    const driver = renderBar();
    const status = () => screen.getByRole("status");
    act(() => driver.select("Region", ["EMEA"], { replace: true }));
    await waitFor(() => expect(status()).toHaveTextContent("Region selected: EMEA"));
    act(() => driver.clear());
    await waitFor(() => expect(status()).toHaveTextContent("All selections cleared"));
  });

  it("Toolbar carries the accessible name and role for the whole row", () => {
    renderBar();
    expect(screen.getByRole("toolbar")).toHaveAccessibleName("Selections");
  });
});
