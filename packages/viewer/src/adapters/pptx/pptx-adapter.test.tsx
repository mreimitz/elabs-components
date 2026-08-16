import { normalizeFileSource } from "@elabs-ai/components-ui";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { ResolvedHighlight } from "../../core/highlight";
import { SAMPLE_PPTX_BASE64 } from "../office-fixture";
import pptxModule, { type PptxDocument } from "./pptx-adapter";

const MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function fixtureSource(name = "quarter.pptx") {
  const bytes = Uint8Array.from(atob(SAMPLE_PPTX_BASE64), (char) => char.charCodeAt(0));
  return normalizeFileSource({
    kind: "buffer",
    buffer: bytes.buffer as ArrayBuffer,
    name,
    mediaType: MEDIA_TYPE,
  });
}

const load = () => pptxModule.create().load(fixtureSource(), {}) as Promise<PptxDocument>;

// jsdom implements no scrolling, so the programmatic scroll is the only
// observable half of "take me to slide N" here. What the reader then sees is
// browser behaviour, and the story is what verifies it.
const scrollTo = vi.fn();
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    writable: true,
    value: scrollTo,
  });
});
beforeEach(() => {
  scrollTo.mockClear();
});

/** Where the column was asked to scroll to, in CSS pixels. */
const scrolledTo = () => (scrollTo.mock.calls.at(-1)?.[0] as { top?: number } | undefined)?.top;

/** Where a mounted slide actually sits in the column — its own laid-out offset. */
function offsetOf(index: number): number {
  const item = globalThis.document.querySelector(`[data-index="${index}"]`) as HTMLElement;
  return Number(/translateY\((-?[\d.]+)px\)/.exec(item.style.transform)?.[1]);
}

describe("pptx adapter — a real deck through jszip", () => {
  it("reads every slide in deck order, with its title", async () => {
    const doc = await load();
    expect(doc.pageCount).toBe(2);
    expect(doc.slides.map((slide) => slide.title)).toEqual(["Quarterly review", "Regions"]);
  });

  it("keeps the outline depth PowerPoint gave each line", async () => {
    const [first] = (await load()).slides;
    expect(first?.lines).toEqual([
      { text: "Revenue grew 18%", level: 0 },
      { text: "EMEA beat plan", level: 1 },
      { text: "APAC held flat", level: 1 },
    ]);
  });

  it("reads a table on a slide", async () => {
    const [, second] = (await load()).slides;
    expect(second?.lines).toContainEqual({ text: "Region\tRevenue", level: 0 });
  });

  it("follows the slide's relationship to its speaker notes", async () => {
    const doc = await load();
    expect(doc.slides[0]?.notes).toBe("Open with the revenue number, then hand over to Sam.");
    // Slide 2 has no notes part; that is a complete deck, not a failure.
    expect(doc.slides[1]?.notes).toBeUndefined();
  });

  it("projects the deck to text, notes included", async () => {
    const doc = await load();
    expect(doc.text).toContain("Quarterly review");
    expect(doc.text).toContain("hand over to Sam");
  });

  it("reports a file that is not a deck as parse-failed, not as a crash", async () => {
    const source = normalizeFileSource({
      kind: "text",
      text: "not a zip",
      name: "broken.pptx",
      mediaType: MEDIA_TYPE,
    });
    await expect(pptxModule.create().load(source, {})).rejects.toMatchObject({
      code: "parse-failed",
    });
  });
});

