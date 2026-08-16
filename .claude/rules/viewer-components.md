---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. See `.claude/rules/quality-gates.md` "Enforcement over reminders" and
# the `rules:scoping:check` gate (scripts/check-rule-scoping.mjs).
paths:
  - "packages/viewer/**"
---

# File viewer components (@qlik-coe-emea/qlabs-components-viewer)

`@qlik-coe-emea/qlabs-components-viewer` renders **a file the app did not write** —
uploaded, fetched from a signed URL, or produced by an agent — themed and accessible.
Durable record: [`docs/ADR/0024-viewer-package.md`](../../docs/ADR/0024-viewer-package.md).
`@qlik-coe-emea/qlabs-components-editor` is its sibling: `editor` is for source you
**author**, `viewer` for content you **read**.

## The shape

- **`FileViewer`** is a compound component (`component-api.md`): `FileViewerProvider`
  holds the state, `FileViewerFrame` / `FileViewerToolbar` / `FileViewerContent` /
  `FileViewerSkeleton` / `FileViewerError` / `FileViewerEmpty` are the parts, and
  `<FileViewer>` is the batteries-included default composition. There is **no
  `showToolbar` boolean** — compose the parts you want.
- **`useFileViewer()`** exposes `{ state, actions, registry }`. Any control inside the
  provider but outside the frame (a download button in a page header, a format badge in a
  breadcrumb) reads and drives the same state without prop-drilling.

## The view state is the SHELL's — page, scale, rotation

Durable record: [`docs/ADR/0026`](../../docs/ADR/0026-viewer-view-state-and-chrome-parts.md).
`state.pageNumber` / `pageCount` / `zoom` / `effectiveZoom` / `rotation` live in the provider,
with `goToPage` · `nextPage` · `previousPage` · `setZoom` · `zoomIn` · `zoomOut` ·
`setRotation` · `rotate` on `actions`. `pageNumber`, `zoom` and `rotation` are each a
controlled/uncontrolled trio (`component-api.md`).

- **An adapter never owns its page or its scale.** It receives `pageNumber` / `zoom` /
  `rotation` as props and reports back — the same shape ADR 0025 gave highlights. A renderer
  that keeps its own `useState` for these cannot be deep-linked to, cannot be driven from an
  app's own header, and can only ever have one pager, inside its canvas.
- **A `Renderer` must still work outside a provider.** Use `usePageControl(pageNumber,
onPageChange, pageCount)` — the same controlled/uncontrolled trio, so a renderer mounted
  directly keeps paging itself.
- **A fit mode is a REQUEST the renderer resolves.** `ZoomLevel` is `number | "fit-width" |
"fit-page"`. Only the renderer knows its viewport, so it computes the scale and reports it
  through `onZoomResolved`; the shell shows the request on the control and the RESOLVED value
  in the live region. **Step from `effectiveZoom`, never from `zoom`** — a page fitted to 137%
  must step up to 150%, not down to 125%.
- **A paginated document SCROLLS; it is never a flipbook.** `pdf` and `pptx` render every
  page into one virtualized column (`usePagedScroll`, on `@tanstack/react-virtual`) and let
  `FileViewerContent` scroll it — the page number is a position in that column, not a switch
  between views. A new paginated adapter uses that hook; do not hand-roll a second
  virtualizer, and do not go back to swapping one canvas. Feed it exact estimates
  (`AdapterDocument.pageSizes` × the scale) so the scrollbar is honest on the first frame;
  `pageSizes` is allowed to be SHORTER than `pageCount` (the PDF loader collects it inside the
  50-page text pass), so fall back to the first page's size rather than measuring a second
  time.
- **The chrome is parts:** `FileViewerPager`, `FileViewerZoom`, `FileViewerRotate`. Each
  renders `null` when the manifest does not claim its capability (`pages` / `zoom` / `rotate`)
  — inert chrome reads as a broken render. A capability a manifest claims, the renderer
  honours, and a test asserts on: the `image` manifest declared `zoom`/`rotate` for a renderer
  that implemented neither, which nothing could observe and therefore nothing could falsify.
- **None of them is a `role="toolbar"`** — the page field is a text input and the role
  promises arrow-key navigation that would steal Left/Right from the caret (the same call
  `FileViewerFind` makes). One `sr-only role="status"` per GROUP, not per control.
- **The zoom ladder is shared** (`VIEWER_ZOOM_STEPS`, `stepZoom`, `canStepZoom`, `isZoomFit`
  in `core/zoom.ts`, exported from the barrel). Never mint a per-adapter ladder.

## The registry is the extension point (never a per-format `switch`)

A format is added by **registering an adapter**, never by editing `FileViewerContent`.
An adapter is a manifest + a lazy loader:

