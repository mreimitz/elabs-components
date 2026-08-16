# ADR 0024 — `@elabs/components-viewer` (adapter-registry leaf) + a shared file model in `@elabs/components-ui`

- **Status:** accepted (2026-08-10)
- **Deciders:** `brand-ui-design-system-architect` review; maintainer decisions on package
  name, phasing and the `Toolbar` rename
- **Related:** ADR 0001 (architecture), ADR 0002 (component ownership), ADR 0007
  (presentation-layer scope), ADR 0015 (wrap-an-engine leaf precedent), ADR 0017 (microcopy),
  ADR 0019 (lazy engine boundaries), `docs/DECISIONS.md` §D3, §D5

## Context

Internal apps, prototypes and AI clients need to show files. Today the library can render
some file-shaped content, but it is scattered, inconsistent and incomplete.

**Three competing file models exist, with no shared type:**

| Model                     | Where                                                       | Shape                                                           |
| ------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| `ContextAssetType`        | `packages/ai/src/context-panel.tsx:54`                      | `"markdown"\|"code"\|"sql"\|"csv"\|"image"`, content a `string` |
| `AttachmentMediaCategory` | `packages/ai/src/attachments.tsx:27`                        | MIME-derived, 6 buckets                                         |
| `UploadFile`              | `packages/ui/src/components/file-upload/file-upload.tsx:29` | `{ file: File }`                                                |

**Coverage gaps:** no PDF renderer anywhere; no video player (only a muted `<video>`
thumbnail at `packages/ai/src/attachments.tsx:239`); no Office support; and CSV "parsing" is
an 8-line `line.split(",")` with no quoted-comma handling
(`packages/ai/src/asset-preview.tsx:69`).

**`AssetPreview` is already a file viewer that cannot grow.** It switches on asset type and
renders markdown/code/sql/csv/image with a Preview/Raw toggle — but it is hard-wired to five
string-content types, so no new format can reach it.

### Prior art evaluated

[`anyview`](https://github.com/harshpreet931/anyview) (MIT, version 0.2.3 at review time, ~10k LOC, single
maintainer, pre-1.0) was reviewed as a candidate baseline. Its **adapter registry** is a
genuinely good design and its **self-hosted pdf.js asset strategy** is the correct one. It is
not adoptable as code:

| Blocker                                                                                       | Evidence                                                                                                              |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| No composition API — `showToolbar`/`showSidebar` booleans, no slots, `className` on root only | `src/components/DocViewer.tsx:265`, `src/core/types.ts:340`                                                           |
| Adapters emit HTML **strings with inline styles** CSS cannot override                         | `XlsxAdapter.ts:167`, `DocxAdapter.ts:123` (`border:'1px solid #ddd'`); `CsvAdapter.ts:184`; `PptxAdapter.ts:133,237` |
| Pages render to a bare `<canvas>` with no role/label; images have **no alt-text path at all** | `PageRenderer.tsx:128`, `ImageAdapter.ts:118`                                                                         |
| ~10 hardcoded English `aria-label`s bypassing its own i18n                                    | `DocViewer.tsx:225`, `Toolbar.tsx:167,259,294,335,404`                                                                |
| 22 raw `innerHTML` writes                                                                     | every reflowable adapter                                                                                              |
| `url` source accepts no headers / credentials / abort signal                                  | `src/core/file-source.ts:69`                                                                                          |

## Decision

### 1. Ship `@elabs/components-viewer` as a Layer-2 leaf

`tokens → ui → viewer`, the established wrap-an-engine pattern of `…-flow` (React Flow),
`…-editor` (Monaco), `…-maps` (MapLibre) and `…-data` (TanStack). Registered in `ALLOWED`
(`scripts/check-dep-direction.mjs`) with the standard Layer-2 row: tokens, icons, ui.

**Name.** Every library package is a single real word (`tokens ui icons data ai flow maps
charts marketing editor blueprint`); the only hyphens in the repo are infra config
(`eslint-config`, `typescript-config`). `viewer` keeps that convention and gives a clean
`editor` ↔ `viewer` symmetry. Components are named `FileViewer*` regardless — that reads
correctly and matches the `ContextPanel*` convention. `FileViewer` shadows no JS global, so
the ADR 0015 `MapCanvas`-not-`Map` concern does not apply.

