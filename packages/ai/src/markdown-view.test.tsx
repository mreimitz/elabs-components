import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("merges a real `plugins.cjk` override in (append), keeps sanitisation on, and keeps the untouched `plugins.math` default alive (#10)", () => {
    // A real, discriminating lock — NOT `plugins={{}}` (that exercises zero
    // slots and passes identically under merge, replace, or a no-op; #10
    // review I3). This test supplies a genuine `cjk` plugin (one of the two
    // slots MarkdownView actually reaches — `code`/`mermaid`/`renderers` are
    // consulted only inside Streamdown's OWN default `code` renderer, which
    // `buildProseComponents()` always shadows) and proves BOTH halves of the
    // merge property:
    //   1. Streamdown's default rehypePlugins (raw → sanitize → harden)
    //      still hold — a <script> is stripped.
    //   2. The supplied `cjk` plugin APPENDS (its remark transformer runs)
    //      *and* the internal `math` default the consumer did NOT set
    //      SURVIVES alongside it (`$$x^2$$` renders as real KaTeX, not
    //      literal text). A REPLACE implementation
    //      (`plugins = pluginOverrides`) would drop `math` — along with
    //      `code`/`mermaid` — the moment a consumer sets `cjk`, and this
    //      assertion would fail.
    const cjkRemarkSpy = vi.fn(() => (tree: unknown) => tree);
    const customCjkPlugin: NonNullable<
      NonNullable<ComponentProps<typeof MarkdownView>["plugins"]>["cjk"]
    > = {
      name: "cjk",
      remarkPlugins: [],
      remarkPluginsAfter: [cjkRemarkSpy],
      remarkPluginsBefore: [],
      type: "cjk",
    };
    const UNSAFE_DOC = `# Note

<script>window.__pwned = true;</script>

$$x^2$$
`;
    render(<MarkdownView plugins={{ cjk: customCjkPlugin }}>{UNSAFE_DOC}</MarkdownView>);

    // (1) sanitisation still holds.
    expect(document.querySelector("script")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/pwned/);
    // (2a) the supplied `cjk` plugin appended (its transformer ran)…
    expect(cjkRemarkSpy).toHaveBeenCalled();
    // (2b) …and the internal `math` default the consumer did not set is
    // still active — real KaTeX markup, not the literal `$$x^2$$` text.
    expect(document.querySelector(".katex")).toBeInTheDocument();
  });
});

describe("MarkdownView sanitiser is not overridable (#36)", () => {
  it("ignores a caller-supplied rehypePlugins array (the sanitiser is not overridable)", () => {
    // A rehype plugin that appends a <script> AFTER the pipeline. Under the bug the
    // consumer array REPLACES [rehypeRaw, rehypeSanitize, harden], so nothing strips it.
    const injectScript = () => (tree: { children: unknown[] }) => {
      tree.children.push({
        type: "element",
        tagName: "script",
        properties: {},
        children: [{ type: "text", value: "globalThis.__pwned = true" }],
      });
    };
    const { container } = render(
      // `as any`: a JS consumer, an `any`, or a wider spread object still reaches
      // this path even after the type-level `Omit`, so the assertion must exercise
      // the RUNTIME strip, not the type. (`as never` doesn't typecheck as a JSX
      // spread — TS2698, "Spread types may only be created from object types" —
      // `any` is the cast the issue itself names as the bypass vector.)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deliberate: proves the runtime strip, not the type
      <MarkdownView {...({ rehypePlugins: [injectScript] } as any)}>{"# hi"}</MarkdownView>,
    );
    expect(container.querySelector("script")).toBeNull();
  });

  it("SUPPORTS a caller-supplied remarkPlugins array, and still sanitises what it injects", () => {
    // PR #74 review, round 1: `remarkPlugins` is NOT a sanitiser override. It runs
    // upstream of [rehypeRaw, rehypeSanitize, harden], which Streamdown derives
    // without reading it — so the prop stays supported (no `as any` below: the TYPE
    // must accept it) while its output is still sanitised. Both halves are asserted,
    // so re-adding it to the runtime strip fails, and dropping the rehype chain fails.
    const ran = vi.fn();
    const injectHostile = () => (tree: { children: unknown[] }) => {
      ran();
      tree.children.push({
        type: "html",
        value: '<script>globalThis.__pwned = true</script><img src="x" onerror="void 0">',
      });
      tree.children.push({
        type: "paragraph",
        data: { hName: "script", hChildren: [{ type: "text", value: "globalThis.__x = 1" }] },
        children: [],
      });
    };
    const { container } = render(
      <MarkdownView remarkPlugins={[injectHostile]}>{"# hi"}</MarkdownView>,
    );

    expect(ran).toHaveBeenCalled(); // the prop really reached Streamdown
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
    expect(document.body.textContent).not.toMatch(/pwned/);
  });
});
