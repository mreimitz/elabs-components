import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopNav } from "./top-nav";

describe("TopNav", () => {
  it("renders the original start/children/end flex row unchanged when center is not passed", () => {
    const { container } = render(
      <TopNav
        start={<span data-testid="start">Start</span>}
        end={<span data-testid="end">End</span>}
      >
        <span data-testid="children">Children</span>
      </TopNav>,
    );
    expect(screen.getByTestId("start")).toBeInTheDocument();
    expect(screen.getByTestId("children")).toBeInTheDocument();
    expect(screen.getByTestId("end")).toBeInTheDocument();
    // No grid layout — the plain flex row this shipped with.
    expect(container.querySelector('[data-slot="top-nav-center"]')).toBeNull();
    const header = container.querySelector("header") as HTMLElement;
    expect(header.className).not.toContain("grid");
  });

  it("switches to the 3-column centred grid when center is passed, and drops children", () => {
    const { container } = render(
      <TopNav
        start={<span data-testid="start">Start</span>}
        center={<span data-testid="center">Center</span>}
        end={<span data-testid="end">End</span>}
      >
        <span data-testid="children">Children</span>
      </TopNav>,
    );
    expect(screen.getByTestId("start")).toBeInTheDocument();
    expect(screen.getByTestId("center")).toBeInTheDocument();
    expect(screen.getByTestId("end")).toBeInTheDocument();
    // `children` is documented as ignored once `center` is supplied.
    expect(screen.queryByTestId("children")).not.toBeInTheDocument();

    const startSlot = container.querySelector('[data-slot="top-nav-start"]');
    const centerSlot = container.querySelector('[data-slot="top-nav-center"]');
    const endSlot = container.querySelector('[data-slot="top-nav-end"]');
    expect(startSlot).not.toBeNull();
    expect(centerSlot).not.toBeNull();
    expect(endSlot).not.toBeNull();
    expect(startSlot?.contains(screen.getByTestId("start"))).toBe(true);
    expect(centerSlot?.contains(screen.getByTestId("center"))).toBe(true);
    expect(endSlot?.contains(screen.getByTestId("end"))).toBe(true);

    const grid = centerSlot?.parentElement;
    expect(grid?.className).toContain("grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]");

    // DOM order: start, then center, then end — the reading order the grid's
    // column order is supposed to match.
    const slots = Array.from(grid?.children ?? []);
    expect(slots.indexOf(startSlot as Element)).toBeLessThan(slots.indexOf(centerSlot as Element));
    expect(slots.indexOf(centerSlot as Element)).toBeLessThan(slots.indexOf(endSlot as Element));
  });
});
