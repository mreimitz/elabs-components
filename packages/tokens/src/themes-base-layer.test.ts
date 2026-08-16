/**
 * themes-base-layer.test.ts — invariants of the `@layer base` rules the token
 * stylesheet ships to every consumer.
 *
 * These are properties a consumer inherits by importing `styles.css` alone, so
 * a refactor that drops one is silent: nothing fails to compile, no component
 * changes, the UI just renders subtly wrong everywhere. Source-parsed for the
 * same reason themes-contrast.test.ts is — jsdom neither applies `@layer` rules
 * from a raw stylesheet nor models vendor font-smoothing properties, so a
 * computed-style assertion there would prove nothing.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(__dirname, "themes.css"), "utf8");

/** The `body { … }` declaration block inside `@layer base`. */
function baseBodyBlock(): string {
  const layer = css.match(/@layer base \{([\s\S]*)/)?.[1];
  if (!layer) throw new Error("themes.css has no `@layer base` block");
  const body = layer.match(/\n {2}body \{([\s\S]*?)\n {2}\}/)?.[1];
  if (!body) throw new Error("`@layer base` has no `body { … }` rule");
  return body;
}

describe("themes.css — @layer base body", () => {
  // #345 — the self-hosted UI faces are drawn for grayscale antialiasing.
  // Without these two lines WebKit/Blink subpixel-render them a weight heavier
  // than designed, and every consuming app re-discovers the same local fix.
  // Shipping it here is the whole point; a refactor must not drop it.
  it.each([
    ["-webkit-font-smoothing", "antialiased"],
    ["-moz-osx-font-smoothing", "grayscale"],
  ])("declares %s: %s", (property, value) => {
    expect(baseBodyBlock()).toMatch(new RegExp(`${property}\\s*:\\s*${value}\\s*;`));
  });

  // The document-level ground/ink pairing every theme re-colors.
  it.each(["background-color", "color"])("declares %s from a token", (property) => {
    expect(baseBodyBlock()).toMatch(new RegExp(`${property}\\s*:\\s*var\\(--color-`));
  });
});
