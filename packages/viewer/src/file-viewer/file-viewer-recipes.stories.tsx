import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  fileIconFor,
  type FileSource,
  type ResolvedFileSource,
} from "@elabs-ai/components-ui";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createElement, useRef, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { createDefaultRegistry } from "../adapters";
import {
  PROTOCOL_VERSION,
  type AdapterDocument,
  type AdapterModule,
  type AdapterRendererProps,
} from "../core/types";
import {
  FileViewer,
  FileViewerContent,
  FileViewerFrame,
  FileViewerHighlightStatus,
  FileViewerProvider,
  FileViewerToolbar,
} from "./file-viewer";
import { FileViewerFind } from "./file-viewer-find";

/**
 * The viewer in the places a product actually puts it: behind an attachment, beside an upload
 * button, twice on one screen to compare two revisions, and with a format of your own.
 * `Viewer/FileViewer` documents the component; these are the compositions people build with it.
 */
const meta = {
  title: "Viewer/Recipes",
  component: FileViewer,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Attachments, uploads, side-by-side revisions and a custom format",
      description: {
        component:
          "Four compositions built from the public parts of `@elabs-ai/components-viewer`. " +
          "Each one is a complete, copyable answer to a product question — none of them " +
          "reaches into an adapter or the provider's internals.",
      },
    },
  },
} satisfies Meta<typeof FileViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

/* -------------------------------------------------------------------------- */
/* Fixtures — fictional                                                        */
/* -------------------------------------------------------------------------- */

const INVOICE_CSV = `line,description,qty,unit_eur,total_eur
1,Trail 40 backpack moss,120,71.50,8580.00
2,Ridge 28 daypack slate,80,48.20,3856.00
3,Replacement hip belt M,40,9.80,392.00
4,Freight Venlo,1,640.00,640.00
`;

const PACKING_NOTE = `# Packing note PN-20418

Shipped 14 July 2025 from NB Packs GmbH to Northwind Outdoor, Venlo.

- 96 cartons, 4,800 units, batch **NB-0931**
- Thread lot TL-5520
- Carrier reference LX-88213-DE

Please inspect within five working days.
`;

const WEBHOOK_JSON = `{
  "event": "shipment.delivered",
  "reference": "LX-88213-DE",
  "deliveredAt": "2025-07-14T08:02:11Z",
  "cartons": 96,
  "signedBy": "dock 3"
}
`;

const ATTACHMENTS: Array<FileSource & { name: string }> = [
  { kind: "text", text: PACKING_NOTE, name: "packing-note-PN-20418.md" },
  { kind: "text", text: INVOICE_CSV, name: "invoice-2025-0714.csv" },
  { kind: "text", text: WEBHOOK_JSON, name: "carrier-webhook.json" },
];

/* -------------------------------------------------------------------------- */
/* 1 — An attachment opens in a dialog                                         */
/* -------------------------------------------------------------------------- */

function AttachmentStrip() {
  const [open, setOpen] = useState<(FileSource & { name: string }) | null>(null);
  return (
    <div className="flex max-w-2xl flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
      <p className="text-body text-foreground">
        The shipment arrived this morning. Packing note, invoice and the carrier's delivery event
        are attached — can you check the carton count before we release the batch?
      </p>
      <ul aria-label="Attachments" className="flex flex-wrap gap-2">
        {ATTACHMENTS.map((file) => (
          <li key={file.name}>
            <Button onClick={() => setOpen(file)} size="sm" variant="outline">
              {createElement(fileIconFor(file.name), { "aria-hidden": true })}
              {file.name}
            </Button>
          </li>
        ))}
      </ul>
      <Dialog onOpenChange={(next) => !next && setOpen(null)} open={open !== null}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{open?.name ?? "Attachment"}</DialogTitle>
            <DialogDescription>Attached to “Shipment LX-88213-DE arrived”.</DialogDescription>
          </DialogHeader>
          {/* One viewer for every attachment: the format is detected from the name. */}
          {open ? <FileViewer className="h-[26rem]" source={open} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * A message with three attachments of three formats. Every chip opens the SAME `FileViewer` in
 * a dialog; the adapter for a format is fetched the first time a file of that kind is opened.
 */
export const AttachmentPreview: Story = {
  render: () => <AttachmentStrip />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /invoice-2025-0714\.csv/ }));
    const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog");
    // The CSV is a TABLE, not text: a header cell proves the csv adapter took it.
    await waitFor(
      () =>
        expect(
          within(dialog).getByRole("columnheader", { name: "description" }),
        ).toBeInTheDocument(),
      { timeout: 15_000 },
    );
  },
};

