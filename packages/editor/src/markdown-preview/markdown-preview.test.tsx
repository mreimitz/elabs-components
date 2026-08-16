import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarkdownPreview } from "./markdown-preview";

afterEach(cleanup);

describe("MarkdownPreview", () => {
  it("renders standard markdown via branded primitives", async () => {
    render(
      <MarkdownPreview>{`# Objective\n\nMigrate **reports** to the platform.\n\n- one\n- two`}</MarkdownPreview>,
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: "Objective" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("list").tagName).toBe("UL");
  });

  it("renders a :::card directive as a Card", async () => {
    render(
      <MarkdownPreview>{`:::card{title="Customer Objective"}\nExplain the goal here.\n:::`}</MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText("Customer Objective")).toBeInTheDocument());
    expect(screen.getByText("Explain the goal here.")).toBeInTheDocument();
  });

  it("renders a :::callout directive as an Alert", async () => {
    render(
      <MarkdownPreview>{`:::callout{type="warning" title="Heads up"}\nMissing component.\n:::`}</MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText("Heads up")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("does not make the :::callout title a document heading (#21 heading-order)", async () => {
    render(
      <MarkdownPreview>{`# Doc\n\n:::callout{type="warning" title="Heads up"}\nMissing component.\n:::`}</MarkdownPreview>,
    );
    // The title text is present...
    await waitFor(() => expect(screen.getByText("Heads up")).toBeInTheDocument());
    // ...but NOT as a heading (it would otherwise jump h1 -> h5 in the outline).
    expect(screen.queryByRole("heading", { name: "Heads up" })).toBeNull();
  });

  it("renders a ::metric leaf directive as a MetricBlock", async () => {
    render(
      <MarkdownPreview>{`::metric{label="Scope" value="1,245" description="reports"}`}</MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText("1,245")).toBeInTheDocument());
    expect(screen.getByText("Scope")).toBeInTheDocument();
  });

  it("renders a :::timeline directive as a Timeline", async () => {
    render(
      <MarkdownPreview>{`:::timeline\n- (done) Draft\n- (active) Review\n- (pending) Publish\n:::`}</MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText("Draft")).toBeInTheDocument());
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Publish")).toBeInTheDocument();
  });

  it("surfaces an unknown directive instead of dropping it", async () => {
    render(<MarkdownPreview>{`:::mystery\nbody\n:::`}</MarkdownPreview>);
    await waitFor(() => expect(screen.getByText(/Unknown block: mystery/)).toBeInTheDocument());
  });
});

describe("MarkdownPreview — sourcepos + annotations (#L18)", () => {
  it("stamps data-sourcepos on block elements", async () => {
    render(<MarkdownPreview>{`# Title\n\nA paragraph.`}</MarkdownPreview>);
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute("data-sourcepos", "1:1"),
    );
    expect(screen.getByText("A paragraph.")).toHaveAttribute("data-sourcepos", "3:3");
  });

  it("washes annotated blocks and renders the removed marker", async () => {
    render(
      <MarkdownPreview
        annotations={[
          { kind: "added", startLine: 3, endLine: 3 },
          { kind: "removed-before", startLine: 1, endLine: 1, removedCount: 2 },
        ]}
      >{`# Title\n\nNew paragraph.`}</MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText("New paragraph.")).toBeInTheDocument());
    const washed = screen.getByText("New paragraph.").closest("[data-annotation]");
    expect(washed).not.toBeNull();
    expect(washed).toHaveAttribute("data-annotation", "added");
    expect(screen.getByRole("note", { name: /2 lines removed/ })).toBeInTheDocument();
  });

  it("shifts annotation lines when frontmatter is stripped", async () => {
    const md = `---\ntitle: X\n---\n# Title\n\nBody line.`;
    render(
      <MarkdownPreview annotations={[{ kind: "added", startLine: 6, endLine: 6 }]}>
        {md}
      </MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText("Body line.")).toBeInTheDocument());
    expect(screen.getByText("Body line.").closest("[data-annotation]")).not.toBeNull();
  });
});

