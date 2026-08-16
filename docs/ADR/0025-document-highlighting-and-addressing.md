# ADR 0025 — pointing at part of a document: `DocumentAddress`, the highlight funnel, and find-in-document

- **Status:** accepted (2026-08-10)
- **Deciders:** maintainer decisions on the address union, the format scope and shipping
  find-in-document in the same change
- **Related:** ADR 0024 (the viewer package), ADR 0007 (presentation-layer scope), ADR 0010
  (`border-strong` / non-text contrast), ADR 0017 (microcopy), `docs/DECISIONS.md` §D3, §D5

## Context

`@elabs-ai/components-viewer` (ADR 0024) opens a file and renders it. It could not
point at a **part** of one — which is the whole RAG-citation case: _"this answer came from that
paragraph on page 3"_, where clicking the citation must take the reader to the passage and mark
it. The same missing layer is why the viewer had no find-in-document, despite
`AdapterCapabilities.search` existing in the protocol and being honoured by nothing.

Two things made this more than "add a `highlight` prop":

- **Producers do not agree on how to say where.** A retrieval pipeline emits a snippet; a
  chunker emits character offsets into its own extraction; a PDF-native tool emits boxes on a
  page. All three are legitimate and none can be converted into the others after the fact.
- **Every format is addressable differently.** A `.txt` IS its own text. A PDF has geometry. A
  Word document reflows and has no page at all. Markdown's source is not what the reader sees.
  A spreadsheet is a grid. A deck is an outline. One painting mechanism cannot serve them.

### Prior art evaluated

`rag-document-viewer` (MIT, Python) was reviewed as a baseline.
**Verdict: ideas only, no adoptable code.** It shells out to `pdf2htmlEX` (GPLv3) and
LibreOffice to bake a static HTML bundle, highlights with jQuery-positioned empty `<div>`s, and
stamps the highlight data into the JS at build time. No TypeScript, no React, no tests, no ARIA,
colours substituted into CSS by Python string replace, and a README that documents `page` as
0-based while the code treats it as 1-based. Four ideas were kept: **normalized 0–1 page-fraction
rects** (survive zoom and resize because geometry is recomputed from the live element), **a
citation is an ARRAY of boxes** (models multi-column and multi-page without DOM-range stitching),
a documented **deep-link precedence**, and a scrollbar minimap (not built).

## Decision

### 1. One address union, in `@elabs-ai/components-ui`

```ts
// packages/ui/src/lib/document-address.ts — dependency-free leaf
export type DocumentAddress =
  | { kind: "quote"; text: string; occurrence?: number; near?: { page?: number; offset?: number } }
  | { kind: "range"; start: number; end: number; page?: number }
  | { kind: "rect"; page: number; rects: readonly DocumentRect[] };
```

Normalization is unconditional, so there is no `normalize` flag: matching a quote
byte-for-byte is the case that essentially never happens, and an off switch would only
offer callers a way to make their own citation fail.

A `page` on `quote`/`range` is **advisory** — it disambiguates repeats and is never used
to navigate. The viewer turns to the page the passage was actually located on, via the
adapter's own index, so a stale hint cannot send a reader to a blank page. `page` is
authoritative only on `rect`, the one kind with no range to derive a position from.

- **`quote` is the interoperable kind.** A producer's offsets never match our extractor's; the
  snippet survives the round trip. It is what a RAG pipeline can actually emit.
- **`range` is exact**, and only trustworthy against **our** `AdapterDocument.text`.
- **`rect` is geometric** (0..1 fractions, CSS origin) and needs no text at all.

It lives in `ui`, not `viewer`, because `ai` and `viewer` are Layer-2 siblings that may not
import each other and `ui` is the only layer both reach — the same reason `FileSource` lives
there (ADR 0024 §5). Only the address vocabulary is hoisted; `DocumentHighlight`,
`ResolvedHighlight`, `TextIndex` and the capability field are adapter-protocol concepts and stay
in `viewer`.

