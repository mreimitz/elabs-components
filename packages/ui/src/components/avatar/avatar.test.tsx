import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar, AvatarFallback } from "./avatar";
describe("Avatar", () => {
  it("renders the fallback", () => {
    render(
      <Avatar>
        <AvatarFallback>MR</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText("MR")).toBeInTheDocument();
  });
});
