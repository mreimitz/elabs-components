import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { oklchToHex } from "@elabs-ai/components-tokens";
import { BAR_CELL_NEGATIVE_COLOR, BAR_CELL_POSITIVE_COLOR, BarCell } from "./bar-cell";

describe("BarCell", () => {
  it("keeps the printed value and sizes the bar against the domain", () => {
    const { container, getByText } = render(
      <BarCell value={20} label="20" domain={[0, 40]} track />,
    );
    expect(getByText("20")).toBeInTheDocument();
    const bar = container.querySelector<HTMLElement>('[data-slot="bar-cell-bar"]');
    expect(bar?.style.width).toBe("50%");
    expect(bar?.style.backgroundColor).toBe(BAR_CELL_POSITIVE_COLOR);
    expect(container.querySelector('[data-slot="bar-cell-track"]')).toHaveClass("bg-muted");
  });
  it("paints a negative value in the negative token, left of zero, with a zero rule", () => {
    const { container } = render(<BarCell value={-5} label="-5" domain={[-5, 20]} />);
    const bar = container.querySelector<HTMLElement>('[data-slot="bar-cell-bar"]');
    expect(bar?.style.backgroundColor).toBe(BAR_CELL_NEGATIVE_COLOR);
    expect(bar?.style.insetInlineStart).toBe("0%");
    expect(bar?.style.width).toBe("20%");
    expect(container.querySelector('[data-slot="bar-cell-zero"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="bar-cell"]')).toHaveAttribute(
      "data-negative",
      "true",
    );
  });
  it("reserves one value box per column, so a shorter number gets no longer bar", () => {
    // Same reservation, different label lengths: the track (and therefore every
    // bar drawn in it) is the same length on both rows.
    const box = (label: string) => {
      const { container } = render(
        <BarCell value={10} label={label} domain={[0, 40]} labelWidth={7} />,
      );
      return container.querySelector<HTMLElement>('[data-slot="bar-cell-value"]')?.style.width;
    };
    expect(box("+12.5 %")).toBe("7ch");
    expect(box("-4.2 %")).toBe("7ch");
    // A slim bar sits UNDER its value and spans the cell: nothing to reserve.
    const { container } = render(
      <BarCell value={10} label="-4.2 %" domain={[0, 40]} variant="slim" labelWidth={7} />,
    );
    expect(container.querySelector<HTMLElement>('[data-slot="bar-cell-value"]')?.style.width).toBe(
      "",
    );
  });
  it("keeps the slim track off the column flex axis, so the mark has height", () => {
    // `flex-1` is `flex: 1 1 0%`: in the slim variant the parent is a COLUMN,
    // so that would resolve the track's HEIGHT to 0 and paint nothing.
    const { container } = render(
      <BarCell value={10} label="25 %" domain={[0, 40]} variant="slim" track />,
    );
    const slim = container.querySelector('[data-slot="bar-cell-track"]');
    expect(slim).toHaveClass("h-1", "w-full", "shrink-0");
    expect(slim).not.toHaveClass("flex-1");
    const { container: regular } = render(
      <BarCell value={10} label="25 %" domain={[0, 40]} track />,
    );
    const row = regular.querySelector('[data-slot="bar-cell-track"]');
    expect(row).toHaveClass("h-3", "flex-1");
  });
  it("uses a category colour for positive bars; negative: false keeps it on negatives", () => {
    const { container } = render(
      <BarCell
        value={-2}
        label="-2"
        domain={[-5, 5]}
        fillColor="var(--chart-3)"
        negativeColor={false}
      />,
    );
    expect(
      container.querySelector<HTMLElement>('[data-slot="bar-cell-bar"]')?.style.backgroundColor,
    ).toBe("var(--chart-3)");
  });
});

/**
 * b-4 — an in-cell bar is a mark whose LENGTH is the message, so it is a
 * "graphical object required to understand the content" (WCAG 1.4.11, ≥ 3:1)
 * and the house status-rung rule asks the same of a fill that IS the mark, in
 * EVERY theme. Before this test the positive fill was `--chart-1`, a
 * categorical token with no contrast guarantee that measures 1.42:1 on `--card`
 * in `light` (a signed-off palette exemption — see `CHART_1411_EXEMPT` in
 * packages/tokens/src/charts-contrast.test.ts). The token is not the bug; using
 * a token that carries no guarantee for a mark that needs one is.
 *
 * Reads the shipped theme stylesheets rather than a copied number, so a retune
 * that drops either fill below the bar fails here instead of shipping.
 */
describe("BarCell — the fills clear the 1.4.11 mark bar in every theme", () => {
  const THEMES = ["light", "dark"] as const;

  /** The shipped stylesheet for `theme`, found by walking up from the cwd. */
  function themeCssPath(theme: (typeof THEMES)[number]): string {
    let dir = process.cwd();
    for (let up = 0; up < 6; up++) {
      const candidate = join(dir, "packages/tokens/src/themes", `${theme}.css`);
      if (existsSync(candidate)) return candidate;
      dir = dirname(dir);
    }
    throw new Error(`No theme stylesheet found for "${theme}" above ${process.cwd()}`);
  }

  function themeTokens(theme: (typeof THEMES)[number]): Map<string, string> {
    const css = readFileSync(themeCssPath(theme), "utf8");
    const map = new Map<string, string>();
    for (const [, name, value] of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      map.set(name as string, (value as string).trim());
    }
    return map;
  }

  /** `var(--x)` → the token's own oklch value in `theme`, following aliases. */
  function resolve(tokens: Map<string, string>, ref: string): string {
    let value = ref;
    for (let hop = 0; hop < 8 && value.startsWith("var("); hop++) {
      value = tokens.get(value.slice(4, value.indexOf(")")).trim()) ?? "";
    }
    return value;
  }

  /** WCAG 2.x relative luminance of `#rrggbb`. */
  function luminance(hex: string): number {
    const channel = (i: number) => {
      const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  }

  function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
  }

  it.each(THEMES)("%s: both bar fills are ≥ 3:1 on --card and on the bg-muted track", (theme) => {
    const tokens = themeTokens(theme);
    const card = oklchToHex(resolve(tokens, "var(--card)"));
    const track = oklchToHex(resolve(tokens, "var(--muted)"));
    expect(card, `${theme}: --card`).not.toBeNull();
    expect(track, `${theme}: --muted`).not.toBeNull();
    for (const fill of [BAR_CELL_POSITIVE_COLOR, BAR_CELL_NEGATIVE_COLOR]) {
      const hex = oklchToHex(resolve(tokens, fill));
      expect(hex, `${theme}: ${fill}`).not.toBeNull();
      expect(contrast(hex as string, card as string), `${fill} on --card`).toBeGreaterThanOrEqual(
        3,
      );
      expect(
        contrast(hex as string, track as string),
        `${fill} on the --muted track`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