```ts
registry.register(
  { id: "pdf", protocol: PROTOCOL_VERSION, extensions: ["pdf"], requires: ["pdfjs-dist"] },
  () => import("./pdf-adapter"),
);
```

- **The manifest is eager and data-only; the loader is lazy.** That split is load-bearing:
  `createDefaultRegistry()` must never pull a renderer — or its engine — into the entry
  chunk. Manifests live in their own `<kind>-manifest.ts` file for exactly this reason, and
  `pnpm heavy-deps:check` fails a static edge to a watched engine.
- **Detection is priority-then-specificity.** Extension (4) beats exact MIME (3) beats MIME
  prefix (2) beats category (1); a higher `priority` outranks all of it. That IS how a
  consumer overrides a built-in — do not add a second override mechanism.
- **`protocol` is a hard gate.** An adapter built against another `PROTOCOL_VERSION` is
  rejected at registration, not at render. Bump it only for a breaking change to
  `FileAdapter` / `AdapterModule`; adding an optional field is not one.
- **One adapter instance per document.** `create()` runs per load, so an adapter may hold
  per-document state; `dispose()` releases it (and any object URL the source minted).

## Adapters emit DATA, never HTML

The rule the whole package rests on. An adapter's `load()` returns a **model** —
rows/columns, a tree, a page list, a string — and its `Renderer` draws that model with
`@qlik-coe-emea/qlabs-components-ui` components. It never returns an HTML string, never
writes `innerHTML`, and never carries inline colour. This is what makes an arbitrary file
themeable at all: the `csv` adapter renders a real `Table`, so it gets the theme, the
density dial, RTL and keyboard semantics for free.

- Document **content** is shown as authored (a PDF's own colours are the file); the
  **chrome** around it is tokened. Don't "brand" the file itself.
- **An adapter whose parser hands back HTML parses it into a model and throws the markup
  away** — it does not sanitize-and-inject. That is what the Word adapter does: mammoth
  returns an HTML string, `docx-model.ts` walks it with `DOMParser` and emits blocks and
  runs, and a tag the walk does not name contributes only its text. The parse IS the
  allowlist, so there is no denylist to maintain, no sanitizer dependency, no
  `dangerouslySetInnerHTML`, and no Trusted-Types carve-out. Only reach for a positive
  allowlist sanitizer (`ALLOWED_TAGS` / `ALLOWED_ATTR`) if a format genuinely cannot be
  modelled — and route that decision through the architect first.
- **Href-bearing content is filtered by scheme.** A link from a foreign document keeps only
  `http:`, `https:`, `mailto:` and `tel:`; anything else (notably `javascript:`) renders as
  plain text. See `safeHref` in `docx-model.ts`.
- **Never trust a parser to reject a wrong file.** SheetJS reads arbitrary text as a
  one-column CSV, so a damaged `.xlsx` would "open" as one junk cell — worse than an error,
  because it looks like it worked. The xlsx adapter checks the container signature first
  (`looksLikeWorkbook`). Give any new adapter the same up-front check where its parser is
  similarly forgiving.

## Text-ish formats: which adapter owns which file

Four adapters can all claim a text file, so the boundaries are deliberate — read them
before adding a fifth:

- **`markdown`** claims `.md` and `text/markdown` and renders a **document**
  (Streamdown → the same `Prose*` primitives `@qlik-coe-emea/qlabs-components-ai` uses).
  It does **not** claim `.mdx` — that is JavaScript wearing markdown, and executing it is
  not what a viewer does.
- **`code`** claims ~60 source extensions and nothing else. It never claims the `code`
  **category**, so an unknown text file still lands on `text` rather than being tokenized
  as an unknown grammar. `json`, `csv`, `md` and `svg` are deliberately absent from its
  table — they belong to adapters that show them as data, not as source.
- **`text`** is registered LAST and claims broad categories only. It is the backstop.
- **Detection has no fallback chain.** The winning manifest is the only one tried: if
  `code` wins a `.ts` file and `shiki` is not installed, the reader gets `parser-missing`
  naming `shiki` — the load does not fall back to `text`. That is the intended trade
  (a named gap beats a silent downgrade); a consumer who wants the other trade registers
  their own adapter at a higher `priority`.

**The highlighting theme is a token theme.** `code-theme.ts` is a hand-written Shiki
`ThemeRegistrationRaw` whose every colour is `var(--code-*)`, so ONE theme is correct in
every `data-theme` and switching theme recolours live with no re-tokenize. Do not port
`@qlik-coe-emea/qlabs-components-ai`'s `_code-block-theme.ts` (oklch→hex + a
`MutationObserver`) here — that bridge exists only because `@streamdown/code` freezes
themes at import time, which this package does not use.

## One scroll boundary, and it is a keyboard stop