/* -------------------------------------------------------------------------- */
/* 2 — The reader's own file                                                   */
/* -------------------------------------------------------------------------- */

function UploadPreview() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  return (
    <div className="flex max-w-3xl flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => input.current?.click()} variant="outline">
          Choose a file…
        </Button>
        <input
          aria-label="Choose a file to preview"
          className="sr-only"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          ref={input}
          type="file"
        />
        {file ? (
          <Badge variant="outline">
            {file.name} · {Math.max(1, Math.round(file.size / 1024))} KB
          </Badge>
        ) : (
          <span className="text-meta text-muted-foreground">
            PDF, Word, Excel, PowerPoint, CSV, JSON, markdown, code, images, audio, video.
          </span>
        )}
      </div>
      {/* `undefined` is the empty state, not an error — nothing has gone wrong yet. */}
      <FileViewer className="h-[26rem]" source={file ? { kind: "file", file } : undefined} />
    </div>
  );
}

/**
 * `{ kind: "file", file }` takes a `File` straight from an input or a drop: nothing is uploaded
 * and nothing leaves the browser. Pick any file on your machine to try the adapters on real
 * content; with nothing picked the viewer shows its empty state.
 */
export const UploadAndPreview: Story = {
  render: () => <UploadPreview />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const picked = new File([INVOICE_CSV], "invoice-2025-0714.csv", { type: "text/csv" });
    await userEvent.upload(canvas.getByLabelText("Choose a file to preview"), picked);
    await waitFor(
      () => expect(canvas.getByRole("columnheader", { name: "qty" })).toBeInTheDocument(),
      { timeout: 15_000 },
    );
  },
};

/* -------------------------------------------------------------------------- */
/* 3 — Two revisions side by side                                              */
/* -------------------------------------------------------------------------- */

const POLICY_V6 = `# Refund policy — version 6

A customer can return an unused item within 14 days of delivery for a full refund.

A defect in material or workmanship is refunded in full within the 24-month warranty.

Instead of a refund an agent may offer store credit of the refund amount plus 5 %.
`;

const POLICY_V7 = `# Refund policy — version 7

A customer can return an unused item within 30 days of delivery for a full refund.

A defect in material or workmanship is refunded in full within the 24-month warranty.

A team lead may approve a refund up to 14 days after the window closes when the photographs show a manufacturing defect rather than wear.

Instead of a refund an agent may offer store credit of the refund amount plus 11 %.
`;

const REVISIONS = [
  {
    label: "Version 6 · in force until 31 December 2024",
    source: { kind: "text", text: POLICY_V6, name: "refund-policy-v6.md" } as const,
    changed: ["within 14 days of delivery", "refund amount plus 5 %"],
  },
  {
    label: "Version 7 · in force since 1 January 2025",
    source: { kind: "text", text: POLICY_V7, name: "refund-policy-v7.md" } as const,
    changed: [
      "within 30 days of delivery",
      "A team lead may approve a refund up to 14 days after the window closes",
      "refund amount plus 11 %",
    ],
  },
];

/**
 * Two providers, two documents, one screen. Each side marks the passages that differ from the
 * other through the same highlight layer citations use, so "what changed" is a list of quotes —
 * the output of any text diff — and not a second rendering mode.
 */
