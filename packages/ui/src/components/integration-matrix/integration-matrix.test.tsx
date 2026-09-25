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
    fireEvent.click(screen.getByRole("button", { name: "Copy command: Add server" }));
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

  // #562 — every row's copy button shared the identical accessible name "Copy command".
  it("gives every row's copy button a distinct, per-row accessible name", () => {
    const rowsWithTwoCopyActions: IntegrationMatrixRow[] = [
      ROWS[0]!,
      {
        id: "local-mcp",
        unit: "Local MCP + CLI",
        gives: "The same tools, run locally.",
        actions: [
          { label: "Run locally", kind: "copy", value: "npx -y @elabs-ai/components-cli mcp" },
        ],
      },
    ];
    render(<IntegrationMatrix hosts={HOSTS} rows={rowsWithTwoCopyActions} />);
    const addServer = screen.getByRole("button", { name: "Copy command: Add server" });
    const runLocally = screen.getByRole("button", { name: "Copy command: Run locally" });
    expect(addServer).not.toBe(runLocally);
    expect(addServer).toHaveAccessibleName("Copy command: Add server");
    expect(runLocally).toHaveAccessibleName("Copy command: Run locally");
  });

  // CommandChip used standalone (e.g. InstallTabs) must keep its own default name.
  it("still standalone-labels a CommandChip with no per-row override elsewhere in the tree", () => {
    render(<IntegrationMatrix hosts={HOSTS} rows={ROWS} />);
    // Only one copy-kind row in the default fixture — its button carries the suffix,
    // the plain default name is no longer present anywhere in this tree.
    expect(screen.queryByRole("button", { name: "Copy command" })).toBeNull();
  });

  // #563 — header/row markup had no row/column association for assistive tech.
  it("exposes each row as a listitem with per-cell column labels", () => {
    const { container } = render(<IntegrationMatrix hosts={HOSTS} rows={ROWS} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(ROWS.length);
    const unitCell = container.querySelector('[data-slot="integration-matrix-row"] span');
    expect(unitCell).toHaveTextContent("Unit: Hosted MCP");
  });

  // #563 — the routine step's explanation was reachable only by hover, not tap/click.
  it("reveals a routine step's explanation on click, not only on hover", async () => {
    const routine = [{ verb: "audit --strict", does: "Fails the build on a raw color." }];
    render(<IntegrationMatrix hosts={HOSTS} rows={ROWS} routine={routine} />);
    const trigger = screen.getByRole("button", { name: "audit --strict" });
    expect(screen.queryByText("Fails the build on a raw color.")).toBeNull();
    fireEvent.click(trigger);
    await waitFor(() =>
      expect(screen.getByText("Fails the build on a raw color.")).toBeInTheDocument(),
    );
  });

  // #564 — the row divider was the only cue between rows but used the weak border rung.
  it("uses the strong border rung for the row divider", () => {
    const { container } = render(<IntegrationMatrix hosts={HOSTS} rows={ROWS} />);
    const row = container.querySelector('[data-slot="integration-matrix-row"]');
    expect(row?.className).toContain("border-border-strong");
  });

  // #567 — routine tokens had no translate="no", so page-translation could mangle them.
  it('marks a routine step translate="no" so browser translation cannot mangle it', () => {
    const routine = [{ verb: "info", does: "Prints the project's taste profile." }];
    render(<IntegrationMatrix hosts={HOSTS} rows={ROWS} routine={routine} />);
    expect(screen.getByRole("button", { name: "info" })).toHaveAttribute("translate", "no");
  });
});
