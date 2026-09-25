import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  IntegrationMatrix,
  type IntegrationMatrixHost,
  type IntegrationMatrixRow,
} from "./integration-matrix";

const HOSTS: IntegrationMatrixHost[] = [
  { id: "claude-code", label: "Claude Code" },
  { id: "cursor", label: "Cursor" },
];

const ROWS: IntegrationMatrixRow[] = [
  {
    id: "hosted-mcp",
    unit: "Hosted MCP",
    gives: "A remote MCP server.",
    actions: [
      {
        label: "Add server",
        kind: "copy",
        value: { "claude-code": "claude mcp add brand-ui", cursor: "cursor command" },
      },
    ],
  },
  {
    id: "llms-txt",
    unit: "llms.txt",
    gives: "A plain-text doc map.",
    actions: [{ label: "Open", kind: "link", value: "https://elabs-ai.com/llms.txt" }],
  },
];

function stubClipboard() {
  const writeText = vi.fn(() => Promise.resolve());
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
}

describe("IntegrationMatrix", () => {
  it("renders its data-slot and every row", () => {
    const { container } = render(<IntegrationMatrix hosts={HOSTS} rows={ROWS} />);
    expect(container.querySelector('[data-slot="integration-matrix"]')).not.toBeNull();
    expect(screen.getByText("Hosted MCP")).toBeInTheDocument();
    expect(screen.getByText("llms.txt")).toBeInTheDocument();
  });

  it("shows the first host's command by default", () => {
    render(<IntegrationMatrix hosts={HOSTS} rows={ROWS} />);
    expect(screen.getByText("claude mcp add brand-ui")).toBeInTheDocument();
  });

  it("honours a controlled host value", () => {
    render(<IntegrationMatrix hosts={HOSTS} rows={ROWS} value="cursor" onValueChange={() => {}} />);
    expect(screen.getByText("cursor command")).toBeInTheDocument();
  });

  it("renders a link action as a real anchor", () => {
    render(<IntegrationMatrix hosts={HOSTS} rows={ROWS} />);
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
      "href",
      "https://elabs-ai.com/llms.txt",
    );
  });

  it("opens an off-site link action in a new tab", () => {
    render(<IntegrationMatrix hosts={HOSTS} rows={ROWS} />);
    const link = screen.getByRole("link", { name: "Open" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("copies the resolved command and reports it", async () => {
    const writeText = stubClipboard();
    const onCopyAction = vi.fn();
    render(<IntegrationMatrix hosts={HOSTS} rows={ROWS} onCopyAction={onCopyAction} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy command" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("claude mcp add brand-ui"));
    expect(onCopyAction).toHaveBeenCalledWith(
      "hosted-mcp",
      "Add server",
      "claude mcp add brand-ui",
      true,
    );
  });

  it("renders no host selector for a single host", () => {
    render(<IntegrationMatrix hosts={[HOSTS[0]!]} rows={ROWS} />);
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
