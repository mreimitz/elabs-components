import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkipLink } from "./skip-link";

describe("SkipLink", () => {
  it("points at the main landmark and is reachable by keyboard", () => {
    render(<SkipLink />);
    const link = screen.getByRole("link", { name: "Skip to main content" });
    expect(link).toHaveAttribute("href", "#main-content");
    expect(link).not.toHaveAttribute("tabindex", "-1");
  });

  it("accepts a different target", () => {
    render(<SkipLink targetId="reading-pane">Skip to the message</SkipLink>);
    expect(screen.getByRole("link", { name: "Skip to the message" })).toHaveAttribute(
      "href",
      "#reading-pane",
    );
  });
});
