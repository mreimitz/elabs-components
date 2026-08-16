import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CSSProperties } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { CodeBlock } from "./code-block";

const __dirname = dirname(fileURLToPath(import.meta.url));

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("--code-background");
});

describe("CodeBlock", () => {
  // #315 — locks the fix: the highlighter theme must be derived from brand
  // `--code-*` tokens, never Shiki's bundled `github-light`/`github-dark`.
  it("never hardcodes shiki's github-light/github-dark theme (#315)", () => {
    const source = readFileSync(join(__dirname, "code-block.tsx"), "utf8");
    expect(source).not.toMatch(/github-light|github-dark/);
  });

  it("resolves the highlighted <pre> background from the active theme's --code-background token (#315)", async () => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.setProperty("--code-background", "oklch(1 0 0)");

    const { container } = render(<CodeBlock code="const a = 1;" language="tsx" />);

    await waitFor(() => {
      const pre = container.querySelector("pre");
      expect(pre?.style.backgroundColor).toBe("rgb(255, 255, 255)");
    });
  });

  // #315 follow-up — a CodeBlock nested inside a region-scoped
  // `<div data-theme="…">` (a supported ThemeProvider/decorator pattern, see
  // @.claude/rules/theming.md and 6 other @…-ai story files) must resolve
  // THAT region's `--code-*` tokens, not always the document root's.
  it("resolves --code-* tokens from a region-scoped data-theme ancestor, not the document root's", async () => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.setProperty("--code-background", "oklch(1 0 0)");

    const { container } = render(
      <div
        data-theme="dark"
        style={{ "--code-background": "oklch(0.25 0.005 75)" } as CSSProperties}
      >
        <CodeBlock code="const a = 1;" language="tsx" />
      </div>,
    );

    await waitFor(() => {
      const pre = container.querySelector("pre");
      // rgb(35, 33, 31) is oklch(0.25 0.005 75) converted to sRGB — the
      // SCOPED dark region's color, never the document root's white.
      expect(pre?.style.backgroundColor).toBe("rgb(35, 33, 31)");
    });
  });

  // #315 regression lock — `highlightCode` returns the tokenized result
  // SYNCHRONOUSLY on a cache hit, WITHOUT invoking the subscribed callback.
  // Once the "tsx" highlighter is warm (e.g. after the FIRST theme's
  // highlight), a theme switch re-tokenizes fast enough to resolve as a cache
  // hit before `CodeBlockContent`'s effect re-subscribes — a component that
  // only reacted to the callback would get stuck showing the un-highlighted
  // raw fallback forever after every theme change after the first.
  it("re-highlights with the new theme's colors after data-theme changes at runtime (#315)", async () => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.setProperty("--code-background", "oklch(1 0 0)");
    document.documentElement.style.setProperty("--code-keyword", "oklch(0.38 0.16 264)");

    const { container } = render(<CodeBlock code="const value = 1;" language="tsx" />);

    // Initial highlight settles on the light colors.
    await waitFor(() => {
      const pre = container.querySelector("pre");
      expect(pre?.style.backgroundColor).toBe("rgb(255, 255, 255)");
    });
    const spansBefore = container.querySelectorAll("code > span > span");
    expect(spansBefore.length).toBeGreaterThan(1); // real per-token spans, not the 1-span raw fallback

    // Switch to dark at runtime (ThemeProvider / Storybook's theme
    // decorator both just flip `data-theme`) with a DIFFERENT resolved value.
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.style.setProperty("--code-background", "oklch(0.25 0.005 75)");
    document.documentElement.style.setProperty("--code-keyword", "oklch(0.7 0.16 264)");

    await waitFor(() => {
      const pre = container.querySelector("pre");
      // rgb(35, 33, 31) is oklch(0.25 0.005 75) converted to sRGB.
      expect(pre?.style.backgroundColor).toBe("rgb(35, 33, 31)");
    });

    // The re-highlight actually re-tokenized (still real per-token spans, not
    // stuck on the single-span raw fallback the bug would strand it on).
    const spansAfter = container.querySelectorAll("code > span > span");
    expect(spansAfter.length).toBeGreaterThan(1);
  });

  // #315 regression lock — the blocker: narrowing the attribute to a validated
  // theme name collapses "no `data-theme` attribute yet" (the
  // pre-`ThemeProvider`-mount render) and an EXPLICIT `data-theme="light"` into
  // the SAME value (both fall back to `DEFAULT_THEME`). `:root`'s `--code-*`
  // fallback values are their own
  // distinct placeholder palette, not a copy of `light`'s — so if the
  // highlight cache were keyed on the validated name, a code block that first
  // tokenizes before `data-theme` is set would cache under the SAME key
  // `ThemeProvider` later writes explicitly, and the (correct) light
  // colors would never take effect. This locks the fix: the cache is keyed on
  // the RAW attribute, so the mutation is a genuine re-tokenize.
  it("re-tokenizes when data-theme transitions from unset to an explicit value resolving to the same theme name (#315)", async () => {
    // No data-theme attribute set — the pre-mount state. Simulates :root's
    // fallback --code-background differing from light's own. Uses a code
    // string unique to this test — the highlight cache is module-level and
    // keyed (in part) on the code content, so reusing another test's snippet
    // here would collide with an ALREADY-cached "light" entry from that
    // other test and mask this exact regression.
    document.documentElement.style.setProperty("--code-background", "oklch(0.5 0 0)");

    const { container } = render(
      <CodeBlock code="const scopeKeyRegressionMarker = 315;" language="tsx" />,
    );

    await waitFor(() => {
      const pre = container.querySelector("pre");
      expect(pre?.style.backgroundColor).toBe("rgb(99, 99, 99)");
    });

    // ThemeProvider mounts and writes data-theme="light" explicitly, with
    // a DIFFERENT --code-background than the unset-attribute render resolved.
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.style.setProperty("--code-background", "oklch(0.1 0 0)");

    await waitFor(() => {
      const pre = container.querySelector("pre");
      // Must pick up the NEW color — never stuck on the unset-attribute cache entry.
      expect(pre?.style.backgroundColor).toBe("rgb(3, 3, 3)");
    });
  });

  it("renders the code content", () => {
    const { container } = render(<CodeBlock code="const a = 1;" language="tsx" />);
    expect(container.textContent).toContain("const a = 1;");
  });

  it("soft-wraps long lines when `wrap` is set (#5)", () => {
    const { container } = render(
      <CodeBlock code="a very long single line of code" language="tsx" wrap />,
    );
    const pre = container.querySelector("pre");
    expect(pre?.className).toContain("whitespace-pre-wrap");
    expect(pre?.className).toContain("break-words");
    // No horizontal-scroll affordance when wrapping (there's nothing to scroll).
    const scroller = container.querySelector(".overflow-auto");
    expect(scroller?.className ?? "").not.toContain("scrollbar-width:thin");
  });

  it("does not wrap by default, and shows a scroll affordance (#5)", () => {
    const { container } = render(
      <CodeBlock code="a very long single line of code" language="tsx" />,
    );
    const pre = container.querySelector("pre");
    expect(pre?.className).not.toContain("whitespace-pre-wrap");
    // Default mode keeps horizontal scroll with a discoverable thin scrollbar.
    const scroller = container.querySelector(".overflow-auto");
    expect(scroller).not.toBeNull();
    expect(scroller?.className).toContain("scrollbar-width:thin");
  });
});

describe("CodeBlock isStreaming (#269, loading-states.md)", () => {
  it("keeps rendering the partial code (build-up), not a skeleton", () => {
    const { container } = render(<CodeBlock code="const partial = " language="tsx" isStreaming />);
    expect(container.textContent).toContain("const partial =");
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("shows exactly one in-progress live region while streaming", () => {
    const { container } = render(<CodeBlock code="const a = 1;" language="tsx" isStreaming />);
    const statuses = container.querySelectorAll('[role="status"]');
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toHaveAttribute("aria-live", "polite");
    expect(statuses[0]).toHaveTextContent("Generating…");
  });

  it("shows no in-progress cue when not streaming", () => {
    const { container } = render(<CodeBlock code="const a = 1;" language="tsx" />);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
