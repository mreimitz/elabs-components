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
          <ToolInput input={{ query: "platform status page" }} />
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

describe("ToolHeader layout in narrow containers (#598)", () => {
  it("StatusBadge element has shrink-0 class to prevent clipping in narrow flex containers", () => {
    const { container } = render(
      <Tool>
        <ToolHeader type="tool-search_web" state="output-available" summary="3 results found" />
      </Tool>,
    );
    // StatusBadge renders as a span with data-slot="status-badge"
    const statusBadgeSpan = container.querySelector('span[data-slot="status-badge"]');
    expect(statusBadgeSpan).not.toBeNull();
    expect(statusBadgeSpan).toHaveClass("shrink-0");
  });

  it("title span has min-w-0 and truncate classes to yield space to fixed-width siblings", () => {
    render(
      <Tool>
        <ToolHeader type="tool-search_web" state="output-available" title="Search Tool" />
      </Tool>,
    );
    // Find the title span (it contains the title text and comes after the wrench icon)
    const titleSpan = screen.getByText("Search Tool");
    expect(titleSpan).toHaveClass("min-w-0");
    expect(titleSpan).toHaveClass("truncate");
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

// A tool that returns a count of 0, a boolean check of false, or an empty
// string is a REAL, defined result — only `undefined` means "no output yet".
// The old `!(output || errorText || isStreaming)` guard treated all three as
// "nothing to show" and rendered null outright.
describe("ToolOutput — defined-but-falsy output renders (review #1)", () => {
  it("renders a numeric 0 result instead of returning null", () => {
    render(<ToolOutput output={0} errorText={undefined} />);
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders a boolean false result instead of returning null", () => {
    const { container } = render(<ToolOutput output={false} errorText={undefined} />);
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(container.querySelector('[data-language="json"]')).not.toBeNull();
  });

  it("renders an empty-string result (not the pending skeleton, not null)", () => {
    const { container } = render(<ToolOutput output="" errorText={undefined} />);
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});

describe("ToolOutput — string output renders as plain text, not forced JSON (review #1)", () => {
  it("renders a plain-text (non-JSON) string result without the JSON highlighter", () => {
    const { container } = render(
      <ToolOutput output="just a plain sentence, not json" errorText={undefined} />,
    );
    expect(screen.getByText("just a plain sentence, not json")).toBeInTheDocument();
    expect(container.querySelector('[data-language="text"]')).not.toBeNull();
    expect(container.querySelector('[data-language="json"]')).toBeNull();
  });

  it("still renders an object result through the JSON highlighter", () => {
    const { container } = render(<ToolOutput output={{ ok: true }} errorText={undefined} />);
    expect(container.querySelector('[data-language="json"]')).not.toBeNull();
  });
});

describe("ToolOutput/ToolInput — JSON.stringify never crashes the render (review #1)", () => {
  it("falls back gracefully for a circular output object instead of throwing", () => {
    const circular: Record<string, unknown> = { name: "circular" };
    circular.self = circular;

    expect(() => render(<ToolOutput output={circular} errorText={undefined} />)).not.toThrow();
    expect(screen.getByText("Result")).toBeInTheDocument();
  });

  it("renders a BigInt field in the output instead of throwing", () => {
    expect(() =>
      render(<ToolOutput output={{ total: 10n }} errorText={undefined} />),
    ).not.toThrow();
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(screen.getByText(/10n/)).toBeInTheDocument();
  });

  it("falls back gracefully for circular tool input instead of throwing", () => {
    const circular: Record<string, unknown> = { query: "x" };
    circular.self = circular;

    expect(() => render(<ToolInput input={circular} />)).not.toThrow();
  });
});

describe("ToolInput/ToolOutput CodeBlock wrapping (#570, axe scrollable-region-focusable)", () => {
  const longSingleLine = JSON.stringify({
    query: "a very long single-line value with no natural line breaks ".repeat(20).trim(),
  });

  it("ToolInput passes wrap to CodeBlock so long lines soft-wrap instead of scrolling", () => {
    const { container } = render(<ToolInput input={{ query: longSingleLine }} />);
    const pre = container.querySelector("pre");
    expect(pre).toHaveClass("whitespace-pre-wrap");
  });

  it("ToolOutput passes wrap to CodeBlock for a string result", () => {
    const { container } = render(<ToolOutput output={longSingleLine} errorText={undefined} />);
    const pre = container.querySelector("pre");
    expect(pre).toHaveClass("whitespace-pre-wrap");
  });

  it("ToolOutput passes wrap to CodeBlock for a JSON (object) result", () => {
    const { container } = render(
      <ToolOutput output={{ query: longSingleLine }} errorText={undefined} />,
    );
    const pre = container.querySelector("pre");
    expect(pre).toHaveClass("whitespace-pre-wrap");
  });
});