`FileViewerContent` owns the viewport. An adapter whose content simply flows —
text, code, markdown, Word — renders a plain block and lets that pane scroll; it must
NOT wrap itself in a second `overflow-auto`. Two nested scrollers do not compose: the
inner one clips while the outer one's padding stays put, so a long document ends flush
against a band of whitespace and reads as a failed render rather than as "scroll for
more". The pane's padding is the page margin, so a flowing adapter adds none of its own.

An adapter keeps its own viewport only when it has a **fixed sub-control above a
scrolling body** — a sheet under its tab bar. It is a narrow exemption, and losing the
fixed control loses the exemption with it: `pdf` and `pptx` gave up their own viewports
the moment their page chrome moved to the shell (ADR 0026). A fixed-RATIO frame whose
content may not fit it (the deck's `aspect-video` slide) is a different thing and may
still scroll inside itself.

Either way the scrolling element is a **focusable, named region**: `tabIndex={0}` +
`role` + `aria-label` + a `focus-visible:ring-ring` ring. A pane that scrolls but holds
nothing focusable cannot be reached from a keyboard at all (WCAG 2.1.1), and a
plain-text file holds nothing focusable by definition. Use `role="region"` for the
content pane and `role="group"` inside it — one landmark per viewer, not one per sheet.

**Headings are offset, not absolute.** A viewed file carries its own heading tree, valid
only relative to the page hosting it. `AdapterRendererProps.baseHeadingLevel` (default
`2`) is what an adapter that renders headings offsets by — `clampHeadingLevel(own + base

- 1)`, never past `h6`. Without it a README's `#`puts a second`h1`in the screen
reader's flat heading list. Same seam as`@qlik-coe-emea/qlabs-components-ai`'s
`MarkdownView`.

## Pointing at part of a document

A citation ("this answer came from that paragraph") and find-in-document are the
same layer. Durable record: [`docs/ADR/0025`](../../docs/ADR/0025-document-highlighting-and-addressing.md).

- **One address union, three kinds** — `quote` (a snippet — the interoperable one,
  and what a retrieval pipeline can actually emit), `range` (character offsets
  into `AdapterDocument.text`, exact but only against OUR projection), `rect`
  (0..1 page fractions, no text needed). `DocumentAddress` lives in
  `@qlik-coe-emea/qlabs-components-ui` (`src/lib/document-address.ts`) because
  `ai` and `viewer` are Layer-2 siblings and `ui` is the only layer both reach —
  the same reason `FileSource` is there.
- **Three steps, three homes.** LOCATE (`quote` → offsets) runs in the
  **provider**, because the outcome is chrome state ("3 of 12", "couldn't locate
  that passage") and because it is pure. MAP (offsets → block/cell/page/slide) and
  PAINT run in the **renderer**, because only the adapter knows its own model and
  owns its DOM, viewport and pager. `rect` skips LOCATE and MAP; `range` skips
  LOCATE.
- **Match the kinds you declared; never `switch` exhaustively.** An adapter
  handles what its manifest's `capabilities.highlight` lists and ignores the rest.
  A `never` fallthrough would make every new kind a `PROTOCOL_VERSION` bump — the
  union is meant to grow (a `cell` kind for a `"Sheet1!B7"` producer).
- **Build the projection with `createTextIndexBuilder`, never by hand.** The
  document's `text` is the builder's OUTPUT, so the projection and the map back
  into the model cannot drift apart. Rows (not cells) are the finest ref in the
  tabular and Word cases — one builder has one separator, and a renderer recovers
  a cell with `chunkOffset`. **The REF is the row; the MARK is still the
  character.** A multi-level join (cells/rows/sheets) stays ONE index via the
  per-push separator override — do not stitch three indexes together.
- **Pick the honest granularity, not the finest one available.** Text/code/Word
  mark characters; PDF draws boxes on the page; csv/xlsx mark inside the cell;
  pptx marks the outline line. **Markdown plates the whole containing block on
  purpose** — its `text` is the SOURCE, so an offset can land inside `**bold**`,
  two characters the reader never sees. Coarse and right beats precise and subtly
  wrong.
- **Navigate first, then scroll.** A renderer with a pager or a tab strip turns to
  the cited page / sheet / slide before scrolling the mark into view — keyed on
  that page/sheet/slide, so a reader who pages away while the same citation is
  active is not dragged back.
- **Paint with real `<mark>`s** (`MatchHighlight`, via the shared `MarkedText`),
  not the CSS Custom Highlight API: real elements are in the accessibility tree
  and are a `scrollIntoView` target. Reach for `useScrollActiveHighlightIntoView`
  rather than a ref — every painter produces its elements from a list.
  - **An adapter OUTSIDE this package** (the registry is a public extension
    point) gets the same toolkit from the barrel: `toMarkRanges`, `localizeRanges`,
    `chunkOffset`, `useScrollActiveHighlightIntoView` and
    `ACTIVE_HIGHLIGHT_SELECTOR`. Do not re-derive the merge↔`activeIndex`
    correspondence by hand — overlapping citations collapse into one mark, and an
    index counted against the unmerged list points at the wrong one. `MarkedText`
    itself is internal (it renders a fragment, so it has no element to carry a
    `data-slot`); compose `localizeRanges` with `MatchHighlight` — that is all it
    is.
- **The current passage is never colour-only** (WCAG 1.4.1): the active mark adds
  an outline (a doubled rail on a markdown plate) and `aria-current="true"`, and
  the count region announces it.
- **Not-found is a state**, not a no-op: `pending` / `resolved` / `not-found` /
  `unsupported`, announced `role="status"`. `unsupported` is a capability gap and
  gets the neutral panel, like `parser-missing` above.
- **Enforced:** `pnpm viewer-highlight:check` (self-tested, blocking) — the
  declared kinds are real and `quote` implies `capabilities.text`; the renderer
  reads `highlights`; painting code with NO declaration fails too; and the
  adapter's test builds an address literal per declared kind and asserts on
  something **painted**. See @.claude/rules/quality-gates.md ("Enforcement over
  reminders").

## States (the vocabulary, not a new one)

`loading-states.md` applies verbatim: `loading` is the only not-ready signal (a file
arrives settled or not at all — there is no `isStreaming` here), rendered as a
**layout-shaped skeleton**. A parent's `loading` prop is **additive** — it can add the
not-ready state but must never clear a real error.

Errors are keyed by `ViewerErrorCode`, and the code decides whether a retry is offered:

| Code                 | Means                                 | Retry?         |
| -------------------- | ------------------------------------- | -------------- |
| `unsupported-format` | no adapter claims the file            | no             |
| `parser-missing`     | the optional peer is not installed    | no             |
| `read-failed`        | the bytes could not be fetched        | yes            |
| `parse-failed`       | the bytes are not a valid file        | yes            |
| `protocol-mismatch`  | adapter built against another version | no             |
| `aborted`            | superseded by a newer load            | never surfaced |

`parser-missing` **names the package**. "Couldn't open this file" leaves the reader with
nothing to do; "needs papaparse to be installed" is actionable.

**A missing peer is caught in TWO places, because it can surface from two.** The registry
maps a failed `loader()` to `parser-missing`, but every parser engine is actually reached
from inside the adapter's own `load()` (`await import("mammoth")`), where the module
resolves fine and the rejection lands on `FileViewerProvider` instead. So the provider
re-runs the same `isModuleNotFound` test against the manifest's `requires` before falling
back to `parse-failed` — without it a missing peer reads as "isn't a valid file, or it's
damaged" plus a retry that can never work. Use `parserMissingError(id, requires)` in both
paths; never construct the code inline.

**A capability gap is not a failure.** `unsupported-format` and `parser-missing` say "this
build can't draw that" — the file is intact and the reader did nothing wrong. They render
as a **neutral** panel (`StatePanel kind="empty"`, solid edge, `EyeOff` glyph) announced
with `role="status"`. `read-failed` / `parse-failed` are real failures and keep the
destructive panel, `role="alert"` and the retry. Route a new code through the same test —
_did something go wrong, or did we simply never ship this?_ — and note that the gap copy
should point at what the reader CAN still do (the file is downloadable from the toolbar).

**Chrome with nothing in it is worse than no chrome.** `FileViewerToolbar` renders `null`
with no source: a row holding a generic glyph and a blank name reads as a broken render,
not as a frame. A screen that needs a permanent header composes its own row around
`FileViewerFrame` — that is what the parts are for.

## Optional peers (a format is allowed to be absent)

Every parser engine is an **optional peer dependency** (`peerDependenciesMeta.optional`)
and also a devDependency so this repo can test it. A consumer who installs neither gets
the graceful `parser-missing` panel, not a build error — `pnpm consumer:check` runs with
the peers absent and proves it. Never promote a parser to a plain `dependency`.

## Cross-package boundary

`viewer` is a Layer-2 leaf: `tokens` → `ui` → `viewer`. It may **not** import `ai`,
`data`, `charts`, `editor` or any other domain sibling, and they may not import it. A
sibling that needs viewer formats takes them by **injection** — see `AssetPreview`'s
`renderPreview` slot (ADR 0024 §6), the same shape `ChartFrame`'s `renderTable` uses.

The shared file vocabulary — `FileSource`, `normalizeFileSource`, `resolveFileKind`,
`fileIconFor`, `FileCategory` — lives in `@qlik-coe-emea/qlabs-components-ui`
(`src/lib/`) precisely so both sides can speak it without a sideways edge.
