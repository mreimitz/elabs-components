/**
 * mock-namespace.test.tsx — locks the defect that made the shipped double
 * unusable through its own documented wiring (issue #364, found in independent
 * validation).
 *
 * The documented swap is a `vi.mock` FACTORY:
 *
 * ```ts
 * vi.mock("@qlik-coe-emea/qlabs-components-charts", async () =>
 *   import("@qlik-coe-emea/qlabs-components-charts/test"));
 * ```
 *
 * Vitest wraps a factory's result in a proxy that THROWS on any export the
 * factory did not return — `[vitest] No "Line" export is defined on the … mock`
 * — the moment the consumer's module READS the binding. So the original claim
 * ("a container double never mounts its children, so a missing `Line` double
 * never throws") was false: the canonical composition
 * `<LineChart><Line dataKey="revenue" /></LineChart>` failed on import.
 *
 * These two tests are the regression lock: (1) the composition renders through
 * the real mock proxy, and (2) every COMPONENT the real barrel exports has a
 * same-named export on the double, checked at RUNTIME against the real module
 * (the gate checks the same property statically, against the manifest).
 */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock(
  "@qlik-coe-emea/qlabs-components-charts",
  async () => await import("@qlik-coe-emea/qlabs-components-charts/test"),
);

import { Line, LineChart, XAxis } from "@qlik-coe-emea/qlabs-components-charts";
import { ChartContractError } from "./contract";

describe("the mocked module namespace is complete", () => {
  it("renders the canonical container + composition-primitive composition", () => {
    const { container } = render(
      <LineChart data={[{ date: new Date("2024-01-01"), revenue: 10 }]} xDataKey="date">
        <Line dataKey="revenue" />
        <XAxis />
      </LineChart>,
    );
    expect(container.querySelector('[data-chart="LineChart"]')).toBeInTheDocument();
  });

  it("still validates the contract when the series comes from a real child element", () => {
    expect(() =>
      render(
        // `revenue` is declared by the child but absent from the rows — the real
        // chart would register the series and read a key that is not there.
        <LineChart data={[{ date: new Date("2024-01-01") }]} xDataKey="date">
          <Line dataKey="revenue" />
        </LineChart>,
      ),
    ).toThrow(ChartContractError);
  });

  it("exports a stand-in for every component the real barrel exports", async () => {
    const real = await vi.importActual<Record<string, unknown>>(
      "@qlik-coe-emea/qlabs-components-charts",
    );
    const double = await import("./index");
    const isComponentName = (n: string) => /^[A-Z]/.test(n) && !/^[A-Z0-9_]+$/.test(n);
    const missing = Object.keys(real)
      .filter(isComponentName)
      .filter((name) => !(name in double))
      .sort();
    expect(missing).toEqual([]);
  }, 15_000);
});