describe("MarkdownPreview — in-document search (searchTerm/activeSearchLine)", () => {
  it("washes the block containing the active search line", async () => {
    render(
      <MarkdownPreview searchTerm="paragraph" activeSearchLine={3}>
        {`# Title\n\nA paragraph.\n\nAnother one.`}
      </MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText("A paragraph.")).toBeInTheDocument());
    expect(screen.getByText("A paragraph.").closest("[data-search-active]")).not.toBeNull();
    expect(screen.getByText("Another one.").closest("[data-search-active]")).toBeNull();
  });

  it("shifts the active line across stripped frontmatter", async () => {
    const md = `---\ntitle: X\n---\n# Title\n\nBody line.`;
    render(
      <MarkdownPreview searchTerm="Body" activeSearchLine={6}>
        {md}
      </MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText("Body line.")).toBeInTheDocument());
    expect(screen.getByText("Body line.").closest("[data-search-active]")).not.toBeNull();
  });

  it("marks the active non-mermaid fence instead of wrapping it", async () => {
    const { container } = render(
      <MarkdownPreview searchTerm="const" activeSearchLine={2}>
        {"```js\nconst x = 1;\n```"}
      </MarkdownPreview>,
    );
    await waitFor(() => expect(container.querySelector("pre")).not.toBeNull());
    expect(container.querySelector("pre")).toHaveAttribute("data-search-active");
  });
});

describe("MarkdownPreview — headingActions slot", () => {
  it("renders the action slot for each heading with text, level and line", async () => {
    const seen: Array<{ level: number; text: string; line?: number }> = [];
    render(
      <MarkdownPreview
        headingActions={(h) => {
          seen.push(h);
          return (
            <button type="button" aria-label={`Pin ${h.text}`}>
              pin
            </button>
          );
        }}
      >
        {`# Alpha\n\nbody\n\n## Beta **bold**\n\nmore`}
      </MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Pin Alpha" })).toBeTruthy());
    expect(screen.getByRole("button", { name: "Pin Beta bold" })).toBeTruthy();
    const alpha = seen.find((h) => h.text === "Alpha");
    const beta = seen.find((h) => h.text === "Beta bold");
    expect(alpha?.level).toBe(1);
    expect(alpha?.line).toBe(1);
    expect(beta?.level).toBe(2);
    expect(beta?.line).toBe(5);
  });

  it("hands STRIPPED-coordinate lines (matches parseMarkdownOutline)", async () => {
    const lines: Array<number | undefined> = [];
    render(
      <MarkdownPreview
        headingActions={(h) => {
          lines.push(h.line);
          return <button type="button" aria-label={`a-${h.text}`} />;
        }}
      >
        {`---\ntitle: X\n---\n# Alpha`}
      </MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "a-Alpha" })).toBeTruthy());
    expect(lines).toContain(1);
  });

  it("renders headings unchanged when no slot is provided", async () => {
    render(<MarkdownPreview>{`# Plain`}</MarkdownPreview>);
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1, name: "Plain" })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("MarkdownPreview — resolveUrl (#L4)", () => {
  it("rewrites image sources and link hrefs (before sanitization)", async () => {
    render(
      <MarkdownPreview
        resolveUrl={(url, kind) =>
          kind === "image" ? `data:image/png;base64,${btoa(url)}` : `https://app.test/repo/${url}`
        }
      >{`[doc](other.md)\n\n![shot](images/a.png)`}</MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByRole("link", { name: "doc" })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "doc" })).toHaveAttribute(
      "href",
      "https://app.test/repo/other.md",
    );
    expect(screen.getByRole("img", { name: "shot" })).toHaveAttribute(
      "src",
      `data:image/png;base64,${btoa("images/a.png")}`,
    );
  });
});

