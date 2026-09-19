import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { createRef } from "react";
import {
  TokenSpotlight,
  resolveTokenDisplayValue,
  scanForConsumers,
  type TokenSpotlightToken,
} from "./token-spotlight";

afterEach(cleanup);

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
  it("reads the literal custom-property value off the given root", () => {
    const el = document.createElement("div");
    el.style.setProperty("--primary", "oklch(0.5 0.1 200)");
    document.body.appendChild(el);
    expect(resolveTokenDisplayValue("--primary", el)).toBe("oklch(0.5 0.1 200)");
    document.body.removeChild(el);
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

  it("a canceller stops the scan before onDone ever fires", () => {
    const root = document.createElement("div");
    for (let i = 0; i < 5; i++) root.appendChild(document.createElement("div"));
    const onDone = vi.fn();
    const cancel = scanForConsumers(root, "rgb(1, 2, 3)", 10, onDone);
    cancel();
    expect(onDone).not.toHaveBeenCalled();
  });
});
