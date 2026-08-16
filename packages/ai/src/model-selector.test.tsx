import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { MODEL_SELECTOR_LOGO_BASE_URL, ModelSelectorLogo } from "./model-selector";

describe("ModelSelectorLogo — remote origin escape hatches", () => {
  it("defaults to the models.dev logo for the provider", () => {
    render(<ModelSelectorLogo provider="anthropic" />);
    expect(screen.getByRole("img", { name: "anthropic logo" })).toHaveAttribute(
      "src",
      `${MODEL_SELECTOR_LOGO_BASE_URL}/anthropic.svg`,
    );
  });

  it("lets a caller override src for a self-hosted asset", () => {
    // The old props type did `Omit<…, "src">` AND spread props before `src=`, so
    // a self-hosting consumer had no way to win. Both are fixed.
    render(<ModelSelectorLogo provider="anthropic" src="/local/anthropic.svg" />);
    expect(screen.getByRole("img", { name: "anthropic logo" })).toHaveAttribute(
      "src",
      "/local/anthropic.svg",
    );
  });

  it("renders a neutral glyph instead of a broken image when the load fails", () => {
    render(<ModelSelectorLogo provider="anthropic" />);
    fireEvent.error(screen.getByRole("img", { name: "anthropic logo" }));

    const fallback = screen.getByRole("img", { name: "anthropic logo" });
    expect(fallback.tagName.toLowerCase()).toBe("svg");
    expect(fallback).not.toHaveAttribute("src");
  });

  it("renders a caller-supplied fallback when provided", () => {
    render(<ModelSelectorLogo provider="anthropic" fallback={<span data-testid="fb">AI</span>} />);
    fireEvent.error(screen.getByRole("img", { name: "anthropic logo" }));
    expect(screen.getByTestId("fb")).toBeInTheDocument();
  });

  it("still calls a caller's onError", () => {
    const onError = vi.fn();
    render(<ModelSelectorLogo provider="anthropic" onError={onError} />);
    fireEvent.error(screen.getByRole("img", { name: "anthropic logo" }));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("keeps an accessible name in both states", () => {
    const { rerender } = render(<ModelSelectorLogo provider="openai" />);
    expect(screen.getByRole("img", { name: "openai logo" })).toBeInTheDocument();

    fireEvent.error(screen.getByRole("img", { name: "openai logo" }));
    rerender(<ModelSelectorLogo provider="openai" />);
    expect(screen.getByRole("img", { name: "openai logo" })).toBeInTheDocument();
  });
});
