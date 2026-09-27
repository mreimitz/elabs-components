import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { A2uiSurface } from "./a2ui-surface";
import { A2UI_CATALOG_SCHEMA } from "./core/catalog.generated";
import type { A2uiSurfaceSpec } from "./core/spec";
import { UI_CATALOG_BINDINGS, createA2uiCatalog, defineA2uiType, uiCatalog } from "./ui-catalog";

const ORDER: A2uiSurfaceSpec = {
  a2ui: "1",
  title: "Order 4711",
  root: {
    type: "Card",
    id: "order",
    children: [
      {
        type: "CardHeader",
        children: [
          { type: "CardTitle", children: ["Order 4711"] },
          { type: "CardDescription", children: ["Placed today"] },
        ],
      },
      {
        type: "CardContent",
        children: [
          {
            type: "Grid",
            props: { columns: 2 },
            children: [
              { type: "MetricCard", props: { label: "Total", value: "€ 1,240" } },
              { type: "StatusBadge", props: { status: "running" } },
            ],
          },
          {
            type: "SectionHeader",
            props: { title: "Lines", actions: { type: "Badge", children: ["3 items"] } },
          },
        ],
      },
      {
        type: "CardFooter",
        children: [
          {
            type: "Button",
            props: { variant: "default" },
            on: { click: { name: "approve", payload: { id: 4711 } } },
            children: ["Approve"],
          },
          {
            type: "Input",
            props: { "aria-label": "Note", defaultValue: "" },
            on: { change: { name: "note" } },
          },
        ],
      },
    ],
  },
};

