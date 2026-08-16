import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SidebarProvider } from "../sidebar";
import { AppSidebar } from "./app-sidebar";

function Wrapper({ children }: { children: React.ReactNode }) {
  return <SidebarProvider>{children}</SidebarProvider>;
}

describe("AppSidebar", () => {
  it("renders children in the content slot", () => {
    render(
      <Wrapper>
        <AppSidebar>
          <div>nav content</div>
        </AppSidebar>
      </Wrapper>,
    );
    expect(screen.getByText("nav content")).toBeInTheDocument();
  });

  it("renders header slot when provided", () => {
    render(
      <Wrapper>
        <AppSidebar header={<div>sidebar header</div>}>
          <div>nav</div>
        </AppSidebar>
      </Wrapper>,
    );
    expect(screen.getByText("sidebar header")).toBeInTheDocument();
  });

  it("renders footer slot when provided", () => {
    render(
      <Wrapper>
        <AppSidebar footer={<div>sidebar footer</div>}>
          <div>nav</div>
        </AppSidebar>
      </Wrapper>,
    );
    expect(screen.getByText("sidebar footer")).toBeInTheDocument();
  });

  it("omits header DOM node when header prop is not provided", () => {
    render(
      <Wrapper>
        <AppSidebar footer={<div>footer</div>}>
          <div>nav</div>
        </AppSidebar>
      </Wrapper>,
    );
    expect(screen.getByText("footer")).toBeInTheDocument();
    expect(screen.getByText("nav")).toBeInTheDocument();
  });
});
