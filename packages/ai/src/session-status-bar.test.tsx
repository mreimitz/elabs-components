import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionStatusBar } from "./session-status-bar";

describe("SessionStatusBar", () => {
  it("renders nothing at all when every segment is empty", () => {
    const { container } = render(<SessionStatusBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders only the segments whose prop is supplied", () => {
    render(<SessionStatusBar workspace="brand-ui" />);

    expect(screen.getByText("brand-ui")).toBeInTheDocument();
    expect(screen.queryByText(/main|feature\//)).not.toBeInTheDocument();
  });

  it("renders workspace, branch and model together when all are supplied", () => {
    render(<SessionStatusBar branch="main" model="Claude Opus 4" workspace="brand-ui" />);

    expect(screen.getByText("brand-ui")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("Claude Opus 4")).toBeInTheDocument();
  });

  it("docks children (e.g. Context) rather than reimplementing usage maths", () => {
    render(
      <SessionStatusBar workspace="brand-ui">
        <span>Context slot</span>
      </SessionStatusBar>,
    );

    expect(screen.getByText("Context slot")).toBeInTheDocument();
  });

  it("renders a connection count and a distinct connecting state", () => {
    const { rerender } = render(
      <SessionStatusBar connections={{ connected: 2, total: 4 }} workspace="brand-ui" />,
    );
    expect(screen.getByText("2/4")).toBeInTheDocument();

    rerender(
      <SessionStatusBar
        connections={{ connected: 0, total: 4, connecting: true }}
        workspace="brand-ui"
      />,
    );
    expect(screen.getByText("0/4")).toBeInTheDocument();
  });

  // #155: the connections live region's only text content used to be
  // aria-hidden, so a screen reader heard an empty string on every update.
  // `screen.getByText` alone cannot catch this (it matches text regardless of
  // aria-hidden) — this asserts what the region ACTUALLY announces: its text
  // content with every aria-hidden subtree stripped out first.
  const announceableText = (el: Element): string => {
    const clone = el.cloneNode(true) as HTMLElement;
    for (const hidden of Array.from(clone.querySelectorAll('[aria-hidden="true"]'))) {
      hidden.remove();
    }
    return clone.textContent?.trim() ?? "";
  };

  it("announces the connection state via real text content, not just an aria-label (#155)", () => {
    const { container, rerender } = render(
      <SessionStatusBar connections={{ connected: 0, total: 4, connecting: true }} />,
    );
    const connecting = container.querySelector(
      '[data-slot="session-status-bar-connections"]',
    ) as HTMLElement;
    expect(connecting).toHaveAttribute("role", "status");
    expect(connecting).toHaveAttribute("aria-live", "polite");
    // No separate `aria-label`: an explicit one would duplicate the
    // announced content as the accessible name too, and some ATs speak a
    // live region's name alongside its changed content ("Connecting…
    // Connecting…"). Leaving it off does NOT relocate the name to the
    // (sr-only) text — `role="status"` is `nameFrom: author`, so with no
    // `aria-label`/`aria-labelledby` the region simply has no accessible
    // name. That is fine: no acceptance criterion needs one here, only the
    // announced content (asserted below) does.
    expect(connecting).not.toHaveAttribute("aria-label");
    // Before the fix this was "" — the only text node was aria-hidden.
    expect(announceableText(connecting)).toBe("Connecting…");

    rerender(<SessionStatusBar connections={{ connected: 2, total: 4 }} />);
    const connected = container.querySelector(
      '[data-slot="session-status-bar-connections"]',
    ) as HTMLElement;
    expect(announceableText(connected)).toBe("2 of 4 connections");
    // The visible, aria-hidden counter is unchanged — the fix adds an
    // announcement, it does not alter the rendered appearance (#155 AC).
    expect(screen.getByText("2/4")).toHaveAttribute("aria-hidden", "true");
  });
});
