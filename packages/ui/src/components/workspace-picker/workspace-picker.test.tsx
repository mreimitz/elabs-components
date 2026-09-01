import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspacePicker } from "./workspace-picker";
import { formatLastOpened } from "./workspace-picker-state";
import type { Workspace } from "./workspace-picker-state";

afterEach(cleanup);

// cmdk calls Element.scrollIntoView to keep the auto-highlighted item visible.
// jsdom doesn't implement it and this package's vitest setup deliberately ships
// no global stub, so third-party libraries that don't feature-detect get a
// local, scoped stub — the same pattern as model-picker.test.tsx and
// combobox.test.tsx.
let originalScrollIntoView: typeof Element.prototype.scrollIntoView;
beforeEach(() => {
  originalScrollIntoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  Element.prototype.scrollIntoView = originalScrollIntoView;
});

// No `LocaleProvider` wrapper: `useLocale()` falls back to the shipped English
// defaults, so these assertions prove the real `ui.workspacePicker.*` catalogue in
// `packages/ui/src/components/locale-provider/messages.ts` rather than a local stub
// that would keep passing if the central entry were missing or misspelled.
function renderPicker(ui: React.ReactElement) {
  return render(ui);
}

const workspaces: Workspace[] = [
  {
    id: "ws-1",
    name: "elabs-components",
    path: "/Users/ada/dev/elabs-components",
    lastOpenedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    id: "ws-2",
    name: "brainless",
    path: "/Users/ada/dev/brainless",
  },
];

const open = async () => {
  await userEvent.click(screen.getAllByRole("combobox")[0]!);
};

describe("formatLastOpened", () => {
  const now = Date.parse("2026-09-01T12:00:00.000Z");

  it("picks minutes for recent times", () => {
    expect(formatLastOpened(new Date(now - 5 * 60 * 1000), "en-US", now)).toBe("5 minutes ago");
  });

  it("picks hours once minutes would read awkwardly large", () => {
    expect(formatLastOpened(new Date(now - 3 * 60 * 60 * 1000), "en-US", now)).toBe("3 hours ago");
  });

  it("picks days once hours would read awkwardly large", () => {
    expect(formatLastOpened(new Date(now - 2 * 24 * 60 * 60 * 1000), "en-US", now)).toBe(
      "2 days ago",
    );
  });

  it("formats a future time as relative-forward", () => {
    expect(formatLastOpened(new Date(now + 10 * 60 * 1000), "en-US", now)).toBe("in 10 minutes");
  });
});

