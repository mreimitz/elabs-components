// @vitest-environment jsdom
/**
 * theme-swatches.test.tsx — the first DOM render test in `apps/home` (its Vitest config is
 * `node` by design, no render tests exist yet, per `component-tiles.test.ts`'s doc comment); the
 * `// @vitest-environment jsdom` pragma above opts only this file into jsdom + React, without
 * touching the shared `apps/home/vitest.config.ts`.
 *
 * `useHydratedSiteTheme` (real hook: `../gallery/theme-control`) needs `ThemeProvider` context
 * and browser storage it isn't worth wiring up here, and `ThemePreview` renders a real
 * `MetricCard`/`Sparkline` from `@elabs-ai/components-charts` that isn't relevant to either
 * issue below — both are mocked out so the test exercises the real `ThemeSwatches` markup/ARIA
 * without either dependency.
 */
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../gallery/theme-control", () => ({
  useHydratedSiteTheme: () => {
    const [family, setFamily] = useState("default");
    return { family, setFamily, mode: "light" as const };
  },
}));

vi.mock("./theme-preview", () => ({
  ThemePreview: () => null,
}));

import { ThemeSwatches } from "./theme-swatches";

describe("ThemeSwatches", () => {
  // #590: the nine "Use" buttons used to share one accessible name, and the name itself
  // flipped ("Use: Claude" → "Active: Claude") on the same click that flips `aria-pressed` —
  // the double-ARIA-toggle anti-pattern. The accessible name must now stay "Use <family>"
  // before and after activation; only `aria-pressed` may change.
  it("keeps a swatch button's accessible name constant across press state, toggling only aria-pressed", () => {
    render(<ThemeSwatches />);
    const button = screen.getByRole("button", { name: "Use Claude" });
    expect(button.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(button);

    // Same accessible name still resolves the same element post-click.
    expect(screen.getByRole("button", { name: "Use Claude" })).toBe(button);
    expect(button.getAttribute("aria-pressed")).toBe("true");
  });

  it('gives every swatch button its own accessible name (family included, not just "Use")', () => {
    render(<ThemeSwatches />);
    expect(screen.getByRole("button", { name: "Use Default" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use Claude" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use Qlik" })).toBeTruthy();
  });

  // #591: the swatch-grid heading and the "Create your own theme" heading both hard-coded
  // `text-title` — identical to the section's own h2 — reading as flat. They now step down
  // per nesting level.
  it("steps the swatch-grid h3 and create-theme h4 down from text-title", () => {
    const { container } = render(<ThemeSwatches />);
    const h3 = container.querySelector("h3")!;
    const h4 = container.querySelector("h4")!;
    expect(h3.className.split(" ")).toContain("text-subtitle");
    expect(h3.className.split(" ")).not.toContain("text-title");
    expect(h4.className.split(" ")).toContain("text-heading-xs");
    expect(h4.className.split(" ")).not.toContain("text-title");
  });
});
