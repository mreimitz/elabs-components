import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatElapsed } from "@elabs-ai/components-ui";
import { TurnStatus } from "./turn-status";

// `formatElapsed` now lives in `@elabs-ai/components-ui` (docs/decisions/
// 2026-09-01-brainless-adoption-architecture.md § 6.1) — `TurnStatus` imports
// it rather than declaring it. These tests stay here because `TurnStatus` is
// the surface whose behaviour they were written to lock.
describe("formatElapsed", () => {
  it.each([
    // [elapsedMs, expected]
    [0, "0ms"],
    [420, "420ms"],
    [999, "999ms"],
    [1000, "1.0s"],
    [8000, "8.0s"],
    [9949, "9.9s"],
    [10000, "10s"],
    [42000, "42s"],
    [59000, "59s"],
    [60000, "1m00s"],
    [77000, "1m17s"],
    [605000, "10m05s"],
  ] as const)("formats %dms as %s", (elapsedMs, expected) => {
    expect(formatElapsed(elapsedMs)).toBe(expected);
  });
});

describe("TurnStatus", () => {
  it("renders exactly one live region when label, elapsed, tokens and turn are all supplied", () => {
    render(
      <TurnStatus
        elapsedMs={8000}
        label="Working…"
        tokens={{ input: 120, output: 340 }}
        turn={2}
        turnTotal={5}
      />,
    );

    const liveRegions = screen.getAllByRole("status");
    expect(liveRegions).toHaveLength(1);
    expect(liveRegions[0]).toHaveTextContent("Working…");
  });

  it("renders the elapsed time and does not put it inside the live region", () => {
    render(<TurnStatus elapsedMs={8000} label="Working…" />);

    expect(screen.getByText("8.0s")).toBeInTheDocument();
    const [liveRegion] = screen.getAllByRole("status");
    expect(liveRegion).not.toHaveTextContent("8.0s");
  });

  it("renders a focusable stop button while working, reachable via onStop", () => {
    const onStop = () => undefined;
    render(<TurnStatus label="Working…" onStop={onStop} status="working" />);

    const stop = screen.getByRole("button", { name: "Stop" });
    expect(stop).toBeInTheDocument();
    expect(stop.tagName).toBe("BUTTON");
    stop.focus();
    expect(stop).toHaveFocus();
  });

  it("renders the completed-turn line and stops announcing when settled", () => {
    render(<TurnStatus elapsedMs={8000} status="settled" />);

    expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
    const liveRegions = screen.getAllByRole("status");
    expect(liveRegions).toHaveLength(1);
    expect(liveRegions[0]).toHaveTextContent(/8\.0s/);
  });
});
