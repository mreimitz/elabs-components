import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CSSProperties } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { CodeBlock, CodeBlockCopyButton, highlightCode } from "./code-block";

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

  // #597 — locks the lazy-boundary fix: shiki (~36KB gzip of bundled
  // language/theme index) must never be a static module-scope import, which
  // would put it in every consumer's entry chunk (ADR 0019). Only an
  // `import type` (erases at build time, #315's own imports rely on this)
  // or the runtime `import("shiki")` inside `loadShiki` may reference it.
  it("never statically imports shiki at module scope — only import type or a lazy import() (#597)", () => {
    const source = readFileSync(join(__dirname, "code-block.tsx"), "utf8");
    expect(source).not.toMatch(/^\s*import\s+(?!type\s)[^;]*\sfrom\s*["']shiki["']/m);
    expect(source).toMatch(/import\(\s*["']shiki["']\s*\)/);
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

  // #597 — locks the runtime contract the shiki lazy-boundary must preserve:
  // the code is visible via the raw `createRawTokens` fallback on the very
  // first render (no spinner/blank gate while shiki's dynamic import is in
  // flight, no layout shift), and per-token highlighting arrives afterward,
  // once that import resolves.
  it("renders the raw code immediately, then highlights once shiki's lazy import resolves (#597)", async () => {
    const { container } = render(<CodeBlock code="const lazyShikiMarker = 597;" language="tsx" />);

    // Immediately: real text content via the single-span raw fallback,
    // synchronously, before shiki has had any chance to load.
    expect(container.querySelector("pre")?.textContent).toContain("const lazyShikiMarker = 597;");
    expect(container.querySelectorAll("code > span > span").length).toBeLessThanOrEqual(1);

    // Afterward: shiki's dynamic import resolves and per-token highlighting
    // replaces the raw fallback with real, multi-span tokenized output.
    await waitFor(() => {
      expect(container.querySelectorAll("code > span > span").length).toBeGreaterThan(1);
    });
    expect(container.querySelector("pre")?.textContent).toContain("const lazyShikiMarker = 597;");
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

describe("CodeBlockCopyButton accessible name (a11y review)", () => {
  it("has an aria-label so the icon-only button has an accessible name", () => {
    const { container } = render(
      <CodeBlock code="const a = 1;" language="tsx">
        <CodeBlockCopyButton />
      </CodeBlock>,
    );
    expect(container.querySelector("button")).toHaveAccessibleName("Copy");
  });

  it("lets a consumer override the label", () => {
    const { container } = render(
      <CodeBlock code="const a = 1;" language="tsx">
        <CodeBlockCopyButton aria-label="Copy snippet" />
      </CodeBlock>,
    );
    expect(container.querySelector("button")).toHaveAccessibleName("Copy snippet");
  });
});

// ─── `highlightCode` awaited helper for the perf-fix regression locks below ──

function highlightAsync(
  code: string,
  language: Parameters<typeof highlightCode>[1],
  el?: Element | null,
  skipCache = false,
): Promise<NonNullable<ReturnType<typeof highlightCode>>> {
  return new Promise((resolve) => {
    const cached = highlightCode(code, language, (result) => resolve(result), el, skipCache);
    if (cached) resolve(cached);
  });
}

const flattenTokenContent = (result: NonNullable<ReturnType<typeof highlightCode>>): string =>
  result.tokens.map((line) => line.map((token) => token.content).join("")).join("\n");

describe("highlightCode cache key — no hash collision (perf review 1.4b/1.4c)", () => {
  it("does not collide two >200-char strings sharing a length, prefix and suffix but differing in the middle", async () => {
    const prefix = "a".repeat(150);
    const suffix = "b".repeat(150);
    // Same length, same first/last 100 chars — the OLD `length:first100:last100`
    // cache key collided on exactly this shape (a mid-string edit), showing
    // whichever of the two resolved second on top of BOTH code blocks.
    const codeA = `${prefix}1${suffix}`;
    const codeB = `${prefix}2${suffix}`;

    await highlightAsync(codeA, "tsx");
    await highlightAsync(codeB, "tsx");

    // Re-requesting codeA must still return a SYNCHRONOUS cache hit for its
    // OWN content — never codeB's.
    const againA = highlightCode(codeA, "tsx");
    expect(againA).not.toBeNull();
    expect(flattenTokenContent(againA!)).toBe(codeA);
    expect(flattenTokenContent(againA!)).not.toBe(codeB);
  });
});

describe("highlightCode tokensCache is bounded (perf review 1.4a — LRU ~200 entries)", () => {
  it("evicts the least-recently-used entry once the cache exceeds its cap", async () => {
    const codes = Array.from({ length: 205 }, (_, i) => `const lruEvictionProbe_${i} = ${i};`);

    for (const code of codes) {
      // Sequential on purpose: each must actually populate the cache (and
      // become the most-recently-used entry) before the next one runs.

      await highlightAsync(code, "tsx");
    }

    // The very first entry inserted is the least-recently-used once 205 > the
    // 200-entry cap — it must have been evicted, so re-requesting it is a
    // cache MISS (highlightCode returns null synchronously and kicks off a
    // fresh async highlight instead).
    expect(highlightCode(codes[0] as string, "tsx")).toBeNull();

    // The most recently inserted entry is still a synchronous cache hit.
    expect(highlightCode(codes[204] as string, "tsx")).not.toBeNull();
  });
});

describe("highlightCode skipCache (perf review 1.4a — never permanently cache mid-stream)", () => {
  it("does not persist a highlight into the shared cache when skipCache is set", async () => {
    const code = "const streamingSkipCacheProbe = 'a';";
    await highlightAsync(code, "tsx", undefined, true);

    // A later, non-streaming request for the EXACT same code is a cache
    // MISS — the streaming pass never wrote it in.
    expect(highlightCode(code, "tsx")).toBeNull();
  });

  it("still persists an ordinary (non-streaming) highlight", async () => {
    const code = "const nonStreamingCacheProbe = 'b';";
    await highlightAsync(code, "tsx");

    expect(highlightCode(code, "tsx")).not.toBeNull();
  });
});