**Why not inside `@elabs/components-ai`.** Not for bundle weight — that
argument is false here: `…-ai` already ships `mermaid`, `@xterm/xterm`,
`@rive-app/react-webgl2`, `media-chrome`, `shiki` and `streamdown` as plain `dependencies`,
so every chat consumer already installs all of it, and this package's parsers are optional
peers that aren't installed at all unless requested. The real reasons:

1. **Consumer shape.** A file viewer's consumers are largely not chat apps — an attachment
   preview in an admin console, a data catalogue's sample-file preview, a document-management
   screen. Making those depend on `…-ai` (and with it the `ai` SDK peer, streamdown, xterm,
   Rive) to render a PDF inverts the dependency for the majority case.
2. **D3 stays answerable.** `docs/DECISIONS.md` §D3 routes by domain, and "render an arbitrary
   file" is not chat. Folding it into `ai` makes D3 unanswerable for the next person.
3. **The registry is a package-level public contract.** Priority override, a versioned adapter
   protocol and an optional-peer surface are properties of a package's API. Grafting a second,
   differently-shaped contract onto `ai`'s flat-file surface muddies both.
4. **Why not `@elabs/components-data`.** That package is TanStack-table-shaped
   tabular UI. A PDF/video/docx viewer is not tabular, and the csv/xlsx overlap resolves to
   `ui`'s `Table`, not `data`'s `DataTable`.

### 2. Adopt anyview's registry architecture; write our own code

`src/core/registry.ts` keeps the four ideas that make it work: a versioned adapter protocol;
**eager manifests + lazy `() => import()` loaders** (so the toolbar knows a format's
capabilities before any parser is fetched); priority-based override so a consumer can replace
a built-in; and a fresh adapter instance per document. Nothing heavy sits in the entry
chunk — per ADR 0019 every engine is reached by dynamic `import()`, and `viewer` joins
`WATCHED_PACKAGES` in `scripts/check-eager-heavy-deps.mjs`.

Every parser is an **optional peer dependency** (`peerDependenciesMeta.optional`). This has no
precedent in the repo, so two requirements are part of this decision:

- Each optional peer is **also** a `devDependency` of `packages/viewer`, or `typecheck`/`build`
  fail on the dynamic `import()`.
- `pnpm consumer:check` must be exercised with the peers **absent**, proving the graceful
  "format unavailable" path rather than a module-resolution stack trace. (This is the failure
  anyview has: `sanitizer.ts:33` does a bare `await import('dompurify')` with no
  `loadParser()` wrapper, so a consumer without it gets an unhelpful resolution error.)

### 3. Adapters emit DATA, not HTML

This is the decision that makes the package themeable, and it is where anyview went wrong in
four adapters.

| Kind            | Engine (lazy, optional peer)    | Renders as                                             |
| --------------- | ------------------------------- | ------------------------------------------------------ |
| image, svg      | native                          | `<img>` with a real `alt` — **not** canvas             |
| text, log, json | `TextDecoder`                   | tokened `<pre>` / JSON tree                            |
| csv, tsv        | `papaparse`                     | `ui` `Table`                                           |
| markdown        | `streamdown`                    | brand markdown surface                                 |
| code            | `shiki`                         | tokened code surface                                   |
| xlsx, xls       | `xlsx`                          | **sheet model → `ui` `Table`** — never `sheet_to_html` |
| pptx            | `jszip` + `DOMParser`           | **slide model → our components**                       |
| docx            | `mammoth`                       | sanitized HTML → tokened prose wrapper                 |
| html            | `dompurify`                     | sanitized, or sandboxed `<iframe>`                     |
| pdf             | `pdfjs-dist` (worker + Comlink) | canvas page + selectable text layer                    |
| video, audio    | `media-chrome`                  | `MediaViewer`                                          |

**3a. The sanitizer guarantee is a positive allowlist.** "Strips `style` and `class`" would be
insufficient — it does not remove presentation attributes (`color`, `bgcolor`, `face`,
`align`, `border`, `fill`, `stroke`), does not remove a `<style>` element, and does not reach
inside `<svg>`. The actual guarantee: **`ALLOWED_TAGS` and `ALLOWED_ATTR` are positive
allowlists; `style`, `class` and every presentation attribute are absent from `ALLOWED_ATTR`;
`<style>` and `<svg>` are absent from `ALLOWED_TAGS`.**

**3b. Chrome is tokened; document content is not.** The viewer's chrome and its reflowed-text
surfaces are token-driven. A photo, a rendered PDF page and a chart inside a slide render **as
authored** — that is the file, not a brand violation. Without this distinction the first PDF
makes the invariant look broken and someone "fixes" it.

