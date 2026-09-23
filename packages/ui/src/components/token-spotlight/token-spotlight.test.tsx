import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen, act, waitFor } from "@testing-library/react";
import { createRef } from "react";
import {
  TokenSpotlight,
  resolveTokenDisplayValue,
  scanForConsumers,
  type TokenSpotlightToken,
} from "./token-spotlight";
import { formatColorAsOklch, formatLengthAsPx } from "./token-value-format";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-decoration");
  document.documentElement.style.removeProperty("--probe-token");
});

const scan = (root: ParentNode, matchValue: string) =>
  new Promise<Element[]>((resolve) => {
    scanForConsumers(root, matchValue, 100, resolve);
  });

/** jsdom resolves no `var()`: the component's match probe reads back `var(--probe-token)`
 * verbatim, so an element styled with that same literal is what it "matches". */
function consumers(count: number) {
  const host = document.createElement("div");
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    el.style.backgroundColor = "var(--probe-token)";
    host.appendChild(el);
  }
  document.body.appendChild(host);
  return host;
}

const TOKENS: TokenSpotlightToken[] = [
  { token: "--primary", label: "Primary" },
  { token: "--border", label: "Border" },
];

describe("TokenSpotlight", () => {
  it("renders one chip per token, with the root's data-slot", () => {
    const { container } = render(<TokenSpotlight tokens={TOKENS} />);
    expect(container.querySelector('[data-slot="token-spotlight"]')).not.toBeNull();
    expect(screen.getByText("--primary")).toBeInTheDocument();
    expect(screen.getByText("--border")).toBeInTheDocument();
  });

  it("merges a caller className onto the root", () => {
    const { container } = render(<TokenSpotlight tokens={TOKENS} className="probe" />);
    expect(container.querySelector('[data-slot="token-spotlight"].probe')).not.toBeNull();
  });

  it("forwards a ref to the root element", () => {
    const ref = createRef<HTMLDivElement>();
    render(<TokenSpotlight tokens={TOKENS} ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("hover sets data-token-spotlight on <html>, and mouse-leave clears it", () => {
    render(<TokenSpotlight tokens={TOKENS} />);
    const chip = screen.getByText("--primary").closest("button");
    if (!chip) throw new Error("chip button not found");
    fireEvent.mouseEnter(chip);
    expect(document.documentElement.dataset.tokenSpotlight).toBe("primary");
    fireEvent.mouseLeave(chip);
    expect(document.documentElement.dataset.tokenSpotlight).toBeUndefined();
  });

  it("keyboard focus sets the same attribute as hover, and blur clears it", () => {
    render(<TokenSpotlight tokens={TOKENS} />);
    const chip = screen.getByText("--border").closest("button");
    if (!chip) throw new Error("chip button not found");
    fireEvent.focus(chip);
    expect(document.documentElement.dataset.tokenSpotlight).toBe("border");
    fireEvent.blur(chip);
    expect(document.documentElement.dataset.tokenSpotlight).toBeUndefined();
  });

  it("calls onSpotlight with the token, then null once it clears", () => {
    const onSpotlight = vi.fn();
    render(<TokenSpotlight tokens={TOKENS} onSpotlight={onSpotlight} />);
    const chip = screen.getByText("--primary").closest("button");
    if (!chip) throw new Error("chip button not found");
    fireEvent.mouseEnter(chip);
    expect(onSpotlight).toHaveBeenLastCalledWith("--primary");
    fireEvent.mouseLeave(chip);
    expect(onSpotlight).toHaveBeenLastCalledWith(null);
  });

  it("cleans up the documentElement attribute on unmount while spotlighted (effect-cleanup)", () => {
    const { unmount } = render(<TokenSpotlight tokens={TOKENS} />);
    const chip = screen.getByText("--primary").closest("button");
    if (!chip) throw new Error("chip button not found");
    fireEvent.mouseEnter(chip);
    expect(document.documentElement.dataset.tokenSpotlight).toBe("primary");
    unmount();
    expect(document.documentElement.dataset.tokenSpotlight).toBeUndefined();
  });

  it("each chip's accessible name carries its label, not just the raw token", () => {
    render(<TokenSpotlight tokens={TOKENS} />);
    expect(screen.getByRole("button", { name: /Primary/ })).toBeInTheDocument();
  });
});

describe("resolveTokenDisplayValue", () => {
  it("reads an oklch() custom-property value off the given root, rounded", () => {
    const el = document.createElement("div");
    el.style.setProperty("--primary", "oklch(0.5 0.1 200)");
    document.body.appendChild(el);
    expect(resolveTokenDisplayValue("--primary", el)).toBe("oklch(0.5 0.1 200)");
    document.body.removeChild(el);
  });

  it("re-encodes a build-transpiled lab() value as the authored oklch()", () => {
    const el = document.createElement("div");
    el.style.setProperty("--background", "lab(98.2553% -.143647 -.74234)");
    document.body.appendChild(el);
    expect(resolveTokenDisplayValue("--background", el)).toBe("oklch(0.985 0.002 257)");
    document.body.removeChild(el);
  });

  it("returns an empty string for an unset token", () => {
    expect(resolveTokenDisplayValue("--not-a-token")).toBe("");
  });
});

describe("formatColorAsOklch", () => {
  it.each([
    ["lab(98.2553% -.143647 -.74234)", "oklch(0.985 0.002 257)"],
    ["lab(98.2553 -0.143647 -0.74234)", "oklch(0.985 0.002 257)"],
    ["oklch(0.985 0.002 257)", "oklch(0.985 0.002 257)"],
    ["oklch(62.8% 0.2577 29.23deg)", "oklch(0.628 0.258 29)"],
    ["rgb(255, 0, 0)", "oklch(0.628 0.258 29)"],
    ["rgb(255 0 0)", "oklch(0.628 0.258 29)"],
    ["color(srgb 1 0 0)", "oklch(0.628 0.258 29)"],
    ["lch(54.29 106.8 40.85)", "oklch(0.628 0.258 29)"],
    ["rgb(255, 255, 255)", "oklch(1 0 0)"],
    ["oklab(0.5 0.1 -0.1 / 50%)", "oklch(0.5 0.141 315 / 0.5)"],
    ["rgba(0, 0, 0, 0)", "oklch(0 0 0 / 0)"],
  ])("%s → %s", (input, expected) => {
    expect(formatColorAsOklch(input)).toBe(expected);
  });

  it.each(["calc(.25rem * (1 - calc(0 / 10)))", "4px", "var(--x)", "#fff", "hsl(0 100% 50%)"])(
    "returns null for %s, never a lab() or a guess",
    (input) => {
      expect(formatColorAsOklch(input)).toBeNull();
    },
  );
});

describe("formatLengthAsPx", () => {
  it("rounds a resolved px length to 2 decimals", () => {
    expect(formatLengthAsPx("4px")).toBe("4px");
    expect(formatLengthAsPx("1.6000000238px")).toBe("1.6px");
  });

  it("returns null for anything that is not a px length", () => {
    expect(formatLengthAsPx("calc(.25rem * (1 - calc(0 / 10)))")).toBeNull();
    expect(formatLengthAsPx("auto")).toBeNull();
  });
});

describe("scanForConsumers", () => {
  it("finds elements whose computed backgroundColor matches, never the ones that don't", async () => {
    const root = document.createElement("div");
    const match = document.createElement("div");
    match.style.backgroundColor = "rgb(1, 2, 3)";
    root.appendChild(match);
    const nonMatch = document.createElement("div");
    nonMatch.style.backgroundColor = "rgb(9, 9, 9)";
    root.appendChild(nonMatch);

    const found = await new Promise<HTMLElement[]>((resolve) => {
      scanForConsumers(root, "rgb(1, 2, 3)", 10, resolve);
    });
    expect(found).toEqual([match]);
  });

  it("returns no elements for an empty or transparent match value, without scanning", async () => {
    const root = document.createElement("div");
    root.appendChild(document.createElement("div"));
    const onDone = vi.fn();
    scanForConsumers(root, "", 10, onDone);
    expect(onDone).toHaveBeenCalledWith([]);
    scanForConsumers(root, "rgba(0, 0, 0, 0)", 10, onDone);
    expect(onDone).toHaveBeenLastCalledWith([]);
  });

  it("counts a border colour only on a side whose width is > 0", async () => {
    const root = document.createElement("div");
    const zeroWidth = document.createElement("div");
    zeroWidth.style.borderColor = "rgb(1, 2, 3)";
    zeroWidth.style.borderWidth = "0px";
    root.appendChild(zeroWidth);
    const topOnly = document.createElement("div");
    topOnly.style.borderColor = "rgb(1, 2, 3)";
    topOnly.style.borderWidth = "0px";
    topOnly.style.borderTopWidth = "1px";
    root.appendChild(topOnly);
    expect(await scan(root, "rgb(1, 2, 3)")).toEqual([topOnly]);
  });

  it("counts a text colour only on an element with its own non-empty text node", async () => {
    const root = document.createElement("div");
    const wrapper = document.createElement("div");
    wrapper.style.color = "rgb(1, 2, 3)";
    const whitespaceOnly = document.createElement("span");
    whitespaceOnly.style.color = "rgb(1, 2, 3)";
    whitespaceOnly.textContent = "   ";
    const text = document.createElement("span");
    text.style.color = "rgb(1, 2, 3)";
    text.textContent = "Uses the token";
    wrapper.append(whitespaceOnly, text);
    root.appendChild(wrapper);
    expect(await scan(root, "rgb(1, 2, 3)")).toEqual([text]);
  });

  it("reports an SVG shape's fill/stroke as its <svg>, once, and ignores zero-width strokes", async () => {
    const ns = "http://www.w3.org/2000/svg";
    const root = document.createElement("div");
    const svg = document.createElementNS(ns, "svg");
    for (let i = 0; i < 3; i++) {
      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("style", "fill: rgb(1, 2, 3)");
      svg.appendChild(rect);
    }
    root.appendChild(svg);
    const hairless = document.createElementNS(ns, "svg");
    const line = document.createElementNS(ns, "line");
    line.setAttribute("style", "fill: none; stroke: rgb(1, 2, 3); stroke-width: 0");
    hairless.appendChild(line);
    root.appendChild(hairless);
    expect(await scan(root, "rgb(1, 2, 3)")).toEqual([svg]);
  });

  it("a canceller stops the scan before onDone ever fires", () => {
    const root = document.createElement("div");
    for (let i = 0; i < 5; i++) root.appendChild(document.createElement("div"));
    const onDone = vi.fn();
    const cancel = scanForConsumers(root, "rgb(1, 2, 3)", 10, onDone);
    cancel();
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe("TokenSpotlight marks", () => {
  it("writes data-token-consumer in slices, never all in one task", async () => {
    vi.useFakeTimers();
    const host = consumers(100);
    render(<TokenSpotlight tokens={[{ token: "--probe-token", label: "Probe" }]} />);
    fireEvent.mouseEnter(screen.getByText("--probe-token"));
    const marked = () => host.querySelectorAll("[data-token-consumer]").length;
    await act(async () => {
      await vi.advanceTimersToNextTimerAsync(); // scan slice (100 < 150 elements: one slice)
    });
    await act(async () => {
      await vi.advanceTimersToNextTimerAsync(); // first mark slice
    });
    const afterFirstSlice = marked();
    expect(afterFirstSlice).toBeGreaterThan(0);
    expect(afterFirstSlice).toBeLessThan(100);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(marked()).toBe(100);
    host.remove();
  });

  it("unhover mid-way stops further write slices, then clears what already landed", async () => {
    vi.useFakeTimers();
    const host = consumers(100);
    render(<TokenSpotlight tokens={[{ token: "--probe-token", label: "Probe" }]} />);
    const chip = screen.getByText("--probe-token");
    fireEvent.mouseEnter(chip);
    await act(async () => {
      await vi.advanceTimersToNextTimerAsync();
    });
    await act(async () => {
      await vi.advanceTimersToNextTimerAsync();
    });
    const markedBeforeUnhover = host.querySelectorAll("[data-token-consumer]").length;
    expect(markedBeforeUnhover).toBeGreaterThan(0);
    expect(markedBeforeUnhover).toBeLessThan(100); // still mid-way, further write slices remain
    fireEvent.mouseLeave(chip);
    // Clearing is sliced too (#616) — nothing is removed synchronously on unhover.
    expect(host.querySelectorAll("[data-token-consumer]").length).toBe(markedBeforeUnhover);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    // No further write slices ran (count never grew past what had already landed), and the clear
    // slices removed everything that had.
    expect(host.querySelectorAll("[data-token-consumer]")).toHaveLength(0);
    host.remove();
  });

  it("clears data-token-consumer in slices, never all in one task", async () => {
    vi.useFakeTimers();
    const host = consumers(100);
    render(<TokenSpotlight tokens={[{ token: "--probe-token", label: "Probe" }]} />);
    const chip = screen.getByText("--probe-token");
    fireEvent.mouseEnter(chip);
    const marked = () => host.querySelectorAll("[data-token-consumer]").length;
    // Let the write finish fully first, so the clear below starts from all 100 marked.
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(marked()).toBe(100);
    fireEvent.mouseLeave(chip);
    expect(marked()).toBe(100); // nothing cleared synchronously
    await act(async () => {
      await vi.advanceTimersToNextTimerAsync(); // first clear slice
    });
    const afterFirstSlice = marked();
    expect(afterFirstSlice).toBeGreaterThan(0);
    expect(afterFirstSlice).toBeLessThan(100);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(marked()).toBe(0);
    host.remove();
  });

  it("unmount and a theme change clear the marks (effect-cleanup)", async () => {
    const host = consumers(3);
    const { unmount } = render(
      <TokenSpotlight tokens={[{ token: "--probe-token", label: "Probe" }]} />,
    );
    fireEvent.mouseEnter(screen.getByText("--probe-token"));
    await waitFor(() => expect(host.querySelectorAll("[data-token-consumer]")).toHaveLength(3));
    const first = host.firstElementChild;
    first?.removeAttribute("data-token-consumer"); // a stale mark would survive a re-scan
    document.documentElement.setAttribute("data-theme", "dark");
    await waitFor(() => expect(first).toHaveAttribute("data-token-consumer", "probe-token"));
    unmount();
    // Clearing is sliced (#616), so it lands on the next tick, not synchronously with unmount.
    await waitFor(() => expect(host.querySelectorAll("[data-token-consumer]")).toHaveLength(0));
    host.remove();
  });

  it("maxMarks caps how many consumers get marked, opt-in (#616)", async () => {
    vi.useFakeTimers();
    const host = consumers(100);
    render(<TokenSpotlight tokens={[{ token: "--probe-token", label: "Probe" }]} maxMarks={10} />);
    fireEvent.mouseEnter(screen.getByText("--probe-token"));
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(host.querySelectorAll("[data-token-consumer]")).toHaveLength(10);
    host.remove();
  });

  it("without maxMarks, marking is unbounded (default: no cap)", async () => {
    vi.useFakeTimers();
    const host = consumers(100);
    render(<TokenSpotlight tokens={[{ token: "--probe-token", label: "Probe" }]} />);
    fireEvent.mouseEnter(screen.getByText("--probe-token"));
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(host.querySelectorAll("[data-token-consumer]")).toHaveLength(100);
    host.remove();
  });
});

describe("TokenSpotlight values", () => {
  it("shows a colour as oklch() and re-reads it on a data-decoration change", async () => {
    const root = document.documentElement;
    root.style.setProperty("--probe-token", "lab(98.2553% -.143647 -.74234)");
    render(<TokenSpotlight tokens={[{ token: "--probe-token", label: "Probe" }]} />);
    await waitFor(() => expect(screen.getByText("oklch(0.985 0.002 257)")).toBeInTheDocument());
    root.style.setProperty("--probe-token", "oklch(0.5 0.1 200)");
    root.setAttribute("data-decoration", "6");
    await waitFor(() => expect(screen.getByText("oklch(0.5 0.1 200)")).toBeInTheDocument());
  });
});
