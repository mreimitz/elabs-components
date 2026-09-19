import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTableCard, DataTableCardList } from "./card-layout";

describe("card-layout", () => {
  it("renders one list item per card with a <dl> of term → detail pairs", () => {
    render(
      <DataTableCardList aria-label="Cities">
        <DataTableCard
          fields={[
            { id: "city", term: "City", value: "Oslo" },
            { id: "pop", term: "Population", value: "709,000" },
          ]}
        />
      </DataTableCardList>,
    );
    expect(screen.getByRole("list", { name: "Cities" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    const terms = screen.getAllByRole("term");
    expect(terms.map((t) => t.textContent)).toEqual(["City", "Population"]);
    expect(screen.getAllByRole("definition").map((d) => d.textContent)).toEqual([
      "Oslo",
      "709,000",
    ]);
  });
});
