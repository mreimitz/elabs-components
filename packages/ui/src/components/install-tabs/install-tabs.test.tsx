import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallTabs, type InstallTabsHostTab, type InstallTabsSelectOption } from "./install-tabs";

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
});
