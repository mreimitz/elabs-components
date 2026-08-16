import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const renderMock = vi.fn(async (_id: string, chart: string) => {
  if (chart.includes("boom")) throw new Error("Parse error on line 1");
  return {
    svg: `<svg data-chart="ok"><g class="node"><rect></rect><text>Microsoft Graph API</text></g><g class="node"><rect></rect><text>Worker</text></g></svg>`,
  };
});

vi.mock("mermaid", () => ({
  default: { initialize: vi.fn(), render: renderMock },
}));

import { MermaidDiagram } from "./mermaid-diagram";

describe("MermaidDiagram", () => {
  it("renders the mermaid SVG with an accessible name", async () => {
    render(<MermaidDiagram chart={"graph TD; A-->B"} label="Flow" />);
    await waitFor(() => expect(screen.getByRole("img", { name: "Flow" })).toBeInTheDocument());
    expect(renderMock).toHaveBeenCalled();
  });

  it("renders an inline error block (not a throw) for invalid source", async () => {
    render(<MermaidDiagram chart={"graph TD; boom"} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText(/Parse error/)).toBeInTheDocument();
    expect(screen.getByText(/graph TD; boom/)).toBeInTheDocument();
  });

  it("shows a loading placeholder before the engine resolves", () => {
    render(<MermaidDiagram chart={"graph TD; A-->B"} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

describe("MermaidDiagram — search highlighting", () => {
  it("marks matching nodes as hits and the active line's node as active", async () => {
    const { container, rerender } = render(
      <MermaidDiagram chart={"graph TD; A-->B"} highlightTerm="graph api" />,
    );
    await waitFor(() => expect(container.querySelector("g.node")).not.toBeNull());
    const nodes = container.querySelectorAll("g.node");
    expect(nodes[0]).toHaveClass("wb-dg-hit");
    expect(nodes[0]).not.toHaveClass("wb-dg-hit-active");
    expect(nodes[1]).not.toHaveClass("wb-dg-hit");

    rerender(
      <MermaidDiagram
        chart={"graph TD; A-->B"}
        highlightTerm="graph api"
        activeText="  a[Microsoft Graph API]"
      />,
    );
    expect(container.querySelectorAll("g.node")[0]).toHaveClass("wb-dg-hit-active");
  });

  it("clears hit classes when the term is removed", async () => {
    const { container, rerender } = render(
      <MermaidDiagram chart={"graph TD; A-->B"} highlightTerm="worker" />,
    );
    await waitFor(() => expect(container.querySelectorAll("g.node")[1]).toHaveClass("wb-dg-hit"));
    rerender(<MermaidDiagram chart={"graph TD; A-->B"} />);
    expect(container.querySelectorAll("g.node")[1]).not.toHaveClass("wb-dg-hit");
  });
});

describe("MermaidDiagram — viewer chrome", () => {
  it("expands into a large modal", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(<MermaidDiagram chart={"graph TD; A-->B"} label="Flow" />);
    await waitFor(() => expect(screen.getByRole("img", { name: "Flow" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Expand diagram" }));
    const dialog = await screen.findByRole("dialog");
    // The modal carries its own large rendering (the page behind is aria-hidden).
    expect(within(dialog).getByRole("img", { name: "Flow" })).toBeInTheDocument();
  });

  it("offers an SVG download next to copy", async () => {
    render(<MermaidDiagram chart={"graph TD; A-->B"} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Download diagram as SVG" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });
});
