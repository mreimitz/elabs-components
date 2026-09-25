import { describe, expect, it, vi } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallTabs, type InstallTabsHostTab, type InstallTabsSelectOption } from "./install-tabs";

/** Install a clipboard stub for one test; returns the writeText spy. Mirrors
 * `CommandChip`'s test helper — `userEvent.setup()` installs its OWN clipboard stub, so
 * every stub below is installed AFTER setup, or `userEvent`'s overwrites it. */
function stubClipboard(impl: () => Promise<void> = () => Promise.resolve()) {
  const writeText = vi.fn(impl);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
}

const PACKAGE_OPTIONS: InstallTabsSelectOption[] = [
  { id: "ai-assistant", label: "AI assistant", command: "pnpm add @elabs-ai/components-ai" },
  { id: "dashboard", label: "Dashboard", command: "pnpm add @elabs-ai/components-charts" },
];

const BLOCK_OPTIONS: InstallTabsSelectOption[] = [
  { id: "kpi-movers-01", label: "KPI movers", command: "npx shadcn@latest add kpi-movers-01.json" },
];

const HOST_TABS: InstallTabsHostTab[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    commands: [{ label: "Install plugin", command: "/plugin install brand-ui" }],
  },
];

const PROMPT = "Use brand-ui — MCP at https://elabs-ai.com/mcp, docs at /llms.txt.";

