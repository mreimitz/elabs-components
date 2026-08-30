import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageCompare, MessageCompareColumn } from "./message-compare";
import { MessageFeedback } from "./message-feedback";

afterEach(cleanup);

function columnBodies(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-slot="message-compare-column-body"]'),
  );
}

/**
 * jsdom performs no layout, so `scrollHeight`/`clientHeight` are always 0.
 * Every test that reads a proportional scroll offset needs a real, non-zero
 * content/viewport size to divide by.
 */
function mockScrollMetrics(
  el: HTMLElement,
  { scrollHeight, clientHeight }: { scrollHeight: number; clientHeight: number },
) {
  Object.defineProperty(el, "scrollHeight", { value: scrollHeight, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: clientHeight, configurable: true });
}

describe("MessageCompare", () => {
  it("does not move a settled column's scroll position when a sibling's content grows", () => {
    const { container, rerender } = render(
      <MessageCompare columns={2}>
        <MessageCompareColumn model={{ name: "Model A" }} status="streaming">
          Short
        </MessageCompareColumn>
        <MessageCompareColumn model={{ name: "Model B" }} status="ready">
          Done
        </MessageCompareColumn>
      </MessageCompare>,
    );

    const complete = columnBodies(container)[1]!;
    mockScrollMetrics(complete, { scrollHeight: 400, clientHeight: 200 });
    complete.scrollTop = 120;
    expect(complete.scrollTop).toBe(120);

    // Simulate the streaming column's content growing.
    rerender(
      <MessageCompare columns={2}>
        <MessageCompareColumn model={{ name: "Model A" }} status="streaming">
          {"Much longer streamed content. ".repeat(40)}
        </MessageCompareColumn>
        <MessageCompareColumn model={{ name: "Model B" }} status="ready">
          Done
        </MessageCompareColumn>
      </MessageCompare>,
    );

    const completeAfter = columnBodies(container)[1]!;
    expect(completeAfter.scrollTop).toBe(120);
  });

  it("does not propagate scroll to siblings by default (syncScroll unset)", () => {
    const { container } = render(
      <MessageCompare columns={2}>
        <MessageCompareColumn model={{ name: "Model A" }}>A</MessageCompareColumn>
        <MessageCompareColumn model={{ name: "Model B" }}>B</MessageCompareColumn>
      </MessageCompare>,
    );

    const [a, b] = columnBodies(container);
    mockScrollMetrics(a!, { scrollHeight: 1000, clientHeight: 200 });
    mockScrollMetrics(b!, { scrollHeight: 500, clientHeight: 100 });

    a!.scrollTop = 400; // 50% of A's scrollable range
    fireEvent.scroll(a!);

    expect(b!.scrollTop).toBe(0);
  });

  it("propagates scroll to siblings proportionally when syncScroll is on", () => {
    const { container } = render(
      <MessageCompare columns={2} syncScroll>
        <MessageCompareColumn model={{ name: "Model A" }}>A</MessageCompareColumn>
        <MessageCompareColumn model={{ name: "Model B" }}>B</MessageCompareColumn>
      </MessageCompare>,
    );

    const [a, b] = columnBodies(container);
    mockScrollMetrics(a!, { scrollHeight: 1000, clientHeight: 200 }); // range 800
    mockScrollMetrics(b!, { scrollHeight: 500, clientHeight: 100 }); // range 400

    a!.scrollTop = 400; // 50% of A's range
    fireEvent.scroll(a!);

    expect(b!.scrollTop).toBe(200); // 50% of B's range
  });

  it("labels each column as a region with a distinct accessible name from its model", () => {
    render(
      <MessageCompare columns={3}>
        <MessageCompareColumn model={{ name: "GPT-5" }}>x</MessageCompareColumn>
        <MessageCompareColumn model={{ name: "Claude" }}>y</MessageCompareColumn>
        <MessageCompareColumn model={{ name: "Gemini" }}>z</MessageCompareColumn>
      </MessageCompare>,
    );

    const regions = screen.getAllByRole("region");
    expect(regions).toHaveLength(3);
    expect(regions.map((region) => region.getAttribute("aria-label"))).toEqual([
      "GPT-5",
      "Claude",
      "Gemini",
    ]);
  });

  it("collapses to a tab strip under the responsive breakpoint instead of side-by-side columns", () => {
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { value: 500, configurable: true });

    try {
      render(
        <MessageCompare columns={2}>
          <MessageCompareColumn model={{ name: "Model A" }}>A</MessageCompareColumn>
          <MessageCompareColumn model={{ name: "Model B" }}>B</MessageCompareColumn>
        </MessageCompare>,
      );

      expect(screen.getByRole("tablist")).toBeInTheDocument();
      expect(screen.getAllByRole("tab")).toHaveLength(2);
    } finally {
      Object.defineProperty(window, "innerWidth", { value: originalWidth, configurable: true });
    }
  });

  it("does not render a tab strip at a normal (non-mobile) viewport", () => {
    render(
      <MessageCompare columns={2}>
        <MessageCompareColumn model={{ name: "Model A" }}>A</MessageCompareColumn>
        <MessageCompareColumn model={{ name: "Model B" }}>B</MessageCompareColumn>
      </MessageCompare>,
    );

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("keeps per-column feedback state independent between siblings", async () => {
    const user = userEvent.setup();
    const onSubmitA = vi.fn();
    const onSubmitB = vi.fn();

    render(
      <MessageCompare columns={2}>
        <MessageCompareColumn model={{ name: "Model A" }}>
          <MessageFeedback onSubmit={onSubmitA} />
        </MessageCompareColumn>
        <MessageCompareColumn model={{ name: "Model B" }}>
          <MessageFeedback onSubmit={onSubmitB} />
        </MessageCompareColumn>
      </MessageCompare>,
    );

    const [goodA] = screen.getAllByRole("button", { name: "Good response" });
    await user.click(goodA!);

    expect(onSubmitA).toHaveBeenCalledTimes(1);
    expect(onSubmitA).toHaveBeenCalledWith({ type: "positive" });
    expect(onSubmitB).not.toHaveBeenCalled();
  });
});
