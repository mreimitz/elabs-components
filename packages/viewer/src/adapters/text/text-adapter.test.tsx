import { normalizeFileSource } from "@elabs-ai/components-ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResolvedHighlight } from "../../core/highlight";
import textModule, { TEXT_CHARACTER_LIMIT, type TextDocument } from "./text-adapter";

const cite = (id: string, range: [number, number], active = false): ResolvedHighlight => ({
  id,
  source: "citation",
  status: "resolved",
  address: { kind: "range", start: range[0], end: range[1] },
  active,
  range,
});

const load = (text: string, name = "notes.txt") =>
  textModule
    .create()
    .load(normalizeFileSource({ kind: "text", text, name }), {}) as Promise<TextDocument>;

const source = normalizeFileSource({ kind: "text", text: "", name: "notes.txt" });

describe("text adapter — loading", () => {
  it("keeps a small file whole and claims no truncation", async () => {
    const doc = await load("line one\nline two");
    expect(doc.text).toBe("line one\nline two");
    expect(doc.totalCharacters).toBeUndefined();
  });

  it("truncates at load, not at render — a huge file must not reach the DOM", async () => {
    const doc = await load("x".repeat(TEXT_CHARACTER_LIMIT + 500));
    expect(doc.text).toHaveLength(TEXT_CHARACTER_LIMIT);
    expect(doc.totalCharacters).toBe(TEXT_CHARACTER_LIMIT + 500);
  });

  it("does not truncate a file exactly at the limit", async () => {
    const doc = await load("x".repeat(TEXT_CHARACTER_LIMIT));
    expect(doc.totalCharacters).toBeUndefined();
  });
});

describe("text adapter — rendering", () => {
  it("preserves whitespace so indentation survives", async () => {
    const doc = await load("  indented\n\n  again");
    const { container } = render(<textModule.Renderer document={doc} source={source} />);
    expect(container.querySelector("pre")?.textContent).toBe("  indented\n\n  again");
  });

  it("announces truncation as a status, never an error", async () => {
    const doc = await load("x".repeat(TEXT_CHARACTER_LIMIT + 1));
    render(<textModule.Renderer document={doc} source={source} />);
    expect(screen.getByRole("status")).toHaveTextContent(/Showing the first/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says nothing when the whole file is shown", async () => {
    const doc = await load("short");
    render(<textModule.Renderer document={doc} source={source} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("text adapter — highlighting", () => {
  it("declares the address kinds it can actually honour, and no others", () => {
    // `rect` is missing on purpose: plain text has no geometry.
    expect(textModule.manifest.capabilities?.highlight).toEqual(["quote", "range"]);
  });

  it("reports a capped file as truncated, so a miss can say WHY", async () => {
    expect((await load("x".repeat(TEXT_CHARACTER_LIMIT + 1))).textTruncated).toBe(true);
    expect((await load("short")).textTruncated).toBeUndefined();
  });

  it("marks a located range and leaves the rest of the file intact", async () => {
    const doc = await load("the delay was escalated");
    const { container } = render(
      <textModule.Renderer document={doc} source={source} highlights={[cite("a", [4, 9])]} />,
    );
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent("delay");
    // Nothing is dropped — a screen reader still reads the file continuously.
    expect(container.querySelector("pre")?.textContent).toBe("the delay was escalated");
  });

  it("distinguishes the current highlight from the rest", async () => {
    const doc = await load("delay delay delay");
    const { container } = render(
      <textModule.Renderer
        document={doc}
        source={source}
        highlights={[cite("a", [0, 5]), cite("b", [6, 11], true), cite("c", [12, 17])]}
        activeHighlightId="b"
      />,
    );
    expect(container.querySelectorAll("mark")).toHaveLength(3);
    const active = container.querySelectorAll("mark[data-active]");
    expect(active).toHaveLength(1);
    expect(active[0]?.getAttribute("aria-current")).toBe("true");
    expect(container.querySelectorAll("mark")[1]).toBe(active[0]);
  });

  it("renders the plain string when nothing located — no empty mark layer", async () => {
    const doc = await load("nothing to point at");
    const { container } = render(
      <textModule.Renderer
        document={doc}
        source={source}
        highlights={[
          {
            id: "a",
            source: "citation",
            status: "not-found",
            reason: "absent",
            address: { kind: "quote", text: "missing" },
            active: false,
          },
        ]}
      />,
    );
    expect(container.querySelectorAll("mark")).toHaveLength(0);
    expect(container.querySelector("pre")?.textContent).toBe("nothing to point at");
  });
});
