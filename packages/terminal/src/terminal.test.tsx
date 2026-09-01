/**
 * terminal.test.tsx — smoke + behaviour lock for the read-only console log.
 *
 * `Terminal` is the presentational ANSI transcript (vs. `InteractiveTerminal`,
 * the real xterm.js PTY surface) — it renders `output` as-is, exposes a
 * copy-to-clipboard action with a locale-seamed accessible name, and an
 * optional clear action that only appears when `onClear` is supplied.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Terminal } from "./terminal";

/** Install a clipboard stub for one test; returns the writeText spy. */
function stubClipboard(impl: () => Promise<void> = () => Promise.resolve()) {
  const writeText = vi.fn(impl);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
    writable: true,
  });
  return writeText;
}

describe("Terminal", () => {
  it("renders the given output", () => {
    render(<Terminal output="$ pnpm build" />);
    expect(screen.getByText("$ pnpm build")).toBeInTheDocument();
  });

  it("shows a streaming cursor only while isStreaming", () => {
    const { container, rerender } = render(<Terminal output="building" isStreaming />);
    expect(container.querySelector(".bg-terminal-cursor")).not.toBeNull();

    rerender(<Terminal output="building" isStreaming={false} />);
    expect(container.querySelector(".bg-terminal-cursor")).toBeNull();
  });

  it("omits the clear action when no onClear is supplied", () => {
    render(<Terminal output="log" />);
    expect(screen.queryByRole("button", { name: /clear/i })).not.toBeInTheDocument();
  });

  it("renders the clear action, with an accessible name, once onClear is supplied", () => {
    const onClear = vi.fn();
    render(<Terminal output="log" onClear={onClear} />);
    const clearButton = screen.getByRole("button", { name: /clear/i });
    fireEvent.click(clearButton);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("the copy control is icon-only with an accessible name from the locale seam", () => {
    stubClipboard();
    render(<Terminal output="$ pnpm build" />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("copies the raw output text, not the rendered ANSI markup", async () => {
    const writeText = stubClipboard();
    render(<Terminal output={"\x1b[32m✓\x1b[0m done"} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("\x1b[32m✓\x1b[0m done"));
  });
});

/**
 * ANSI colour must resolve from `--terminal-ansi-*` (issue #115 defect 2), not
 * from ansi-to-react's own hardcoded RGB table. A test that only checked two
 * class strings differ would pass on the OLD, broken code too (anser emits
 * distinct inline `rgb(...)` values per colour regardless of `useClasses`) —
 * so this locks BOTH halves: the DOM renders the class ansi-to-react's
 * `useClasses` mode emits, AND the shipped CSS actually maps that exact class
 * onto the matching token (parsed from the real file, not hand-duplicated).
 */
describe("Terminal ANSI colour → --terminal-ansi-* token wiring (#115 defect 2)", () => {
  const cssPath = join(dirname(fileURLToPath(import.meta.url)), "terminal-ansi.css");
  const css = readFileSync(cssPath, "utf8");

  it("renders ANSI colour codes as ansi-to-react's `useClasses` classes, not a hardcoded inline rgb()", () => {
    render(<Terminal output={"\x1b[32mgreen\x1b[0m \x1b[36mcyan\x1b[0m"} />);
    const green = screen.getByText("green");
    const cyan = screen.getByText("cyan");

    expect(green).toHaveClass("ansi-green-fg");
    expect(cyan).toHaveClass("ansi-cyan-fg");
    // ansi-to-react's default (non-`useClasses`) mode paints an inline
    // `style="color: rgb(...)"` straight from anser's own hardcoded palette —
    // asserting there is no `style` attribute at all proves the colour is no
    // longer coming from there.
    expect(green).not.toHaveAttribute("style");
    expect(cyan).not.toHaveAttribute("style");
  });

  const ANSI_SLOTS = [
    ["black", "--terminal-ansi-black"],
    ["red", "--terminal-ansi-red"],
    ["green", "--terminal-ansi-green"],
    ["yellow", "--terminal-ansi-yellow"],
    ["blue", "--terminal-ansi-blue"],
    ["magenta", "--terminal-ansi-magenta"],
    ["cyan", "--terminal-ansi-cyan"],
    ["white", "--terminal-ansi-white"],
    ["bright-black", "--terminal-ansi-bright-black"],
    ["bright-red", "--terminal-ansi-bright-red"],
    ["bright-green", "--terminal-ansi-bright-green"],
    ["bright-yellow", "--terminal-ansi-bright-yellow"],
    ["bright-blue", "--terminal-ansi-bright-blue"],
    ["bright-magenta", "--terminal-ansi-bright-magenta"],
    ["bright-cyan", "--terminal-ansi-bright-cyan"],
    ["bright-white", "--terminal-ansi-bright-white"],
  ] as const;

  it.each(ANSI_SLOTS)("maps ansi-%s-fg (and -bg) onto %s in the shipped CSS", (name, token) => {
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expect(css).toMatch(
      new RegExp(`\\.ansi-${name}-fg\\s*\\{\\s*color:\\s*var\\(${escapedToken}\\)`),
    );
    expect(css).toMatch(
      new RegExp(`\\.ansi-${name}-bg\\s*\\{\\s*background-color:\\s*var\\(${escapedToken}\\)`),
    );
  });
});