describe("MarkdownPreview — code fences (highlight + chip + copy)", () => {
  it("renders a language chip and a copy button on a fenced block", async () => {
    const { container } = render(<MarkdownPreview>{"```ts\nconst x = 1;\n```"}</MarkdownPreview>);
    await waitFor(() => expect(container.querySelector("pre")).toBeInTheDocument());
    expect(container.querySelector('[data-code-fence="ts"]')).not.toBeNull();
    expect(screen.getByText("ts")).toBeInTheDocument();
    // CopyButton (shared editor affordance) is wired to the fence text.
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });

  it("tokenizes the fence with CSS-variable-driven colors", async () => {
    const { container } = render(<MarkdownPreview>{"```js\nconst x = 1;\n```"}</MarkdownPreview>);
    // Shiki loads async; tokens land as styled spans referencing --md-code-*.
    await waitFor(
      () => {
        const token = container.querySelector("pre code span[style]");
        expect(token).not.toBeNull();
        expect((token as HTMLElement).style.color).toContain("var(--md-code-");
      },
      { timeout: 10_000 },
    );
  });

  it("renders a fence without a language tag as plain text (no chip)", async () => {
    const { container } = render(<MarkdownPreview>{"```\nplain text\n```"}</MarkdownPreview>);
    await waitFor(() => expect(container.querySelector("pre")).toBeInTheDocument());
    expect(container.querySelector('[data-code-fence=""]')).not.toBeNull();
    expect(screen.getByText("plain text")).toBeInTheDocument();
  });

  it("keeps the fence addressable by source line (data-sourcepos)", async () => {
    const { container } = render(
      <MarkdownPreview>{"intro\n\n```ts\nconst x = 1;\n```"}</MarkdownPreview>,
    );
    await waitFor(() => expect(container.querySelector("pre")).toBeInTheDocument());
    expect(container.querySelector("[data-code-fence]")).toHaveAttribute("data-sourcepos", "3:5");
  });
});

describe("MarkdownPreview — mermaid fences (#L1)", () => {
  it("routes ```mermaid fences to the MermaidDiagram component", async () => {
    render(<MarkdownPreview>{"```mermaid\ngraph TD; A-->B\n```"}</MarkdownPreview>);
    await waitFor(() => expect(screen.getByTestId("mermaid-diagram")).toBeInTheDocument());
  });

  it("keeps non-mermaid fences as plain pre blocks", async () => {
    const { container } = render(<MarkdownPreview>{"```ts\nconst x = 1;\n```"}</MarkdownPreview>);
    await waitFor(() => expect(container.querySelector("pre")).toBeInTheDocument());
    expect(container.querySelector('[data-testid="mermaid-diagram"]')).toBeNull();
  });
});

describe("MarkdownPreview — colon false-positives (#workbench live finding)", () => {
  it("renders prose colons literally instead of unknown-block errors", async () => {
    render(
      <MarkdownPreview>
        {"Models: qwen3.5:9b default, qwen3:0.6b embeddings, profile 35b-a3b:4b."}
      </MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText(/Models:/)).toBeInTheDocument());
    expect(screen.getByText(/qwen3\.5:9b/)).toBeInTheDocument();
    expect(screen.getByText(/qwen3:0\.6b embeddings/)).toBeInTheDocument();
    expect(screen.queryByText(/Unknown block/)).toBeNull();
  });

  it("restores unknown leaf directives (::name) as literal text", async () => {
    render(<MarkdownPreview>{"before\n\n::nope\n\nafter"}</MarkdownPreview>);
    await waitFor(() => expect(screen.getByText("after")).toBeInTheDocument());
    expect(screen.getByText("::nope")).toBeInTheDocument();
    expect(screen.queryByText(/Unknown block/)).toBeNull();
  });

  it("still flags unknown CONTAINER directives as explicit errors", async () => {
    render(<MarkdownPreview>{":::definitelynotreal\ncontent\n:::"}</MarkdownPreview>);
    await waitFor(() =>
      expect(screen.getByText(/Unknown block: definitelynotreal/)).toBeInTheDocument(),
    );
  });
});

