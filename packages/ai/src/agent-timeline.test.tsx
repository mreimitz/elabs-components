import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Search } from "lucide-react";
import { AgentStep, AgentTimeline } from "./agent-timeline";
import {
  ChainOfThought,
  ChainOfThoughtContent,
  ChainOfThoughtHeader,
  ChainOfThoughtStep,
} from "./chain-of-thought";

describe("AgentTimeline / AgentStep (#192, research 10 §B.3)", () => {
  it("renders steps as list items on the canonical rail with status, badge and summary", () => {
    render(
      <AgentTimeline data-testid="timeline">
        <AgentStep
          icon={Search}
          status="complete"
          name="Searched financial filings"
          summary="3 documents"
        />
        <AgentStep status="running" name="Computing QoQ deltas" />
      </AgentTimeline>,
    );
    expect(screen.getByTestId("timeline").tagName).toBe("OL");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute("data-status", "complete");
    expect(items[1]).toHaveAttribute("data-status", "running");
    expect(screen.getByText("Complete")).toBeInTheDocument(); // StatusBadge label
    expect(screen.getByText("3 documents")).toBeInTheDocument();
    expect(screen.getByText("Searched financial filings")).toBeInTheDocument();
  });

  it("renders rich detail children under the node; hideBadge drops the badge", () => {
    render(
      <AgentTimeline>
        <AgentStep name="Queried finance.revenue" status="complete" hideBadge>
          <div data-testid="detail">8 rows · 0 variances</div>
        </AgentStep>
      </AgentTimeline>,
    );
    expect(screen.getByTestId("detail")).toBeInTheDocument();
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
  });

  it("merges className and spreads props on the li", () => {
    render(
      <AgentTimeline>
        <AgentStep name="Step" className="custom-step" aria-label="step" />
      </AgentTimeline>,
    );
    const li = screen.getByRole("listitem");
    expect(li).toHaveClass("custom-step");
    expect(li).toHaveAttribute("aria-label", "step");
  });
});

describe("ChainOfThoughtStep → AgentStep alias (#192 convergence)", () => {
  it("renders on the canonical rail with the 3-state vocabulary mapped in", () => {
    render(
      <ChainOfThought defaultOpen>
        <ChainOfThoughtHeader>Working</ChainOfThoughtHeader>
        <ChainOfThoughtContent>
          <ChainOfThoughtStep label="Searched filings" description="Q3 10-Q" status="active" />
        </ChainOfThoughtContent>
      </ChainOfThought>,
    );
    const li = screen.getByRole("listitem");
    expect(li).toHaveAttribute("data-status", "running");
    expect(screen.getByText("Searched filings")).toBeInTheDocument();
    expect(screen.getByText("Q3 10-Q")).toBeInTheDocument();
  });
});
