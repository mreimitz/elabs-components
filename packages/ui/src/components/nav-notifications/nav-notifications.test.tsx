import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("caps the menu width so it never overflows a narrow viewport", async () => {
    const user = userEvent.setup();
    render(<NavNotifications notifications={notifications} />);
    await user.click(screen.getByRole("button", { name: "Open notifications" }));
    const menu = await screen.findByRole("menu");
    // Without a max-width cap, the fixed `w-80` (320px) menu forces horizontal
    // overflow on any viewport narrower than ~336px.
    expect(menu.className).toContain("max-w-[calc(100vw-2rem)]");
  });
});
