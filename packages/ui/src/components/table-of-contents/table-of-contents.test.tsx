import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TableOfContents } from "./table-of-contents";

const ITEMS = [
  { id: "one", label: "One" },
  { id: "two", label: "Two", level: 2 as const },
  { id: "three", label: "Three" },
];

function Sections() {
  return (
    <>
      {ITEMS.map((item) => (
        <section id={item.id} key={item.id}>
          {item.label}
        </section>
      ))}
    </>
  );
}

describe("TableOfContents", () => {
  it("renders a named navigation landmark with one link per item and the current one marked", () => {
    render(<TableOfContents activeId="two" items={ITEMS} />);
    const nav = screen.getByRole("navigation", { name: "On this page" });
    expect(nav).toHaveAttribute("data-slot", "table-of-contents");
    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Two" })).toHaveAttribute("aria-current", "location");
    expect(screen.getByRole("link", { name: "One" })).not.toHaveAttribute("aria-current");
    // Nested entries indent, so depth is visible without colour.
    expect(screen.getByRole("link", { name: "Two" }).className).toMatch(/\bps-8\b/);
  });

  it("title={null} drops the eyebrow but keeps the landmark name", () => {
    render(<TableOfContents activeId="one" items={ITEMS} title={null} />);
    expect(screen.getByRole("navigation", { name: "On this page" })).toBeInTheDocument();
    expect(document.querySelector('[data-slot="table-of-contents-title"]')).toBeNull();
  });

  it("click: scrolls the section into view, updates the hash, focuses the section, reports the change", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const onActiveChange = vi.fn();
    render(
      <>
        <Sections />
        <TableOfContents items={ITEMS} onActiveChange={onActiveChange} />
      </>,
    );
    await userEvent.click(screen.getByRole("link", { name: "Three" }));

    expect(scrollIntoView).toHaveBeenCalledWith(expect.objectContaining({ block: "start" }));
    expect(window.location.hash).toBe("#three");
    expect(document.getElementById("three")).toHaveFocus();
    expect(onActiveChange).toHaveBeenLastCalledWith("three");
    expect(screen.getByRole("link", { name: "Three" })).toHaveAttribute("aria-current", "location");
  });

  it('scroll="native" leaves the click to the browser', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(
      <>
        <Sections />
        <TableOfContents activeId="one" items={ITEMS} scroll="native" />
      </>,
    );
    await userEvent.click(screen.getByRole("link", { name: "Two" }));
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("spreads props and merges className onto the nav", () => {
    render(<TableOfContents className="mt-2" data-testid="toc" items={ITEMS} />);
    expect(screen.getByTestId("toc").className).toMatch(/\bmt-2\b/);
  });
});