describe("MarkdownPreview — extensions seam (#L: register without forking the engine)", () => {
  it("renders a registered CONTAINER directive via the consumer's renderer", async () => {
    render(
      <MarkdownPreview
        extensions={{
          directives: [
            {
              name: "decision",
              kinds: ["container"],
              render: ({ attributes, children }) => (
                <div data-testid="decision" data-status={attributes.status}>
                  {children}
                </div>
              ),
            },
          ],
        }}
      >{`:::decision{status="accepted"}\nWe will migrate.\n:::`}</MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByTestId("decision")).toBeInTheDocument());
    expect(screen.getByTestId("decision")).toHaveAttribute("data-status", "accepted");
    expect(screen.getByText("We will migrate.")).toBeInTheDocument();
  });

  it("renders a registered INLINE directive in the text flow", async () => {
    render(
      <MarkdownPreview
        extensions={{
          directives: [
            {
              name: "entity",
              kinds: ["inline"],
              render: ({ attributes, children }) => (
                <mark data-testid="entity" data-kind={attributes.kind}>
                  {children}
                </mark>
              ),
            },
          ],
        }}
      >{`Owner :entity[Acme]{kind=org} ships it.`}</MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByTestId("entity")).toBeInTheDocument());
    expect(screen.getByTestId("entity")).toHaveTextContent("Acme");
    expect(screen.getByTestId("entity")).toHaveAttribute("data-kind", "org");
    // Inline → no block wrapper: the chip lives INSIDE the paragraph (valid HTML).
    expect(screen.getByTestId("entity").closest("p")).not.toBeNull();
    expect(screen.queryByText(/Unknown block/)).toBeNull();
  });

  it("leaves an UNregistered inline prose colon as literal text", async () => {
    render(
      <MarkdownPreview
        extensions={{
          directives: [{ name: "entity", kinds: ["inline"], render: () => <span /> }],
        }}
      >{`Use :other[x] only when registered.`}</MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByText(/only when registered/)).toBeInTheDocument());
    expect(screen.getByText(/:other\[x\]/)).toBeInTheDocument();
    expect(screen.queryByText(/Unknown block/)).toBeNull();
  });

  it("renders a registered FENCE and keeps it addressable by source line", async () => {
    const { container } = render(
      <MarkdownPreview
        extensions={{
          fences: [
            {
              lang: "chart",
              render: ({ source }) => <figure data-testid="chart">{source}</figure>,
            },
          ],
        }}
      >
        {"intro\n\n```chart\nbars: 1,2,3\n```"}
      </MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByTestId("chart")).toBeInTheDocument());
    expect(screen.getByTestId("chart")).toHaveTextContent("bars: 1,2,3");
    expect(container.querySelector("[data-sourcepos='3:5']")).not.toBeNull();
  });

  it("routes a ```calc fence to CalcBlock via the evaluate sugar", async () => {
    render(
      <MarkdownPreview
        evaluate={() => ({
          results: [{ line: 1, tokens: [], value: { kind: "number", raw: 42, display: "42" } }],
          total: { kind: "number", raw: 42, display: "42" },
        })}
      >
        {"```calc\n40 + 2\n```"}
      </MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByTestId("calc-block")).toBeInTheDocument());
  });

  it("routes an inline :calc[expr] to a CalcInline chip with the VERBATIM expression", async () => {
    let seen = "";
    render(
      <MarkdownPreview
        evaluate={(src) => {
          seen = src;
          return {
            results: [
              { line: 1, tokens: [], value: { kind: "currency", raw: 2720, display: "2,720 USD" } },
            ],
          };
        }}
      >{`Budget is :calc[85 USD * 32] this quarter.`}</MarkdownPreview>,
    );
    await waitFor(() => expect(screen.getByTestId("calc-inline")).toBeInTheDocument());
    // The chip shows the result; the multiplication operator survived parsing
    // (raw-label capture), so the consumer's evaluate saw the real expression.
    expect(screen.getByTestId("calc-inline")).toHaveTextContent("2,720 USD");
    expect(seen).toBe("85 USD * 32");
    // Inline → lives inside the paragraph, no block wrapper.
    expect(screen.getByTestId("calc-inline").closest("p")).not.toBeNull();
  });
});
