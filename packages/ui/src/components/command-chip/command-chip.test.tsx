import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CommandChip, type CommandChipHost } from "./command-chip";

const HOSTS: CommandChipHost[] = [
  { id: "claude-code", label: "Claude Code", command: "claude mcp add brand-ui" },
  { id: "cursor", label: "Cursor", command: "npx -y @elabs-ai/components-cli mcp" },
];

function stubClipboard(impl: () => Promise<void> = () => Promise.resolve()) {
  const writeText = vi.fn(impl);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
}

describe("CommandChip", () => {
  it("shows the first host's command with its data-slot", () => {
    const { container } = render(<CommandChip hosts={HOSTS} />);
    expect(container.querySelector('[data-slot="command-chip"]')).not.toBeNull();
    expect(screen.getByText(HOSTS[0]!.command)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install for: Claude Code" })).toBeInTheDocument();
  });

  it("honours defaultValue", () => {
    render(<CommandChip hosts={HOSTS} defaultValue="cursor" />);
    expect(screen.getByText(HOSTS[1]!.command)).toBeInTheDocument();
  });

  it("copies the exact command and announces it", async () => {
    const writeText = stubClipboard();
    const onCopyCommand = vi.fn();
    render(<CommandChip hosts={HOSTS} onCopyCommand={onCopyCommand} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");
    fireEvent.click(screen.getByRole("button", { name: "Copy command" }));
    await waitFor(() => expect(status).toHaveTextContent("Copied"));
    expect(writeText).toHaveBeenCalledWith(HOSTS[0]!.command);
    expect(onCopyCommand).toHaveBeenCalledWith(HOSTS[0]!.command, true);
  });

  it("selects the command when the clipboard is unavailable", async () => {
    stubClipboard(() => Promise.reject(new Error("denied")));
    render(<CommandChip hosts={HOSTS} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy command" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Command selected"));
    expect(window.getSelection()?.toString()).toBe(HOSTS[0]!.command);
  });

  it("renders no menu for a single host", () => {
    render(<CommandChip hosts={[HOSTS[0]!]} />);
    expect(screen.queryByRole("button", { name: /Install for/ })).toBeNull();
  });
});
