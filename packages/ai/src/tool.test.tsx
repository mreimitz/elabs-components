import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tool, ToolContent, ToolDetails, ToolHeader, ToolInput, ToolOutput } from "./tool";

const renderTool = () =>
  render(
    <Tool defaultOpen>
      <ToolHeader type="tool-search_web" state="output-available" summary="3 results found" />
      <ToolContent>
        <ToolDetails>
          <ToolInput input={{ query: "qlik cloud status" }} />
        </ToolDetails>
      </ToolContent>
    </Tool>,
  );

describe("Tool JSON-behind-disclosure (#192, research 10 §B.5)", () => {
  it("shows the business summary in the header and keeps ToolDetails COLLAPSED by default", () => {
    renderTool();
    expect(screen.getByText("3 results found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show technical details/i })).toBeInTheDocument();
    // The JSON payload is NOT the headline — hidden until opted in.
    expect(screen.queryByText("Parameters")).not.toBeInTheDocument();
  });

  it("reveals the technical view on demand", async () => {
    const user = userEvent.setup();
    renderTool();
    await user.click(screen.getByRole("button", { name: /show technical details/i }));
    expect(screen.getByText("Parameters")).toBeInTheDocument();
  });
});

describe("ToolOutput isStreaming (#269, loading-states.md)", () => {
  it("renders a skeleton (not null) while streaming with no output yet", () => {
    const { container } = render(
      <ToolOutput output={undefined} errorText={undefined} isStreaming />,
    );
    expect(screen.getByText("Result")).toBeInTheDocument();
    const statuses = container.querySelectorAll('[role="status"]');
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toHaveAttribute("aria-live", "polite");
  });

  it("never shows the error branch while streaming, even with a stale errorText", () => {
    render(<ToolOutput output={undefined} errorText="boom" isStreaming />);
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(screen.queryByText("Error")).not.toBeInTheDocument();
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
  });

  it("shows the terminal error branch once settled (not streaming)", () => {
    render(<ToolOutput output={undefined} errorText="boom" />);
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("still renders nothing when idle (no output, no error, not streaming)", () => {
    const { container } = render(<ToolOutput output={undefined} errorText={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
