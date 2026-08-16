import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CalcInline } from "./calc-inline";
import type { CalcSheet, EvaluateCalc } from "./types";

const OK: CalcSheet = {
  results: [{ line: 1, tokens: [], value: { kind: "currency", raw: 2720, display: "2,720 USD" } }],
};

// CalcInline is self-contained (native `title`, no Radix TooltipProvider needed).
function renderInline(source: string, evaluate: EvaluateCalc) {
  return render(<CalcInline source={source} evaluate={evaluate} />);
}

describe("CalcInline", () => {
  it("renders the evaluated result as the chip, with the expression in the accessible name", () => {
    renderInline("85 USD * 32", () => OK);
    const chip = screen.getByTestId("calc-inline");
    expect(chip).toHaveTextContent("2,720 USD");
    expect(chip).toHaveAttribute("aria-label", "85 USD * 32 = 2,720 USD");
  });

  it("passes the verbatim expression to the evaluate hook (no bundled engine)", () => {
    let seen = "";
    renderInline("85 USD * 32", (src) => {
      seen = src;
      return OK;
    });
    expect(seen).toBe("85 USD * 32");
  });

  it("renders a calm warning (never throws) for a bad expression", () => {
    renderInline("oops", () => ({ results: [{ line: 1, tokens: [], error: { message: "bad" } }] }));
    const chip = screen.getByTestId("calc-inline");
    expect(chip).toHaveAttribute("data-calc-error");
    expect(chip).toHaveAttribute("aria-label", "oops: bad");
  });

  it("treats a missing result as a calm 'No result' warning", () => {
    renderInline("", () => ({ results: [] }));
    expect(screen.getByTestId("calc-inline")).toHaveAttribute("data-calc-error");
  });
});
