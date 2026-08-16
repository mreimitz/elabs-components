import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelPicker } from "./model-picker";
import { countItems, modelPickerBody, showsInlineError } from "./model-picker-state";
import type { ModelPickerGroup } from "./model-picker-state";

afterEach(cleanup);

// cmdk calls Element.scrollIntoView to keep the auto-highlighted item visible.
// jsdom doesn't implement it and this package's vitest setup deliberately ships
// no global stub (a stub there would only fix @elabs-ai/components-ui's
// own tests while every other jsdom consumer still crashed), so third-party
// libraries that don't feature-detect get a local, scoped stub — the same
// pattern as combobox.test.tsx and tree.test.tsx.
let originalScrollIntoView: typeof Element.prototype.scrollIntoView;
beforeEach(() => {
  originalScrollIntoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

const groups: ModelPickerGroup[] = [
  {
    key: "apps-northwind",
    label: "Apps · northwind",
    items: [
      {
        id: "app-1",
        label: "Sales overview",
        description: "Updated 2 days ago",
        // The visible label never says "northwind" — the keyword is what finds it.
        keywords: ["northwind", "app-1"],
        meta: ["not provisioned"],
      },
    ],
  },
  {
    key: "assistants-personal",
    label: "Assistants · personal",
    items: [{ id: "asst-1", label: "Research helper", keywords: ["personal"] }],
  },
];

const open = async () => {
  await userEvent.click(screen.getAllByRole("combobox")[0]!);
};

// The two decisions that were unreachable inline ternaries in the app this came
// from. Tested directly — that is why they are exported functions.
describe("modelPickerBody / showsInlineError", () => {
  it("lets a non-empty list win over every non-ready status", () => {
    expect(modelPickerBody("error", 3)).toBe("list");
    expect(modelPickerBody("stale", 3)).toBe("list");
    expect(modelPickerBody("loading", 3)).toBe("list");
  });

  it("shows loading only while there is nothing to show", () => {
    expect(modelPickerBody("loading", 0)).toBe("loading");
    expect(modelPickerBody("idle", 0)).toBe("loading");
  });

  it("separates a failed load from a genuinely empty list", () => {
    expect(modelPickerBody("error", 0)).toBe("error");
    expect(modelPickerBody("stale", 0)).toBe("error");
    expect(modelPickerBody("empty", 0)).toBe("empty");
    expect(modelPickerBody("ready", 0)).toBe("empty");
  });

  it("shows the inline strip only over a list that still works", () => {
    expect(showsInlineError("stale", 3)).toBe(true);
    expect(showsInlineError("error", 3)).toBe(true);
    // No list to preserve → the panel takes over instead.
    expect(showsInlineError("error", 0)).toBe(false);
    expect(showsInlineError("ready", 3)).toBe(false);
  });

  it("counts items across groups", () => {
    expect(countItems(groups)).toBe(2);
  });
});

describe("ModelPicker", () => {
  it("renders grouped rows under caller-supplied headings", async () => {
    render(<ModelPicker groups={groups} triggerLabel="Pick a target" />);
    await open();
    expect(screen.getByText("Apps · northwind")).toBeInTheDocument();
    expect(screen.getByText("Assistants · personal")).toBeInTheDocument();
    // Scoped to the list — the trigger label would otherwise match too.
    const list = document.querySelector('[data-slot="model-picker-content"]')!;
    expect(within(list as HTMLElement).getByText("Sales overview")).toBeInTheDocument();
  });

  it("matches hidden keywords, not just the visible label", async () => {
    render(<ModelPicker groups={groups} triggerLabel="Pick" />);
    await open();
    await userEvent.type(screen.getByPlaceholderText("Search…"), "northwind");

    // "Sales overview" contains no "northwind" anywhere on screen.
    expect(await screen.findByText("Sales overview")).toBeInTheDocument();
    expect(screen.queryByText("Research helper")).not.toBeInTheDocument();
  });

  it("marks the pinned row with data-picked, NOT data-selected", async () => {
    render(<ModelPicker groups={groups} value="asst-1" triggerLabel="Research helper" />);
    await open();

    const picked = document.querySelector('[data-model-id="asst-1"]')!;
    const other = document.querySelector('[data-model-id="app-1"]')!;
    expect(picked).toHaveAttribute("data-picked", "true");
    expect(other).toHaveAttribute("data-picked", "false");

    // cmdk owns data-selected as the keyboard HIGHLIGHT. Asserting on it would
    // report the highlighted row, not the pinned one — the trap this locks.
    expect(picked.getAttribute("data-picked")).not.toBe(picked.getAttribute("data-selected"));
  });

  it("selects a row and closes", async () => {
    const onSelect = vi.fn();
    render(<ModelPicker groups={groups} triggerLabel="Pick" onSelect={onSelect} />);
    await open();
    await userEvent.click(screen.getByText("Research helper"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "asst-1" }));
  });

  it("keeps a usable list and shows an inline error when a refresh fails", async () => {
    const onRetry = vi.fn();
    render(<ModelPicker groups={groups} status="stale" triggerLabel="Pick" onRetry={onRetry} />);
    await open();

    // The list is still there — the failure must not take it over.
    expect(screen.getByText("Sales overview")).toBeInTheDocument();
    const strip = document.querySelector('[data-slot="model-picker-stale"]')!;
    expect(within(strip as HTMLElement).getByText("Couldn't refresh the list")).toBeInTheDocument();

    await userEvent.click(within(strip as HTMLElement).getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows skeletons while loading with nothing to show", async () => {
    render(<ModelPicker groups={[]} status="loading" triggerLabel="Pick" />);
    await open();
    expect(document.querySelector('[data-slot="model-picker-loading"]')).not.toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("shows a retryable error panel when the load failed with no data", async () => {
    const onRetry = vi.fn();
    render(<ModelPicker groups={[]} status="error" triggerLabel="Pick" onRetry={onRetry} />);
    await open();
    expect(screen.getByText("Couldn't load the list")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("distinguishes empty from failed", async () => {
    render(<ModelPicker groups={[]} status="empty" triggerLabel="Pick" />);
    await open();
    expect(screen.getByText("Nothing to show yet")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load the list")).not.toBeInTheDocument();
  });

  it("names the trigger from its label, and lets aria-label name the CONTROL", async () => {
    const { unmount } = render(<ModelPicker groups={groups} triggerLabel="Sales overview" />);
    // Default: the name tells AT what is currently CHOSEN.
    expect(screen.getAllByRole("combobox")[0]).toHaveAccessibleName("Sales overview");
    unmount();

    render(
      <ModelPicker groups={groups} triggerLabel="Sales overview" aria-label="Target picker" />,
    );
    // Explicit: the name tells AT what the control is FOR.
    expect(screen.getAllByRole("combobox")[0]).toHaveAccessibleName("Target picker");
  });

  it("renders caller-supplied meta badges verbatim", async () => {
    render(<ModelPicker groups={groups} triggerLabel="Pick" />);
    await open();
    // Caller-built array, never derived from a flag — an absent flag means
    // "undecided", and deriving from !flag mislabels every row.
    expect(screen.getByText("not provisioned")).toBeInTheDocument();
    expect(screen.queryByText("no modes")).not.toBeInTheDocument();
  });

  describe("controlled open / onOpenChange", () => {
    it("shows the popover content with no interaction when open=true", () => {
      render(<ModelPicker groups={groups} triggerLabel="Pick" open onOpenChange={vi.fn()} />);
      // No click on the trigger — the content must already be there.
      expect(screen.getByText("Apps · northwind")).toBeInTheDocument();
    });

    it("does not open on trigger click when open=false is held by the parent", async () => {
      const onOpenChange = vi.fn();
      render(
        <ModelPicker
          groups={groups}
          triggerLabel="Pick"
          open={false}
          onOpenChange={onOpenChange}
        />,
      );
      await open();
      // The parent never updated `open`, so the popover must stay closed —
      // this is the controlled contract, not a convenience default.
      expect(screen.queryByText("Apps · northwind")).not.toBeInTheDocument();
      expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it("calls onOpenChange(false) on row select instead of closing itself", async () => {
      const onOpenChange = vi.fn();
      const onSelect = vi.fn();
      render(
        <ModelPicker
          groups={groups}
          triggerLabel="Pick"
          open
          onOpenChange={onOpenChange}
          onSelect={onSelect}
        />,
      );
      await userEvent.click(screen.getByText("Research helper"));
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "asst-1" }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
      // Controlled: the parent hasn't updated `open`, so content stays mounted.
      expect(screen.getByText("Apps · northwind")).toBeInTheDocument();
    });
  });

  it("uncontrolled mode: trigger click still opens and closes on its own (regression)", async () => {
    const onSelect = vi.fn();
    render(<ModelPicker groups={groups} triggerLabel="Pick" onSelect={onSelect} />);
    expect(screen.queryByText("Apps · northwind")).not.toBeInTheDocument();
    await open();
    expect(screen.getByText("Apps · northwind")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Research helper"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "asst-1" }));
    expect(screen.queryByText("Apps · northwind")).not.toBeInTheDocument();
  });
});
