/**
 * cjk-font-locale.test.ts — Traditional Chinese gets its own font fallback
 * stack, distinct from Simplified Chinese (review finding on `themes.css`).
 *
 * The regression this locks: the CJK per-locale font seam
 * (`themes.css` § CJK PER-LOCALE FONT SEAM, issue #15) only declared
 * `:lang(zh)` and `:lang(ko)` overrides for `--font-cjk-sans`. Per the CSS
 * Selectors spec, `:lang(zh)` matches ANY language tag starting "zh-"
 * (zh-Hant, zh-TW, zh-HK included) — not only bare "zh" — so a document
 * declaring `<html lang="zh-TW">` (or zh-Hant / zh-HK) silently inherited the
 * Simplified-Chinese-oriented stack ("PingFang SC", "Microsoft YaHei", …)
 * meant for Simplified documents.
 *
 * The fix adds a MORE SPECIFIC block for `:lang(zh-Hant)`, `:lang(zh-TW)` and
 * `:lang(zh-HK)`, placed AFTER the bare `:lang(zh)` block so equal-specificity
 * cascade source order lets it win for those three subtags.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ENGINE_CSS_PATH } from "./_theme-css-source";

const css = readFileSync(ENGINE_CSS_PATH, "utf8");

/** The `--font-cjk-sans` value declared inside a given `:lang(...)` block's
 * braces — a narrow, purpose-built parser (not the general `@font-face`
 * parser in `fonts.test.ts`), scoped to exactly the selector text passed in. */
function fontCjkSansIn(selectorPattern: RegExp): string {
  const match = selectorPattern.exec(css);
  expect(match, `expected to find a block matching ${selectorPattern}`).not.toBeNull();
  const body = match?.[1] ?? "";
  const value = /--font-cjk-sans:\s*([^;]+);/.exec(body)?.[1]?.trim();
  expect(value, `expected --font-cjk-sans inside: ${body}`).toBeDefined();
  return value ?? "";
}

describe("CJK per-locale font seam — Traditional Chinese is distinct from Simplified (#15 follow-up)", () => {
  it("declares a bare :lang(zh) block (Simplified-oriented default)", () => {
    const value = fontCjkSansIn(/:lang\(zh\)\s*\{([^}]*)\}/);
    expect(value).toContain("PingFang SC");
  });

  it("declares a MORE SPECIFIC block for zh-Hant / zh-TW / zh-HK with a Traditional-oriented stack", () => {
    const value = fontCjkSansIn(/:lang\(zh-Hant\)[\s\S]*?\{([^}]*)\}/);
    expect(value).toContain("PingFang TC");
    // The exact regression: Traditional Chinese must NOT resolve to the
    // Simplified stack.
    expect(value).not.toContain("PingFang SC");
  });

  it("the zh-Hant/zh-TW/zh-HK block covers all three Traditional-Chinese subtags in one rule", () => {
    const match = /:lang\(zh-Hant\)[\s\S]*?\{[^}]*\}/.exec(css);
    expect(match).not.toBeNull();
    const rule = match?.[0] ?? "";
    expect(rule).toMatch(/:lang\(zh-Hant\)/);
    expect(rule).toMatch(/:lang\(zh-TW\)/);
    expect(rule).toMatch(/:lang\(zh-HK\)/);
  });

  it("places the zh-Hant/zh-TW/zh-HK override AFTER the bare :lang(zh) block — cascade source order is what makes it win", () => {
    const bareZhIndex = css.indexOf(":lang(zh) {");
    const traditionalIndex = css.indexOf(":lang(zh-Hant)");
    expect(bareZhIndex).toBeGreaterThan(-1);
    expect(traditionalIndex).toBeGreaterThan(-1);
    expect(traditionalIndex).toBeGreaterThan(bareZhIndex);
  });

  it("still declares :lang(ko) with its own distinct stack, unaffected by the zh-Hant addition", () => {
    const value = fontCjkSansIn(/:lang\(ko\)\s*\{([^}]*)\}/);
    expect(value).toContain("Apple SD Gothic Neo");
  });
});
