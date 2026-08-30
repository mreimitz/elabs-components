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

  // #12/#53 review (P2): the `aria-label` overrides visible text content as
  // the ACCESSIBLE NAME, so a non-English `LocaleProvider` that only
  // translated the visible `previous`/`next` span left screen-reader users
  // hearing hardcoded English regardless of locale.
  describe("accessible name (aria-label) is localized, not just the visible text", () => {
    it("defaults to the shipped English accessible names", () => {
      render(
        <>
          <PaginationPrevious />
          <PaginationNext />
        </>,
      );
      expect(screen.getByLabelText("Go to previous page")).toBeInTheDocument();
      expect(screen.getByLabelText("Go to next page")).toBeInTheDocument();
    });

    it("routes the aria-label through t() under a non-English LocaleProvider", () => {
      render(
        <LocaleProvider
          locale="de-DE"
          messages={{
            previous: "Zurück",
            next: "Weiter",
            "ui.pagination.previous": "Zur vorherigen Seite",
            "ui.pagination.next": "Zur nächsten Seite",
          }}
        >
          <PaginationPrevious />
          <PaginationNext />
        </LocaleProvider>,
      );
      const prev = screen.getByLabelText("Zur vorherigen Seite");
      const next = screen.getByLabelText("Zur nächsten Seite");
      // The visible text is translated too — the accessible name isn't just
      // masking untranslated visible content.
      expect(prev).toHaveTextContent("Zurück");
      expect(next).toHaveTextContent("Weiter");
      // Neither link's accessible name is the stale hardcoded English string.
      expect(screen.queryByLabelText("Go to previous page")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Go to next page")).not.toBeInTheDocument();
    });
  });
});
