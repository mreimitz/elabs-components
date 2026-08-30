import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LocaleProvider } from "../locale-provider";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "./breadcrumb";
describe("Breadcrumb", () => {
  it("renders the current page", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Here</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(screen.getByText("Here")).toHaveAttribute("aria-current", "page");
  });
});

describe("BreadcrumbEllipsis — microcopy (#18)", () => {
  it("keeps its shipped sr-only 'More' text with no LocaleProvider", () => {
    render(<BreadcrumbEllipsis />);
    expect(screen.getByText("More")).toHaveClass("sr-only");
  });

  it("translates via the reused generic `more` key under a LocaleProvider", () => {
    render(
      <LocaleProvider locale="de-DE" messages={{ more: "Mehr" }}>
        <BreadcrumbEllipsis />
      </LocaleProvider>,
    );
    expect(screen.getByText("Mehr")).toHaveClass("sr-only");
  });
});
