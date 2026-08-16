import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_META, type ThemeName } from "@elabs/components-tokens";

/**
 * Regression lock for #3: the Tailwind `dark:` custom variant in themes.css must
 * match EVERY dark-appearance theme. Components like CodeBlock select their dark
 * palette via `dark:` overrides; if a dark theme is missing from the variant it
 * renders light-on-dark (illegible). This catches a new dark theme being added
 * without updating the variant.
 */
const themesCssPath = [
  resolve(process.cwd(), "../tokens/src/themes.css"), // cwd = packages/ai
  resolve(process.cwd(), "packages/tokens/src/themes.css"), // cwd = repo root
  resolve(process.cwd(), "../../packages/tokens/src/themes.css"),
].find((candidate) => existsSync(candidate));

if (!themesCssPath) {
  throw new Error(`themes.css not found from ${process.cwd()}`);
}

const themesCss = readFileSync(themesCssPath, "utf8");

const darkVariant = themesCss.match(/@custom-variant dark \(([^;]*)\)/);
const darkVariantSelector = darkVariant?.[1] ?? "";

const darkThemes = (Object.keys(THEME_META) as ThemeName[]).filter((name) => THEME_META[name].dark);

describe("dark: custom variant", () => {
  it("is declared in themes.css", () => {
    expect(darkVariantSelector).not.toBe("");
  });

  it("covers at least the known dark themes (dark)", () => {
    expect(darkThemes).toEqual(expect.arrayContaining(["dark"]));
  });

  it.each(darkThemes)("matches [data-theme=%s]", (name) => {
    expect(darkVariantSelector).toContain(`[data-theme="${name}"]`);
  });
});
