import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartSelectionToolbar } from "./chart-selection-toolbar";
import type { ChartSelectionIntent, ChartSelectionIntentHandler } from "./types";
import {
  type SelectionSession,
  useSelectionSession,
  type UseSelectionSessionOptions,
} from "./use-selection-session";

afterEach(cleanup);

let session: SelectionSession | null = null;

function Harness(props: Partial<UseSelectionSessionOptions>) {
  const s = useSelectionSession({
    gestures: ["range", "rect", "lasso"],
    field: "region",
    ...props,
  });
  session = s as SelectionSession;
  return (
    <div ref={s.rootRef}>
      <ChartSelectionToolbar session={s as SelectionSession} />
    </div>
  );
}

const range = (values: string[]): ChartSelectionIntent => ({
  field: "region",
  values,
  mode: "replace",
  gesture: { kind: "range", axis: "x", from: values[0]!, to: values.at(-1)! },
  datapoints: [],
  source: "pointer",
});

describe("ChartSelectionToolbar", () => {
  it("offers pointer + the listed tools as named toggle buttons", () => {
    render(<Harness />);
    const group = screen.getByRole("group", { name: "Selection tools" });
    expect(group).toHaveAttribute("data-slot", "chart-selection-toolbar");
    for (const name of ["Pointer", "Range", "Rectangle", "Lasso"]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("radio", { name: "Circle" })).toBeNull();
    expect(document.querySelector('[data-slot="chart-selection-toolbar-mode"]')).not.toBeNull();
  });

  it("switches the session's mode", async () => {
    const onModeChange = vi.fn();
    render(<Harness onModeChange={onModeChange} />);
    await userEvent.click(screen.getByRole("radio", { name: "Lasso" }));
    expect(onModeChange).toHaveBeenCalledWith("lasso");
    expect(session!.mode).toBe("lasso");
    expect(screen.getByRole("radio", { name: "Lasso" })).toHaveAttribute("aria-checked", "true");
  });

  it("is keyboard-operable: arrows move between tools, Space picks one", async () => {
    render(<Harness />);
    const pointer = screen.getByRole("radio", { name: "Pointer" });
    act(() => pointer.focus());
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Range" })).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(session!.mode).toBe("range");
  });

  it("immediate: no ✓ / ✕; the count reads the last intent", () => {
    render(<Harness onSelectionIntent={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Confirm selection" })).toBeNull();
    act(() => session!.receive(range(["a", "b", "c"])));
    expect(document.querySelector('[data-slot="chart-selection-toolbar-count"]')?.textContent).toBe(
      "3 selected",
    );
  });

  it("explicit: ✓ commits one replace intent, ✕ cancels; both disabled while closed", async () => {
    const onSelectionIntent = vi.fn<ChartSelectionIntentHandler>();
    render(<Harness confirm="explicit" onSelectionIntent={onSelectionIntent} />);
    const confirm = screen.getByRole("button", { name: "Confirm selection" });
    const cancel = screen.getByRole("button", { name: "Cancel selection" });
    expect(confirm).toHaveAttribute("data-slot", "chart-selection-toolbar-confirm");
    expect(cancel).toHaveAttribute("data-slot", "chart-selection-toolbar-cancel");
    expect(confirm).toBeDisabled();

    act(() => session!.receive(range(["a", "b"])));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    await userEvent.click(confirm);
    expect(onSelectionIntent).toHaveBeenCalledTimes(1);
    expect(onSelectionIntent.mock.calls[0]![0].mode).toBe("replace");

    act(() => session!.receive(range(["c"])));
    fireEvent.click(screen.getByRole("button", { name: "Cancel selection" }));
    expect(onSelectionIntent).toHaveBeenCalledTimes(1);
    expect(session!.isOpen).toBe(false);
  });

  it("hides the tool group when only the pointer is available", () => {
    render(<Harness gestures={[]} />);
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("renders nothing without a session", () => {
    const { container } = render(<ChartSelectionToolbar session={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
