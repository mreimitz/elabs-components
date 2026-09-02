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
});
