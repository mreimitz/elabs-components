import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Transfer } from "./transfer";
import type { TransferItem } from "./transfer";

// jsdom does not provide ResizeObserver, which Radix ScrollArea requires.
// Stub it so the component mounts cleanly in the test environment.
beforeAll(() => {
  if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
    // @ts-expect-error jsdom stub
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

const ITEMS: TransferItem[] = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
  { value: "c", label: "Gamma" },
  { value: "d", label: "Delta", disabled: true },
];

/** Each panel is a labelled region (aria-labelledby its CardTitle). */
function getPanel(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

/**
 * A row's checkbox is named via aria-labelledby → its row label text, so it is
 * directly addressable by accessible name (this also verifies the a11y wiring).
 */
function rowCheckbox(panel: HTMLElement, name: string): HTMLElement {
  return within(panel).getByRole("checkbox", { name });
}

describe("Transfer", () => {
  it("renders both panels with the correct initial split given defaultTargetKeys", () => {
    render(
      <Transfer dataSource={ITEMS} defaultTargetKeys={["b", "c"]} titles={["Source", "Target"]} />,
    );

    const source = getPanel("Source");
    const target = getPanel("Target");

    // Source: Alpha + Delta
    expect(rowCheckbox(source, "Alpha")).toBeInTheDocument();
    expect(rowCheckbox(source, "Delta")).toBeInTheDocument();
    expect(within(source).queryByRole("checkbox", { name: "Beta" })).not.toBeInTheDocument();

    // Target: Beta + Gamma
    expect(rowCheckbox(target, "Beta")).toBeInTheDocument();
    expect(rowCheckbox(target, "Gamma")).toBeInTheDocument();
  });

  it("checking a source row + clicking move-right moves it to target and calls onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Transfer
        dataSource={ITEMS}
        defaultTargetKeys={["c"]}
        onChange={onChange}
        titles={["Source", "Target"]}
      />,
    );

    const alpha = rowCheckbox(getPanel("Source"), "Alpha");
    await user.click(alpha);
    expect(alpha).toHaveAttribute("data-state", "checked");

    await user.click(screen.getByRole("button", { name: "Move selected right" }));

    expect(onChange).toHaveBeenCalledOnce();
    const nextKeys: string[] = onChange.mock.calls[0]![0];
    expect(nextKeys).toContain("a");
    expect(nextKeys).toContain("c");
  });

  it("move-all-right moves all enabled items; disabled items stay in source", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Transfer
        dataSource={ITEMS}
        defaultTargetKeys={[]}
        onChange={onChange}
        titles={["Source", "Target"]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Move all right" }));

    expect(onChange).toHaveBeenCalledOnce();
    const nextKeys: string[] = onChange.mock.calls[0]![0];
    expect(nextKeys).toContain("a");
    expect(nextKeys).toContain("b");
    expect(nextKeys).toContain("c");
    expect(nextKeys).not.toContain("d");
  });

  it("move-left returns items from target back to source", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <Transfer
        dataSource={ITEMS}
        defaultTargetKeys={["a", "b"]}
        onChange={onChange}
        titles={["Source", "Target"]}
      />,
    );

    const alpha = rowCheckbox(getPanel("Target"), "Alpha");
    await user.click(alpha);
    expect(alpha).toHaveAttribute("data-state", "checked");

    await user.click(screen.getByRole("button", { name: "Move selected left" }));

    expect(onChange).toHaveBeenCalledOnce();
    const nextKeys: string[] = onChange.mock.calls[0]![0];
    expect(nextKeys).not.toContain("a");
    expect(nextKeys).toContain("b");
  });

  it("controlled mode: renders the given targetKeys split and onChange fires on move", async () => {
    const user = userEvent.setup();

    function ControlledWrapper() {
      const [keys, setKeys] = useState(["b"]);
      return (
        <div>
          <Transfer
            dataSource={ITEMS}
            targetKeys={keys}
            onChange={setKeys}
            titles={["Source", "Target"]}
          />
          <span data-testid="keys">{keys.join(",")}</span>
        </div>
      );
    }

    render(<ControlledWrapper />);

    expect(screen.getByTestId("keys").textContent).toBe("b");

    const alpha = rowCheckbox(getPanel("Source"), "Alpha");
    await user.click(alpha);
    expect(alpha).toHaveAttribute("data-state", "checked");

    await user.click(screen.getByRole("button", { name: "Move selected right" }));

    expect(screen.getByTestId("keys").textContent).toBe("b,a");
  });

  it("select-all checkbox checks all enabled rows in the source panel", async () => {
    const user = userEvent.setup();

    render(<Transfer dataSource={ITEMS} defaultTargetKeys={[]} titles={["Source", "Target"]} />);

    const selectAll = screen.getByRole("checkbox", { name: /Select all in Source/i });
    await user.click(selectAll);

    // Enabling all source rows enables the "Move selected right" control.
    expect(screen.getByRole("button", { name: "Move selected right" })).not.toBeDisabled();
    // The enabled row checkbox reflects the checked state.
    expect(rowCheckbox(getPanel("Source"), "Alpha")).toHaveAttribute("data-state", "checked");
  });
});
