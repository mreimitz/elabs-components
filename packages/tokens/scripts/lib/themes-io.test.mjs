/**
 * themes-io.test.mjs — locks the #401 comment-swallowing bug in
 * `parseScopedTokens` (the themes.css → DTCG re-seeding parser's scanner).
 *
 * Run via `pnpm --filter @elabs/components-tokens test` (vitest).
 *
 * `themes.css` documents its own tokens inline, so a comment sitting directly
 * above a declaration routinely contains a `--token:`-shaped substring (see
 * the real comment above light's `--ring` in
 * packages/tokens/src/themes.css:826-834, which mentions `--info:`). Before
 * the #401 fix, `parseScopedTokens` scanned the raw block body with a lazy
 * `[^;]*?` regex that started matching INSIDE such a comment and consumed
 * through to the semicolon of the NEXT real declaration — silently dropping
 * that declaration from the parsed token list. This is the same class of bug
 * already fixed in `scripts/check-role-distinctness.mjs` (commit 22ca442).
 */
import { describe, it, expect } from "vitest";
import { parseScopedTokens } from "./themes-io.mjs";

describe("parseScopedTokens — comment blindness (#401)", () => {
  it("does not swallow a real declaration preceded by a comment mentioning another --token:", () => {
    const body = `
  /* mentions --other-token: in prose here, not a real declaration */
  --chart-1: oklch(0.55 0.2 300);
`;
    const tokens = parseScopedTokens(body);
    const names = tokens.map((t) => t.name);
    expect(names).toContain("--chart-1");
    expect(tokens.find((t) => t.name === "--chart-1")?.value).toBe("oklch(0.55 0.2 300)");
    // The comment's own `--token:`-shaped mention must never surface as a
    // (garbled) parsed entry either.
    expect(names).not.toContain("--other-token");
  });

  it("still parses a var() alias correctly when the alias name is also mentioned in a preceding comment", () => {
    const body = `
  /* --sidebar-primary mirrors --primary (#385) */
  --sidebar-primary: var(--primary);
`;
    const tokens = parseScopedTokens(body);
    expect(tokens.find((t) => t.name === "--sidebar-primary")?.value).toBe("var(--primary)");
  });
});
