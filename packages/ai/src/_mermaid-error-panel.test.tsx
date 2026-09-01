/**
 * Issue #33 — `mermaid` is an OPTIONAL peer of `@elabs-ai/components-ai`,
 * reached only through the lazy plugin in `_lazy-mermaid.ts`. Streamdown hands
 * a failed diagram render to `MermaidErrorPanel` as a plain STRING (never the
 * original `Error`), so this test locks the message-based branch directly:
 * a missing-peer-shaped message renders the neutral "capability gap" panel
 * (`kind="empty"`, `role="status"`, no retry — re-installing a dependency does
 * not happen by clicking a button); any other message keeps the destructive
 * `kind="error"` panel wired to Streamdown's own `retry()`.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MermaidErrorPanel } from "./_mermaid-error-panel";

afterEach(cleanup);

describe("MermaidErrorPanel (#33)", () => {
  it("renders the neutral capability-gap panel for a missing-peer-shaped message, naming mermaid", () => {
    const retry = vi.fn();
    render(
      <MermaidErrorPanel
        chart="graph TD; A-->B;"
        error="Cannot find module 'mermaid'"
        retry={retry}
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/mermaid/)).toBeInTheDocument();
    // Re-installing a dependency does not happen by clicking a button.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the destructive, retryable panel for a genuine render failure", () => {
    const retry = vi.fn();
    render(
      <MermaidErrorPanel
        chart="graph TD; A--"
        error="Parse error on line 1: Unexpected end of input"
        retry={retry}
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Unexpected end of input/)).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: /try again/i });
    retryButton.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