export const CompareRevisions: Story = {
  render: () => (
    <div className="grid max-w-5xl gap-4 md:grid-cols-2">
      {REVISIONS.map((revision) => (
        <section
          aria-label={revision.label}
          className="flex min-w-0 flex-col gap-2"
          key={revision.label}
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-body-sm font-semibold text-foreground">{revision.label}</h3>
            <Badge variant="outline">{revision.changed.length} changed passages</Badge>
          </div>
          <FileViewerProvider
            defaultHighlights={revision.changed.map((text, index) => ({
              id: `change-${index}`,
              label: "Changed in this revision",
              address: { kind: "quote" as const, text },
            }))}
            source={revision.source}
          >
            {/* Two viewers side by side means two of every landmark inside them. Their default
                names ("File viewer", "File content") would be identical, which is exactly what
                axe's `landmark-unique` is for: a screen-reader user listing landmarks would see
                the same two entries twice with nothing to tell them apart. Name them after the
                revision they show. */}
            <FileViewerFrame aria-label={`${revision.label}, file viewer`} className="h-[24rem]">
              <FileViewerToolbar />
              <FileViewerFind />
              <FileViewerHighlightStatus />
              <FileViewerContent aria-label={`${revision.label}, file content`} />
            </FileViewerFrame>
          </FileViewerProvider>
        </section>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        // Markdown plates the whole BLOCK a passage sits in: 2 on the left, 3 on the right.
        expect(canvasElement.querySelectorAll('[data-slot="highlight-block"]')).toHaveLength(5),
      { timeout: 15_000 },
    );
  },
};

/* -------------------------------------------------------------------------- */
/* 4 — A format of your own                                                    */
/* -------------------------------------------------------------------------- */

interface Cue {
  index: number;
  from: string;
  to: string;
  text: string;
}

interface SubtitleDocument extends AdapterDocument {
  kind: "subtitles";
  cues: Cue[];
}

function parseSrt(raw: string): Cue[] {
  return raw
    .trim()
    .split(/\r?\n\r?\n/)
    .flatMap((block) => {
      const [index, times, ...lines] = block.split(/\r?\n/);
      const [from, to] = (times ?? "").split(" --> ");
      return from && to ? [{ index: Number(index), from, to, text: lines.join(" ") }] : [];
    });
}

/** A complete adapter: a manifest that claims `.srt`, a loader, and a renderer on tokens. */
const subtitleAdapter: AdapterModule = {
  manifest: {
    id: "subtitles",
    protocol: PROTOCOL_VERSION,
    // Above the built-in text adapter, which would otherwise claim an unknown text file.
    priority: 10,
    extensions: ["srt"],
    capabilities: { text: true },
  },
  create: () => ({
    async load(source: ResolvedFileSource, context): Promise<SubtitleDocument> {
      const raw = await source.text(context.signal);
      const cues = parseSrt(raw);
      return { kind: "subtitles", cues, text: cues.map((cue) => cue.text).join("\n") };
    },
  }),
  Renderer: ({ document }: AdapterRendererProps) => (
    <ol className="flex flex-col">
      {(document as SubtitleDocument).cues.map((cue) => (
        <li
          className="grid grid-cols-[9rem_minmax(0,1fr)] gap-3 border-b border-border px-1 py-2 last:border-b-0"
          key={cue.index}
        >
          <span className="text-meta tabular-nums text-muted-foreground">
            {cue.from.slice(3, 8)} – {cue.to.slice(3, 8)}
          </span>
          <span className="text-body text-foreground">{cue.text}</span>
        </li>
      ))}
    </ol>
  ),
};

const registryWithSubtitles = (() => {
  const registry = createDefaultRegistry();
  registry.register(subtitleAdapter.manifest, () => Promise.resolve(subtitleAdapter));
  return registry;
})();

const STANDUP_SRT = `1
00:00:01,200 --> 00:00:05,900
Morning. Batch NB-0931 is on sales hold since yesterday.

2
00:00:06,100 --> 00:00:11,400
Quality measured twelve returned units. All of them failed below 220 newtons.

3
00:00:11,800 --> 00:00:17,000
Legal sends the written notice to the supplier today. The 30 days started on the sixth.

4
00:00:17,300 --> 00:00:21,500
Support keeps approving seam refunds without asking. Any questions?
`;

/**
 * The registry is the extension point: this story adds a subtitle (`.srt`) adapter in forty
 * lines and hands the registry to the viewer. The shell — identity row, download, loading,
 * empty and error states — is the same one every built-in format gets, because the adapter
 * supplies only `load` and a `Renderer`.
 */
export const CustomFormat: Story = {
  args: {
    registry: registryWithSubtitles,
    source: { kind: "text", text: STANDUP_SRT, name: "standup-2025-10-07.srt" },
    className: "h-[22rem] max-w-3xl",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByText(/Batch NB-0931 is on sales hold/)).toBeInTheDocument(),
      { timeout: 15_000 },
    );
    // Drawn by the custom renderer (a list of cues), not by the text fallback (a <pre>).
    await expect(canvasElement.querySelector("pre")).toBeNull();
  },
};
