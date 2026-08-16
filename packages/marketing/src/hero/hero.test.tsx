import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Hero } from "./hero";

describe("Hero", () => {
  it("renders the title", () => {
    render(<Hero title="Welcome to the platform" animate={false} />);
    expect(screen.getByText("Welcome to the platform")).toBeInTheDocument();
  });

  it("renders eyebrow label when provided", () => {
    render(<Hero title="Main Heading" eyebrow="New Release" animate={false} />);
    expect(screen.getByText("New Release")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <Hero title="Main Heading" description="This is the description text" animate={false} />,
    );
    expect(screen.getByText("This is the description text")).toBeInTheDocument();
  });

  it("renders actions when provided", () => {
    render(<Hero title="Main Heading" actions={<button>Get Started</button>} animate={false} />);
    expect(screen.getByRole("button", { name: "Get Started" })).toBeInTheDocument();
  });

  it("renders a section element in the document", () => {
    const { container } = render(<Hero title="Hello World" animate={false} />);
    expect(container.querySelector("section")).toBeInTheDocument();
  });

  it("renders title in an h1", () => {
    render(<Hero title="Big Headline" animate={false} />);
    expect(screen.getByRole("heading", { level: 1, name: "Big Headline" })).toBeInTheDocument();
  });
});
