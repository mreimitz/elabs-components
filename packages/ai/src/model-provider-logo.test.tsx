import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  MODEL_PROVIDER_LOGO_BASE_URL,
  ModelProviderLogo,
  ModelProviderLogoGroup,
} from "./model-provider-logo";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.colorScheme = "";
});

describe("ModelProviderLogo — remote origin escape hatches", () => {
  it("defaults to the models.dev logo for the provider", () => {
    render(<ModelProviderLogo provider="anthropic" />);
    expect(screen.getByRole("img", { name: "anthropic logo" })).toHaveAttribute(
      "src",
      `${MODEL_PROVIDER_LOGO_BASE_URL}/anthropic.svg`,
    );
  });

  it("lets a caller override src for a self-hosted asset", () => {
    // The old props type did `Omit<…, "src">` AND spread props before `src=`, so
    // a self-hosting consumer had no way to win. Both are fixed.
    render(<ModelProviderLogo provider="anthropic" src="/local/anthropic.svg" />);
    expect(screen.getByRole("img", { name: "anthropic logo" })).toHaveAttribute(
      "src",
      "/local/anthropic.svg",
    );
  });

  it("renders a neutral glyph instead of a broken image when the load fails", () => {
    render(<ModelProviderLogo provider="anthropic" />);
    fireEvent.error(screen.getByRole("img", { name: "anthropic logo" }));

    const fallback = screen.getByRole("img", { name: "anthropic logo" });
    expect(fallback.tagName.toLowerCase()).toBe("svg");
    expect(fallback).not.toHaveAttribute("src");
  });

  it("renders a caller-supplied fallback when provided", () => {
    render(<ModelProviderLogo provider="anthropic" fallback={<span data-testid="fb">AI</span>} />);
    fireEvent.error(screen.getByRole("img", { name: "anthropic logo" }));
    expect(screen.getByTestId("fb")).toBeInTheDocument();
  });

  it("still calls a caller's onError", () => {
    const onError = vi.fn();
    render(<ModelProviderLogo provider="anthropic" onError={onError} />);
    fireEvent.error(screen.getByRole("img", { name: "anthropic logo" }));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("keeps an accessible name in both states", () => {
    const { rerender } = render(<ModelProviderLogo provider="openai" />);
    expect(screen.getByRole("img", { name: "openai logo" })).toBeInTheDocument();

    fireEvent.error(screen.getByRole("img", { name: "openai logo" }));
    rerender(<ModelProviderLogo provider="openai" />);
    expect(screen.getByRole("img", { name: "openai logo" })).toBeInTheDocument();
  });
});

// Was `dark:invert` — a bare Tailwind dark: variant, which per theming.md only
// covers the two SHIPPED themes and misses any consumer-registered dark theme
// (ADR 0029, open theme registry). Now driven by `resolveThemeIsDark`, the
// same signal `Toaster` uses, so it follows the ACTIVE theme's own
// `color-scheme`, not a hardcoded theme name (review #1).
describe("ModelProviderLogo — theme-driven invert (review #1)", () => {
  it("does not invert under the light theme", () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(<ModelProviderLogo provider="anthropic" />);
    expect(screen.getByRole("img", { name: "anthropic logo" })).not.toHaveClass("invert");
  });

  it("inverts under the dark theme", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(<ModelProviderLogo provider="anthropic" />);
    expect(screen.getByRole("img", { name: "anthropic logo" })).toHaveClass("invert");
  });

  it("also inverts under a consumer-registered dark theme, not only the shipped one", () => {
    // A raw `dark:` utility only ever matches `data-theme="dark"` — this
    // is exactly the gap `resolveThemeIsDark`'s `color-scheme` reading closes.
    document.documentElement.setAttribute("data-theme", "midnight");
    document.documentElement.style.colorScheme = "dark";
    render(<ModelProviderLogo provider="anthropic" />);
    expect(screen.getByRole("img", { name: "anthropic logo" })).toHaveClass("invert");
  });
});

describe("ModelProviderLogoGroup — theme-driven backdrop (review #1)", () => {
  it("backs logos with --background in the light theme", () => {
    document.documentElement.setAttribute("data-theme", "light");
    const { container } = render(<ModelProviderLogoGroup />);
    expect(container.firstElementChild?.className).toContain("[&>img]:bg-background");
    expect(container.firstElementChild?.className).not.toContain("[&>img]:bg-foreground");
  });

  it("backs logos with --foreground in the dark theme", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    const { container } = render(<ModelProviderLogoGroup />);
    expect(container.firstElementChild?.className).toContain("[&>img]:bg-foreground");
    expect(container.firstElementChild?.className).not.toContain("[&>img]:bg-background");
  });
});
