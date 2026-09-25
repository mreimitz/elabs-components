import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  UnpaintedLabels,
  UnpaintedLabelsProvider,
  useReportUnpaintedLabels,
  useUnpaintedLabelsStore,
} from "./unpainted-labels";

/**
 * #546 — a dropped label whose OWN text contains a space (pie's
 * `formatPieLabelText`-style `"Direct · 30.8%"`) must round-trip through the
 * store as one entry, not fragment into separate words.
 */
function Reporter({ texts }: { texts: readonly string[] }) {
  useReportUnpaintedLabels("reporter", texts);
  return null;
}

function Harness({ texts }: { texts: readonly string[] }) {
  const store = useUnpaintedLabelsStore();
  return (
    <UnpaintedLabelsProvider store={store}>
      <Reporter texts={texts} />
      <UnpaintedLabels store={store} />
    </UnpaintedLabelsProvider>
  );
}

describe("useReportUnpaintedLabels / UnpaintedLabels", () => {
  it("keeps a dropped label containing an internal space as one entry, not split into words (#546)", () => {
    const { container } = render(<Harness texts={["Direct · 30.8%"]} />);
    const restated = container.querySelector('[data-slot="chart-labels-unpainted"]');
    expect(restated?.textContent).toBe("Direct · 30.8%");
    expect(restated?.getAttribute("data-count")).toBe("1");
  });

  it("keeps several space-containing labels as distinct, unfragmented entries", () => {
    const { container } = render(
      <Harness texts={["Direct · 30.8%", "Organic · 26.9%", "Referral · 18.3%"]} />,
    );
    const restated = container.querySelector('[data-slot="chart-labels-unpainted"]');
    expect(restated?.getAttribute("data-count")).toBe("3");
    // The exact source strings, comma-joined — never fragmented into words.
    expect(restated?.textContent).toBe("Direct · 30.8%, Organic · 26.9%, Referral · 18.3%");
  });

  it("still reports nothing when nothing is dropped, and clears on unmount", () => {
    const { container, rerender } = render(<Harness texts={[]} />);
    expect(container.querySelector('[data-slot="chart-labels-unpainted"]')).toBeNull();
    rerender(<Harness texts={["Solo label"]} />);
    expect(container.querySelector('[data-slot="chart-labels-unpainted"]')?.textContent).toBe(
      "Solo label",
    );
  });

  it("byKey → flattened snapshot across multiple reporters is unaffected by the fix", () => {
    function TwoReporters() {
      const store = useUnpaintedLabelsStore();
      return (
        <UnpaintedLabelsProvider store={store}>
          <Reporter texts={["Direct · 30.8%"]} />
          <UnpaintedLabels extra={["Extra one", "Extra two"]} store={store} />
        </UnpaintedLabelsProvider>
      );
    }
    const { container } = render(<TwoReporters />);
    const restated = container.querySelector('[data-slot="chart-labels-unpainted"]');
    expect(restated?.textContent).toBe("Extra one, Extra two, Direct · 30.8%");
    expect(restated?.getAttribute("data-count")).toBe("3");
  });
});