**3c. Fidelity tradeoff, decided now.** Stripping author styling from a docx means a document
whose meaning is carried by highlight or colour renders wrong. **Brand-tokened prose is the
default and author colour is deliberately dropped.** If fidelity is later required it arrives
as an opt-in `fidelity="brand" | "document"`, with `document` confined to the sandboxed
`<iframe>` that already exists for the `html` adapter.

**3d. CSP / Trusted Types — declared, not asserted.** `mammoth` output and the `html` adapter
must put a string into the DOM; under `require-trusted-types-for 'script'` a plain-string
`dangerouslySetInnerHTML` throws. The chosen path is **DOMPurify with
`RETURN_TRUSTED_TYPE: true` behind a named TT policy** (the repo already dogfoods
`tt-aliases:check` and `csp:check`). If any module ends up on a raw sink it is **declared in
`csp-sinks-baseline.json.ourSource`**, not asserted away.

Critically: `scripts/check-csp-sinks.mjs:141` iterates `manifest.dependencies` **only**, so it
is structurally blind to optional peers. Claiming "zero sinks" would be an artefact of that
blind spot, which is exactly the route-around-a-gate move `quality-gates.md` forbids.
**Therefore: extend `check-csp-sinks.mjs` to scan `peerDependencies`, self-tested, in the same
change that introduces the first optional peer.** Budget for fallout — `streamdown` and
`media-chrome` are already on the baseline's `packages` list, but `pdfjs-dist`, `mammoth`,
`xlsx`, `jszip`, `dompurify` and `papaparse` are not.

**3e. pdf.js CSP posture.** `pdfjs-dist` compiles Type-4 PostScript functions with
`new Function` unless `isEvalSupported: false` is passed to `getDocument` — so pass it.
`apps/playground` serves the documented policy as a real header and
`apps/e2e/tests/csp.spec.ts` fails on any violation, so the `worker-src` / `blob:` deltas the
worker and the canvas→blob download need are written into `docs/CSP-AND-NETWORK.md` §2.7 as
named carve-outs (`pnpm csp:check` keeps the two byte-identical).

### 4. The shared file model lives in `@elabs/components-ui`

`ui` (Layer 1) is the only place `ai`, `viewer` and future consumers can all reach, and it
already hosts exactly this class of non-visual leaf (`lib/download.ts`, `lib/merge-refs.ts`,
`lib/use-mobile.ts`) plus `FileUpload`. `tokens` is rejected: it is the **visual vocabulary**
package (themes, density, motion, taste) and a file domain model has no visual dimension.
`icons` is rejected because the map is Lucide and `.claude/rules/icons.md` makes
`…-icons` brand vocabulary only.

Three dependency-free leaves in `packages/ui/src/lib/`, barrel-exported (no subpath):

- **`file-source.ts`** — one tagged union covering every input, fixing anyview's fetch gap by
  carrying `init?: RequestInit` on the `url` variant (auth headers, credentials, abort
  signal):

  ```ts
  export type FileSource =
    | { kind: "file"; file: File; alt?: string }
    | { kind: "blob"; blob: Blob; name: string; mediaType?: string; alt?: string }
    | {
        kind: "url";
        url: string;
        name?: string;
        mediaType?: string;
        alt?: string;
        init?: RequestInit;
      }
    | { kind: "buffer"; buffer: ArrayBuffer; name: string; mediaType: string; alt?: string }
    | { kind: "text"; text: string; name: string; mediaType?: string };
  ```

  Plus `normalizeFileSource(source): ResolvedFileSource` — named so it does not read as a
  `FileReader` sibling.

- **`file-kind.ts`** — **`ui` owns a CLOSED, coarse category**, so that adding a `.pptx`
  adapter in Layer 2 is never a `ui` change:

  ```ts
  export type FileCategory =
    | "image" | "video" | "audio" | "document" | "spreadsheet" | "presentation"
    | "code" | "text" | "data" | "archive" | "unknown";

  resolveFileKind(name, mediaType): { category: FileCategory; mediaType: string; extension: string }
  ```

  **Fine-grained format matching lives in the adapter manifests**, in the package that owns
  the parsers.

- **`file-icon.ts`** — one Lucide icon map keyed by `FileCategory`, superseding
  `PRODUCED_ASSET_ICONS` (`packages/ai/src/file-tree.tsx:310`) and `mediaCategoryIcons`
  (`packages/ai/src/attachments.tsx:37`).