describe("WorkspacePicker", () => {
  it("renders each workspace's path as truncating secondary text", async () => {
    renderPicker(<WorkspacePicker workspaces={workspaces} />);
    await open();
    const description = screen.getByText("/Users/ada/dev/elabs-components");
    expect(description).toBeInTheDocument();
    expect(description).toHaveClass("truncate");
  });

  it("marks the current workspace in the row's accessible name, not only by icon", async () => {
    renderPicker(<WorkspacePicker workspaces={workspaces} currentId="ws-1" />);
    await open();
    const current = screen.getByRole("option", { name: /elabs-components/ });
    const other = screen.getByRole("option", { name: /brainless/ });
    expect(current).toHaveAccessibleName(/current/i);
    expect(other).not.toHaveAccessibleName(/current/i);
  });

  it("names the trigger from the current workspace, and falls back to a placeholder", async () => {
    const { unmount } = renderPicker(<WorkspacePicker workspaces={workspaces} currentId="ws-1" />);
    expect(screen.getByRole("combobox")).toHaveTextContent("elabs-components");
    unmount();

    renderPicker(<WorkspacePicker workspaces={workspaces} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("No workspace selected");
  });

  it("reports the whole Workspace object on selection, not just the id", async () => {
    const onSelect = vi.fn();
    renderPicker(<WorkspacePicker workspaces={workspaces} onSelect={onSelect} />);
    await open();
    await userEvent.click(screen.getByText("brainless"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(workspaces[1]);
  });

  it("shows a designed empty state whose one action is the free-text path entry", async () => {
    renderPicker(<WorkspacePicker workspaces={[]} onSubmitPath={vi.fn()} />);
    await open();
    // ModelPicker's own empty panel — reused, not reimplemented.
    expect(screen.getByText("Nothing to show yet")).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    // The action: the free-text path entry always renders, even with zero rows.
    expect(screen.getByPlaceholderText("/path/to/project…")).toBeInTheDocument();
  });

  it("validates non-empty free text before reporting the raw string", async () => {
    const onSubmitPath = vi.fn();
    renderPicker(<WorkspacePicker workspaces={workspaces} onSubmitPath={onSubmitPath} />);
    await open();
    const submit = screen.getByRole("button", { name: "Open" });

    await userEvent.click(submit);
    expect(onSubmitPath).not.toHaveBeenCalled();

    const input = screen.getByPlaceholderText("/path/to/project…");
    await userEvent.type(input, "  ");
    await userEvent.click(submit);
    expect(onSubmitPath).not.toHaveBeenCalled();

    await userEvent.clear(input);
    await userEvent.type(input, "/tmp/new-workspace");
    await userEvent.click(submit);
    expect(onSubmitPath).toHaveBeenCalledTimes(1);
    expect(onSubmitPath).toHaveBeenCalledWith("/tmp/new-workspace");
  });

  it("performs no filesystem access — onSubmitPath is the only side effect of a submit", async () => {
    const onSubmitPath = vi.fn();
    const onSelect = vi.fn();
    renderPicker(
      <WorkspacePicker workspaces={workspaces} onSubmitPath={onSubmitPath} onSelect={onSelect} />,
    );
    await open();
    const input = screen.getByPlaceholderText("/path/to/project…");
    await userEvent.type(input, "/tmp/new-workspace");
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(onSubmitPath).toHaveBeenCalledWith("/tmp/new-workspace");
    expect(onSelect).not.toHaveBeenCalled();
    // The field clears after a successful submit.
    expect(input).toHaveValue("");
  });

  it("submits the path on Enter instead of cmdk hijacking it as list navigation", async () => {
    const onSubmitPath = vi.fn();
    const onSelect = vi.fn();
    renderPicker(
      <WorkspacePicker workspaces={workspaces} onSubmitPath={onSubmitPath} onSelect={onSelect} />,
    );
    await open();
    const input = screen.getByPlaceholderText("/path/to/project…");
    await userEvent.type(input, "/tmp/other-workspace{Enter}");
    expect(onSubmitPath).toHaveBeenCalledWith("/tmp/other-workspace");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("truncates a very long path without overflow", async () => {
    const longPath = "/Users/ada/dev/" + "very-long-segment/".repeat(20) + "elabs-components";
    renderPicker(
      <WorkspacePicker workspaces={[{ id: "ws-long", name: "long-one", path: longPath }]} />,
    );
    await open();
    const description = screen.getByText(longPath);
    expect(description).toHaveClass("truncate");
    // The truncating span is a min-w-0 flex child — the min-w-0 + flex-1 rule
    // that lets truncate actually clip instead of overflowing.
    expect(description.parentElement).toHaveClass("min-w-0");
  });

  it("uses the caller's explicit aria-label over the default", async () => {
    renderPicker(<WorkspacePicker workspaces={workspaces} aria-label="Session workspace" />);
    expect(screen.getByRole("combobox")).toHaveAccessibleName("Session workspace");
  });

  it("renders the shipped English default with no LocaleProvider mounted", () => {
    // No provider: `t()` falls back to `DEFAULT_MESSAGES[key] ?? key`. The keys
    // landed in messages.ts with this component, so the fallback is now real
    // microcopy — a regression that dropped them would surface here as the raw
    // key string instead.
    render(<WorkspacePicker workspaces={workspaces} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("No workspace selected");
  });

  it("scopes the workspace-picker data-slot to the root, distinct from model-picker", async () => {
    const { container } = renderPicker(<WorkspacePicker workspaces={workspaces} />);
    expect(container.querySelector('[data-slot="workspace-picker"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="model-picker"]')).not.toBeInTheDocument();
  });

  it("renders the free-text path form outside CommandList — the search query cannot hide it", async () => {
    renderPicker(<WorkspacePicker workspaces={workspaces} />);
    await open();
    await userEvent.type(screen.getByPlaceholderText("Search workspaces…"), "no-match-xyz");
    expect(screen.getByPlaceholderText("/path/to/project…")).toBeInTheDocument();
  });
});
