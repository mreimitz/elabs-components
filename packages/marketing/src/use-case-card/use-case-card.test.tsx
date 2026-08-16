import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { UseCaseCard } from "./use-case-card";

describe("UseCaseCard", () => {
  it("renders the title", () => {
    render(<UseCaseCard title="Financial Services" description="Analyze risk in real time" />);
    expect(screen.getByText("Financial Services")).toBeInTheDocument();
  });

  it("renders the description", () => {
    render(<UseCaseCard title="Financial Services" description="Analyze risk in real time" />);
    expect(screen.getByText("Analyze risk in real time")).toBeInTheDocument();
  });

  it("renders the tag when provided", () => {
    render(<UseCaseCard title="Healthcare" description="Patient data at scale" tag="Industry" />);
    expect(screen.getByText("Industry")).toBeInTheDocument();
  });

  it("renders the footer when provided", () => {
    render(<UseCaseCard title="Retail" description="Drive sales insights" footer="Learn more" />);
    expect(screen.getByText("Learn more")).toBeInTheDocument();
  });

  it("renders title as h3 heading", () => {
    render(<UseCaseCard title="Manufacturing" description="Optimize supply chains" />);
    expect(screen.getByRole("heading", { level: 3, name: "Manufacturing" })).toBeInTheDocument();
  });
});
