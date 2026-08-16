import { normalizeFileSource } from "@elabs-ai/components-ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResolvedHighlight } from "../../core/highlight";
import markdownModule, {
  MARKDOWN_CHARACTER_LIMIT,
  type MarkdownDocument,
} from "./markdown-adapter";

const SAMPLE = [
  "# Quarterly review",
  "",
  "Revenue grew **18%** against a flat market.",
  "",
  "- EMEA beat plan",
  "- APAC held flat",
  "",
  "See the [full report](https://example.com/report) and `pnpm build`.",
  "",
  "```ts",
  "const total = 18;",
  "```",
].join("\n");

function source(text: string, name = "README.md") {
  return normalizeFileSource({ kind: "text", text, name, mediaType: "text/markdown" });
}

const load = (text = SAMPLE) =>
  markdownModule.create().load(source(text), {}) as Promise<MarkdownDocument>;

describe("markdown adapter — loading", () => {
  it("keeps the source as-is; the parse belongs to the renderer", async () => {
    const doc = await load();
    expect(doc.kind).toBe("markdown");
    expect(doc.text).toBe(SAMPLE);
    expect(doc.totalCharacters).toBeUndefined();
  });

  it("truncates a file too large to parse, and says how much it kept", async () => {
    const doc = await load("a\n".repeat(600_000));
    expect(doc.text).toHaveLength(MARKDOWN_CHARACTER_LIMIT);
    expect(doc.totalCharacters).toBe(1_200_000);
  });

  it("reports an unreadable source as read-failed, not parse-failed", async () => {
    const failing = {
      ...source(""),
      text: () => Promise.reject(new Error("network down")),
    };
    await expect(markdownModule.create().load(failing, {})).rejects.toMatchObject({
      code: "read-failed",
    });
  });
});

