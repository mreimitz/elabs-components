import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
describe("Popover", () => {
  it("opens content on trigger click", async () => {
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Inside</PopoverContent>
      </Popover>,
    );
    await userEvent.click(screen.getByText("Open"));
    expect(await screen.findByText("Inside")).toBeInTheDocument();
  });
});