describe("InstallTabs", () => {
  it("renders its data-slot and defaults to the packages tab", () => {
    const { container } = render(
      <InstallTabs
        packageOptions={PACKAGE_OPTIONS}
        blockOptions={BLOCK_OPTIONS}
        hostTabs={HOST_TABS}
        prompt={PROMPT}
      />,
    );
    expect(container.querySelector('[data-slot="install-tabs"]')).not.toBeNull();
    expect(screen.getByText("pnpm add @elabs-ai/components-ai")).toBeInTheDocument();
  });

  it("honours a controlled package value", () => {
    render(
      <InstallTabs
        packageOptions={PACKAGE_OPTIONS}
        blockOptions={BLOCK_OPTIONS}
        hostTabs={HOST_TABS}
        prompt={PROMPT}
        packageValue="dashboard"
        onPackageValueChange={() => {}}
      />,
    );
    expect(screen.getByText("pnpm add @elabs-ai/components-charts")).toBeInTheDocument();
  });

  it("switches to the copy-own tab and shows the block command", async () => {
    const user = userEvent.setup();
    render(
      <InstallTabs
        packageOptions={PACKAGE_OPTIONS}
        blockOptions={BLOCK_OPTIONS}
        hostTabs={HOST_TABS}
        prompt={PROMPT}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Copy-own" }));
    expect(await screen.findByText("npx shadcn@latest add kpi-movers-01.json")).toBeInTheDocument();
  });

  it("switches to a host tab and shows its commands", async () => {
    const user = userEvent.setup();
    render(
      <InstallTabs
        packageOptions={PACKAGE_OPTIONS}
        blockOptions={BLOCK_OPTIONS}
        hostTabs={HOST_TABS}
        prompt={PROMPT}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Claude Code" }));
    expect(await screen.findByText("/plugin install brand-ui")).toBeInTheDocument();
  });

  it("shows the read-only prompt on the prompt tab", async () => {
    const user = userEvent.setup();
    render(
      <InstallTabs
        packageOptions={PACKAGE_OPTIONS}
        blockOptions={BLOCK_OPTIONS}
        hostTabs={HOST_TABS}
        prompt={PROMPT}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Prompt" }));
    expect(await screen.findByDisplayValue(PROMPT)).toHaveAttribute("readonly");
  });

  it("copies the prompt to the clipboard", async () => {
    // `userEvent.setup()` attaches its OWN clipboard stub to `navigator` — define ours
    // AFTER setup, or `userEvent`'s overwrites it and the assertion below sees 0 calls.
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    const onPromptCopy = vi.fn();
    render(
      <InstallTabs
        packageOptions={PACKAGE_OPTIONS}
        blockOptions={BLOCK_OPTIONS}
        hostTabs={HOST_TABS}
        prompt={PROMPT}
        onPromptCopy={onPromptCopy}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Prompt" }));
    fireEvent.click(await screen.findByRole("button", { name: "Copy prompt" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(PROMPT));
    expect(onPromptCopy).toHaveBeenCalledWith(true);
  });

  it("mounts an always-present polite status region on the prompt tab, silent until a copy", async () => {
    const user = userEvent.setup();
    stubClipboard();
    render(
      <InstallTabs
        packageOptions={PACKAGE_OPTIONS}
        blockOptions={BLOCK_OPTIONS}
        hostTabs={HOST_TABS}
        prompt={PROMPT}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Prompt" }));
    const status = await screen.findByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("");
  });

  it("announces a successful copy on mouse click, from the same state as the visible label", async () => {
    const user = userEvent.setup();
    stubClipboard();
    render(
      <InstallTabs
        packageOptions={PACKAGE_OPTIONS}
        blockOptions={BLOCK_OPTIONS}
        hostTabs={HOST_TABS}
        prompt={PROMPT}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Prompt" }));
    const button = await screen.findByRole("button", { name: "Copy prompt" });

    await user.click(button);
    await waitFor(() => expect(button).toHaveTextContent("Copied"));
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    expect(button).toHaveFocus();
  });

  it("announces a successful copy on keyboard Enter, without moving focus off the trigger", async () => {
    const user = userEvent.setup();
    stubClipboard();
    render(
      <InstallTabs
        packageOptions={PACKAGE_OPTIONS}
        blockOptions={BLOCK_OPTIONS}
        hostTabs={HOST_TABS}
        prompt={PROMPT}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Prompt" }));
    const button = await screen.findByRole("button", { name: "Copy prompt" });
    button.focus();
    expect(button).toHaveFocus();

    await user.keyboard("{Enter}");
    await waitFor(() => expect(button).toHaveTextContent("Copied"));
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    expect(button).toHaveFocus();
  });

  it("announces a successful copy on keyboard Space, without moving focus off the trigger", async () => {
    const user = userEvent.setup();
    stubClipboard();
    render(
      <InstallTabs
        packageOptions={PACKAGE_OPTIONS}
        blockOptions={BLOCK_OPTIONS}
        hostTabs={HOST_TABS}
        prompt={PROMPT}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Prompt" }));
    const button = await screen.findByRole("button", { name: "Copy prompt" });
    button.focus();
    expect(button).toHaveFocus();

    await user.keyboard(" ");
    await waitFor(() => expect(button).toHaveTextContent("Copied"));
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    expect(button).toHaveFocus();
  });

  it("reverts the label and status once the 1.5s feedback window elapses (fake timers)", async () => {
    const user = userEvent.setup();
    stubClipboard();
    render(
      <InstallTabs
        packageOptions={PACKAGE_OPTIONS}
        blockOptions={BLOCK_OPTIONS}
        hostTabs={HOST_TABS}
        prompt={PROMPT}
      />,
    );
    // Switch tabs under real timers — Radix's Tabs trigger needs the full
    // pointer/focus sequence `userEvent` produces, not a bare `fireEvent.click`.
    await user.click(screen.getByRole("tab", { name: "Prompt" }));
    const button = await screen.findByRole("button", { name: "Copy prompt" });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");

    vi.useFakeTimers();
    try {
      // `fireEvent.click` (unlike `userEvent.click`) does not focus its target the way a
      // real click does — focus it explicitly so the assertion below reflects a real click.
      button.focus();
      fireEvent.click(button);
      // Flush the microtasks `copy()` awaits (`navigator.clipboard.writeText`, then
      // `.then(onPromptCopy)`) — fake timers only fake macrotasks, not promises.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(button).toHaveTextContent("Copied");
      expect(status).toHaveTextContent("Copied");
      expect(button).toHaveFocus();

      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(button).toHaveTextContent("Copy prompt");
      expect(status).toHaveTextContent("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("never announces Copied when the clipboard write is rejected", async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard(() => Promise.reject(new Error("denied")));
    render(
      <InstallTabs
        packageOptions={PACKAGE_OPTIONS}
        blockOptions={BLOCK_OPTIONS}
        hostTabs={HOST_TABS}
        prompt={PROMPT}
      />,
    );
    await user.click(screen.getByRole("tab", { name: "Prompt" }));
    const button = await screen.findByRole("button", { name: "Copy prompt" });

    await user.click(button);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(PROMPT));
    expect(button).toHaveTextContent("Copy prompt");
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});
