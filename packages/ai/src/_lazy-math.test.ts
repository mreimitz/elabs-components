import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { needsMathPlugin, preloadMath, useLazyMathPlugin } from "./_lazy-math";

/**
 * The KaTeX-carrying `@streamdown/math` module is mocked so this file tests
 * the lazy wrapper's *behaviour*. That the real dependency is genuinely
 * absent from the entry chunk is a property of the BUILD, not of jsdom — see
 * `pnpm check --rule eager-heavy-deps`, which
 * asserts no `packages/ai/src` module statically imports `@streamdown/math`
 * or `katex`.
 */
const fakeMathPlugin = {
  name: "katex",
  rehypePlugin: vi.fn(),
  remarkPlugin: vi.fn(),
  type: "math",
};

vi.mock("@streamdown/math", () => ({ math: fakeMathPlugin }));

describe("needsMathPlugin", () => {
  it("matches $$block$$ and $inline$ delimiters", () => {
    expect(needsMathPlugin("plain text")).toBe(false);
    expect(needsMathPlugin("$$x^2$$")).toBe(true);
    expect(needsMathPlugin("the answer is $x + 1$ today")).toBe(true);
  });

  it("matches \\( \\) and \\[ \\] delimiters", () => {
    expect(needsMathPlugin("\\(x^2\\)")).toBe(true);
    expect(needsMathPlugin("\\[x^2\\]")).toBe(true);
  });

  it("does not false-positive on a bare dollar amount", () => {
    // A single, unpaired `$` (no closing delimiter on the same line) is not math.
    expect(needsMathPlugin("that costs $5")).toBe(false);
  });
});

describe("useLazyMathPlugin", () => {
  it("returns undefined when the text has no math delimiters", () => {
    const { result } = renderHook(() => useLazyMathPlugin("plain text"));
    expect(result.current).toBeUndefined();
  });

  it("loads and returns the plugin once the text needs math", async () => {
    const { result } = renderHook(() => useLazyMathPlugin("$$x^2$$"));
    await waitFor(() => expect(result.current).toBe(fakeMathPlugin));
  });

  it("preloadMath resolves without throwing", () => {
    expect(() => preloadMath()).not.toThrow();
  });

  it("serves a second, simultaneous consumer off the same cached load", async () => {
    const first = renderHook(() => useLazyMathPlugin("$$x^2$$"));
    const second = renderHook(() => useLazyMathPlugin("$y^2$"));

    await waitFor(() => expect(first.result.current).toBe(fakeMathPlugin));
    await waitFor(() => expect(second.result.current).toBe(fakeMathPlugin));
  });
});