### 5. Compound components, composed from existing `ui` primitives

`FileViewerProvider` owns source, adapter, page, zoom, rotation, search and registry; parts
(`FileViewer`, `FileViewerToolbar`, `FileViewerPager`, `FileViewerZoom`, `FileViewerSearch`,
`FileViewerContent`, `FileViewerSidebar`, and the state parts) read it from context. Sibling
controls outside the visual frame but inside the provider drive state directly — no
prop-drilling, and no `showToolbar` boolean. `data-slot` on the root and every part.

> `pnpm data-slot:check` is a per-module **declaration** ratchet: it cannot see per-part
> coverage and does not validate slot values. Per-part correctness rests on the author and
> the reviewer.

A reuse audit against the manifest (2026-08-10; 100 exported `ui` components) confirms the
chrome composes existing primitives: `IconButton`, `ButtonGroup`, `Tooltip`, `Separator`,
`DropdownMenu`, `Kbd`, `Slider`/`SliderNumber`, `ToggleGroup`/`SegmentedField`,
`BoundedNumber`, `Pagination`, `InputGroup`, `Command`, `MatchHighlight`, `Tabs`,
`ScrollArea`, `Tree`, `Table`, `Descriptions`, `Dialog`, `Carousel`, `AspectRatio`,
`StatePanel`, `EmptyState`, `ErrorState`, `LoadingState`, `Skeleton`, `Spinner`, `Progress`,
`Heading`/`Text`, `FileUploadDropzone`, `downloadBlob`/`downloadUrl`.

**5a. `ui` gains a headless `Toolbar`; `ViewToolbar` is NOT retrofitted.** `ViewToolbar` is a
closed vocabulary — info ⓘ · status · filter chips · result count · actions — for "the row
above every list, table or board view"
(`packages/ui/src/components/view-toolbar/view-toolbar.tsx:4-43`). A page-nav/zoom/rotate row
has no filters and no result count, so composing it would use the component for the thing its
own doc comment says it is not.

The other toolbars are not evidence that toolbars are package-local; they are evidence of a
missing shared _behaviour_ and a live a11y defect. **Four modules claim `role="toolbar"` —
which promises arrow-key navigation — and none implements roving tabindex:**
`packages/ai/src/selection-toolbar.tsx:179`, `packages/charts/src/gantt/gantt.tsx:715`,
`packages/editor/src/markdown-toolbar/markdown-toolbar.tsx:123`,
`packages/editor/src/markdown-editor/table-view.tsx:146`. `ViewToolbar` is the only one that
got it right, by declining the role.

So: add `Toolbar` to `ui` as a thin wrapper over **`@radix-ui/react-toolbar`** (not currently
a dependency) — the same shape as every other `ui` Radix wrapper, and `accessibility.md`
already says not to reimplement focus management the primitive provides. It ships
`role="toolbar"` + `aria-orientation` + roving focus for free.

`@elabs/components-ai` already barrel-exports `Toolbar`
(`packages/ai/src/index.ts:75`), which is React Flow's node toolbar and is **mis-named
today**. It is renamed **`NodeToolbar`**, with `export { NodeToolbar as Toolbar }` kept as a
deprecated alias for one minor and a migration note in `CHANGELOG.md ## Unreleased`.

`ViewToolbar` is explicitly **not** flipped to roving tabindex — that would be a behaviour
change to a shipped component with a documented deliberate decision. (Its `actions` cluster
could later host a `Toolbar`; separate change, separate ADR.)

**5b. The sidebar uses `ResizablePanelGroup`, not `SplitPanel`.** `SplitPanel` is a static
CSS-grid two-pane layout and says so (`split-panel.tsx:50-56`). `Resizable*` wraps
`react-resizable-panels`, whose `PanelResizeHandle` already ships `role="separator"`,
`tabIndex=0`, `aria-controls`/`aria-valuenow` and Arrow/Home/End keyboard resize.

### 6. `AssetPreview` gains the new formats by injection, not dependency

`…-ai` and `…-viewer` are both Layer 2, so **neither may import the other**. This is not a new
precedent: **`ChartFrame`'s `renderTable`** (`packages/charts/src/chart-frame/chart-frame.tsx:378`)
is the same shape under the same constraint — `charts` cannot import `data`, so the frame takes
a render slot the app fills with a `DataTable`. Siblings: `funnel-chart.tsx:86`
`renderPattern`, `gantt.tsx:591` `renderBar`.

