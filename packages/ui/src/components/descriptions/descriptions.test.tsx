import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Descriptions, DescriptionsItem } from "./descriptions";

describe("Descriptions", () => {
  it("renders a definition list with dt/dd pairs", () => {
    render(
      <Descriptions>
        <DescriptionsItem label="Name">Ada</DescriptionsItem>
        <DescriptionsItem label="Role">Maintainer</DescriptionsItem>
      </Descriptions>,
    );
    const term = screen.getByText("Name");
    expect(term.tagName).toBe("DT");
    expect(screen.getAllByRole("term")).toHaveLength(2);
    expect(screen.getByText("Ada").tagName).toBe("DD");
    expect(screen.getByText("Maintainer")).toBeInTheDocument();
  });

  it("applies tabular-nums to numeric values", () => {
    render(
      <Descriptions>
        <DescriptionsItem label="Records" numeric>
          1284
        </DescriptionsItem>
      </Descriptions>,
    );
    expect(screen.getByText("1284")).toHaveClass("tabular-nums");
  });

  it("renders a real <dl> element", () => {
    const { container } = render(
      <Descriptions>
        <DescriptionsItem label="Name">Ada</DescriptionsItem>
      </Descriptions>,
    );
    expect(container.querySelector("dl")).not.toBeNull();
    expect(container.querySelectorAll("dt")).toHaveLength(1);
    expect(container.querySelectorAll("dd")).toHaveLength(1);
  });
});