describe("pptx renderer", () => {
  it("shows the first slide, in a named frame the keyboard can reach", async () => {
    const doc = await load();
    render(<pptxModule.Renderer document={doc} source={fixtureSource()} />);

    expect(screen.getByRole("heading", { name: "Quarterly review" })).toBeInTheDocument();
    // A slide that overflows its 16:9 frame scrolls, so the frame itself has to
    // be a focus stop with a name (WCAG 2.1.1).
    expect(screen.getByLabelText("Slide 1")).toHaveAttribute("tabindex", "0");
  });

  it("stacks the slides — a deck scrolls, it does not flip", async () => {
    // The behaviour that prompted the change: slide 2 is one gesture below slide
    // 1, not behind a "next" button that swaps the frame.
    const doc = await load();
    render(<pptxModule.Renderer document={doc} source={fixtureSource()} />);
    expect(screen.getByRole("heading", { name: "Quarterly review" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Regions" })).toBeInTheDocument();
  });

  it("scrolls to the slide the shell asked for, including on the first frame", async () => {
    const doc = await load();
    render(<pptxModule.Renderer document={doc} source={fixtureSource()} pageNumber={2} />);
    await waitFor(() => expect(scrolledTo()).toBe(offsetOf(1)));
  });

  it("clamps a slide number past the end of the deck", async () => {
    const doc = await load();
    render(<pptxModule.Renderer document={doc} source={fixtureSource()} pageNumber={9} />);
    // The last slide, not an offset past the end of the column.
    await waitFor(() => expect(scrolledTo()).toBe(offsetOf(1)));
  });

  it("draws no chrome of its own — the pager lives in the shell (ADR 0026)", async () => {
    const doc = await load();
    render(<pptxModule.Renderer document={doc} source={fixtureSource()} />);
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next slide" })).not.toBeInTheDocument();
  });

  it("shows the speaker notes as their own labelled region", async () => {
    const doc = await load();
    render(<pptxModule.Renderer document={doc} source={fixtureSource()} />);
    expect(screen.getByRole("region", { name: "Speaker notes" })).toHaveTextContent(
      "hand over to Sam",
    );
  });

  it("says so when a slide has no text, instead of showing an empty frame", async () => {
    const doc = await load();
    const blank: PptxDocument = {
      ...doc,
      slides: [{ index: 1, lines: [] }],
      pageCount: 1,
    };
    render(<pptxModule.Renderer document={blank} source={fixtureSource()} />);
    expect(screen.getByText("This slide has no text")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Untitled slide" })).toBeInTheDocument();
  });
});

describe("pptx renderer — highlighting", () => {
  const cite = (id: string, range: [number, number], active = false): ResolvedHighlight => ({
    id,
    source: "citation",
    status: "resolved",
    address: { kind: "range", start: range[0], end: range[1] },
    active,
    range,
  });

  /** Offsets of a passage in the deck's own projection. */
  const rangeOf = (doc: PptxDocument, passage: string): [number, number] => {
    const start = doc.text?.indexOf(passage) ?? -1;
    expect(start).toBeGreaterThanOrEqual(0);
    return [start, start + passage.length];
  };

  const renderWith = async (
    pick: (doc: PptxDocument) => ResolvedHighlight[],
    activeHighlightId?: string,
    onPageChange?: (page: number) => void,
  ) => {
    const doc = await load();
    return render(
      <pptxModule.Renderer
        document={doc}
        source={fixtureSource()}
        highlights={pick(doc)}
        activeHighlightId={activeHighlightId}
        onPageChange={onPageChange}
      />,
    );
  };

  it("declares the address kinds it can actually honour", () => {
    expect(pptxModule.manifest.capabilities?.highlight).toEqual(["quote", "range"]);
  });

  it("marks the bullet a citation points at, not the whole slide", async () => {
    const { container } = await renderWith((doc) => [cite("a", rangeOf(doc, "EMEA beat plan"))]);
    const marks = Array.from(container.querySelectorAll("mark"));
    expect(marks).toHaveLength(1);
    expect(marks[0]?.closest("li")?.textContent).toBe("EMEA beat plan");
  });

  it("marks the slide title", async () => {
    const { container } = await renderWith((doc) => [cite("a", rangeOf(doc, "Quarterly"))]);
    expect(container.querySelector("mark")?.closest("h2")?.textContent).toBe("Quarterly review");
  });

  it("marks the speaker notes, which are part of the projection", async () => {
    const { container } = await renderWith((doc) => [cite("a", rangeOf(doc, "hand over to Sam"))]);
    const mark = container.querySelector("mark");
    expect(mark?.textContent).toBe("hand over to Sam");
    expect(mark?.closest("section")?.getAttribute("aria-label")).toBe("Speaker notes");
  });

  it("pages to the cited slide instead of marking nothing", async () => {
    // "Region\tRevenue" is a table on slide 2, which is not the slide that opens.
    // The renderer no longer owns the pager, so this is a REQUEST it makes —
    // asserted both as the call and as its effect.
    const onPageChange = vi.fn();
    const { container } = await renderWith(
      (doc) => [cite("a", rangeOf(doc, "Region\tRevenue"), true)],
      "a",
      onPageChange,
    );
    expect(await screen.findByRole("heading", { name: "Regions" })).toBeInTheDocument();
    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(container.querySelector("mark")?.textContent).toBe("Region\tRevenue");
  });

  it("flags the current passage for assistive tech, not by colour alone", async () => {
    const { container } = await renderWith(
      (doc) => [cite("a", rangeOf(doc, "Revenue grew 18%"), true)],
      "a",
    );
    const active = container.querySelector('mark[data-active][data-slot="match-highlight-mark"]');
    expect(active?.getAttribute("aria-current")).toBe("true");
    expect(active?.textContent).toBe("Revenue grew 18%");
  });

  it("draws nothing when no highlight is passed", async () => {
    const { container } = await renderWith(() => []);
    expect(container.querySelectorAll("mark")).toHaveLength(0);
  });
});
