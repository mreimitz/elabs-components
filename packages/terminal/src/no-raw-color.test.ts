import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Package-level guard (#117): no raw colour in `@elabs-ai/components-terminal`
 * component source.
 *
 * The CLI look-alike family reproduces a terminal's *information design*, not
 * a terminal's palette. Every colour it paints must come from the dedicated
 * `--terminal-*` / `--terminal-ansi-*` token group (#115) so the console is
 * THEMED rather than painted — that is the whole reason this package is
 * rule-compliant instead of an exemption to
 * `.claude/rules/styling-and-tokens.md`.
 *
 * ## What this test actually checks, stated honestly
 *
 * It scans the package's own `.ts`/`.tsx` source **with comments stripped**
 * (issue references like `#117` are hex-shaped and live in prose, so a naive
 * regex over raw bytes reports nothing but false positives) and fails on:
 *
 *   - a hex colour literal (`#rgb`, `#rrggbb`, `#rrggbbaa`),
 *   - a `rgb()` / `rgba()` / `hsl()` / `hsla()` colour function,
 *   - a Tailwind arbitrary colour value (`bg-[#fff]`, `text-[rgb(...)]`),
 *   - a raw Tailwind palette utility (`text-zinc-400`, `bg-emerald-500`) —
 *     these answer to no theme at all, which is the defect #124 had to sweep
 *     out of five other packages.
 *
 * ## What it does NOT check
 *
 * It reads source text, so it cannot see a colour a value computes at runtime,
 * one that arrives through a prop, or one a consumer passes in `className`.
 * Those are review's job. It also does not police `terminal-ansi.css`, whose
 * job is precisely to bind ANSI classes to the token group.
 */

/**
 * The one sanctioned exception, enumerated rather than pattern-matched so a
 * NEW raw colour cannot hide behind it.
 *
 * `interactive-terminal.tsx` hands a colour theme to xterm.js, which paints on
 * a canvas and therefore **cannot read a CSS custom property**. Its mapping
 * resolves every slot from the `--terminal-*` group at runtime; these literals
 * are the fallbacks used only when a token does not resolve (SSR, jsdom, a
 * consumer who imported no theme stylesheet), plus the two poles the WCAG AA
 * ink clamp pushes toward. See that file's own doc comments.
 */
const SANCTIONED: Readonly<Record<string, readonly string[]>> = {
  "interactive-terminal.tsx": ["#0b0e14", "#e5e7eb", "#000000", "#ffffff"],
};

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const COLOR_FN = /\b(?:rgba?|hsla?)\s*\(/g;
const ARBITRARY = /-\[(?:#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?)\()/g;
/**
 * Tailwind's own palette ramps. Deliberately a literal list of the family
 * names rather than "any word followed by a number" — the latter would flag
 * `grid-cols-2` and `gap-1` and be abandoned within a week.
 */
const RAW_PALETTE = new RegExp(
  String.raw`\b(?:bg|text|border|ring|fill|stroke|from|via|to|decoration|outline|shadow|accent|caret|divide|placeholder)-` +
    String.raw`(?:slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-` +
    String.raw`(?:50|100|200|300|400|500|600|700|800|900|950)\b`,
  "g",
);

/**
 * Strip `//` and block comments. Crude by design — it is only used to remove
 * prose before a colour scan, never to parse the language.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const SRC = join(import.meta.dirname, ".");

function sourceFiles(): string[] {
  return readdirSync(SRC)
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => !/\.(test|stories)\.tsx?$/.test(f))
    .sort();
}

describe("no raw colour in @elabs-ai/components-terminal source", () => {
  const files = sourceFiles();

  it("finds source to scan (a silent empty scan would pass vacuously)", () => {
    expect(files.length).toBeGreaterThan(3);
  });

  it.each(files)("%s paints only from the terminal token group", (file) => {
    const code = stripComments(readFileSync(join(SRC, file), "utf8"));
    const allowed = SANCTIONED[file] ?? [];

    const hex = [...code.matchAll(HEX)].map((m) => m[0]).filter((h) => !allowed.includes(h));
    const fns = [...code.matchAll(COLOR_FN)].map((m) => m[0]);
    const arbitrary = [...code.matchAll(ARBITRARY)].map((m) => m[0]);
    const palette = [...code.matchAll(RAW_PALETTE)].map((m) => m[0]);

    expect({ arbitrary, fns, hex, palette }).toEqual({
      arbitrary: [],
      fns: [],
      hex: [],
      palette: [],
    });
  });

  it("keeps the sanctioned list pinned to colours that are actually still there", () => {
    // A stale exception is an open door. If a fallback is deleted or renamed,
    // this fails and the list has to be re-derived rather than quietly widened.
    for (const [file, colors] of Object.entries(SANCTIONED)) {
      const code = readFileSync(join(SRC, file), "utf8");
      for (const color of colors) {
        expect(code, `${file} no longer contains sanctioned ${color}`).toContain(color);
      }
    }
  });
});
