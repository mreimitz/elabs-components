import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { scaleBand, scaleLinear, scaleTime } from "d3-scale";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseBubbleValue, RangeBubble, toDateInputValue } from "./range-bubble";
import { buildRangeAxisModel } from "./range-select";

afterEach(cleanup);

const linear = buildRangeAxisModel(
  { kind: "linear", scale: scaleLinear().domain([0, 200]).range([200, 0]) },
  "y",
  200,
  { label: "revenue", locale: "en-US" },
);
const time = buildRangeAxisModel(
  {
    kind: "time",
    scale: scaleTime()
      .domain([new Date(2024, 0, 1), new Date(2024, 11, 31)])
      .range([0, 365]),
  },
  "x",
  365,
  { label: "month", locale: "en-US" },
);
const band = buildRangeAxisModel(
  { kind: "band", scale: scaleBand<string>().domain(["A", "B", "C"]).range([0, 90]) },
  "x",
  90,
  { label: "letter" },
);

describe("parseBubbleValue", () => {
  it("numbers on a measure axis, local dates on a time axis, nothing on a band axis", () => {
    expect(parseBubbleValue(linear, " 150 ")).toBe(150);
    expect(parseBubbleValue(linear, "abc")).toBeNull();
    expect(parseBubbleValue(linear, "")).toBeNull();
    expect(parseBubbleValue(time, "2024-03-05")).toBe(new Date(2024, 2, 5).getTime());
    expect(parseBubbleValue(time, "03/05/2024")).toBeNull();
    expect(parseBubbleValue(band, "B")).toBeNull();
  });
  it("toDateInputValue round-trips a local day", () => {
    expect(toDateInputValue(new Date(2024, 2, 5, 13).getTime())).toBe("2024-03-05");
  });
});

describe("RangeBubble", () => {
  const position = { left: 10, top: 20 };

  it("a measure bubble is a button; click → numeric Input; Enter applies", () => {
    const onCommit = vi.fn();
    render(
      <RangeBubble
        before
        editable
        edge="hi"
        model={linear}
        onCommit={onCommit}
        position={position}
        value={120}
      />,
    );
    const button = screen.getByRole("button", { name: "Edit Range end, revenue: 120" });
    expect(button).toHaveTextContent("120");
    fireEvent.click(button);
    const input = screen.getByRole("spinbutton", { name: "Range end, revenue" });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "150" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith(150);
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("Esc reverts without applying; an unparsable value applies nothing", () => {
    const onCommit = vi.fn();
    render(
      <RangeBubble
        before={false}
        editable
        edge="lo"
        model={linear}
        onCommit={onCommit}
        position={position}
        value={40}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "90" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "" } });
    fireEvent.keyDown(screen.getByRole("spinbutton"), { key: "Enter" });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("a time bubble edits a date", () => {
    const onCommit = vi.fn();
    const { container } = render(
      <RangeBubble
        before
        editable
        edge="lo"
        model={time}
        onCommit={onCommit}
        position={position}
        value={new Date(2024, 2, 1).getTime()}
      />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Mar 1, 2024");
    fireEvent.click(screen.getByRole("button"));
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("date");
    expect(input.value).toBe("2024-03-01");
    fireEvent.change(input, { target: { value: "2024-04-15" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith(new Date(2024, 3, 15).getTime());
  });

  it("a category bubble is plain text, hidden from AT (the thumbs speak it)", () => {
    const { container } = render(
      <RangeBubble
        before
        editable={false}
        edge="lo"
        model={band}
        onCommit={vi.fn()}
        position={position}
        value={1}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    const bubble = container.querySelector('[data-slot="chart-selection-range-bubble"]');
    expect(bubble).toHaveTextContent("B");
    expect(bubble).toHaveAttribute("aria-hidden", "true");
  });
});
