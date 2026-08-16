import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardDescription, CardTitle } from "./card";

describe("Card", () => {
  it("renders a nested title", () => {
    render(
      <Card>
        <CardTitle>Hello</CardTitle>
      </Card>,
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  // --- CardTitle `as` seam (#328) ---
  it("CardTitle defaults to a <div> (byte-identical to pre-#328 output)", () => {
    render(<CardTitle>Title</CardTitle>);
    const el = screen.getByText("Title");
    expect(el.tagName).toBe("DIV");
  });

  it("CardTitle renders the requested heading level via `as`, joining the document outline (#328)", () => {
    render(<CardTitle as="h2">Section title</CardTitle>);
    const heading = screen.getByRole("heading", { level: 2, name: "Section title" });
    expect(heading.tagName).toBe("H2");
    expect(heading).toHaveClass("text-title", "leading-none");
  });

  // --- CardDescription `text-muted-foreground` drop (#336) ---
  it("CardDescription keeps its muted-foreground color class and actually balances (#336)", () => {
    render(<CardDescription>Body copy</CardDescription>);
    const el = screen.getByText("Body copy");
    // The real #336 regression was an invalid, misspelled utility name that
    // does not exist in Tailwind and emits zero CSS — tailwind-merge
    // classified it as an unrecognized text color and dropped
    // `text-muted-foreground` in favor of it. Assert the REAL rendered class
    // list (not a mocked cn()) contains the color AND the real `text-balance`
    // utility (which actually sets `text-wrap: balance`, finally also
    // delivering #148).
    expect(el).toHaveClass("text-muted-foreground");
    expect(el).toHaveClass("text-balance");
  });

  // --- CardDescription `measure` cap (#339) ---
  it("CardDescription has no max-w cap by default (#339)", () => {
    render(<CardDescription>Short subtitle</CardDescription>);
    expect(screen.getByText("Short subtitle")).not.toHaveClass("max-w-prose");
  });

  it("CardDescription caps to a readable measure when `measure` is set (#339)", () => {
    render(
      <CardDescription measure>Genuine prose that should not run edge to edge.</CardDescription>,
    );
    const el = screen.getByText(/Genuine prose/);
    expect(el).toHaveClass("max-w-prose");
    // measure must not regress the #336 fix
    expect(el).toHaveClass("text-muted-foreground");
  });

  it("uses the shared container radius rung (rounded-lg, not the ambiguous rounded-xl) (#19)", () => {
    render(<Card data-testid="card">x</Card>);
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("rounded-lg");
    expect(card).not.toHaveClass("rounded-xl");
  });

  // --- optional detail panel (#117) ---
  it("without `detail`, renders a plain card — no grid, no panel (backwards compatible)", () => {
    render(<Card data-testid="card">body</Card>);
    const card = screen.getByTestId("card");
    expect(card).not.toHaveClass("grid");
    expect(card.textContent).toBe("body");
  });

  it("with `detail` (fixed, the default), renders the panel beside the main content", () => {
    render(
      <Card data-testid="card" detail={<span>DETAIL</span>}>
        <span>MAIN</span>
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("grid");
    expect(screen.getByText("MAIN")).toBeInTheDocument();
    expect(screen.getByText("DETAIL")).toBeInTheDocument();
    expect(card.className).toContain("grid-cols-[minmax(0,1fr)_var(--card-detail-size)]");
  });

  it("with `detail` + hover, keeps the panel in the DOM but hides it from AT when collapsed", () => {
    render(
      <Card data-testid="card" detailReveal="hover" detail={<button>More</button>}>
        main
      </Card>,
    );
    const card = screen.getByTestId("card");
    // collapsed at rest; revealed on hover AND keyboard focus-within
    expect(card.className).toContain("grid-cols-[minmax(0,1fr)_0px]");
    expect(card.className).toContain(
      "focus-within:grid-cols-[minmax(0,1fr)_var(--card-detail-size)]",
    );
    // detail panel is in the DOM but hidden from AT at rest (aria-hidden=true, #141)
    const region = card.querySelector("[role='region']");
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute("aria-hidden", "true");
  });

  it("with `detail` + hover, detail region is labelled (landmark navigation, #141)", () => {
    render(
      <Card detailReveal="hover" detail={<span>info</span>} detailLabel="Card details">
        main
      </Card>,
    );
    const region = document.querySelector("[role='region']");
    expect(region).toHaveAttribute("aria-label", "Card details");
  });

  it("with `detail` (fixed), detail region is labelled and always visible to AT", () => {
    render(
      <Card data-testid="card" detail={<span>D</span>} detailLabel="More info">
        main
      </Card>,
    );
    // getByRole respects aria-hidden; fixed panel should NOT be aria-hidden
    const region = screen.getByRole("region", { name: "More info" });
    expect(region).toBeInTheDocument();
    expect(region).not.toHaveAttribute("aria-hidden");
  });

  it("supports bottom placement (a row grid track instead of a column)", () => {
    render(
      <Card data-testid="card" detailPlacement="bottom" detail={<span>D</span>}>
        m
      </Card>,
    );
    expect(screen.getByTestId("card").className).toContain(
      "grid-rows-[minmax(0,1fr)_var(--card-detail-size)]",
    );
  });

  it("drives the panel track from the --card-detail-size custom property (default + override)", () => {
    const { rerender } = render(
      <Card data-testid="card" detail="d">
        m
      </Card>,
    );
    expect(screen.getByTestId("card").style.getPropertyValue("--card-detail-size")).toBe("16rem");
    rerender(
      <Card data-testid="card" detail="d" detailSize="20rem">
        m
      </Card>,
    );
    expect(screen.getByTestId("card").style.getPropertyValue("--card-detail-size")).toBe("20rem");
  });
});
