import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Alert, AlertDescription, AlertTitle } from "./alert";
describe("Alert", () => {
  it("renders with role=alert and a title", () => {
    render(
      <Alert>
        <AlertTitle>Heads up</AlertTitle>
      </Alert>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Heads up")).toBeInTheDocument();
  });

  // --- AlertTitle `as` seam + ref-type fix (#329) ---
  it("AlertTitle defaults to <h5> (byte-identical to pre-#329 output)", () => {
    render(<AlertTitle>Default level</AlertTitle>);
    const heading = screen.getByRole("heading", { level: 5, name: "Default level" });
    expect(heading.tagName).toBe("H5");
  });

  it("AlertTitle renders the requested heading level via `as` (#329)", () => {
    render(<AlertTitle as="h3">Inline error</AlertTitle>);
    const heading = screen.getByRole("heading", { level: 3, name: "Inline error" });
    expect(heading.tagName).toBe("H3");
    expect(heading).toHaveClass("mb-1", "font-medium", "leading-none", "tracking-tight");
  });

  // --- AlertDescription `measure` cap (#339) ---
  it("AlertDescription has no max-w cap by default (#339)", () => {
    render(<AlertDescription>Short note</AlertDescription>);
    expect(screen.getByText("Short note")).not.toHaveClass("max-w-prose");
  });

  it("AlertDescription caps to a readable measure when `measure` is set (#339)", () => {
    render(
      <AlertDescription measure>
        Genuine prose that should not run edge to edge in a wide alert.
      </AlertDescription>,
    );
    const el = screen.getByText(/Genuine prose/);
    expect(el).toHaveClass("max-w-prose");
    expect(el).toHaveClass("text-muted-foreground");
  });

  // role override seam (#191, research 11 §B.3): a pending decision with
  // focusable controls must be a labelled region, not an assertive live region.
  it("accepts a role override (default stays alert)", () => {
    render(
      <Alert aria-label="Pending decision" role="group">
        <AlertTitle>Approve this?</AlertTitle>
      </Alert>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Pending decision" })).toBeInTheDocument();
  });
});
