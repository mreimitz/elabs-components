/**
 * copyable-value.test.tsx — "shown short, copied exact" is only defensible if
 * the exact value is genuinely reachable, so the locks here are: the clipboard
 * gets the UNROUNDED string, the visible text stays inside the accessible name
 * (WCAG 2.5.3), the live region exists before the copy (ARIA22), and a missing
 * clipboard degrades instead of throwing.
 *
 * `userEvent.setup()` installs its OWN clipboard stub, so every clipboard stub
 * below is installed AFTER setup — otherwise the spy is silently replaced.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopyableValue } from "./copyable-value";

/** Install a clipboard stub for one test; returns the writeText spy. */
function stubClipboard(impl: () => Promise<void> = () => Promise.resolve()) {
  const writeText = vi.fn(impl);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
    writable: true,
  });
  return writeText;
}

describe("CopyableValue", () => {
  it("shows the children and copies the exact value", async () => {
    const writeText = stubClipboard();
    render(<CopyableValue value="50012102.632741">50M</CopyableValue>);

    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("50M");

    fireEvent.click(button);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("50012102.632741");
    });
  });

  it("falls back to the exact value as its own display", () => {
    render(<CopyableValue value="1234" />);
    expect(screen.getByRole("button")).toHaveTextContent("1234");
  });

  it("keeps the visible text inside the accessible name (WCAG 2.5.3)", () => {
    render(<CopyableValue value="1500000">1.5M</CopyableValue>);
    // The hint is APPENDED, never substituted — a voice-control user must be
    // able to say what they read.
    expect(screen.getByRole("button", { name: "1.5M Copy exact value" })).toBeInTheDocument();
  });

  it("accepts a custom hint", () => {
    render(
      <CopyableValue hint="Copy unrounded rate" value="0.9612">
        96.1%
      </CopyableValue>,
    );
    expect(screen.getByRole("button", { name: "96.1% Copy unrounded rate" })).toBeInTheDocument();
  });

  it("mounts the live region before the copy so it can be announced (ARIA22)", async () => {
    stubClipboard();
    render(<CopyableValue value="42">42</CopyableValue>);

    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    expect(status).toHaveTextContent("");

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("Copied");
    });
  });

  it("marks the copied state on the control", async () => {
    stubClipboard();
    render(<CopyableValue value="42">42</CopyableValue>);

    const button = screen.getByRole("button");
    expect(button).not.toHaveAttribute("data-copied");

    fireEvent.click(button);
    await waitFor(() => {
      expect(button).toHaveAttribute("data-copied");
    });
  });

  it("is a real tab stop and copies on Enter", async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    render(<CopyableValue value="42">42</CopyableValue>);

    await user.tab();
    expect(screen.getByRole("button")).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("42");
    });
  });

  it("lets a consumer's onClick pre-empt the copy", () => {
    const writeText = stubClipboard();
    render(
      <CopyableValue
        onClick={(event) => {
          event.preventDefault();
        }}
        value="42"
      >
        42
      </CopyableValue>,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(writeText).not.toHaveBeenCalled();
  });

  it("degrades where there is no clipboard (insecure context / old browser)", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    render(<CopyableValue value="42">42</CopyableValue>);

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("");
    });
  });
});
