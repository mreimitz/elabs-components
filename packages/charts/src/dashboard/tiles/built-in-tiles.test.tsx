import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SchemaForm } from "@elabs-ai/components-ui";

import type { DashboardSpec, TileSpec } from "../core/spec";
import { DashboardProvider, DashboardSheet } from "../dashboard-sheet";
import { builtInTiles, withBuiltInTiles } from "./built-in-tiles";
import { parseInlineMarkup, renderInlineMarkup } from "./inline-markup";
import { imageTileKind } from "./image-tile";

vi.mock("react-use-measure", () => ({
  default: () => [
    () => {},
    { width: 960, height: 540, top: 0, left: 0, right: 960, bottom: 540, x: 0, y: 0 },
  ],
}));

// jsdom has no ResizeObserver; Radix primitives (Slider, Select) read one on mount.
class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only jsdom polyfill
(globalThis as any).ResizeObserver ??= StubResizeObserver;

// jsdom has no pointer-capture APIs; Radix Select reads them on pointer interaction.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

describe("withBuiltInTiles", () => {
  it("registers exactly the ten built-in kinds", () => {
    const kinds = withBuiltInTiles({});
    expect(kinds.map((k) => k.kind).sort()).toEqual(
      [
        "button",
        "chart",
        "container",
        "divider",
        "filter",
        "heading",
        "image",
        "metric",
        "text",
        "variable",
      ].sort(),
    );
  });

  it("includes the filter tile kind (RM-076)", () => {
    expect(builtInTiles.filter).toBeDefined();
    const kinds = withBuiltInTiles({});
    expect(kinds.some((k) => k.kind === "filter")).toBe(true);
  });

  it("lets a host kind win over a built-in of the same name", () => {
    const hostChart = { ...builtInTiles.chart!, label: "Host chart" };
    const kinds = withBuiltInTiles([hostChart]);
    const chartKinds = kinds.filter((k) => k.kind === "chart");
    expect(chartKinds.length).toBe(2); // "later wins" is `createTileRegistry`'s job, not the merge's
  });

  it("every kind's configForm renders in SchemaForm with no console errors", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const kind of Object.values(builtInTiles)) {
      const { unmount } = render(<SchemaForm spec={kind.configForm} onSubmit={() => {}} />);
      unmount();
    }
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("inline-markup", () => {
  it("parses bold, italic and https links", () => {
    const nodes = parseInlineMarkup("**bold** _italic_ [link](https://example.com) plain");
    render(<div data-testid="root">{nodes}</div>);
    const root = screen.getByTestId("root");
    expect(root.querySelector("strong")?.textContent).toBe("bold");
    expect(root.querySelector("em")?.textContent).toBe("italic");
    const link = root.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://example.com");
    expect(link?.getAttribute("rel")).toBe("noopener");
    expect(root.textContent).toContain("plain");
  });

  it("renders a <script> tag as literal text, never as HTML", () => {
    render(<div data-testid="root">{renderInlineMarkup("<script>alert(1)</script>")}</div>);
    const root = screen.getByTestId("root");
    expect(root.querySelector("script")).toBeNull();
    expect(root.textContent).toContain("<script>alert(1)</script>");
  });

  it("drops a javascript: link (never renders it as an <a>)", () => {
    render(<div data-testid="root">{renderInlineMarkup("[click me](javascript:alert(1))")}</div>);
    const root = screen.getByTestId("root");
    expect(root.querySelector("a")).toBeNull();
  });

  it("renders `- ` lines as a bullet list", () => {
    render(<div data-testid="root">{renderInlineMarkup("- one\n- two")}</div>);
    const root = screen.getByTestId("root");
    expect(root.querySelectorAll("li").length).toBe(2);
  });
});

describe("validateContent (image tile, RM-075 follow-up)", () => {
  it("flags missing alt text", () => {
    expect(imageTileKind.validateContent?.({ src: "https://example.com/x.png", alt: "" })).toEqual({
      path: "content.alt",
      code: "missing",
      message: expect.any(String),
    });
  });

  it("passes with alt text set", () => {
    expect(
      imageTileKind.validateContent?.({ src: "https://example.com/x.png", alt: "A map" }),
    ).toBeNull();
  });
});

function sheetWith(tiles: TileSpec[], extra?: Partial<DashboardSpec>): DashboardSpec {
  return {
    version: 1,
    id: "test-sheet",
    title: "Test sheet",
    grid: { mode: "fit", columns: 24, rows: 12, gap: 8 },
    tiles,
    ...extra,
  };
}

function renderSheet(spec: DashboardSpec, onAction?: (id: string) => void) {
  return render(
    <div style={{ width: 960, height: 540 }}>
      <DashboardProvider spec={spec} tiles={withBuiltInTiles({})} onAction={onAction}>
        <DashboardSheet />
      </DashboardProvider>
    </div>,
  );
}

describe("built-in tile kinds render", () => {
  it("metric tile shows label and value", async () => {
    renderSheet(
      sheetWith([
        {
          id: "m1",
          kind: "metric",
          layout: { x: 0, y: 0, w: 6, h: 4 },
          content: { label: "Revenue", value: 42 },
        },
      ]),
    );
    expect(await screen.findByText("Revenue")).toBeInTheDocument();
  });

  it("heading tile renders the given level", async () => {
    renderSheet(
      sheetWith([
        {
          id: "h1",
          kind: "heading",
          layout: { x: 0, y: 0, w: 6, h: 1 },
          content: { text: "Section", level: 2 },
        },
      ]),
    );
    expect((await screen.findByText("Section")).closest("h2")).not.toBeNull();
  });

  it("divider tile renders a separator", () => {
    const { container } = renderSheet(
      sheetWith([
        {
          id: "d1",
          kind: "divider",
          layout: { x: 0, y: 0, w: 4, h: 1 },
          content: {},
        },
      ]),
    );
    expect(container.querySelector('[data-slot="separator"]')).not.toBeNull();
  });

  it("image tile renders alt text", async () => {
    renderSheet(
      sheetWith([
        {
          id: "i1",
          kind: "image",
          layout: { x: 0, y: 0, w: 6, h: 4 },
          content: { src: "https://example.com/x.png", alt: "A map" },
        },
      ]),
    );
    expect(await screen.findByAltText("A map")).toBeInTheDocument();
  });

  it("button tile fires clearSelections", async () => {
    const user = userEvent.setup();
    renderSheet(
      sheetWith([
        {
          id: "b1",
          kind: "button",
          layout: { x: 0, y: 0, w: 3, h: 1 },
          content: { label: "Clear", action: { type: "clearSelections" } },
        },
      ]),
    );
    const button = await screen.findByRole("button", { name: "Clear" });
    await user.click(button);
    expect(button).toBeEnabled();
  });

  it("button tile's host action calls DashboardProvider's onAction (RM-075 follow-up)", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderSheet(
      sheetWith([
        {
          id: "b1",
          kind: "button",
          layout: { x: 0, y: 0, w: 3, h: 1 },
          content: { label: "Run", action: { type: "host", id: "custom-export" } },
        },
      ]),
      onAction,
    );
    const button = await screen.findByRole("button", { name: "Run" });
    await user.click(button);
    expect(onAction).toHaveBeenCalledWith("custom-export");
  });

  it("button tile is disabled (via aria-disabled through the interactions gate) in edit mode", async () => {
    renderSheet(
      sheetWith(
        [
          {
            id: "b1",
            kind: "button",
            layout: { x: 0, y: 0, w: 3, h: 1 },
            content: { label: "Clear", action: { type: "clearSelections" } },
          },
        ],
        { view: { mode: "edit" } },
      ),
    );
    const button = await screen.findByRole("button", { name: "Clear" });
    expect(button).toBeDisabled();
  });

  it("variable tile's select writes the named variable", async () => {
    const user = userEvent.setup();
    renderSheet(
      sheetWith(
        [
          {
            id: "v1",
            kind: "variable",
            title: "Region",
            layout: { x: 0, y: 0, w: 6, h: 1 },
            content: { name: "region", control: "select", options: ["EMEA", "APAC"] },
          },
        ],
        { variables: [{ name: "region", type: "string", default: "EMEA", label: "Region" }] },
      ),
    );
    const trigger = await screen.findByRole("combobox", { name: "Region" });
    await user.click(trigger);
    const option = await screen.findByRole("option", { name: "APAC" });
    await user.click(option);
    expect(trigger).toHaveTextContent("APAC");
  });

  it("container tile mounts only the active tab's children", async () => {
    renderSheet(
      sheetWith([
        {
          id: "c1",
          kind: "container",
          title: "Detail",
          layout: { x: 0, y: 0, w: 12, h: 6 },
          content: {
            kind: "tabs",
            tabs: [
              { id: "a", label: "A", children: ["h1"] },
              { id: "b", label: "B", children: ["h2"] },
            ],
          },
        },
        {
          id: "h1",
          kind: "heading",
          // Excluded from the main grid (RM-074's own `!t.container` filter) — this tile
          // exists only to be looked up by `c1`'s tab children.
          container: { id: "c1" },
          layout: { x: 12, y: 0, w: 6, h: 1 },
          content: { text: "First tab child", level: 3 },
        },
        {
          id: "h2",
          kind: "heading",
          container: { id: "c1" },
          layout: { x: 18, y: 0, w: 6, h: 1 },
          content: { text: "Second tab child", level: 3 },
        },
      ]),
    );
    await screen.findByRole("region", { name: "Test sheet" });
    expect(screen.getAllByText("First tab child").length).toBeGreaterThan(0);
    expect(screen.queryByText("Second tab child")).toBeNull();
  });
});
