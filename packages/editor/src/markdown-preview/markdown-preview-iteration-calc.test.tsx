/**
 * Locks the user-reported gap: a ```calc fence used as an iteration cell template
 * must RESOLVE into a CalcBlock (not show as raw text) — in BOTH the matrix/pivot
 * and the stacked layouts. MarkdownPreview threads the calc `evaluate` into each
 * cell's nested preview, so calc objects compute per cell. The builder dialog's
 * live preview renders through this same path.
 *
 * Nested previews are jsdom-sensitive (Streamdown), so this lives in its own file
 * with generous waits — per the markdown-preview-iteration suite convention.
 */
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarkdownPreview } from "./markdown-preview";
import { evaluateEmbedded } from "../markdown-iteration/iteration-builder";
import type { EvaluateCalc } from "../calc-block";

afterEach(cleanup);

// A minimal calc engine: each non-empty line resolves to 42. Proves a calc cell
// RESOLVES into a CalcBlock inside an iteration — the library renders, the app
// computes (no math engine bundled).
const evaluateCalc: EvaluateCalc = (source) => ({
  results: source
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((_, i) => ({
      line: i + 1,
      tokens: [],
      value: { kind: "number" as const, raw: 42, display: "42" },
    })),
});

const calcCount = (root: HTMLElement) => root.querySelectorAll('[data-testid="calc-block"]').length;

describe("calc objects resolve inside iteration cells (every layout)", () => {
  it("pivot/matrix: every cell's calc fence renders a CalcBlock", async () => {
    const md = [
      `:::pivot{rows="Q1, Q2" cols="N, S" layout="matrix"}`,
      "```calc",
      "items = {{row}} + {{col}}",
      "total = items",
      "```",
      ":::",
    ].join("\n");
    const { container } = render(
      <MarkdownPreview evaluateIteration={evaluateEmbedded} evaluate={evaluateCalc}>
        {md}
      </MarkdownPreview>,
    );
    // 2 rows × 2 cols = 4 resolved calc blocks.
    await waitFor(() => expect(calcCount(container)).toBe(4), { timeout: 8000 });
  });

  it("iterate/stacked: every item's calc fence renders a CalcBlock", async () => {
    const md = [
      `:::iterate{as="item" values="A, B, C" layout="stacked"}`,
      "```calc",
      "x = {{item.name}}",
      "```",
      ":::",
    ].join("\n");
    const { container } = render(
      <MarkdownPreview evaluateIteration={evaluateEmbedded} evaluate={evaluateCalc}>
        {md}
      </MarkdownPreview>,
    );
    // 3 values = 3 resolved calc blocks (stacked).
    await waitFor(() => expect(calcCount(container)).toBe(3), { timeout: 8000 });
  });
});