### 2. Resolution is a funnel with three homes

| Step       | Does                                          | Runs in      | Why there                                                     |
| ---------- | --------------------------------------------- | ------------ | ------------------------------------------------------------- |
| **Locate** | `quote` → offsets into `AdapterDocument.text` | **provider** | the outcome is chrome state ("3 of 12", "couldn't find that") |
| **Map**    | offsets → block / line / cell / page / slide  | **renderer** | only the adapter knows its own model                          |
| **Paint**  | model coords → `<mark>` or overlay, + scroll  | **renderer** | it owns the DOM, its viewport and its pager                   |

`rect` skips Locate and Map. `range` skips Locate. Locate is pure, so it is unit-tested without
a DOM.

### 3. An adapter matches only the kinds it declared — never an exhaustive `switch`

`capabilities.highlight?: readonly DocumentAddressKind[]` sits on the **eager** manifest, so an
app can gate a "show citation" affordance without downloading pdf.js. A renderer handles the
kinds it declared and ignores the rest; it must NOT `switch` exhaustively with a `never`
fallthrough. That is what lets the union grow — a `cell` kind for a producer that can only emit
`"Sheet1!B7"` — without a `PROTOCOL_VERSION` bump.

**`PROTOCOL_VERSION` stays `1`.** Every addition is optional, which the protocol's own contract
already declares sufficient.

### 4. `TextIndex` is the one piece of offset bookkeeping

`AdapterDocument.text` is the address space; a renderer draws blocks, pages, cells, bullets. The
map between them is the same running-offset arithmetic every time, so it is written once
(`core/text-index.ts`) and each adapter supplies only its own `ref` type. The projection is the
**builder's output**, never a second string assembled by hand — that is what makes it impossible
for the text and the index to disagree.

**Rows, not cells, are the finest ref** in the tabular and Word cases: one builder has one
separator, and a renderer recovers a cell by summing the cells before it (`chunkOffset`). The
granularity of the REF is the row; the granularity of the MARK is still the character.

### 5. Per format, the honest granularity — not the finest one available

| Format       | Marked as                        | Why not finer / coarser                                                                       |
| ------------ | -------------------------------- | --------------------------------------------------------------------------------------------- |
| text, code   | `<mark>` on the characters       | the document IS its projection                                                                |
| pdf          | boxes over the page raster       | geometry exists; `rect` needs no text                                                         |
| docx         | `<mark>` on the characters       | reflowed prose, no page to draw on                                                            |
| **markdown** | **the containing block, plated** | `text` is the SOURCE — offset 212 can land inside `**bold**`, two characters nobody ever sees |
| csv, xlsx    | `<mark>` inside the cell         | one shared grid projection, so a citation resolves the same in a workbook and its CSV export  |
| pptx         | `<mark>` on the outline line     | the deck is read as an outline, so there is no slide canvas to box                            |
| json, image  | nothing declared                 | a tree is not text; `rect` on an image is a real future case                                  |

Markdown is the load-bearing exception: a character-granular guess there would look exactly as
confident as a correct one, so the block is plated whole. **Coarse and right beats precise and
subtly wrong.**

A renderer that owns a pager (`pdf`, `pptx`) or a tab strip (`xlsx`) **navigates to the passage
first, then scrolls** — keyed on the page/sheet/slide, so a reader who pages away while the same
citation is active is not dragged back.

### 6. Real `<mark>`s, not the CSS Custom Highlight API

`MatchHighlight` already splits a string at ranges into real `<mark>`s on the `--highlight` token
pair. Real elements are in the accessibility tree, are a `scrollIntoView` target, and work in
every browser. `CSS.highlights` needs no per-adapter work but is invisible to assistive tech and
gives nothing to scroll to. Keep it as a possible markdown-only enhancement, off the critical
path.

### 7. The current passage is never distinguished by colour alone