Four shape requirements:

1. **`renderPreview?: (asset) => ReactNode | null`, with documented fall-through.** Returning
   `null` falls through to the built-in renderer, so an app that wants PDF does not also have
   to reimplement the five built-ins. That is what makes adoption incremental.
2. **Injected via the provider, not a prop chain.** `ContextPanelProvider` is the lifted-state
   home (`context-panel.tsx:70`); threading the slot through four levels would violate the
   provider-injection convention in `component-api.md`. A direct prop on `AssetPreview` stays
   as an override for standalone use.
3. **`ContextAsset` gains `source?: FileSource`.** `content?: string`
   (`context-panel.tsx:64`) cannot carry a PDF or an xlsx; without this, §6 does not work.
4. **`ContextAssetType` is NOT widened.** It is a closed 5-member union consumed by
   `ProducedAssetTree` and `AssetPreview`; widening it breaks any consumer with an exhaustive
   `switch`. Instead `ai` gains optional `mediaType?: string` and calls `resolveFileKind`
   **internally** to derive icon and label. The vocabulary converges under the hood; the
   public type does not change.

### 7. pdf.js assets are self-hosted, never a CDN

Following anyview's `copyPdfjsAssets` approach: a build step copies `cmaps/`,
`standard_fonts/`, `wasm/` and `iccs/` from `node_modules/pdfjs-dist` into `dist/pdfjs/`,
resolved relative to the worker's own URL, with a `configureAssets(baseUrl)` escape hatch.
Required by `origins:check` and the CSP gates, not merely preferred, and it must survive
`pnpm consumer:check` (packed + installed outside the workspace).

### 8. Cross-cutting conventions

- **Client-only.** Canvas, workers and DOM parsing — the whole package carries `"use client"`
  (`banner` in `tsup.config.ts`, plus `CLIENT_PACKAGES` in `check-use-client-source.mjs`).
- **Loading vocabulary** (`.claude/rules/loading-states.md`, `loading-states:check`): the
  viewer takes the canonical `loading?: boolean` — no fourth name is minted — and renders a
  **layout-shaped skeleton** (page-sized `AspectRatio` + `Skeleton`), not a spinner. Parse
  errors are **terminal-only** (`role="alert"`) and suppressed while input is incomplete; the
  JSON and CSV adapters will hit that on a partially-fetched file, which is the same class of
  bug this ADR criticises in anyview.
- **Microcopy** (ADR 0017, `microcopy:check`): all user strings — including every toolbar
  `aria-label` — go through `useLocale()`/`t()` under a `viewer.*` namespace with English
  defaults in `packages/ui/src/components/locale-provider/messages.ts`. This is the concrete
  answer to the anyview defect indicted above.
- **RTL:** logical properties only (`border-s`, `ms-auto`) — the sidebar, pager and zoom
  controls are all direction-sensitive.
- **Subpath exports: none now.** The one candidate is `@…-viewer/registry` (adapter protocol +
  `register()`, dependency-free). It satisfies condition 1 of `component-api.md` (lighter
  tree) but not condition 2 (a real consumer needs it). Barrel now; revisit when a concrete
  consumer appears — do not add one silently, since `check-package-registered` only warns.

## Consequences

**Positive**

- One file vocabulary replaces three; `Attachments`, `FileTree` and `Gallery` can adopt it
  incrementally.
- Formats are additive: a new adapter is a `register(manifest, loader)` call, not a change to
  the shell — and never a `ui` change, because `FileCategory` is closed.
- Consumers can override any built-in adapter, and apps that never open a PDF never download
  pdf.js.
- A long-standing a11y defect gets a real fix: `ui` finally has a roving-tabindex `Toolbar`
  the four mis-roled toolbars can recompose onto.

**Negative / accepted**

- **Markdown and code are rendered twice in the monorepo.** `viewer` uses `streamdown`/`shiki`
  directly rather than `…-ai`'s `MarkdownView`/`CodeBlock`, which would be a banned sibling
  edge. Extracting them up front would be _worse_: they are streaming-aware chat surfaces, so
  hoisting them makes `streamdown` + `shiki` hard dependencies of `ui` that every consumer
  (including `marketing`) pays for.
  - **Bounded now:** hoist `packages/ai/src/_code-block-theme.ts` (it AA-clamps Shiki tokens
    against the surface — a _token_ concern, not a chat concern) and reuse
    `_streamdown-i18n.ts` rather than mounting a second untranslated streamdown
    (`.claude/rules/ai-chat-components.md` #310 records that `microcopy:check` cannot see
    inside a third-party rendering surface). Both are small file moves, not component
    extractions.
  - **Exit trigger, countable:** when a **third** consumer needs branded markdown/code,
    extract to `ui`. Not "if they drift".
