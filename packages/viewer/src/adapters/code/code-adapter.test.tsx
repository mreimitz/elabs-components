import { normalizeFileSource } from "@elabs-ai/components-ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResolvedHighlight } from "../../core/highlight";
import codeModule, { CODE_CHARACTER_LIMIT, type CodeDocument } from "./code-adapter";

const cite = (id: string, range: [number, number], active = false): ResolvedHighlight => ({
  id,
  source: "citation",
  status: "resolved",
  address: { kind: "range", start: range[0], end: range[1] },
  active,
  range,
});

const SAMPLE = `// a greeting
export const greet = (name: string) => \`hello \${name}\`;
`;

function source(text: string, name = "greet.ts") {
  return normalizeFileSource({ kind: "text", text, name });
}

const load = (text = SAMPLE, name?: string) =>
  codeModule.create().load(source(text, name), {}) as Promise<CodeDocument>;

/**
 * Offset of the `greet` IDENTIFIER — not the "greet" inside the comment's
 * "greeting" on line 1, which is what a plain `indexOf("greet")` finds.
 */
const IDENTIFIER = SAMPLE.indexOf("greet =");

describe("code adapter — tokenizing", () => {
  it("resolves the grammar from the file name", async () => {
    const doc = await load();
    expect(doc.language).toBe("typescript");
  });

  it("returns one entry per line, in order", async () => {
    const doc = await load();
    // Trailing newline means a final empty line, which is real: a `<pre>` that
    // dropped it would render one line short of the file.
    expect(doc.lines).toHaveLength(3);
    expect(doc.lines[0]?.map((token) => token.text).join("")).toBe("// a greeting");
    expect(doc.lines[2]).toEqual([]);
  });

  it("colours tokens with brand token references, never a literal", async () => {
    const doc = await load();
    const colours = doc.lines.flat().map((token) => token.color);
    expect(colours.some((colour) => colour === "var(--code-comment)")).toBe(true);
    expect(colours.some((colour) => colour === "var(--code-keyword)")).toBe(true);
    // The whole reason for the CSS-variable theme: a raw hex would freeze the
    // document in whichever theme happened to be active when it was parsed.
    for (const colour of colours) expect(colour).not.toMatch(/^#/);
  });

  it("distinguishes a comment from a keyword — the theme really is applied", async () => {
    const doc = await load();
    const comment = doc.lines[0]?.[0];
    const keyword = doc.lines[1]?.find((token) => token.text.trim() === "export");
    expect(comment?.color).not.toBe(keyword?.color);
    expect(comment?.italic).toBe(true);
  });

  it("falls back to plain lines for a name it has no grammar for", async () => {
    const doc = await load("just words\n", "notes.unknownext");
    expect(doc.language).toBeUndefined();
    expect(doc.lines[0]).toEqual([{ text: "just words" }]);
  });

  it("exposes a plain-text projection for search and copy", async () => {
    const doc = await load();
    expect(doc.text).toBe(SAMPLE);
  });

  it("truncates a file too large to tokenize, and says so", async () => {
    // Deliberately on the HIGHLIGHTED path: truncation has to happen BEFORE
    // the grammar runs, and a test on the grammar-less path would still pass
    // if the slice moved below the tokenize call. That is also why this one
    // gets its own timeout — tokenizing at the limit is the work being
    // bounded, and it exceeds the 5s default on a loaded machine.
    const doc = await load(`const x = 1;\n`.repeat(40_000));
    expect(doc.text).toHaveLength(CODE_CHARACTER_LIMIT);
    expect(doc.totalCharacters).toBe(40_000 * 13);
  }, 30_000);

  it("reports an unreadable source as read-failed, not parse-failed", async () => {
    const failing = {
      ...source(""),
      text: () => Promise.reject(new Error("network down")),
    };
    await expect(codeModule.create().load(failing, {})).rejects.toMatchObject({
      code: "read-failed",
    });
  });
});

describe("code adapter — rendering", () => {
  const Renderer = codeModule.Renderer;

  it("renders every line of the file", async () => {
    const doc = await load();
    render(<Renderer document={doc} source={source(SAMPLE)} />);
    expect(screen.getByText("// a greeting")).toBeInTheDocument();
  });

  it("keeps line numbers out of the accessibility tree", async () => {
    const doc = await load();
    const { container } = render(<Renderer document={doc} source={source(SAMPLE)} />);
    const gutter = container.querySelectorAll('[aria-hidden="true"]');
    // One per line — decorative, so a screen reader reads the code, not "1 2 3".
    expect(gutter).toHaveLength(doc.lines.length);
    expect(gutter[0]?.textContent).toBe("1");
  });

  it("announces truncation as a status, not an error", () => {
    // Built directly rather than loaded: rendering half a million characters in
    // jsdom to assert one line of copy costs seconds and proves nothing extra.
    const doc: CodeDocument = {
      kind: "code",
      language: "typescript",
      lines: [[{ text: "const x = 1;" }]],
      text: "const x = 1;",
      totalCharacters: 520_000,
    };
    render(<Renderer document={doc} source={source("")} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/Showing the first/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an empty file as an empty state, not a blank pane", async () => {
    const doc = await load("", "empty.ts");
    render(<Renderer document={doc} source={source("", "empty.ts")} />);
    expect(screen.getByText("This file is empty")).toBeInTheDocument();
  });
});

describe("code adapter — highlighting", () => {
  const Renderer = codeModule.Renderer;

  it("declares the address kinds it can actually honour", () => {
    expect(codeModule.manifest.capabilities?.highlight).toEqual(["quote", "range"]);
  });

  it("rejoins its token lines to exactly the text ranges are addressed against", async () => {
    // The load-bearing invariant behind every offset below: if the tokenizer's
    // lines and `document.text` ever disagreed, every mark would land wrong.
    const doc = await load();
    expect(doc.lines.map((tokens) => tokens.map((token) => token.text).join("")).join("\n")).toBe(
      doc.text,
    );
  });

  it("marks a range that falls inside one syntax token", async () => {
    const doc = await load();
    const start = IDENTIFIER;
    const { container } = render(
      <Renderer
        document={doc}
        source={source(SAMPLE)}
        highlights={[cite("a", [start, start + 5])]}
      />,
    );
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent("greet");
    // The file still reads whole — the mark layer wraps, it does not replace.
    expect(container.querySelector("pre")?.textContent).toContain("export const greet");
  });

  it("keeps a range spanning several tokens as one continuous run", async () => {
    const doc = await load();
    const start = SAMPLE.indexOf("export");
    const end = IDENTIFIER + 5;
    const { container } = render(
      <Renderer document={doc} source={source(SAMPLE)} highlights={[cite("a", [start, end])]} />,
    );
    const marks = Array.from(container.querySelectorAll("mark"));
    // Several marks, because syntax colour lives on the token spans — but they
    // are adjacent and together spell the requested passage.
    expect(marks.length).toBeGreaterThan(1);
    expect(marks.map((mark) => mark.textContent).join("")).toBe("export const greet");
  });

  it("carries the active flag onto every token piece of the current run", async () => {
    const doc = await load();
    const start = SAMPLE.indexOf("export");
    const end = IDENTIFIER + 5;
    const { container } = render(
      <Renderer
        document={doc}
        source={source(SAMPLE)}
        highlights={[cite("a", [start, end], true)]}
        activeHighlightId="a"
      />,
    );
    const marks = Array.from(container.querySelectorAll("mark"));
    const active = Array.from(container.querySelectorAll("mark[data-active]"));
    expect(active).toHaveLength(marks.length);
    expect(active[0]?.getAttribute("aria-current")).toBe("true");
  });

  it("leaves untouched tokens rendering exactly as before", async () => {
    const doc = await load();
    const start = IDENTIFIER;
    const { container } = render(
      <Renderer
        document={doc}
        source={source(SAMPLE)}
        highlights={[cite("a", [start, start + 5])]}
      />,
    );
    const comment = screen.getByText("// a greeting");
    expect(comment.tagName).toBe("SPAN");
    expect(comment.querySelector("mark")).toBeNull();
    expect(container.querySelectorAll("mark")).toHaveLength(1);
  });
});
