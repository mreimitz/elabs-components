/**
 * snippet.test.tsx — smoke + copy-contract lock for the one-line snippet (#59).
 *
 * `Snippet` is the "here is the command, take it" surface. Two contracts:
 * the code travels through context (so `SnippetInput` and `SnippetCopyButton`
 * can never disagree about WHAT gets copied), and the icon-only copy control
 * carries an accessible name from the locale seam — never a bare glyph.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Snippet, SnippetAddon, SnippetCopyButton, SnippetInput, SnippetText } from "./snippet";

const CODE = "pnpm add @elabs/components-ui";

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

function renderSnippet(extra?: React.ReactNode) {
  return render(
    <Snippet code={CODE}>
      <SnippetInput />
      <SnippetAddon align="inline-end">
        <SnippetCopyButton />
        {extra}
      </SnippetAddon>
    </Snippet>,
  );
}

describe("Snippet — the code channel", () => {
  it("renders the code in a read-only field (selectable, never editable)", () => {
    renderSnippet();
    const field = screen.getByRole("textbox");
    expect(field).toHaveValue(CODE);
    expect(field).toHaveAttribute("readonly");
  });

  it("renders an optional prompt prefix via SnippetText", () => {
    render(
      <Snippet code={CODE}>
        <SnippetAddon align="inline-start">
          <SnippetText>$</SnippetText>
        </SnippetAddon>
        <SnippetInput />
      </Snippet>,
    );
    expect(screen.getByText("$")).toBeInTheDocument();
  });

  it("uses a monospace face for the snippet frame", () => {
    const { container } = renderSnippet();
    expect(container.querySelector(".font-mono")).not.toBeNull();
  });
});

describe("SnippetCopyButton", () => {
  it("is an icon-only control with an accessible name from the locale seam", () => {
    stubClipboard();
    renderSnippet();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("copies the SAME code the field shows (both read one context)", async () => {
    const writeText = stubClipboard();
    renderSnippet();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(CODE));
  });

  it("reports a clipboard rejection through onError instead of throwing", async () => {
    stubClipboard(() => Promise.reject(new Error("denied")));
    const onError = vi.fn();
    render(
      <Snippet code={CODE}>
        <SnippetInput />
        <SnippetCopyButton onError={onError} />
      </Snippet>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(onError).toHaveBeenCalled());
  });

  it("reports an UNAVAILABLE clipboard through onError (insecure context / old browser)", () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    const onError = vi.fn();
    render(
      <Snippet code={CODE}>
        <SnippetInput />
        <SnippetCopyButton onError={onError} />
      </Snippet>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(onError).toHaveBeenCalled();
  });

  it("fires onCopy once the write resolves", async () => {
    stubClipboard();
    const onCopy = vi.fn();
    render(
      <Snippet code={CODE}>
        <SnippetInput />
        <SnippetCopyButton onCopy={onCopy} />
      </Snippet>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(onCopy).toHaveBeenCalledTimes(1));
  });
});
