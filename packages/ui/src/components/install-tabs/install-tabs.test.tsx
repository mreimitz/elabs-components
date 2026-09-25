import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InstallTabs, type InstallTabsHostTab, type InstallTabsSelectOption } from "./install-tabs";
import { COPY_FEEDBACK_MS } from "../../lib/use-copy-to-clipboard";

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

  describe("copy prompt announcement", () => {
    // Fake timers for the whole block so each test can jump the COPY_FEEDBACK_MS window
    // deterministically; `shouldAdvanceTime` keeps Radix Tabs and `userEvent` working.
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /** Render, switch to the Prompt tab, and return the copy button. The clipboard stub is
     * installed AFTER `userEvent.setup()`, which installs its own. */
    async function openPromptTab(clipboard?: () => Promise<void>) {
      const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
      const writeText = stubClipboard(clipboard);
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
      return { user, button, writeText };
    }

    it("mounts exactly one always-present polite status region, silent until a copy", async () => {
      await openPromptTab();
      // One live region for the prompt copy — a second would announce it twice.
      const panel = screen.getByRole("tabpanel");
      expect(panel.querySelectorAll('[role="status"], [role="alert"], [aria-live]')).toHaveLength(
        1,
      );
      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(status).toBeEmptyDOMElement();
    });

    it("announces the copy via the status region and reverts after the feedback window (mouse)", async () => {
      const { user, button } = await openPromptTab();
      await user.click(button);

      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Copied"));
      expect(button).toHaveTextContent("Copied");
      expect(button).toHaveFocus();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(COPY_FEEDBACK_MS);
      });

      expect(screen.getByRole("status")).toBeEmptyDOMElement();
      expect(button).toHaveTextContent("Copy prompt");
      expect(button).toHaveFocus();
    });

    it("announces the copy on Enter and again on Space, without moving focus off the trigger", async () => {
      const { user, button } = await openPromptTab();
      button.focus();
      expect(button).toHaveFocus();

      await user.keyboard("{Enter}");
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Copied"));
      expect(button).toHaveTextContent("Copied");
      expect(button).toHaveFocus();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(COPY_FEEDBACK_MS);
      });
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
      expect(button).toHaveTextContent("Copy prompt");

      await user.keyboard(" ");
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Copied"));
      expect(button).toHaveTextContent("Copied");
      expect(button).toHaveFocus();
    });

    it("never announces Copied when the clipboard rejects the write", async () => {
      const { user, button, writeText } = await openPromptTab(() =>
        Promise.reject(new Error("denied")),
      );
      await user.click(button);

      await waitFor(() => expect(writeText).toHaveBeenCalledWith(PROMPT));
      expect(screen.getByRole("status")).toBeEmptyDOMElement();
      expect(button).toHaveTextContent("Copy prompt");
    });
  });
});
