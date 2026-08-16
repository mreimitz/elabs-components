import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarProvider } from "../sidebar";
import { TeamSwitcher } from "./team-switcher";

const IconStub = ({ className }: { className?: string }) => (
  <svg className={className} aria-hidden="true" />
);

function Wrapper({ children }: { children: React.ReactNode }) {
  return <SidebarProvider>{children}</SidebarProvider>;
}

describe("TeamSwitcher", () => {
  it("renders the active team name and plan", () => {
    render(
      <Wrapper>
        <TeamSwitcher
          teams={[
            { name: "Acme Inc.", logo: IconStub, plan: "Enterprise" },
            { name: "Beta Corp.", logo: IconStub, plan: "Free" },
          ]}
        />
      </Wrapper>,
    );
    expect(screen.getByText("Acme Inc.")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
  });

  it("renders nothing when teams array is empty", () => {
    const { container } = render(
      <Wrapper>
        <TeamSwitcher teams={[]} />
      </Wrapper>,
    );
    // No active team → inner returns null, so no trigger button
    expect(container.querySelector("[data-radix-dropdown-menu-trigger]")).toBeNull();
  });
});
