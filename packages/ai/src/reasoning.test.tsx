import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Reasoning, ReasoningContent, ReasoningTrigger } from "./reasoning";

const open = (children: React.ReactNode) =>
  render(
    <Reasoning defaultOpen isStreaming={false}>
      <ReasoningTrigger />
      <ReasoningContent>{children}</ReasoningContent>
    </Reasoning>,
  );

describe("ReasoningContent — markdown or nodes", () => {
  it("renders a string child as markdown — syntax is consumed", () => {
    const { container } = open("**bold** reasoning");
    // Streamdown wraps tokens in styled <span>s for the streaming animation, so
    // don't assert a tag. The contract is that the markdown was PARSED: the
    // `**` delimiters are gone and only the text remains. The node-path test
    // below asserts the exact opposite, which is what pins the branch.
    expect(container.textContent).not.toContain("**");
    expect(screen.getByText("bold")).toBeInTheDocument();
  });

  it("performs structural markdown transforms on a string child", () => {
    open("- first\n- second");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders a non-string child as-is, never through the markdown parser", () => {
    // The consumer's case: a structured live reasoning ledger (timeline,
    // per-step status) inside the disclosure. `children: string` made this
    // impossible; handing JSX to Streamdown would be worse.
    open(
      <ol data-testid="ledger">
        <li>Fetch schema</li>
        <li>Join tables</li>
      </ol>,
    );

    expect(screen.getByTestId("ledger")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("does not markdown-parse text inside a node child", () => {
    open(<span data-testid="raw">**not bold**</span>);
    expect(screen.getByTestId("raw").textContent).toBe("**not bold**");
    expect(screen.queryByText("not bold")).not.toBeInTheDocument();
  });
});
