// @vitest-environment jsdom
/**
 * Locks #552: the "Jump to the matrix" card must point at the integration matrix. The matrix
 * (`WorksWith`, `id="works-with"`) lives on `/agents`, not this page — a bare `#works-with`
 * fragment would be a dead anchor here, so the fix is a cross-page link, not a same-page one.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouteCards } from "./route-cards";
import { routeCardsCopy } from "../../content/copy";

describe("RouteCards", () => {
  it('the "Jump to the matrix" card links to the works-with section on /agents', () => {
    render(<RouteCards />);
    const link = screen.getByRole("link", { name: routeCardsCopy.pointAgent.action });
    expect(link.getAttribute("href")).toBe("/agents#works-with");
  });

  it("does not link to #agents (the matrix is two sections below that id)", () => {
    render(<RouteCards />);
    const link = screen.getByRole("link", { name: routeCardsCopy.pointAgent.action });
    expect(link.getAttribute("href")).not.toBe("#agents");
  });
});