describe("A2uiSurface", () => {
  it("renders a valid surface with the real components and forwards actions", () => {
    const onAction = vi.fn();
    render(<A2uiSurface surface={ORDER} onAction={onAction} />);
    const region = screen.getByRole("group", { name: "Order 4711" });
    expect(region).toHaveAttribute("data-status", "ready");
    expect(
      screen.getByText("Order 4711", { selector: "[data-slot='card-title']" }),
    ).toBeInTheDocument();
    expect(screen.getByText("€ 1,240")).toBeInTheDocument();
    expect(screen.getByText("3 items")).toBeInTheDocument(); // a node inside a `node` prop
    expect(region.querySelector("[data-a2ui-id='order']")).toHaveAttribute(
      "data-a2ui-type",
      "Card",
    );

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(onAction).toHaveBeenCalledWith(
      { name: "approve", payload: { id: 4711 } },
      expect.objectContaining({ event: "click", path: "root.children[2].children[0]" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Note" }), { target: { value: "ok" } });
    expect(onAction).toHaveBeenLastCalledWith(
      { name: "note" },
      expect.objectContaining({ event: "change", value: "ok" }),
    );
  });

  it("settled + invalid → role=alert with every problem, onError once; nothing drawn", () => {
    const onError = vi.fn();
    const { rerender } = render(
      <A2uiSurface
        surface={{
          a2ui: "1",
          root: {
            type: "Stack",
            children: [{ type: "Sparkle" }, { type: "Button", props: { variant: "loud" } }],
          },
        }}
        onError={onError}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("root.children[0].type");
    expect(alert).toHaveTextContent("root.children[1].props.variant");
    expect(screen.queryByRole("button")).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![0]).toHaveLength(2);
    rerender(
      <A2uiSurface
        surface={{
          a2ui: "1",
          root: {
            type: "Stack",
            children: [{ type: "Sparkle" }, { type: "Button", props: { variant: "loud" } }],
          },
        }}
        onError={onError}
      />,
    );
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("streams: a JSON prefix builds up, invalid-yet nodes are pruned, no alert", () => {
    const full = JSON.stringify({
      a2ui: "1",
      root: {
        type: "Stack",
        children: [
          { type: "Heading", props: { level: 2 }, children: ["Revenue"] },
          { type: "Text", children: ["Up 12% quarter over quarter."] },
          { type: "Button", props: { variant: "outline" }, children: ["Details"] },
        ],
      },
    });
    const cut = full.indexOf('"Up 12%') + 6;
    const { rerender, container } = render(
      <A2uiSurface surface={full.slice(0, cut)} isStreaming />,
    );
    expect(screen.getByRole("heading", { name: "Revenue" })).toBeInTheDocument();
    expect(screen.getByText("Up 12")).toBeInTheDocument(); // the half-arrived text node
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(container.querySelector("[data-slot='a2ui-surface']")).toHaveAttribute(
      "data-status",
      "pending",
    );

    // A prefix that ends inside the Button's props — the Button is pruned, siblings stay.
    const cut2 = full.indexOf('"variant":"out') + 12;
    rerender(<A2uiSurface surface={full.slice(0, cut2)} isStreaming />);
    expect(screen.getByRole("heading", { name: "Revenue" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();

    rerender(<A2uiSurface surface={full} isStreaming={false} />);
    expect(screen.getByRole("button", { name: "Details" })).toBeInTheDocument();
    expect(container.querySelector("[data-slot='a2ui-surface']")).toHaveAttribute(
      "data-status",
      "ready",
    );
  });

  it("loading → skeleton with a polite live region; empty → idle, nothing", () => {
    const { container, rerender } = render(<A2uiSurface surface={null} loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading surface…");
    rerender(<A2uiSurface surface={null} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.querySelector("[data-slot='a2ui-surface']")).toHaveAttribute(
      "data-status",
      "idle",
    );
  });

  // RM-197 fix round 1: a synthetic type here, never a real `AutoChart` — `packages/ai` may
  // not import `@elabs-ai/components-charts` (one-way dep graph); the shape (a `height` alias
  // deprecated in favour of `plotHeight`, alongside a required prop) mirrors AutoChart's real
  // one, already covered end to end in charts' own `charts-catalog.test.ts`.
  const chartCatalog = () =>
    createA2uiCatalog(
      { ...UI_CATALOG_BINDINGS, Chart: () => <output>chart</output> },
      {
        ...A2UI_CATALOG_SCHEMA,
        Chart: defineA2uiType({
          props: {
            value: { type: "number", required: true },
            height: {
              type: "number",
              deprecated: true,
              description: "Deprecated — use `plotHeight`.",
            },
          },
        }),
      },
    );

  it("streaming: a warning never prunes its node — only a genuinely incomplete sibling is", () => {
    const catalog = chartCatalog();
    const full = JSON.stringify({
      a2ui: "1",
      root: {
        type: "Stack",
        children: [
          { type: "Chart", props: { value: 1, height: 260 } }, // complete, but `height` warns
          { type: "Chart", props: {} }, // still missing the required `value` — an error
        ],
      },
    });
    const { container } = render(<A2uiSurface catalog={catalog} surface={full} isStreaming />);
    const roots = container.querySelectorAll("output");
    expect(roots).toHaveLength(1); // only the complete (warning-carrying) Chart painted
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("settled + valid-with-a-warning: no alert, no `onError` — a warning never reaches either", () => {
    const catalog = chartCatalog();
    const onError = vi.fn();
    render(
      <A2uiSurface
        catalog={catalog}
        surface={{ a2ui: "1", root: { type: "Chart", props: { value: 1, height: 260 } } }}
        onError={onError}
      />,
    );
    expect(screen.getByText("chart")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("an app extends the catalog with its own type", () => {
    const Sparkle = ({ level }: { level: string }) => <output>sparkle:{level}</output>;
    const catalog = createA2uiCatalog(
      { ...UI_CATALOG_BINDINGS, Sparkle },
      {
        ...A2UI_CATALOG_SCHEMA,
        Sparkle: defineA2uiType({
          props: { level: { type: "string", enum: ["lo", "hi"], required: true } },
        }),
      },
    );
    render(
      <A2uiSurface
        catalog={catalog}
        surface={{ a2ui: "1", root: { type: "Sparkle", props: { level: "hi" } } }}
      />,
    );
    expect(screen.getByText("sparkle:hi")).toBeInTheDocument();
  });

  it("the shipped catalog binds exactly the generated schema's non-builtin types", () => {
    const schemaTypes = Object.entries(A2UI_CATALOG_SCHEMA)
      .filter(([, s]) => !s.builtin)
      .map(([t]) => t)
      .sort();
    expect(Object.keys(UI_CATALOG_BINDINGS).sort()).toEqual(schemaTypes);
    expect(Object.keys(uiCatalog).sort()).toEqual(Object.keys(A2UI_CATALOG_SCHEMA).sort());
  });
});
