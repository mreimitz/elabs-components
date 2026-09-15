/**
 * Locks the AutoChart local error boundary (review finding): AutoChart's
 * `try/catch` around building the element tree cannot catch an error thrown
 * once React actually renders/commits a chart container's own hooks — only a
 * class error boundary can. Without one, that error escapes AutoChart's
 * documented "never throws" contract and unmounts an ancestor (or the app).
 *
 * Isolated from `auto-chart.test.tsx` so the `../charts` mock here (one
 * series component made to throw) doesn't interfere with that file's much
 * larger real-render fixture set.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@visx/responsive", () => ({
  ParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => React.ReactNode;
  }) => <>{children({ width: 560, height: 288 })}</>,
}));

vi.mock("../charts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../charts")>();
  return {
    ...actual,
    // A render-phase throw — NOT a construction-time throw — simulating a
    // hook inside a real container blowing up on a malformed value. Thrown
    // from the component itself (not from `createElement`), so it only
    // surfaces once React renders it, past the local `try/catch`.
    Line: () => {
      throw new Error("simulated render-phase failure");
    },
  };
});

beforeAll(() => {
  // Expected: componentDidCatch + React's own dev-mode log.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

import { AutoChart } from "./auto-chart";

afterEach(cleanup);

describe("AutoChart — local error boundary (review finding)", () => {
  it("shows the fallback instead of throwing when a chart container fails during render", () => {
    expect(() =>
      render(
        <AutoChart
          spec={{
            type: "line",
            data: [{ date: "2024-01-01", revenue: 100 }],
            x: "date",
            series: ["revenue"],
          }}
        />,
      ),
    ).not.toThrow();

    expect(screen.getByText("Unable to display this chart")).toBeInTheDocument();
  });
});
