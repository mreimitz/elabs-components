import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeProvider, defineTheme } from "@elabs-ai/components-tokens";

import { DashboardThemeScope } from "./dashboard-theme-scope";

const CUSTOM_THEMES = [
  defineTheme({ value: "custom-light", label: "Custom Light", dark: false, family: "custom" }),
  defineTheme({ value: "custom-dark", label: "Custom Dark", dark: true, family: "custom" }),
];

describe("DashboardThemeScope", () => {
  it("renders children unwrapped when there is no theme override", () => {
    render(
      <ThemeProvider storageKey={null}>
        <DashboardThemeScope>
          <div data-testid="child">content</div>
        </DashboardThemeScope>
      </ThemeProvider>,
    );
    const scope = screen.getByTestId("child").parentElement as HTMLElement;
    expect(scope.getAttribute("data-slot")).toBe("dashboard-theme-scope");
    expect(scope.getAttribute("data-theme")).toBeNull();
  });

  it("resolves a family + mode against a host registry, scoped to its own root", () => {
    render(
      <ThemeProvider storageKey={null}>
        <DashboardThemeScope theme={{ family: "custom", mode: "dark" }} themes={CUSTOM_THEMES}>
          <div data-testid="child">content</div>
        </DashboardThemeScope>
      </ThemeProvider>,
    );
    const scope = screen.getByTestId("child").parentElement as HTMLElement;
    expect(scope.getAttribute("data-theme")).toBe("custom-dark");
    expect(document.documentElement.getAttribute("data-theme")).not.toBe("custom-dark");
  });

  it("computed --background on the scope root differs from the document root", () => {
    render(
      <ThemeProvider storageKey={null}>
        <DashboardThemeScope theme={{ overrides: { "--background": "oklch(0.2 0 0)" } }}>
          <div data-testid="child">content</div>
        </DashboardThemeScope>
      </ThemeProvider>,
    );
    const scope = screen.getByTestId("child").parentElement as HTMLElement;
    const scopedBackground = getComputedStyle(scope).getPropertyValue("--background").trim();
    const pageBackground = getComputedStyle(document.documentElement)
      .getPropertyValue("--background")
      .trim();
    expect(scopedBackground).toBe("oklch(0.2 0 0)");
    expect(scopedBackground).not.toBe(pageBackground);
  });
});
