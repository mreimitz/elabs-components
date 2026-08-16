import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarkdownView } from "./markdown-view";

afterEach(cleanup);

const DOC = `# Board note

A paragraph with [a link](https://example.com) and \`inline\` code.

- first
- second
`;

describe("MarkdownView (#193, research 04 §5 — document, not Shiki source)", () => {
  it("renders markdown onto the Prose primitives (document semantics)", () => {
    render(<MarkdownView>{DOC}</MarkdownView>);

    // Headings are real headings (not mono source text).
    expect(screen.getByRole("heading", { level: 1, name: "Board note" })).toBeInTheDocument();
    // Links map onto ProseLink (external → safe rel + new tab).
    const link = screen.getByRole("link", { name: "a link" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    // Lists are real lists.
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("caps headings at the constrained rung via baseHeadingLevel (research 09 §G.2)", () => {
    render(<MarkdownView baseHeadingLevel={2}>{DOC}</MarkdownView>);
    // The document `#` renders as an h2 (the `title` rung), never the
    // reading-scale h1 — no "biggest text on screen" inside a 20rem rail.
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Board note" })).toBeInTheDocument();
  });
});
