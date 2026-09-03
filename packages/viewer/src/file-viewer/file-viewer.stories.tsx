import { Button } from "@elabs-ai/components-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";

import {
  SAMPLE_DOCX_DATA_URI,
  SAMPLE_PPTX_DATA_URI,
  SAMPLE_XLSX_DATA_URI,
} from "../adapters/office-fixture";
import { SAMPLE_PDF_DATA_URI } from "../adapters/pdf/pdf-fixture";
import { ViewerError } from "../core/errors";
import { createRegistry } from "../core/registry";
import { PROTOCOL_VERSION } from "../core/types";
import {
  FileViewer,
  FileViewerContent,
  FileViewerFrame,
  FileViewerProvider,
  FileViewerToolbar,
} from "./file-viewer";
import { useFileViewer } from "./file-viewer-context";
import { FileViewerPager } from "./file-viewer-pager";
import { FileViewerRotate, FileViewerZoom } from "./file-viewer-zoom";

/**
 * `FileViewer` renders any file the registry can claim. The adapter decides how
 * a format is parsed and drawn; this shell owns the chrome and the state grid,
 * so every format gets the same identity row, skeleton, empty and error states.
 */
const meta = {
  title: "Viewer/FileViewer",
  component: FileViewer,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Point it at a File, a Blob, a URL or a string and it detects the format, " +
          "loads the matching adapter on demand, and renders it with brand-ui components. " +
          "Formats are added by registering an adapter, never by editing this component.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="h-[420px] w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FileViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const CSV = `region,orders,revenue,note
EMEA,1240,982400,"Includes Ireland, remapped in Q2"
AMER,2110,1704300,Steady
APAC,880,613900,"Two launches, one delayed"
`;

const JSON_TEXT = JSON.stringify(
  {
    pipeline: "nightly-ingest",
    runs: [
      { id: "r-8812", status: "succeeded", durationMs: 41200, rows: 1_204_881 },
      { id: "r-8811", status: "failed", durationMs: 980, error: "source unreachable" },
    ],
    owner: { team: "Data Platform", contact: "data-platform@example.test" },
  },
  null,
  2,
);

const LOG = `2026-08-10T06:00:01Z  INFO   starting nightly-ingest
2026-08-10T06:00:02Z  INFO   connected to source (12 shards)
2026-08-10T06:41:13Z  WARN   shard 7 retried once
2026-08-10T06:41:14Z  INFO   wrote 1204881 rows
`;

const MARKDOWN = `# Nightly ingest

Runs at **06:00 UTC** and writes into the \`warehouse.raw\` schema.

## What it does

1. Reads every shard the source advertises
2. Normalises timestamps to UTC
3. Writes one partition per shard

> A shard that fails is retried once, then reported. Partial runs are never
> published.

See the [runbook](https://example.com/runbook) for the escalation path.

\`\`\`bash
pnpm ingest --since 2026-08-09
\`\`\`
`;

const SOURCE = `import { useContext } from "react";

import { FileViewerContext } from "./file-viewer-context";

/** Read and drive the viewer from anywhere inside the provider. */
export function useFileViewer(): FileViewerContextValue {
  const value = useContext(FileViewerContext);
  if (!value) {
    // A control outside the provider has no state to drive — say so here
    // rather than failing later with an undefined read.
    throw new Error("useFileViewer must be used inside a <FileViewerProvider>.");
  }
  return value;
}
`;

/**
 * A real image file, inline so the story needs no network. Drawn as SVG rather
 * than a base64 blob so the fixture is readable — and deliberately in the file's
 * OWN colours, because the viewer shows a document as authored and only themes
 * the chrome around it.
 */
const DIAGRAM_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300" viewBox="0 0 480 300">
  <rect width="480" height="300" fill="whitesmoke"/>
  <text x="24" y="44" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="dimgray">Nightly ingest — rows per shard</text>
  <line x1="24" y1="250" x2="456" y2="250" stroke="darkgray" stroke-width="2"/>
  <rect x="48" y="150" width="52" height="100" fill="steelblue"/>
  <rect x="120" y="96" width="52" height="154" fill="steelblue"/>
  <rect x="192" y="182" width="52" height="68" fill="steelblue"/>
  <rect x="264" y="120" width="52" height="130" fill="steelblue"/>
  <rect x="336" y="206" width="52" height="44" fill="indianred"/>
  <text x="336" y="274" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="indianred">retried</text>
</svg>`;

const DIAGRAM = `data:image/svg+xml;utf8,${encodeURIComponent(DIAGRAM_SVG)}`;

/**
 * A real, playable ~1.5 s silent 8-bit mono WAV, synthesized here so the story
 * needs no network origin (`docs/CSP-AND-NETWORK.md`) and no binary fixture.
 * Same technique as `@elabs-ai/components-ai`'s audio-player story —
 * copied rather than imported, because a Layer-2 package may not reach sideways.
 */
function silentWav(seconds = 1.5, sampleRate = 8000): string {
  const samples = Math.floor(seconds * sampleRate);
  const bytes = new Uint8Array(44 + samples).fill(128); // 128 == silence, 8-bit unsigned
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // format: PCM
  view.setUint16(22, 1, true); // channels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, samples, true);

  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

const TONE = silentWav();

/* -------------------------------------------------------------------------- */
/* Formats                                                                     */
/* -------------------------------------------------------------------------- */

export const Default: Story = {
  args: { source: { kind: "text", text: JSON_TEXT, name: "pipeline-runs.json" } },
};

/** A real CSV parser, so a quoted comma stays in one cell. */
export const Csv: Story = {
  name: "CSV",
  args: { source: { kind: "text", text: CSV, name: "sales-by-region.csv" } },
};

export const PlainText: Story = {
  args: { source: { kind: "text", text: LOG, name: "nightly-ingest.log" } },
};

/**
 * A markdown file read as a DOCUMENT — real headings, lists and links drawn with
 * the library's own prose primitives, so a README in the viewer looks like the
 * same README in a chat answer or the editor's preview.
 *
 * `streamdown` is an optional peer. No Streamdown plugins are installed, which
 * is a deliberate trade: fenced code renders as an unhighlighted block rather
 * than costing a consumer four more packages to open one file. A source file
 * opened directly still gets Shiki — see `Source code` below.
 *
 * Pick a markdown renderer by where the markdown is going to be READ: a file the
 * app did not write, opened here → this adapter; a read-only document in a chat
 * or a side rail → `AI/MarkdownView`; the preview pane of the markdown editor →
 * `Editor/MarkdownPreview`; streaming into a message as the model writes it →
 * `MessageResponse` on `AI/Message`. See
 * [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs).
 *
 * The element map here is deliberately a near-copy of `MarkdownView`'s, not a
 * shared module: `@elabs-ai/components-ai`, `@elabs-ai/components-editor` and
 * `@elabs-ai/components-viewer` are leaves that may not import one another, and
 * the half that could move down (the `Prose*` primitives, the Streamdown locale
 * bridge) already has. What differs is the job — a file arrives settled or not at
 * all, so this adapter takes no plugins and does not stream.
 */
export const Markdown: Story = {
  args: { source: { kind: "text", text: MARKDOWN, name: "README.md" } },
};

/**
 * A source file, tokenized by Shiki at load and coloured entirely with
 * `var(--code-*)` references — so switching the theme recolours the document
 * without re-highlighting it, and no raw hex ever enters the model.
 *
 * `shiki` is an optional peer, and this adapter claims only extensions it has a
 * grammar for. A `.log`, a `.env` or an unknown extension keeps falling through
 * to the plain-text backstop rather than failing to open.
 */
export const SourceCode: Story = {
  name: "Source code",
  args: { source: { kind: "text", text: SOURCE, name: "use-file-viewer.ts" } },
};

export const Image: Story = {
  args: {
    source: {
      kind: "url",
      url: DIAGRAM,
      name: "rows-per-shard.svg",
      mediaType: "image/svg+xml",
      // The description travels with the source, so a screen-reader user gets
      // what the picture says — not just that a picture is there.
      alt: "Bar chart of rows per shard; shard 7 is the shortest bar and is marked as retried.",
    },
  },
};

/**
 * A real PDF, opened by pdf.js on a worker: the page is rasterized in the file's
 * own colours, and a transparent text layer over it stays selectable.
 *
 * The pages STACK and the pane scrolls, the way every document reader works —
 * page 2 is a gesture away, not behind a button. Only the pages near the viewport
 * are mounted, so the cost follows the screen rather than the page count.
 *
 * The pager, the scale and the rotate button are the SHELL's (ADR 0026), not the
 * adapter's — which is why the same controls drive the deck below, and why an app
 * can move any of them into its own header.
 *
 * `pdfjs-dist` is an optional peer — a consumer who never opens a PDF never
 * installs it, and one who forgot sees the `ParserMissing` panel below.
 */
export const Pdf: Story = {
  name: "PDF",
  args: {
    source: {
      kind: "url",
      url: SAMPLE_PDF_DATA_URI,
      name: "quarterly-report.pdf",
      mediaType: "application/pdf",
    },
  },
};

/**
 * Video and audio use the NATIVE elements on purpose — the platform's own
 * transport brings keyboard control, captions, picture-in-picture and the OS
 * media keys, none of which a custom skin gets for free. The adapter streams
 * from a URL and never buffers the bytes, so a 2 GB recording seeks instantly.
 *
 * The fixture is audio because a real, playable video cannot be synthesized
 * inline; the element and the chrome are the same for both.
 */
export const Audio: Story = {
  args: {
    source: {
      kind: "url",
      url: TONE,
      name: "standup-recording.wav",
      mediaType: "audio/wav",
    },
  },
};

/**
 * The settled "can't play this" outcome — a codec the browser does not ship, or
 * a truncated file. It is an error, not a capability gap: the format IS
 * supported, this particular file just will not decode. No retry is offered,
 * because retrying cannot install a codec.
 */
export const MediaUndecodable: Story = {
  name: "Media (undecodable)",
  args: {
    source: {
      kind: "url",
      url: "data:video/mp4;base64,AAAA",
      name: "briefing.mp4",
      mediaType: "video/mp4",
    },
  },
};

/**
 * A real Word file. mammoth resolves Word's styles, numbering and images; the
 * adapter then parses that into a block model and draws it with the library's own
 * prose primitives — so a `.docx` inherits the theme, the type scale and real
 * heading semantics instead of arriving as a slab of foreign markup.
 *
 * It shows the document's STRUCTURE, not Word's page layout: no page breaks, no
 * columns, no margins. The toolbar's download is the answer for the real thing.
 */
export const Word: Story = {
  args: {
    source: {
      kind: "url",
      url: SAMPLE_DOCX_DATA_URI,
      name: "quarterly-review.docx",
      mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  },
};

/**
 * A real workbook, every sheet reachable. SheetJS is asked only for the DATA —
 * never its `sheet_to_html` helper — so the grid is the same `Table` the CSV
 * adapter renders, with the theme, the density dial and keyboard semantics.
 *
 * `xlsx` is an optional peer with two npm-only advisories; see
 * `docs/CONSUMING.md` before installing it in a build that opens untrusted files.
 */
export const Excel: Story = {
  args: {
    source: {
      kind: "url",
      url: SAMPLE_XLSX_DATA_URI,
      name: "quarter.xlsx",
      mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  },
};

/**
 * A real deck, read as an outline: title, text at its authored indent level, and
 * the speaker notes — which are followed through the slide's own relationship,
 * not by matching slide numbers.
 *
 * Slides stack and scroll, like the PDF above: a deck is skimmed by scrolling
 * through it, not by clicking "next" once per slide.
 *
 * There is no PowerPoint library here; a `.pptx` is a zip of XML, so jszip opens
 * it and the platform's `DOMParser` reads it. Positional design (layout, images,
 * charts, transitions) is deliberately absent rather than half-reproduced.
 */
export const PowerPoint: Story = {
  args: {
    source: {
      kind: "url",
      url: SAMPLE_PPTX_DATA_URI,
      name: "quarterly-review.pptx",
      mediaType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    },
  },
};

/* -------------------------------------------------------------------------- */
/* States                                                                      */
/* -------------------------------------------------------------------------- */

/** No file chosen yet — an invitation, not a failure. */
export const Empty: Story = { args: {} };

/**
 * The layout-shaped skeleton. Held open by an adapter that never resolves, so
 * the state can be inspected rather than glimpsed.
 */
export const Loading: Story = {
  args: {
    source: { kind: "text", text: LOG, name: "nightly-ingest.log" },
    registry: (() => {
      const registry = createRegistry();
      registry.register(
        { id: "slow", protocol: PROTOCOL_VERSION, categories: ["text"], mediaTypes: ["text/"] },
        () =>
          Promise.resolve({
            manifest: { id: "slow", protocol: PROTOCOL_VERSION, categories: ["text"] },
            create: () => ({ load: () => new Promise<never>(() => undefined) }),
            Renderer: () => null,
          }),
      );
      return registry;
    })(),
  },
};

/** No adapter claims the file. Not retryable — retrying changes nothing. */
export const UnsupportedFormat: Story = {
  args: {
    source: {
      kind: "text",
      text: "%PDF-1.7",
      name: "contract.pdf",
      mediaType: "application/pdf",
    },
    registry: (() => {
      const registry = createRegistry();
      registry.register(
        { id: "text", protocol: PROTOCOL_VERSION, categories: ["text"] },
        () => import("../adapters/text/text-adapter"),
      );
      return registry;
    })(),
  },
};

/**
 * The optional parser package is not installed. The message names it, because
 * "couldn't open this file" would leave the reader with nothing to do.
 */
export const ParserMissing: Story = {
  args: {
    source: { kind: "text", text: CSV, name: "sales-by-region.csv" },
    registry: (() => {
      const registry = createRegistry();
      registry.register(
        {
          id: "csv",
          protocol: PROTOCOL_VERSION,
          extensions: ["csv"],
          requires: ["papaparse"],
        },
        () => Promise.reject(new Error("Cannot find module 'papaparse'")),
      );
      return registry;
    })(),
  },
};

/** A settled read failure — the one error state that offers a retry. */
export const ReadFailed: Story = {
  args: {
    source: { kind: "text", text: LOG, name: "nightly-ingest.log" },
    registry: (() => {
      const registry = createRegistry();
      registry.register(
        { id: "broken", protocol: PROTOCOL_VERSION, categories: ["text"], mediaTypes: ["text/"] },
        () =>
          Promise.resolve({
            manifest: { id: "broken", protocol: PROTOCOL_VERSION, categories: ["text"] },
            create: () => ({
              // A typed failure, not a bare Error: the CODE picks the copy and
              // decides whether a retry is offered, so a story that says
              // "read failed" has to throw one.
              load: () =>
                Promise.reject(
                  new ViewerError("read-failed", "The network connection was lost.", {
                    fileName: "nightly-ingest.log",
                  }),
                ),
            }),
            Renderer: () => null,
          }),
      );
      return registry;
    })(),
  },
};

/** A parent that fetches the file itself can hold the viewer not-ready. */
export const ParentLoading: Story = {
  args: { source: { kind: "text", text: LOG, name: "nightly-ingest.log" }, loading: true },
};

/* -------------------------------------------------------------------------- */
/* Composition                                                                 */
/* -------------------------------------------------------------------------- */

/** Reads the viewer state from outside the frame — no prop-drilling, no refs. */
function FormatBadge() {
  const { state } = useFileViewer();
  return (
    <p className="text-meta text-muted-foreground mb-2">
      {state.status === "ready"
        ? `Showing ${state.source?.extension.toUpperCase() ?? ""} · ${state.source?.category ?? ""}`
        : `Status: ${state.status}`}
    </p>
  );
}

/**
 * The parts, arranged by hand. `FileViewerProvider` is the state boundary, so a
 * control **outside** the frame but inside the provider reads the same state the
 * viewer does — the reason this is a compound component rather than one prop bag.
 */
export const Composed: Story = {
  render: () => (
    <FileViewerProvider source={{ kind: "text", text: JSON_TEXT, name: "pipeline-runs.json" }}>
      <FormatBadge />
      <FileViewerFrame className="h-[380px]">
        <FileViewerToolbar />
        <FileViewerContent />
      </FileViewerFrame>
    </FileViewerProvider>
  ),
};

/* -------------------------------------------------------------------------- */
/* Page, scale and rotation (ADR 0026)                                         */
/* -------------------------------------------------------------------------- */

const PDF_SOURCE = {
  kind: "url",
  url: SAMPLE_PDF_DATA_URI,
  name: "quarterly-report.pdf",
  mediaType: "application/pdf",
} as const;

/**
 * The same file opened at page 2, at a fixed 125%.
 *
 * Page and scale are the SHELL's state, so they are ordinary props with the
 * controlled/uncontrolled trio — which is what makes a deep link ("open the
 * contract at page 2") a one-liner instead of a reach inside the canvas.
 *
 * There is no rotate button here, and that is the point: the PDF manifest does
 * not claim `rotate`, so the control does not exist. A capability is a promise
 * the renderer keeps — chrome for one it has not implemented would be a lie the
 * reader can click.
 */
export const PageAndZoom: Story = {
  args: {
    source: PDF_SOURCE,
    defaultPageNumber: 2,
    defaultZoom: 1.25,
  },
};

/**
 * Rotation, on the format that implements it.
 *
 * `image` DOES claim `rotate`, so the button appears and turns the picture a
 * quarter at a time. It also honours the fit modes and the fixed stops, which the
 * manifest had been claiming for a renderer that did neither.
 */
export const Rotated: Story = {
  args: {
    source: {
      kind: "url",
      url: DIAGRAM,
      name: "rows-per-shard.svg",
      mediaType: "image/svg+xml",
      alt: "Bar chart of rows per shard; shard 7 is the shortest bar and is marked as retried.",
    },
    defaultRotation: 90,
  },
};

/**
 * The controls moved OUT of the viewer, into the app's own header.
 *
 * They are parts over the provider, not adapter chrome: anything inside
 * `FileViewerProvider` reads and drives the same page and scale, so a workspace
 * can put the pager beside a breadcrumb and keep the document pane clean. This is
 * the composition the old design could not express at all — page and zoom were
 * `useState` inside the PDF renderer, so there could only ever be one pager, and
 * only inside the canvas.
 */
export const ChromeInTheAppHeader: Story = {
  render: () => (
    <FileViewerProvider source={PDF_SOURCE}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-meta text-muted-foreground">Contracts / Q3 / quarterly-report.pdf</p>
        <div className="flex items-center gap-1">
          <FileViewerPager />
          <FileViewerZoom />
          <FileViewerRotate />
        </div>
      </div>
      <FileViewerFrame className="h-[360px]">
        <FileViewerContent />
      </FileViewerFrame>
    </FileViewerProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Prove the header really drives the document. Under continuous scroll page
    // 2 is already MOUNTED, so its presence proves nothing — what has to follow
    // the button outside the frame is the viewport.
    await canvas.findByRole("img", { name: /Page 1/ }, { timeout: 15_000 });
    const pane = canvasElement.querySelector<HTMLElement>('[data-slot="file-viewer-content"]');
    expect(pane?.scrollTop).toBe(0);
    await userEvent.click(canvas.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(pane?.scrollTop).toBeGreaterThan(0));
    await waitFor(() => expect(canvas.getByRole("img", { name: /Page 2/ })).toBeInTheDocument());
  },
};

/**
 * The other direction: the reader scrolls, and the chrome follows.
 *
 * A paginated document is a COLUMN, not a flipbook — page 2 sits one gesture
 * below page 1, and only the pages near the viewport are ever mounted, so a
 * 900-page file costs what is on screen rather than what is in the file. The page
 * number is a two-way binding: type "2" and the column scrolls, scroll and the
 * field updates.
 */
export const ContinuousScroll: Story = {
  args: { source: PDF_SOURCE },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("img", { name: /Page 1/ }, { timeout: 15_000 });
    const pane = canvasElement.querySelector<HTMLElement>('[data-slot="file-viewer-content"]');
    const field = canvas.getByRole("textbox", { name: "Page number" });
    expect(field).toHaveValue("1");

    // Scroll the way a reader does — the pane, not a control — and the pager has
    // to arrive at page 2 on its own.
    pane?.scrollTo({ top: pane.scrollHeight });
    pane?.dispatchEvent(new Event("scroll"));
    await waitFor(() => expect(field).toHaveValue("2"));
  },
};

/* -------------------------------------------------------------------------- */
/* Pointing at part of a document (ADR 0025)                                   */
/* -------------------------------------------------------------------------- */

/** The citations a RAG answer would hand the viewer, quoted from the log above. */
const CITATIONS = [
  { id: "c1", label: "12 shards were advertised", address: { kind: "quote", text: "12 shards" } },
  { id: "c2", label: "one shard was retried", address: { kind: "quote", text: "shard 7 retried" } },
  { id: "c3", label: "the row count", address: { kind: "quote", text: "1204881 rows" } },
] as const;

/**
 * Open the find row the way a reader does — focus the document, press the
 * platform's find shortcut, type — and leave it open so the story SHOWS the
 * search state instead of describing it. Also what puts the row in front of the
 * blocking interaction + axe pass.
 */
function openFindAndSearch(query: string) {
  return async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    // Wait for the file to have actually LOADED, not merely for the pane to
    // exist: the shortcut is a no-op until the adapter has published text to
    // search (the pane holds a skeleton before that), so pressing it early
    // silently does nothing.
    const pane = await waitFor(() => {
      const el = canvasElement.querySelector<HTMLElement>('[data-slot="file-viewer-content"]');
      expect(el?.querySelector("pre")).not.toBeNull();
      return el as HTMLElement;
    });
    pane.focus();
    await userEvent.keyboard("{Control>}f{/Control}");
    const box = await canvas.findByRole("textbox", { name: "Find in document" });
    await userEvent.type(box, query);
    await waitFor(() => expect(canvas.getByRole("status")).toHaveTextContent(/of/));
  };
}

/** Prev / next over the located citations, driven from outside the frame. */
function CitationStepper() {
  const { state, actions, meta } = useFileViewer();
  const located = meta.resolvedHighlights.filter(
    (highlight) => highlight.source === "citation" && highlight.status === "resolved",
  );
  const current = located.find((highlight) => highlight.id === state.activeHighlightId);
  return (
    <div className="mb-2 flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={actions.previousHighlight}>
        Previous passage
      </Button>
      <Button size="sm" variant="outline" onClick={actions.nextHighlight}>
        Next passage
      </Button>
      <span aria-live="polite" className="text-meta text-muted-foreground">
        {current
          ? `Passage ${String(current.index ?? 0)} of ${String(located.length)} — ${current.label ?? ""}`
          : `${String(located.length)} passages`}
      </span>
    </div>
  );
}

/**
 * A chat answer cites three passages; clicking one scrolls the document to it
 * and marks it. The app owns the citation list and which one is current — the
 * viewer only locates and paints them, so the same list drives a sidebar, a
 * stepper, or a chat bubble without any of them talking to each other.
 *
 * The current passage is never signalled by colour alone: it also carries an
 * outline and `aria-current="true"` (WCAG 1.4.1).
 */
export const Citations: Story = {
  render: () => (
    <FileViewerProvider
      source={{ kind: "text", text: LOG, name: "nightly-ingest.log" }}
      defaultHighlights={[...CITATIONS]}
      defaultActiveHighlightId="c2"
    >
      <CitationStepper />
      <FileViewerFrame className="h-[340px]">
        <FileViewerToolbar />
        <FileViewerContent />
      </FileViewerFrame>
    </FileViewerProvider>
  ),
};

/**
 * A quote that is not in the document is a STATE, not a no-op. The reader
 * clicked a source link, so silence would leave them unable to tell whether the
 * viewer broke, the passage moved, or they mis-clicked.
 */
export const PassageNotFound: Story = {
  args: {
    source: { kind: "text", text: LOG, name: "nightly-ingest.log" },
    highlights: [{ id: "c1", address: { kind: "quote", text: "a sentence that is not there" } }],
  },
};

/**
 * Find-in-document — press **Ctrl/Cmd + F** with the viewer focused. It paints
 * through the same mark layer citations use, so a document never grows two
 * highlight systems that disagree about what a mark looks like.
 *
 * The shortcut is bound to the FRAME, not `document`: a page may hold several
 * viewers, and the browser's own find is untouched everywhere else.
 */
export const FindInDocument: Story = {
  args: { source: { kind: "text", text: LOG, name: "nightly-ingest.log" } },
  // The story OPENS the search rather than telling the reader to press a key:
  // a state nobody can see is a state nobody reviews — and this is what puts
  // the find row in front of the blocking axe pass.
  play: openFindAndSearch("shard"),
};

/**
 * The citations for the PDF fixture: one geometric, one quoted.
 *
 * The `rect` is the interesting one — its box is in page FRACTIONS, so it is
 * correct at every zoom stop and after any resize, and it needed no text
 * extraction at all. That is the address an OCR or layout-aware chunker
 * produces, and the PDF adapter is the only one that can honour it.
 */
const PDF_CITATIONS = [
  {
    id: "p1",
    label: "The report's own title",
    address: {
      kind: "rect",
      page: 1,
      rects: [{ x: 0.11, y: 0.084, width: 0.53, height: 0.034 }],
    },
  },
  {
    id: "p2",
    label: "Where the appendix starts",
    address: { kind: "quote", text: "Appendix - page two" },
  },
] as const;

/**
 * A PDF page is pixels, so a citation is a BOX over the raster rather than a
 * `<mark>` — same state, same stepper, different paint. Stepping to the second
 * passage turns to page 2 on its own: the quote was located in the text
 * projection, and the document's index says which page that stretch came from.
 *
 * The current box is not distinguished by colour alone — it is also drawn twice
 * as thick (WCAG 1.4.1).
 */
export const PdfCitations: Story = {
  name: "PDF citations",
  render: () => (
    <FileViewerProvider
      source={{
        kind: "url",
        url: SAMPLE_PDF_DATA_URI,
        name: "quarterly-report.pdf",
        mediaType: "application/pdf",
      }}
      defaultHighlights={[...PDF_CITATIONS]}
      defaultActiveHighlightId="p1"
    >
      <CitationStepper />
      <FileViewerFrame className="h-[520px]">
        <FileViewerToolbar />
        <FileViewerContent />
      </FileViewerFrame>
    </FileViewerProvider>
  ),
};

/**
 * A Word document marks the WORDS. The passage is underlined where it falls —
 * mid-paragraph, through a bold run, inside one bullet, in a single table cell —
 * and the document keeps reading as a document around it.
 *
 * Word's own page layout is gone by the time this renders (see `Word` above), so
 * there is no page to draw a box on: the marks are the whole answer here.
 */
export const WordCitations: Story = {
  name: "Word citations",
  render: () => (
    <FileViewerProvider
      source={{
        kind: "url",
        url: SAMPLE_DOCX_DATA_URI,
        name: "quarterly-review.docx",
        mediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }}
      defaultHighlights={[
        {
          id: "w1",
          label: "The growth claim",
          address: { kind: "quote", text: "Revenue grew 18%" },
        },
        { id: "w2", label: "How EMEA did", address: { kind: "quote", text: "EMEA beat plan" } },
        { id: "w3", label: "The number behind it", address: { kind: "quote", text: "4.2M" } },
      ]}
      defaultActiveHighlightId="w1"
    >
      <CitationStepper />
      <FileViewerFrame className="h-[420px]">
        <FileViewerToolbar />
        <FileViewerContent />
      </FileViewerFrame>
    </FileViewerProvider>
  ),
};

/**
 * Markdown is addressed by its SOURCE, which is why its citations are plated
 * blocks rather than `<mark>`s: source offset 212 can land inside `**bold**`,
 * two of whose characters are never drawn. So a passage lights up the paragraph,
 * heading, list item or fence it lives in — enough to point a reader at it, and
 * incapable of being subtly wrong about which words it covers.
 *
 * The current plate doubles its rail as well as warming its fill, and carries
 * `aria-current="true"` (WCAG 1.4.1).
 */
export const MarkdownCitations: Story = {
  name: "Markdown citations",
  render: () => (
    <FileViewerProvider
      source={{ kind: "text", text: MARKDOWN, name: "nightly-ingest.md" }}
      defaultHighlights={[
        { id: "m1", label: "When it runs", address: { kind: "quote", text: "06:00 UTC" } },
        {
          id: "m2",
          label: "What happens to a failed shard",
          address: { kind: "quote", text: "retried once, then reported" },
        },
        { id: "m3", label: "How to run it", address: { kind: "quote", text: "pnpm ingest" } },
      ]}
      defaultActiveHighlightId="m2"
    >
      <CitationStepper />
      <FileViewerFrame className="h-[420px]">
        <FileViewerToolbar />
        <FileViewerContent />
      </FileViewerFrame>
    </FileViewerProvider>
  ),
};

/**
 * A spreadsheet marks the CELL. Rows are what the projection is indexed by, but
 * the mark is still character-granular, so a citation lands inside one cell and
 * leaves the rest of the row alone.
 *
 * Stepping to the third citation switches TAB as well as scrolling: the passage
 * lives on Headcount, and a mark on a sheet nobody is looking at is the same as
 * no mark at all.
 */
export const SpreadsheetCitations: Story = {
  name: "Spreadsheet citations",
  render: () => (
    <FileViewerProvider
      source={{
        kind: "url",
        url: SAMPLE_XLSX_DATA_URI,
        name: "quarter.xlsx",
        mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }}
      defaultHighlights={[
        { id: "x1", label: "The biggest region", address: { kind: "quote", text: "6100000" } },
        { id: "x2", label: "Where APAC landed", address: { kind: "quote", text: "1800000" } },
        {
          id: "x3",
          label: "The team behind it (other sheet)",
          address: { kind: "quote", text: "Engineering" },
        },
      ]}
      defaultActiveHighlightId="x1"
    >
      <CitationStepper />
      <FileViewerFrame className="h-[420px]">
        <FileViewerToolbar />
        <FileViewerContent />
      </FileViewerFrame>
    </FileViewerProvider>
  ),
};

/**
 * A deck is read as an outline, so a citation marks the line it came from — a
 * bullet, a title, a table row, or the speaker notes. Stepping to a passage on
 * another slide PAGES there first, the same way the PDF turns to the cited page.
 */
export const DeckCitations: Story = {
  name: "Deck citations",
  render: () => (
    <FileViewerProvider
      source={{
        kind: "url",
        url: SAMPLE_PPTX_DATA_URI,
        name: "quarter.pptx",
        mediaType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }}
      defaultHighlights={[
        { id: "d1", label: "The headline", address: { kind: "quote", text: "Revenue grew 18%" } },
        {
          id: "d2",
          label: "What the presenter says",
          address: { kind: "quote", text: "hand over to Sam" },
        },
        {
          id: "d3",
          label: "The number (next slide)",
          address: { kind: "quote", text: "4.2M" },
        },
      ]}
      defaultActiveHighlightId="d1"
    >
      <CitationStepper />
      <FileViewerFrame className="h-[520px]">
        <FileViewerToolbar />
        <FileViewerContent />
      </FileViewerFrame>
    </FileViewerProvider>
  ),
};

/** The same search over a source file — marks survive syntax colouring. */
export const FindInSourceCode: Story = {
  args: { source: { kind: "text", text: SOURCE, name: "use-file-viewer.ts" } },
  // A word that appears several times AND inside a coloured token, so the story
  // shows marks surviving syntax colouring rather than only sitting beside it.
  play: openFindAndSearch("provider"),
};
