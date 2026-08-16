import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatsBand } from "./stats-band";

const stats = [
  { value: "10K+", label: "Customers" },
  { value: "99.9%", label: "Uptime" },
  { value: "500M", label: "Queries per day" },
  { value: "150+", label: "Countries" },
];

describe("StatsBand", () => {
  it("renders all stat values", () => {
    render(<StatsBand stats={stats} animate={false} />);
    expect(screen.getByText("10K+")).toBeInTheDocument();
    expect(screen.getByText("99.9%")).toBeInTheDocument();
    expect(screen.getByText("500M")).toBeInTheDocument();
    expect(screen.getByText("150+")).toBeInTheDocument();
  });

  it("renders all stat labels", () => {
    render(<StatsBand stats={stats} animate={false} />);
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Uptime")).toBeInTheDocument();
    expect(screen.getByText("Queries per day")).toBeInTheDocument();
    expect(screen.getByText("Countries")).toBeInTheDocument();
  });

  it("renders with a single stat", () => {
    render(<StatsBand stats={[{ value: "42", label: "Things" }]} animate={false} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Things")).toBeInTheDocument();
  });
});
