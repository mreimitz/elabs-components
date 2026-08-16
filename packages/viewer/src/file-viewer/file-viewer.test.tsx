import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import type { DocumentAddressKind } from "@qlik-coe-emea/qlabs-components-ui";

import type { DocumentHighlight } from "../core/highlight";
import { createRegistry } from "../core/registry";
import {
  PROTOCOL_VERSION,
  type AdapterManifest,
  type AdapterModule,
  type AdapterRendererProps,
} from "../core/types";
import { FileViewer, FileViewerContent, FileViewerFrame, FileViewerProvider } from "./file-viewer";
import { useFileViewer } from "./file-viewer-context";

const textSource = { kind: "text", text: "hello world", name: "notes.txt" } as const;

/** A registry with only the text adapter — enough to exercise the state grid. */
function textOnlyRegistry() {
  const registry = createRegistry();
  registry.register(
    {
      id: "text",
      protocol: PROTOCOL_VERSION,
      categories: ["text"],
      mediaTypes: ["text/"],
      capabilities: { text: true },
    },
    () => import("../adapters/text/text-adapter"),
  );
  return registry;
}

describe("FileViewer — the state grid", () => {
  it("shows the empty state with no source, and does not call it an error", () => {
    render(<FileViewer registry={textOnlyRegistry()} />);
    expect(screen.getByText("No file selected")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("announces loading once, then renders the file", async () => {
    render(<FileViewer source={textSource} registry={textOnlyRegistry()} />);

    // The skeleton is decorative; the single live region is what AT hears.
    expect(screen.getByRole("status")).toHaveTextContent("Loading notes.txt…");
    await waitFor(() => {
      expect(screen.getByText("hello world")).toBeInTheDocument();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("reports a file no adapter claims as unsupported, with no retry offered", async () => {
    render(
      <FileViewer
        source={{ kind: "text", text: "x", name: "thing.pdf", mediaType: "application/pdf" }}
        registry={textOnlyRegistry()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Can't preview this file type")).toBeInTheDocument();
    });
    // Retrying cannot change the outcome — offering it would teach the user the
    // button does nothing.
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("names the missing package when an optional peer is not installed", async () => {
    const registry = createRegistry();
    const manifest: AdapterManifest = {
      id: "csv",
      protocol: PROTOCOL_VERSION,
      extensions: ["csv"],
      requires: ["papaparse"],
    };
    registry.register(manifest, () => Promise.reject(new Error("Cannot find module 'papaparse'")));

    render(
      <FileViewer source={{ kind: "text", text: "a,b", name: "r.csv" }} registry={registry} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/needs papaparse to be installed/)).toBeInTheDocument();
    });
  });

  it("names the missing package when the peer is reached from INSIDE load()", async () => {
    // Where every parser engine actually lives: `await import("mammoth")` runs
    // in the adapter's own `load()`, so the module resolves fine and the
    // rejection lands on the provider, not on `registry.load()`. Before this was
    // handled, the reader was told their file was damaged ("isn't a valid file")
    // and offered a retry that could never succeed.
    const registry = createRegistry();
    const manifest: AdapterManifest = {
      id: "docx",
      protocol: PROTOCOL_VERSION,
      extensions: ["docx"],
      requires: ["mammoth"],
    };
    registry.register(manifest, () =>
      Promise.resolve({
        manifest,
        create: () => ({
          load: () => Promise.reject(new Error("Failed to resolve module specifier 'mammoth'")),
        }),
        Renderer: () => null,
      } satisfies AdapterModule),
    );

    render(
      <FileViewer source={{ kind: "text", text: "x", name: "report.docx" }} registry={registry} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/needs mammoth to be installed/)).toBeInTheDocument();
    });
    // A capability gap, so: no alarm, and no retry that cannot work.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("presents a capability gap as news, not as an alarm", async () => {
    render(
      <FileViewer
        source={{ kind: "text", text: "x", name: "thing.pdf", mediaType: "application/pdf" }}
        registry={textOnlyRegistry()}
      />,
    );
    await screen.findByText("Can't preview this file type");

    // "This build can't draw PDFs" is not the reader's failure, and `alert`
    // interrupts. It is still announced — politely.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Can't preview this file type");
  });

  it("keeps a real failure an alert", async () => {
    const registry = createRegistry();
    registry.register({ id: "bad", protocol: PROTOCOL_VERSION, categories: ["text"] }, () =>
      Promise.resolve({
        manifest: { id: "bad", protocol: PROTOCOL_VERSION, categories: ["text"] },
        create: () => ({ load: () => Promise.reject(new Error("bad bytes")) }),
        Renderer: () => null,
      } satisfies AdapterModule),
    );

    render(<FileViewer source={textSource} registry={registry} />);
    await screen.findByText("Couldn't read this file");
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("offers a retry for a read failure, and re-runs the load", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("network died"))
      .mockResolvedValueOnce({ kind: "text", text: "second try" });
    const adapterModule: AdapterModule = {
      manifest: { id: "flaky", protocol: PROTOCOL_VERSION, categories: ["text"] },
      create: () => ({ load }),
      Renderer: ({ document: doc }) => <p>{(doc as { text: string }).text}</p>,
    };
    const registry = createRegistry();
    registry.register(adapterModule.manifest, () => Promise.resolve(adapterModule));

    render(<FileViewer source={textSource} registry={registry} />);

    const retry = await screen.findByRole("button", { name: "Try again" });
    await userEvent.click(retry);

    await waitFor(() => {
      expect(screen.getByText("second try")).toBeInTheDocument();
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps a parent's loading prop additive — it cannot clear a real error", async () => {
    const registry = createRegistry();
    registry.register({ id: "bad", protocol: PROTOCOL_VERSION, categories: ["text"] }, () =>
      Promise.resolve({
        manifest: { id: "bad", protocol: PROTOCOL_VERSION, categories: ["text"] },
        create: () => ({ load: () => Promise.reject(new Error("bad bytes")) }),
        Renderer: () => null,
      } satisfies AdapterModule),
    );

    const { rerender } = render(<FileViewer source={textSource} registry={registry} />);
    await screen.findByText("Couldn't read this file");

    rerender(<FileViewer source={textSource} registry={registry} loading />);
    expect(screen.getByText("Couldn't read this file")).toBeInTheDocument();
  });
});

describe("FileViewer — chrome", () => {
  it("names the region and the file, and offers a download", async () => {
    render(<FileViewer source={textSource} registry={textOnlyRegistry()} />);

    expect(screen.getByRole("region", { name: "File viewer" })).toBeInTheDocument();
    expect(screen.getByText("notes.txt")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Download notes.txt" })).toBeInTheDocument();
  });

  it("renders no identity row when there is no file", () => {
    render(<FileViewer registry={textOnlyRegistry()} />);
    // A row holding a generic glyph and a blank name reads as a broken render.
    expect(document.querySelector('[data-slot="file-viewer-toolbar"]')).toBeNull();
    expect(screen.queryByRole("button", { name: /Download/ })).not.toBeInTheDocument();
  });

  it("makes the scrolling content pane a real keyboard stop", async () => {
    render(<FileViewer source={textSource} registry={textOnlyRegistry()} />);
    await screen.findByText("hello world");

    // A plain-text file contains nothing focusable, so without this the pane
    // scrolls for a mouse and is unreachable from a keyboard (WCAG 2.1.1).
    const content = screen.getByRole("region", { name: "File content" });
    expect(content).toHaveAttribute("tabindex", "0");

    await userEvent.tab();
    await userEvent.tab();
    expect(content).toHaveFocus();
  });

  it("keeps ONE scroll boundary — a flowing adapter does not nest a second", async () => {
    // Two nested `overflow-auto` boxes do not compose: the inner one clips
    // while the outer one's padding stays put, so a long file ends flush
    // against a band of whitespace and reads as a failed render.
    render(<FileViewer source={textSource} registry={textOnlyRegistry()} />);
    const content = await screen.findByRole("region", { name: "File content" });
    expect(content.querySelector(".overflow-auto")).toBeNull();
  });

  it("does not claim role=toolbar — that promises arrow-key navigation it lacks", () => {
    render(<FileViewer source={textSource} registry={textOnlyRegistry()} />);
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  });

  it("replaces the default composition when children are given", () => {
    render(
      <FileViewer source={textSource} registry={textOnlyRegistry()}>
        <p>custom</p>
      </FileViewer>,
    );
    expect(screen.getByText("custom")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Download/ })).not.toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* Page, zoom and rotation (ADR 0026)                                          */
/* -------------------------------------------------------------------------- */

/**
 * A three-page format that claims every view capability and echoes back what the
 * shell handed it.
 *
 * The echo is the point: page, zoom and rotation used to be `useState` inside
 * each renderer, so the only way to observe them was through that renderer's own
 * chrome. Now the shell owns them and the adapter is downstream — which is what
 * these assertions check.
 */
function pagedRegistry(
  capabilities: AdapterManifest["capabilities"] = { pages: true, zoom: true, rotate: true },
  reportZoom?: number,
) {
  const manifest: AdapterManifest = {
    id: "paged",
    protocol: PROTOCOL_VERSION,
    categories: ["text"],
    capabilities,
  };
  const registry = createRegistry();
  registry.register(manifest, () =>
    Promise.resolve({
      manifest,
      create: () => ({ load: () => Promise.resolve({ kind: "paged", pageCount: 3 }) }),
      Renderer: ({ pageNumber, zoom, rotation, onZoomResolved }: AdapterRendererProps) => {
        // Standing in for the real thing: only the renderer can measure its own
        // viewport, so a fit mode is resolved down here and reported back up.
        useEffect(() => {
          if (reportZoom !== undefined) onZoomResolved?.(reportZoom);
        }, [onZoomResolved]);
        return <div data-testid="view">{`${pageNumber}|${String(zoom)}|${rotation}`}</div>;
      },
    } satisfies AdapterModule),
  );
  return registry;
}

const view = () => screen.getByTestId("view").textContent;

describe("FileViewer — paging", () => {
  it("shows no page control for a format that has no pages", async () => {
    render(<FileViewer source={textSource} registry={textOnlyRegistry()} />);
    await screen.findByText("hello world");
    // An inert "1 of 0" over a text file is chrome with nothing in it.
    expect(screen.queryByRole("group", { name: "Pages" })).not.toBeInTheDocument();
  });

  it("pages with the buttons and stops at both ends", async () => {
    render(<FileViewer source={textSource} registry={pagedRegistry()} />);
    await screen.findByTestId("view");

    const next = screen.getByRole("button", { name: "Next page" });
    const previous = screen.getByRole("button", { name: "Previous page" });
    expect(previous).toBeDisabled();
    expect(screen.getByText("of 3")).toBeInTheDocument();

    await userEvent.click(next);
    expect(view()).toBe("2|fit-width|0");
    await userEvent.click(next);
    expect(next).toBeDisabled();

    await userEvent.click(previous);
    expect(view()).toBe("2|fit-width|0");
  });

  it("takes a typed page number, and clamps one past the end", async () => {
    render(<FileViewer source={textSource} registry={pagedRegistry()} />);
    await screen.findByTestId("view");

    const field = screen.getByRole("textbox", { name: "Page number" });
    await userEvent.clear(field);
    await userEvent.type(field, "3{Enter}");
    expect(view()).toBe("3|fit-width|0");

    await userEvent.clear(field);
    await userEvent.type(field, "99{Enter}");
    expect(view()).toBe("3|fit-width|0");
    expect(field).toHaveValue("3");
  });

  it("abandons a half-typed page on Escape instead of navigating", async () => {
    render(<FileViewer source={textSource} registry={pagedRegistry()} />);
    await screen.findByTestId("view");

    const field = screen.getByRole("textbox", { name: "Page number" });
    await userEvent.clear(field);
    await userEvent.type(field, "2{Escape}");
    expect(view()).toBe("1|fit-width|0");
    expect(field).toHaveValue("1");
  });

  it("says where the reader is, in ONE live region", async () => {
    render(<FileViewer source={textSource} registry={pagedRegistry()} />);
    await screen.findByTestId("view");

    // Paging repaints a canvas, which announces nothing on its own — and one
    // region for the group, not one per control (loading-states.md).
    const live = screen.getByText("Page 1 of 3");
    expect(live).toHaveAttribute("aria-live", "polite");
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });

  it("lets an app own the page — controlled means controlled", async () => {
    const onPageNumberChange = vi.fn();
    render(
      <FileViewer
        source={textSource}
        registry={pagedRegistry()}
        pageNumber={2}
        onPageNumberChange={onPageNumberChange}
      />,
    );
    await screen.findByTestId("view");
    expect(view()).toBe("2|fit-width|0");

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(onPageNumberChange).toHaveBeenCalledWith(3);
    // The app did not move it, so it did not move — a deep-linked page that
    // drifted out from under its own URL would be worse than an inert button.
    expect(view()).toBe("2|fit-width|0");
  });
});

describe("FileViewer — zoom and rotation", () => {
  it("shows neither control for a format that claims neither", async () => {
    render(<FileViewer source={textSource} registry={pagedRegistry({ pages: true })} />);
    await screen.findByTestId("view");
    expect(screen.queryByRole("group", { name: "Zoom" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rotate clockwise" })).not.toBeInTheDocument();
  });

  it("asks for a fit by default and lets the renderer resolve it", async () => {
    render(<FileViewer source={textSource} registry={pagedRegistry(undefined, 1.5)} />);
    await screen.findByTestId("view");

    // The state is the REQUEST ("fit-width"); the percentage is what came back.
    expect(view()).toBe("1|fit-width|0");
    expect(screen.getByRole("combobox", { name: "Zoom level" })).toHaveTextContent("Fit width");
    await waitFor(() => expect(screen.getByText("Zoom 150%")).toBeInTheDocument());
  });

  it("steps from what is ON SCREEN, not from the last number asked for", async () => {
    // A page fitted to 150% steps to 200%, not to 125% — otherwise the first
    // press of "+" makes the page smaller.
    render(<FileViewer source={textSource} registry={pagedRegistry(undefined, 1.5)} />);
    await screen.findByTestId("view");
    await waitFor(() => expect(screen.getByText("Zoom 150%")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(view()).toBe("1|2|0");
    expect(screen.getByRole("combobox", { name: "Zoom level" })).toHaveTextContent("200%");
  });

  it("stops at both ends of the ladder", async () => {
    render(<FileViewer source={textSource} registry={pagedRegistry()} defaultZoom={3} />);
    await screen.findByTestId("view");
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(view()).toBe("1|2|0");
  });

  it("turns the document a quarter at a time, all the way round", async () => {
    render(<FileViewer source={textSource} registry={pagedRegistry()} />);
    await screen.findByTestId("view");

    const rotate = screen.getByRole("button", { name: "Rotate clockwise" });
    for (const expected of ["90", "180", "270", "0"]) {
      await userEvent.click(rotate);
      expect(view()).toBe(`1|fit-width|${expected}`);
    }
  });

  it("starts the next file at page 1, the right way up, at the same scale", async () => {
    const { rerender } = render(<FileViewer source={textSource} registry={pagedRegistry()} />);
    await screen.findByTestId("view");
    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    await userEvent.click(screen.getByRole("button", { name: "Rotate clockwise" }));
    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(view()).toBe("2|1.25|90");

    rerender(
      <FileViewer
        source={{ kind: "text", text: "other", name: "other.txt" }}
        registry={pagedRegistry()}
      />,
    );
    // Page and rotation belong to the document. The scale is the READER's
    // preference — resetting it would undo their choice on every file.
    await waitFor(() => expect(view()).toBe("1|1.25|0"));
  });
});

/* -------------------------------------------------------------------------- */
/* Highlights                                                                  */
/* -------------------------------------------------------------------------- */

/** Renders what the shell handed it, so a test can assert on the seam itself. */
function spyRegistry(
  highlight?: readonly DocumentAddressKind[],
  options: { truncated?: boolean } = {},
) {
  const manifest: AdapterManifest = {
    id: "spy",
    protocol: PROTOCOL_VERSION,
    categories: ["text"],
    capabilities: { text: true, ...(highlight ? { highlight } : {}) },
  };
  const registry = createRegistry();
  registry.register(manifest, () =>
    Promise.resolve({
      manifest,
      create: () => ({
        // Reads the source rather than hard-coding a string, so a test can
        // choose the document text it needs (case sensitivity, no matches).
        load: (source, _context) =>
          source
            .text()
            .then((text) => ({ kind: "spy", text, textTruncated: options.truncated ?? false })),
      }),
      Renderer: ({ highlights = [], activeHighlightId }: AdapterRendererProps) => (
        <ul data-testid="seen">
          <li data-testid="active">{activeHighlightId ?? "none"}</li>
          {highlights.map((entry) => (
            <li key={entry.id}>{`${entry.id}:${entry.status}:${String(entry.active)}`}</li>
          ))}
        </ul>
      ),
    } satisfies AdapterModule),
  );
  return registry;
}

const QUOTE: DocumentHighlight = { id: "c1", address: { kind: "quote", text: "WORLD" } };

describe("FileViewer — pointing at part of a document", () => {
  it("hands the adapter located highlights, not raw requests", async () => {
    render(
      <FileViewer source={textSource} registry={spyRegistry(["quote"])} highlights={[QUOTE]} />,
    );
    // LOCATE ran in the shell: the quote is case-folded, found, and reported as
    // resolved before the renderer ever sees it.
    expect(await screen.findByText("c1:resolved:false")).toBeInTheDocument();
  });

  it("reports a kind the adapter never declared as unsupported, and still renders", async () => {
    render(<FileViewer source={textSource} registry={spyRegistry()} highlights={[QUOTE]} />);
    expect(await screen.findByText("c1:unsupported:false")).toBeInTheDocument();
  });

  it("forwards every provider prop — including the ones added after it shipped", async () => {
    // The regression this locks: `FileViewer` used to peel off four props by
    // name and spread the rest onto the frame, so `baseHeadingLevel` and every
    // later provider prop type-checked, never reached the provider, and landed
    // on the <section> as an unknown DOM attribute.
    const { container } = render(
      <FileViewer
        source={textSource}
        registry={spyRegistry(["quote"])}
        highlights={[QUOTE]}
        activeHighlightId="c1"
        baseHeadingLevel={1}
      />,
    );
    expect(await screen.findByText("c1:resolved:true")).toBeInTheDocument();
    expect(container.querySelector("[baseheadinglevel]")).toBeNull();
    expect(container.querySelector("[activehighlightid]")).toBeNull();
  });

  it("owns the active highlight when it is uncontrolled", async () => {
    function Harness() {
      const { actions } = useFileViewer();
      return (
        <>
          <button onClick={actions.nextHighlight}>next</button>
          <FileViewerContent />
        </>
      );
    }
    render(
      <FileViewer
        source={textSource}
        registry={spyRegistry(["quote"])}
        defaultHighlights={[QUOTE, { id: "c2", address: { kind: "quote", text: "hello" } }]}
      >
        <Harness />
      </FileViewer>,
    );

    await screen.findByText("c1:resolved:false");
    await userEvent.click(screen.getByRole("button", { name: "next" }));
    // Document order, not the order asked for: "hello" precedes "world".
    expect(screen.getByTestId("active")).toHaveTextContent("c2");
  });

  it("never writes a controlled active id locally — it only reports", async () => {
    const onActiveHighlightChange = vi.fn();
    function Harness() {
      const { actions } = useFileViewer();
      return (
        <>
          <button onClick={actions.nextHighlight}>next</button>
          <FileViewerContent />
        </>
      );
    }
    render(
      <FileViewer
        source={textSource}
        registry={spyRegistry(["quote"])}
        highlights={[QUOTE]}
        activeHighlightId={null}
        onActiveHighlightChange={onActiveHighlightChange}
      >
        <Harness />
      </FileViewer>,
    );

    await screen.findByText("c1:resolved:false");
    await userEvent.click(screen.getByRole("button", { name: "next" }));
    expect(onActiveHighlightChange).toHaveBeenCalledWith("c1");
    // The owner said `null` and has not said otherwise, so it is still null.
    expect(screen.getByTestId("active")).toHaveTextContent("none");
  });
});

describe("FileViewer — find-in-document", () => {
  function Probe() {
    const { state, meta } = useFileViewer();
    return (
      <p data-testid="find">
        {`${String(meta.canFind)}/${String(state.find.matches)}/${String(state.find.activeIndex)}`}
      </p>
    );
  }

  it("offers find when the adapter can paint a range, without a declared flag", async () => {
    // `capabilities.search` is an override in the OFF direction only. Read as
    // the source of truth it would deny the find box to PDF, whose manifest
    // predates the feature and never declared it.
    render(
      <FileViewer source={textSource} registry={spyRegistry(["range"])}>
        <Probe />
      </FileViewer>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("find")).toHaveTextContent("true/0/0");
    });
  });

  it("does not offer find when nothing could paint the result", async () => {
    render(
      <FileViewer source={textSource} registry={spyRegistry(["quote"])}>
        <Probe />
      </FileViewer>,
    );
    await waitFor(() => {
      expect(screen.getByTestId("find")).toHaveTextContent("false/0/0");
    });
  });

  it("turns a query into resolved matches the adapter can draw", async () => {
    function Harness() {
      const { actions } = useFileViewer();
      return (
        <>
          <button
            onClick={() => {
              actions.openFind();
              actions.setFindQuery("l");
            }}
          >
            search
          </button>
          <Probe />
          <FileViewerContent />
        </>
      );
    }
    render(
      <FileViewer source={textSource} registry={spyRegistry(["range"])}>
        <Harness />
      </FileViewer>,
    );

    await screen.findByTestId("seen");
    await userEvent.click(screen.getByRole("button", { name: "search" }));

    // "hello world" — three l's, and the first is current.
    await waitFor(() => {
      expect(screen.getByTestId("find")).toHaveTextContent("true/3/0");
    });
    expect(screen.getByText("find:0:resolved:true")).toBeInTheDocument();
    expect(screen.getByText("find:2:resolved:false")).toBeInTheDocument();
  });

  it("points the RENDERER at the find match, not at the citation knob", async () => {
    // The regression this locks: the shell passed `state.activeHighlightId` —
    // the citation knob — to the renderer, while marking the find match active
    // in the list. Every renderer that navigates or scrolls keys off that id, so
    // with no citation active (the ordinary find case) Enter repainted the mark
    // and never scrolled to it, never turned the PDF's page, and never switched
    // the workbook's sheet.
    function Harness() {
      const { actions } = useFileViewer();
      return (
        <>
          <button
            onClick={() => {
              actions.openFind();
              actions.setFindQuery("world");
            }}
          >
            search
          </button>
          <FileViewerContent />
        </>
      );
    }
    render(
      <FileViewer source={textSource} registry={spyRegistry(["range", "quote"])}>
        <Harness />
      </FileViewer>,
    );

    await screen.findByTestId("seen");
    expect(screen.getByTestId("active")).toHaveTextContent("none");
    await userEvent.click(screen.getByRole("button", { name: "search" }));
    await waitFor(() => {
      expect(screen.getByTestId("active")).toHaveTextContent("find:0");
    });
  });

  it("lets the reader's own match outrank a citation, and only one is current", async () => {
    function Harness() {
      const { actions } = useFileViewer();
      return (
        <>
          <button
            onClick={() => {
              actions.openFind();
              actions.setFindQuery("world");
            }}
          >
            search
          </button>
          <FileViewerContent />
        </>
      );
    }
    render(
      <FileViewer
        source={textSource}
        registry={spyRegistry(["range", "quote"])}
        highlights={[QUOTE]}
        activeHighlightId="c1"
      >
        <Harness />
      </FileViewer>,
    );

    expect(await screen.findByText("c1:resolved:true")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "search" }));

    // Find wins while its box is open: it is what the reader's keystrokes move.
    // Two things painted as "current" would make the reader's own match look
    // like every other match.
    await waitFor(() => {
      expect(screen.getByText("find:0:resolved:true")).toBeInTheDocument();
    });
    expect(screen.getByText("c1:resolved:false")).toBeInTheDocument();
    expect(screen.getByTestId("active")).toHaveTextContent("find:0");
  });

  it("hands the citation back the moment the find bar closes", async () => {
    function Harness() {
      const { actions, state } = useFileViewer();
      return (
        <>
          <button
            onClick={() => {
              actions.openFind();
              actions.setFindQuery("world");
            }}
          >
            search
          </button>
          <button onClick={actions.closeFind}>close</button>
          <p data-testid="open">{String(state.find.open)}</p>
          <FileViewerContent />
        </>
      );
    }
    render(
      <FileViewer
        source={textSource}
        registry={spyRegistry(["range", "quote"])}
        highlights={[QUOTE]}
        activeHighlightId="c1"
      >
        <Harness />
      </FileViewer>,
    );

    await screen.findByText("c1:resolved:true");
    await userEvent.click(screen.getByRole("button", { name: "search" }));
    await waitFor(() => {
      expect(screen.getByTestId("active")).toHaveTextContent("find:0");
    });

    await userEvent.click(screen.getByRole("button", { name: "close" }));
    // The query survives the close, but the citation is current again — the
    // reader is no longer stepping through anything.
    expect(screen.getByTestId("active")).toHaveTextContent("c1");
  });
});

/** Open the find bar the way a reader does, and return the content region. */
async function openFind() {
  const content = await screen.findByRole("region", { name: "File content" });
  content.focus();
  // Scoped to the frame, never `document`: a page may hold two viewers, and a
  // document-level listener would let whichever mounted last win.
  await userEvent.keyboard("{Control>}f{/Control}");
  return content;
}

describe("FileViewer — the find bar", () => {
  it("stays out of the way until Ctrl/Cmd+F, then takes the caret", async () => {
    render(<FileViewer source={textSource} registry={spyRegistry(["range"])} />);
    await screen.findByTestId("seen");
    expect(screen.queryByRole("search")).not.toBeInTheDocument();

    await openFind();

    expect(screen.getByRole("search", { name: "Find in document" })).toBeInTheDocument();
    // A find box that does not take the caret sends the next keystroke to the
    // document behind it.
    expect(screen.getByRole("textbox", { name: "Find in document" })).toHaveFocus();
  });

  it("leaves the browser's own find alone when no find part is composed in", async () => {
    // The regression this locks: the frame gated the shortcut on the ADAPTER's
    // capability alone, so a hand-composed viewer that omits `FileViewerFind` —
    // which every citation story does — swallowed Ctrl/Cmd+F, showed no box, and
    // left the reader with neither the viewer's find nor the browser's.
    render(
      <FileViewerProvider source={textSource} registry={spyRegistry(["range"])}>
        <FileViewerFrame>
          <FileViewerContent />
        </FileViewerFrame>
      </FileViewerProvider>,
    );
    const content = await screen.findByRole("region", { name: "File content" });
    content.focus();

    const event = createEvent.keyDown(content, { key: "f", ctrlKey: true, bubbles: true });
    fireEvent(content, event);
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });

  it("leaves the browser's own find alone when it could not paint a result", async () => {
    render(<FileViewer source={textSource} registry={spyRegistry(["quote"])} />);
    await screen.findByTestId("seen");
    await openFind();
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });

  it("counts matches and steps through them with Enter / Shift+Enter", async () => {
    render(<FileViewer source={textSource} registry={spyRegistry(["range"])} />);
    await screen.findByTestId("seen");
    await openFind();
    await userEvent.keyboard("l");

    // "hello world" — three l's.
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("1 of 3");
    });
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("2 of 3");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    expect(screen.getByRole("status")).toHaveTextContent("1 of 3");
    // …and it wraps rather than dead-ending at the top.
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    expect(screen.getByRole("status")).toHaveTextContent("3 of 3");
  });

  it("says 'No matches' rather than counting to zero", async () => {
    render(<FileViewer source={textSource} registry={spyRegistry(["range"])} />);
    await screen.findByTestId("seen");
    await openFind();
    await userEvent.keyboard("zzz");

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("No matches");
    });
    expect(screen.getByRole("status")).not.toHaveTextContent("0 of 0");
  });

  it("keeps the step controls focusable when there is nothing to step to", async () => {
    // `aria-disabled`, never the native attribute: a focused control that goes
    // `disabled` is dropped from the focus order, stranding a keyboard reader.
    render(<FileViewer source={textSource} registry={spyRegistry(["range"])} />);
    await screen.findByTestId("seen");
    await openFind();

    const next = screen.getByRole("button", { name: "Next match" });
    expect(next).toHaveAttribute("aria-disabled", "true");
    expect(next).not.toBeDisabled();
    next.focus();
    expect(next).toHaveFocus();
  });

  it("closes on Escape and hands the caret back to the document", async () => {
    render(<FileViewer source={textSource} registry={spyRegistry(["range"])} />);
    await screen.findByTestId("seen");
    const content = await openFind();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("search")).not.toBeInTheDocument();
    expect(content).toHaveFocus();
  });

  it("matches case only when asked to", async () => {
    render(
      <FileViewer
        source={{ kind: "text", text: "Hello hello", name: "notes.txt" }}
        registry={spyRegistry(["range"])}
      />,
    );
    await screen.findByTestId("seen");
    await openFind();
    await userEvent.keyboard("hello");
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("1 of 2");
    });

    await userEvent.click(screen.getByRole("button", { name: "Match case" }));
    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("1 of 1");
    });
  });
});

