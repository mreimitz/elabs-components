import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidebarProvider } from "../sidebar";
import { NavUser } from "./nav-user";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <SidebarProvider>{children}</SidebarProvider>;
}

describe("NavUser", () => {
  it("renders the user name and email in the trigger", () => {
    render(
      <Wrapper>
        <NavUser user={{ name: "Jane Doe", email: "jane@example.com" }} />
      </Wrapper>,
    );
    expect(screen.getAllByText("Jane Doe").length).toBeGreaterThan(0);
    expect(screen.getAllByText("jane@example.com").length).toBeGreaterThan(0);
  });

  it("derives two-letter initials from the name", () => {
    render(
      <Wrapper>
        <NavUser user={{ name: "John Smith", email: "j@example.com" }} />
      </Wrapper>,
    );
    expect(screen.getAllByText("JS").length).toBeGreaterThan(0);
  });

  it("opens the account menu with Settings and Sign out", async () => {
    const onSignOut = vi.fn();
    render(
      <Wrapper>
        <NavUser
          user={{ name: "Jane Doe", email: "jane@example.com" }}
          settingsHref="/settings"
          onSignOut={onSignOut}
        />
      </Wrapper>,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Jane Doe jane@example.com" }));
    expect(await screen.findByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
