import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChartTooltipTable } from "./tooltip-table";

describe("ChartTooltipTable", () => {
  const rows = [
    { color: "#4f81c4", label: "users", value: 1200 },
    { color: "#e37c2f", label: "sessions", value: 3400 },
    { color: "#4caf50", label: "revenue", value: 8200 },
  ];

  it("renders a <table> with one value cell per series", () => {
    render(<ChartTooltipTable rows={rows} title="Jan 2024" />);
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();
    const cells = screen.getAllByRole("cell");
    expect(cells).toHaveLength(3);
  });

  it("renders the hovered date/category as the table's caption", () => {
    render(<ChartTooltipTable rows={rows} title="Jan 2024" />);
    expect(screen.getByText("Jan 2024").closest("caption")).toBeInTheDocument();
  });

  it("renders one header cell per series, labelled with the series key", () => {
    render(<ChartTooltipTable rows={rows} title="Jan 2024" />);
    expect(screen.getByRole("columnheader", { name: "users" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "sessions" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "revenue" })).toBeInTheDocument();
  });

  it("formats numeric values through the shared tooltip formatter", () => {
    render(<ChartTooltipTable rows={rows} />);
    expect(screen.getByText(/1[,.]?200/)).toBeInTheDocument();
  });
});
