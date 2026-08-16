import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Read the stylesheet as text. The repo runs vitest per-package (turbo /
// `--filter`), so cwd is the package root — `src/...` resolves deterministically.
const css = readFileSync(resolve(process.cwd(), "src/markdown-editor/markdown-editor.css"), "utf8");

/**
 * The editor's fill-height behavior lives in CSS (`markdown-editor.css`), which
 * jsdom does not lay out — so a render test can't observe it. Lock the rules
 * deterministically instead: assert the stylesheet still declares the flex-fill
 * chain that makes the editable grow to fill a definite-height parent. The
 * regression this guards is the editable staying content-sized (`min-height:
 * 9rem`) inside a tall pane, which also clips the caret-anchored `/` slash menu.
 * The real visual proof is the `FillsContainer` Storybook story.
 * (qlabs-components: editor-fill-height)
 */

describe("editor fill-height CSS (regression)", () => {
  it("makes .milkdown-host a column flex that fills its parent", () => {
    expect(css).toMatch(/\.milkdown-host\s*\{[^}]*display:\s*flex/);
    expect(css).toMatch(/\.milkdown-host\s*\{[^}]*flex-direction:\s*column/);
    expect(css).toMatch(/\.milkdown-host\s*\{[^}]*min-height:\s*100%/);
  });

  it("lets the Milkdown wrapper grow inside the host", () => {
    expect(css).toMatch(/\.milkdown-host\s+\.milkdown[^{]*\{[^}]*flex:\s*1 1 auto/);
  });

  it("lets the ProseMirror editing surface grow", () => {
    expect(css).toMatch(/\.milkdown-host\s+\.ProseMirror\.editor\s*\{[^}]*flex:\s*1 1 auto/);
  });
});