- **`xlsx@0.18.5` is a permanent `npm audit` finding — accepted.** It is the last SheetJS
  community release published to npm and carries two advisories (prototype pollution
  CVE-2023-30533, ReDoS CVE-2024-22363) whose fixed versions were published only to
  SheetJS's own CDN, which this repo's registry policy does not allow. Since `.xlsx` support
  is in scope, the decision is to ship it as an **optional peer** with both advisories
  documented in `docs/CONSUMING.md`, so only a consumer that opts into spreadsheets is
  exposed. The alternative — dropping `.xlsx` to CSV-only — stays available if the security
  posture changes. This is decided here rather than "revisited at P3" so it is not settled by
  whoever is closest to a deadline.
- **§6 does not fix the `ai`-side holes for apps that don't opt in.** The muted `<video>`
  thumbnail and the quoted-comma-blind CSV split remain for any consumer that passes no
  `renderPreview`. The CSV split is a genuine correctness bug independent of this package and
  is filed separately.
- A new package carries the full registration cost (below).

## Registration cost (per `quality-gates.md` "Adding a new package")

Hardcoded lists: `scripts/check-dep-direction.mjs` `ALLOWED` · `check-use-client-source.mjs`
`CLIENT_PACKAGES` · `check-consumer-install.mjs` `mustHave` · `check-eager-heavy-deps.mjs`
`WATCHED_PACKAGES` + `HEAVY_DEPS` · `check-docs-accuracy.mjs` `PROSE_IGNORE` ·
`check-rule-scoping.mjs` `PATH_SCOPED` · `packages/cli/lib/render-docs.mjs` `PKG_ORDER` +
`PKG_PURPOSE`.

Data/docs: `fixtures/consumer-smoke/{package.json,src/index.css,src/main.tsx}` ·
`apps/docs/.storybook/preview.css` `@source` · `apps/docs/.storybook/preview.tsx` `storySort` ·
`CLAUDE.md` (packages list, one-way dep line, D3 row) · `AGENTS.md` D3 row ·
`.claude/rules/design-system.md` · `.claude/rules/architecture-review.md` ·
`.claude/agents/repo-architect-structure-auditor.md` · `.claude/commands/new-component.md` ·
`skills/brand-ui/SKILL.md` + `skills/brand-ui-component/SKILL.md` (**including their
`description` package lists**) · `docs/CONSUMING.md` · `docs/CSP-AND-NETWORK.md` +
`origins:check` for the pdf.js assets · `.claude/rules/viewer-components.md` (path-scoped) ·
`CHANGELOG.md ## Unreleased`. Then `pnpm agent-docs` and `pnpm gen:attributions`.

Ratchet baselines the package immediately enters: `a11y`, `intent-coverage`,
`loading-states`, `data-slot`, `text-scale`, `variant-coverage`, `components-story`. Note
**`intent:check` ratchets coverage** — a new package's root surfaces cannot ship with zero
anti-patterns, so intent content is a build deliverable, not a follow-up.

## Phasing

- **P0 — Foundation.** Registry + `FileViewer` shell + the `ui` file model + image/text/json/
  csv. Proves the architecture end-to-end on cheap formats.
- **P1 — PDF.** The gap nothing in the repo can do today, and the reason the package exists.
  Ships with the new `ui` `Toolbar` primitive (and the `ai` `Toolbar` → `NodeToolbar` rename),
  plus video/audio.
- **P2 — markdown / code.** Deferring these also defers the accepted duplication debt until
  the shell is proven.
- **P3 — Office.** docx, xlsx, pptx.

## Follow-ups to file separately (finders report; this ADR does not fix them)

1. Four modules claim `role="toolbar"` without roving tabindex (§5a) — and recomposing them
   onto the new `ui` `Toolbar` once it exists.
2. Three pre-existing gaps in `packages/ui/src/components/resizable/resizable.tsx`: no default
   `aria-label` on the handle (a focusable `separator` with `aria-valuenow` and no name
   announces as "separator, 50"), no `"use client"`, no `data-slot`/`forwardRef`.
3. `packages/ai/src/asset-preview.tsx:69` — `line.split(",")` mis-parses any quoted comma.
