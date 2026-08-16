/**
 * column-picker.test.tsx — smoke + table-integration lock for the column toggle (#59).
 *
 * ColumnPicker is the one filter primitive that does NOT take its own state: it
 * drives a live TanStack `Table` instance. So the test drives a REAL table (the
 * same `useReactTable` the DataTable toolbar render-prop hands over) instead of
 * a stub — a hand-rolled fake `Table` would prove nothing about the integration
 * that actually breaks (`getCanHide` filtering, `toggleVisibility`).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import { ColumnPicker } from "./column-picker";

interface Row {
  service: string;
  env: string;
  latencyMs: number;
}

const data: Row[] = [{ service: "billing", env: "prod", latencyMs: 240 }];

/** Renders a real table instance and exposes the picker over it. */
function Harness({
  columns,
  visibility = {},
  onVisibilityChange,
  label,
}: {
  columns: ColumnDef<Row>[];
  visibility?: VisibilityState;
  onVisibilityChange?: (next: VisibilityState) => void;
  label?: string;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility: visibility },
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === "function" ? updater(visibility) : updater;
      onVisibilityChange?.(next);
    },
  });
  return <ColumnPicker table={table} label={label} />;
}

const columns: ColumnDef<Row>[] = [
  { accessorKey: "service", header: "Service" },
  { accessorKey: "env", header: "Environment" },
  { accessorKey: "latencyMs", header: "Latency (ms)" },
];

/** Open the dropdown from the keyboard (the real keyboard path, WCAG 2.1.1). */
function open(name: string | RegExp = "Columns") {
  fireEvent.keyDown(screen.getByRole("button", { name }), { key: "Enter" });
}

describe("ColumnPicker — trigger", () => {
  it('defaults the trigger label to "Columns"', () => {
    render(<Harness columns={columns} />);
    expect(screen.getByRole("button", { name: "Columns" })).toBeInTheDocument();
  });

  it("uses a custom label when supplied", () => {
    render(<Harness columns={columns} label="Fields" />);
    expect(screen.getByRole("button", { name: "Fields" })).toBeInTheDocument();
  });
});

describe("ColumnPicker — menu contents", () => {
  it("lists every hideable column", () => {
    render(<Harness columns={columns} />);
    open();
    expect(screen.getByRole("menuitem", { name: "service" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "env" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "latencyMs" })).toBeInTheDocument();
  });

  it("omits a column that opts out of hiding (enableHiding: false)", () => {
    const pinned: ColumnDef<Row>[] = [
      { accessorKey: "service", header: "Service", enableHiding: false },
      { accessorKey: "env", header: "Environment" },
    ];
    render(<Harness columns={pinned} />);
    open();
    expect(screen.queryByRole("menuitem", { name: "service" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "env" })).toBeInTheDocument();
  });
});

describe("ColumnPicker — visibility toggling", () => {
  it("hides a visible column through the table's visibility channel", () => {
    const onVisibilityChange = vi.fn<(next: VisibilityState) => void>();
    render(<Harness columns={columns} onVisibilityChange={onVisibilityChange} />);
    open();
    fireEvent.click(screen.getByRole("menuitem", { name: "env" }));
    expect(onVisibilityChange).toHaveBeenCalledWith(expect.objectContaining({ env: false }));
  });

  it("re-shows a hidden column", () => {
    const onVisibilityChange = vi.fn<(next: VisibilityState) => void>();
    render(
      <Harness
        columns={columns}
        visibility={{ env: false }}
        onVisibilityChange={onVisibilityChange}
      />,
    );
    open();
    fireEvent.click(screen.getByRole("menuitem", { name: "env" }));
    expect(onVisibilityChange).toHaveBeenCalledWith(expect.objectContaining({ env: true }));
  });

  it("stays open after a toggle so several columns can be changed in one pass", () => {
    render(<Harness columns={columns} onVisibilityChange={vi.fn()} />);
    open();
    fireEvent.click(screen.getByRole("menuitem", { name: "env" }));
    expect(screen.getByRole("menuitem", { name: "service" })).toBeInTheDocument();
  });

  it("hides the decorative check swatch from assistive tech", () => {
    render(<Harness columns={columns} />);
    open();
    expect(
      screen.getByRole("menuitem", { name: "service" }).querySelector("[aria-hidden='true']"),
    ).not.toBeNull();
  });
});