describe("markdown adapter — rendering", () => {
  const Renderer = markdownModule.Renderer;

  const draw = async (text = SAMPLE) => {
    const doc = await load(text);
    return render(<Renderer document={doc} source={source(text)} />);
  };

  it("renders a document, not a wall of source", async () => {
    await draw();
    // A real heading element — this is the ASSET-2 defect in reverse: markdown
    // shown as highlighted source instead of as the document it is.
    expect(screen.getByRole("heading", { name: "Quarterly review" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "EMEA beat plan",
      "APAC held flat",
    ]);
  });

  it("offsets the document's headings below the host page's own", async () => {
    // A viewed README's `#` is the top of THAT document, not of the page. The
    // default puts it at h2, so a host page keeping its own h1 does not end up
    // with two of them in a screen reader's flat heading list.
    await draw();
    expect(screen.getByRole("heading", { name: "Quarterly review", level: 2 })).toBeInTheDocument();
  });

  it("honours a host that owns no h1 of its own", async () => {
    const doc = await load();
    render(<Renderer document={doc} source={source(SAMPLE)} baseHeadingLevel={1} />);
    expect(screen.getByRole("heading", { name: "Quarterly review", level: 1 })).toBeInTheDocument();
  });

  it("never renders past h6, whatever the offset", async () => {
    const doc = await load("###### Deep\n");
    render(<Renderer document={doc} source={source("")} baseHeadingLevel={6} />);
    // 6 + 6 - 1 = 11, clamped: an `h11` is not an element.
    expect(screen.getByRole("heading", { name: "Deep", level: 6 })).toBeInTheDocument();
  });

  it("renders links as links", async () => {
    await draw();
    expect(screen.getByRole("link", { name: "full report" })).toHaveAttribute(
      "href",
      "https://example.com/report",
    );
  });

  it("keeps fenced code as code", async () => {
    const { container } = await draw();
    expect(container.querySelector("pre")).toHaveTextContent("const total = 18;");
  });

  it("announces truncation as a status, not an error", async () => {
    const doc: MarkdownDocument = {
      kind: "markdown",
      text: "# Partial",
      totalCharacters: 1_200_000,
    };
    render(<Renderer document={doc} source={source("")} />);
    expect(screen.getByRole("status")).toHaveTextContent(/Showing the first/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a whitespace-only file as an empty state, not a blank pane", async () => {
    await draw("   \n\n");
    expect(screen.getByText("This file is empty")).toBeInTheDocument();
  });
});

describe("markdown renderer — highlighting", () => {
  const Renderer = markdownModule.Renderer;

  const cite = (id: string, range: [number, number], active = false): ResolvedHighlight => ({
    id,
    source: "citation",
    status: "resolved",
    address: { kind: "range", start: range[0], end: range[1] },
    active,
    range,
  });

  /** Offsets of a passage in the markdown SOURCE, which is the address space. */
  const rangeOf = (passage: string, text = SAMPLE): [number, number] => {
    const start = text.indexOf(passage);
    expect(start).toBeGreaterThanOrEqual(0);
    return [start, start + passage.length];
  };

  const drawWith = async (
    highlights: ResolvedHighlight[],
    activeHighlightId?: string,
    text = SAMPLE,
  ) => {
    const doc = await load(text);
    return render(
      <Renderer
        document={doc}
        source={source(text)}
        highlights={highlights}
        activeHighlightId={activeHighlightId}
      />,
    );
  };

  const plates = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[data-slot="highlight-block"]'));

  it("declares the address kinds it can actually honour", () => {
    expect(markdownModule.manifest.capabilities?.highlight).toEqual(["quote", "range"]);
  });

  it("plates the paragraph a passage falls in, and only that one", async () => {
    const { container } = await drawWith([cite("a", rangeOf("against a flat"))]);
    expect(plates(container).map((el) => el.textContent)).toEqual([
      "Revenue grew 18% against a flat market.",
    ]);
  });

  it("plates the heading when the passage is the heading", async () => {
    const { container } = await drawWith([cite("a", rangeOf("Quarterly review"))]);
    const [plate] = plates(container);
    expect(plate?.tagName).toBe("H2");
  });

  it("plates one list item, not the whole list", async () => {
    const { container } = await drawWith([cite("a", rangeOf("APAC held"))]);
    expect(plates(container).map((el) => el.textContent)).toEqual(["APAC held flat"]);
  });

  it("plates a fenced block on its `pre`, so the code keeps its own ground", async () => {
    const { container } = await drawWith([cite("a", rangeOf("const total"))]);
    const [plate] = plates(container);
    expect(plate?.tagName).toBe("PRE");
  });

  it("plates every block a passage spans", async () => {
    const start = SAMPLE.indexOf("Revenue");
    const end = SAMPLE.indexOf("APAC held flat") + "APAC held flat".length;
    const { container } = await drawWith([cite("a", [start, end])]);
    // The paragraph plus both list items — a citation that runs across a break
    // is still one passage, so every block it touches says so.
    expect(plates(container)).toHaveLength(3);
  });

  it("does not plate the block after a passage that ends where it starts", async () => {
    // Half-open on both sides: the heading's span ends exactly where the blank
    // line before the paragraph begins, and the paragraph must stay unplated.
    const { container } = await drawWith([cite("a", rangeOf("# Quarterly review"))]);
    expect(plates(container)).toHaveLength(1);
  });

  it("flags the current passage for assistive tech, not by colour alone", async () => {
    const { container } = await drawWith([cite("a", rangeOf("against a flat"), true)], "a");
    const active = container.querySelector('[data-slot="highlight-block"][data-active]');
    expect(active?.getAttribute("aria-current")).toBe("true");
  });

  it("plates a loose list item once, not once per nested paragraph", async () => {
    // A loose list renders as `li > p`; both nodes' source spans contain the
    // mark, so without the nesting guard the reader sees two stacked fills.
    const text = "- One\n\n- Two\n";
    const { container } = await drawWith([cite("a", rangeOf("One", text))], undefined, text);
    expect(plates(container)).toHaveLength(1);
  });

  it("draws nothing when no highlight is passed", async () => {
    const { container } = await drawWith([]);
    expect(plates(container)).toHaveLength(0);
  });
});
