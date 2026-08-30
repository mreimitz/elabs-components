import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "../locale-provider";
import { PaginationEllipsis, PaginationNext, PaginationPrevious } from "./pagination";

/**
 * Pagination had no test file before #18 — its three microcopy sites
 * (Previous/Next reuse the generic keys, the ellipsis's sr-only "More pages"
 * is a new namespaced key) are locked here.
 */
describe("Pagination — microcopy (#18)", () => {
  it("PaginationPrevious/PaginationNext keep their shipped English labels", () => {
    render(
      <>
        <PaginationPrevious />
        <PaginationNext />
      </>,
    );
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("PaginationEllipsis keeps its shipped sr-only 'More pages' text", () => {
    render(<PaginationEllipsis />);
    expect(screen.getByText("More pages")).toHaveClass("sr-only");
  });

  it("translates all three via a LocaleProvider (generic + namespaced keys)", () => {
    render(
      <LocaleProvider
        locale="de-DE"
        messages={{
          previous: "Zurück",
          next: "Weiter",
          "ui.pagination.morePages": "Weitere Seiten",
        }}
      >
        <PaginationPrevious />
        <PaginationNext />
        <PaginationEllipsis />
      </LocaleProvider>,
    );
    expect(screen.getByText("Zurück")).toBeInTheDocument();
    expect(screen.getByText("Weiter")).toBeInTheDocument();
    expect(screen.getByText("Weitere Seiten")).toHaveClass("sr-only");
  });
});
