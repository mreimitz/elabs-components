import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Read the stylesheet as text. The repo runs vitest per-package (turbo /
// `--filter`), so cwd is the package root — `src/...` resolves deterministically.
const css = readFileSync(resolve(process.cwd(), "src/markdown-editor/markdown-editor.css"), "utf8");

/**
 * #309: `.ProseMirror` used to suppress the platform focus outline
 * (`outline: none`, repeated as a dead no-op at `:focus`) with no replacement
 * on the element itself — the only stand-in lived on a DIFFERENT element in a
 * different file (`markdown-editor.tsx`'s wrapper `focus-ring-within` class),
 * an implicit, unlocked, easily-overridden dependency raw CSS can't express.
 * jsdom doesn't apply real focus/outline rendering, so this locks the
 * stylesheet TEXT deterministically; `markdown-editor.stories.tsx`'s
 * `FocusIndicator` play is the rendered-surface proof (resolved computed
 * values, real contrast, both themes).
 */
describe("editor focus indicator CSS (regression, #309)", () => {
  it("gives the editable its own :focus-visible indicator with a real outline", () => {
    const focusVisibleRule = css.match(/\.milkdown-host \.ProseMirror:focus-visible\s*\{([^}]*)\}/);
    expect(
      focusVisibleRule,
      "expected a .milkdown-host .ProseMirror:focus-visible rule",
    ).not.toBeNull();
    const body = focusVisibleRule![1]!;
    expect(body).toMatch(/outline:\s*(?!none\b)\S/);
  });

  it("never suppresses the outline on a :focus/:focus-visible rule with nothing else in it", () => {
    // A rule whose ENTIRE body is `outline: none;` (whitespace only otherwise)
    // on a focus selector is exactly the dead-suppression defect #309 found —
    // catches a future edit re-adding `.ProseMirror:focus { outline: none; }`
    // (or a :focus-visible equivalent) with no compensating declaration.
    const focusRules = [...css.matchAll(/([.\w-]+:focus(?:-visible)?)\s*\{([^}]*)\}/g)];
    for (const [, selector, body] of focusRules) {
      const bareOutlineNone = /^\s*outline:\s*none;?\s*$/.test(body!);
      expect(
        bareOutlineNone,
        `${selector} suppresses outline with no replacement in the same rule`,
      ).toBe(false);
    }
  });

  it("no longer contains the dead .ProseMirror:focus { outline: none; } rule", () => {
    expect(css).not.toMatch(/\.milkdown-host \.ProseMirror:focus\s*\{\s*outline:\s*none;?\s*\}/);
  });
});
