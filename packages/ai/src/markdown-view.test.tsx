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

describe("MarkdownView components/plugins overrides (#10 — inline citations)", () => {
  const CITATION_DOC = `# Board note

Revenue grew[1](https://example.com/report) this quarter.

A paragraph with [a link](https://example.com) and \`inline\` code.

- first
- second
`;

  it("uses a consumer-supplied `components` entry for one element type", () => {
    render(
      <MarkdownView
        components={{
          a: ({ href, children }) => (
            <span data-testid="citation-chip" data-href={href}>
              [{children}]
            </span>
          ),
        }}
      >
        {CITATION_DOC}
      </MarkdownView>,
    );

    // The overridden `a` renders through the consumer's component…
    const chips = screen.getAllByTestId("citation-chip");
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveAttribute("data-href", "https://example.com/report");
    // …and NOT through the internal ProseLink (no anchor role at all now).
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps the internal prose styling for element types the consumer did NOT override", () => {
    // `baseHeadingLevel` is what makes this discriminating: a plain object
    // merge/replace of `components` still satisfies role=heading (Streamdown's
    // OWN default `h1` is still a real <h1>), but ONLY buildProseComponents()
    // knows about baseHeadingLevel's h1→h2 remap. If MarkdownView's merge drops
    // the internal map for keys the consumer didn't set, this regresses to h1.
    render(
      <MarkdownView
        baseHeadingLevel={2}
        components={{
          a: ({ children }) => <span data-testid="citation-chip">{children}</span>,
        }}
      >
        {CITATION_DOC}
      </MarkdownView>,
    );

    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Board note" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("keeps the default sanitisation pipeline active even when the consumer passes `plugins` (#10)", () => {
    // rehype-sanitize/rehype-harden run as Streamdown's own default
    // rehypePlugins — a pipeline MarkdownView never exposes or routes the
    // `plugins` (PluginConfig: cjk/code/math/mermaid) merge through. A
    // <script> survives only if that default pipeline was bypassed.
    const UNSAFE_DOC = `# Note\n\n<script>window.__pwned = true;</script>\n\nSafe text.`;
    render(<MarkdownView plugins={{}}>{UNSAFE_DOC}</MarkdownView>);

    expect(document.querySelector("script")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/pwned/);
  });
});
