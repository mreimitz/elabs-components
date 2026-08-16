import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NavNotifications } from "./nav-notifications";

describe("NavNotifications", () => {
  const notifications = [
    { id: "1", fallback: "AB", text: "New order received.", time: "10m ago" },
    { id: "2", fallback: "CD", text: "Server upgrade completed.", time: "1h ago" },
  ];

  it("renders the notifications trigger button", () => {
    render(<NavNotifications notifications={notifications} />);
    expect(screen.getByRole("button", { name: "Open notifications" })).toBeInTheDocument();
  });
});
