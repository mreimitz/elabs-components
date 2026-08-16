/**
 * Locking tests for slash-menu scroll-to-active (A2). The scroll + aria wiring
 * already ships (slash-widget.tsx), so these guard it from silent removal: the
 * popup must be a capped, scrollable listbox whose options carry stable ids (the
 * scroll / `aria-activedescendant` target), and the widget must scroll the active
 * option into view as ↑/↓ moves it. The live keyboard UX is covered in the
 * browser by slash-menu.stories.tsx.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";

import { SlashMenu, slashOptionId } from "./slash-menu";
import { BRAND_SLASH_COMMANDS } from "./brand-slash-commands";

describe("slash menu scroll-to-active (A2)", () => {
  it("renders a capped, scrollable listbox so the active row can scroll into view", () => {
    render(<SlashMenu commands={BRAND_SLASH_COMMANDS} activeId="brand-card" onSelect={() => {}} />);
    const list = screen.getByRole("listbox");
    expect(list.className).toMatch(/overflow-y-auto/);
    expect(list.className).toMatch(/max-h-/);
  });

  it("gives each option a stable id (the scroll + aria-activedescendant target)", () => {
    render(
      <SlashMenu
        commands={BRAND_SLASH_COMMANDS}
        activeId="brand-card"
        onSelect={() => {}}
        idPrefix="x"
      />,
    );
    const opt = document.getElementById(slashOptionId("x", "brand-card"));
    expect(opt).not.toBeNull();
    expect(opt?.getAttribute("role")).toBe("option");
    expect(opt?.getAttribute("aria-selected")).toBe("true");
  });

  it("the widget scrolls the active option into view and mirrors aria-activedescendant", () => {
    // This behavior lives in the widget's layout effects, which need a live
    // ProseMirror view to exercise — lock it at the source so it can't regress.
    const src = readFileSync(
      resolve(process.cwd(), "src/markdown-editor/slash/slash-widget.tsx"),
      "utf8",
    );
    expect(src).toMatch(/scrollIntoView\(\{\s*block:\s*"nearest"\s*\}\)/);
    expect(src).toMatch(/aria-activedescendant/);
    // The scroll effect re-runs as ↑/↓ changes the active row.
    expect(src).toMatch(/\[activeId\]/);
  });
});