One new token pair — `--highlight-active` / `--highlight-active-foreground` — because exactly one
highlight pair existed, so "the current match" had no colour; and the alternatives lie
(`ring-ring` on an unfocused element claims focus; the status tones mean warning/success, not
"current"). Colour is not the only channel (WCAG 1.4.1): the active mark also carries an
outline — a doubled rail on a markdown plate — plus `aria-current="true"`, and the count region
announces it.

### 8. Not-found is a state, not a no-op

`pending` · `resolved` · `not-found` · `unsupported`, one per id, announced `role="status"`.
`not-found` splits on `truncated`, because the projections are capped: "this passage is beyond
the previewed pages" is different news from "we couldn't find it". `unsupported` is a
**capability gap**, not a failure — neutral panel, no retry, matching ADR 0024's treatment.

### 9. Find-in-document reuses the same layer

The query lives in provider state (it originates in the chrome), citations are a **prop** (they
originate in a chat pane, often another route). Two lists, never one: find matches carry reserved
`find:*` ids and `source: "search"`; both paint identically and only `active` differs.
`FileViewerFind` is `role="search"`, deliberately **not** a `Toolbar` — a toolbar is one tab stop
with roving arrow keys, and an `<input>` inside one steals Left/Right from the caret.
Cmd/Ctrl+F is scoped to `FileViewerFrame`, never a document-level listener.

`capabilities.search` becomes an **override in the OFF direction only** —
`(search ?? true) && text !== undefined && support.includes("range")` — because `pdf` never
declared it while `json` did, so gating on the flag would have denied the find box to the
flagship format and handed one to a format that could paint nothing. A declared `true` is
therefore inert; a declared `false` still turns find off.

Two things decide whether Ctrl/Cmd+F is taken from the browser, not one: the adapter must be
able to paint a match, **and** a `FileViewerFind` part must be composed in. The parts are
composable, so "could paint" is not "somewhere to type" — the find part registers itself on
mount, and a hand-composed frame that omits it keeps the browser's own find rather than
swallowing the shortcut into nothing.

The current search match **outranks** an active citation while the box is open: it is what the
reader's keystrokes are moving, and only one thing can be current. That effective id — not the
citation knob — is what an adapter `Renderer` receives, so find can scroll, turn the page and
switch sheet exactly as a citation does.

### 10. The capability declaration is gated (a convention ships with its teeth)

`capabilities.highlight` is a promise the renderer must keep, and nothing else in the repo checks
it: a manifest could claim `rect` forever while the renderer ignored the prop, and the only
symptom is a citation that silently does nothing.
`pnpm viewer-highlight:check` (`scripts/check-viewer-highlight-coverage.mjs`, self-tested) runs
four rungs per adapter — the declared kinds are real and `quote` implies `text`; the renderer
reads `highlights`; the converse (painting code with no declaration fails too); and a test builds
an address literal per declared kind AND asserts on something **painted**.

## Consequences

- A chat citation needs **no change to `@elabs-ai/components-ai`**: the app holds the
  highlight state and closes over it in `AssetPreview`'s `renderPreview` slot (ADR 0024 §6). No
  sideways package edge is created.
- **A CSV's `AdapterDocument.text` changed** from the raw file to the parsed grid. It is a
  behaviour change and is recorded in the changelog: an offset into raw bytes — with their
  quoting, escapes and arbitrary delimiter — lands nowhere in particular in the rendered table.
- Adding a format's highlight support is now a bounded job: build a `TextIndex` in `load()`,
  paint with `MarkedText` (or your own overlay), declare the kinds, write the test the gate
  demands.
- The union can grow. A `cell` kind (`"Sheet1!B7"`) is the obvious next member and needs no
  protocol bump — §3 is what buys that.
- What the gate cannot prove: that a painted mark lands on the RIGHT characters, that `rect`
  boxes are positioned correctly, or that the locator agrees with the adapter's projection. Those
  are the unit tests' job; the gate proves the wiring exists at all.