describe("FileViewer — a citation that cannot be located", () => {
  const MISSING: DocumentHighlight = { id: "c9", address: { kind: "quote", text: "not in here" } };

  it("says so, rather than showing an untouched document", async () => {
    render(
      <FileViewer source={textSource} registry={spyRegistry(["quote"])} highlights={[MISSING]} />,
    );
    expect(await screen.findByText(/Couldn't find that passage/)).toBeInTheDocument();
    // Information, not a failure: the file itself opened fine.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("distinguishes 'not in the document' from 'past what we previewed'", async () => {
    render(
      <FileViewer
        source={textSource}
        registry={spyRegistry(["quote"], { truncated: true })}
        highlights={[MISSING]}
      />,
    );
    expect(await screen.findByText(/beyond the part of this document/)).toBeInTheDocument();
  });

  it("calls a kind the adapter never declared a capability gap, not a miss", async () => {
    render(
      <FileViewer
        source={textSource}
        registry={spyRegistry()}
        highlights={[{ id: "c1", address: { kind: "rect", page: 1, rects: [] } }]}
      />,
    );
    expect(await screen.findByText(/can't point at part of a/)).toBeInTheDocument();
  });

  it("stays quiet for a fruitless SEARCH — the find bar already counts that", async () => {
    render(<FileViewer source={textSource} registry={spyRegistry(["range"])} />);
    await screen.findByTestId("seen");
    await openFind();
    await userEvent.keyboard("zzz");

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("No matches");
    });
    expect(screen.queryByText(/Couldn't find that passage/)).not.toBeInTheDocument();
  });
});
