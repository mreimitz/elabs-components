---
# Path-scoped (Claude Code lazy-loads this only when a matching file is touched) — not
# always-on context. See `.claude/rules/quality-gates.md` "Enforcement over reminders" and
# the `rules:scoping:check` gate (scripts/check-rule-scoping.mjs).
paths:
  - "packages/viewer/**"
---

# File viewer components (@elabs-ai/components-viewer)

## Shell (ADR 0026)

- `FileViewer` = `FileViewerProvider` + `Frame`/`Toolbar`/`Content`/`Skeleton`/`Error`/`Empty` parts; no `showToolbar` boolean. `useFileViewer()` -> `{ state, actions, registry }`, also outside the frame.
- `FileViewerToolbar` renders `null` with no source; compose a permanent header around `FileViewerFrame`.
- Provider owns `pageNumber`/`pageCount`/`zoom`/`effectiveZoom`/`rotation` + actions; `pageNumber`/`zoom`/`rotation` = controlled/uncontrolled trios.
- Adapters take them as props and report back, never own `useState`; standalone `Renderer`: `usePageControl(pageNumber, onPageChange, pageCount)`.
- `ZoomLevel` = `number | "fit-width" | "fit-page"`; renderer resolves fit via `onZoomResolved`; control shows the request, live region the result; step from `effectiveZoom`, never `zoom`.
- Paginated = one virtualized column (`usePagedScroll`) scrolled by `FileViewerContent`; no flipbook, no second virtualizer; estimates = `AdapterDocument.pageSizes` x scale; `pageSizes` may be shorter than `pageCount` (page-1 fallback, never re-measure).
- `FileViewerPager`/`Zoom`/`Rotate` render `null` unless the manifest claims `pages`/`zoom`/`rotate`; claimed = implemented AND tested. No `role="toolbar"`; one `sr-only role="status"` per group.
- Zoom ladder: `VIEWER_ZOOM_STEPS`/`stepZoom`/`canStepZoom`/`isZoomFit` (`core/zoom.ts`), never per-adapter.

## Adapters (ADR 0024)

- A format = a registered adapter (manifest `{ id, protocol: PROTOCOL_VERSION, extensions, requires }` + lazy `() => import(...)`), never a `FileViewerContent` edit.
- Manifest eager, data-only, own `<kind>-manifest.ts`; loader lazy; `createDefaultRegistry()` pulls no renderer/engine into the entry chunk (`pnpm heavy-deps:check`).
- Detection: extension (4) > exact MIME (3) > MIME prefix (2) > category (1); higher `priority` beats all = the only override. No fallback chain: missing engine -> `parser-missing` naming it.
- `protocol` mismatch rejects at registration; bump `PROTOCOL_VERSION` only for a breaking `FileAdapter`/`AdapterModule` change (an optional field is not). `create()` per load; `dispose()` releases state + object URLs.
- `load()` returns a model (DATA, never HTML); `Renderer` draws it with `@elabs-ai/components-ui`; no HTML string/`innerHTML`/inline colour. Content as authored, chrome tokened.
- Parser HTML: `DOMParser` walk -> model, markup dropped, unnamed tags = text only (`docx-model.ts`); never sanitize-and-inject or `dangerouslySetInnerHTML`; an `ALLOWED_TAGS`/`ALLOWED_ATTR` sanitizer only if unmodellable, architect first.
- Hrefs: `http:`/`https:`/`mailto:`/`tel:` only, else plain text (`safeHref`). Signature check before a forgiving parser (`looksLikeWorkbook`).
- `markdown`: `.md` + `text/markdown` as a document (Streamdown -> `Prose*`), never `.mdx`. `code`: ~60 source extensions, never the `code` category, no `json`/`csv`/`md`/`svg`. `text`: registered LAST, broad categories only.
- `code-theme.ts`: Shiki `ThemeRegistrationRaw`, every colour `var(--code-*)`; never port `-ai`'s `_code-block-theme.ts`.
- Parser engines: optional peers (`peerDependenciesMeta.optional`) + devDependencies, never a plain `dependency` (`pnpm consumer:check`).

## Scroll & highlights (ADR 0025)

- `FileViewerContent` owns the viewport; a flowing adapter = a plain block, no second `overflow-auto`, no own padding. Own viewport only under a fixed sub-control; a fixed-ratio frame may scroll.
- Scroller = focusable named region: `tabIndex={0}` + `role` + `aria-label` + `focus-ring`; `role="region"` pane, `role="group"` inside, one landmark per viewer.
- `AdapterRendererProps.baseHeadingLevel` (default `2`): `clampHeadingLevel(own + base - 1)`, never past `h6`.
- `DocumentAddress` (`quote`/`range`/`rect`) in `packages/ui/src/lib/document-address.ts`. LOCATE (`quote` -> offsets) in the provider; MAP + PAINT in the renderer; `rect` skips LOCATE+MAP, `range` skips LOCATE. Handle only `capabilities.highlight` kinds, no exhaustive `switch`/`never`.
- `createTextIndexBuilder` builds the projection (`text` is its OUTPUT), never by hand; REF = row (cell via `chunkOffset`), MARK = character; a multi-level join = ONE index (per-push separator).
- Honest granularity, not the finest (markdown plates the whole block: its `text` is SOURCE). Navigate to the cited page/sheet/slide (keyed on it) before scrolling the mark into view.
- Real `<mark>`s (`MatchHighlight`), never the CSS Custom Highlight API; scroll with `useScrollActiveHighlightIntoView`, not a ref. External adapters: the barrel's `toMarkRanges`/`localizeRanges`/`chunkOffset`/`ACTIVE_HIGHLIGHT_SELECTOR`, never re-derive merge<->`activeIndex`; `MarkedText` stays internal.
- Active passage: outline + `aria-current="true"` + count announcement, never colour-only. States `pending`/`resolved`/`not-found`/`unsupported` (`role="status"`); `unsupported` -> neutral panel.
- `pnpm viewer-highlight:check` gates declared kinds, `quote` => `capabilities.text`, `highlights` read, painted-mark tests.

## States & boundary

- `loading-states.md`: `loading` only (no `isStreaming`), layout-shaped skeleton; a parent's `loading` is additive, never clears an error.
- `ViewerErrorCode`: `unsupported-format`/`parser-missing`/`read-failed`/`parse-failed`/`protocol-mismatch`/`aborted` (never surfaced); retry only on `read-failed`/`parse-failed`.
- `parser-missing` names the package; caught in registry (failed `loader()`) AND provider (`isModuleNotFound` vs `requires`, before `parse-failed`) via `parserMissingError(id, requires)`, never inline.
- Gap != failure: `unsupported-format`/`parser-missing` -> `StatePanel kind="empty"`, `EyeOff`, `role="status"`, copy naming what the reader CAN do; `read-failed`/`parse-failed` -> destructive panel, `role="alert"`, retry. Test: did something go wrong, or did we never ship this?
- Layer-2 leaf: no sibling imports either way; siblings take viewer formats by injection (`AssetPreview` `renderPreview`, ADR 0024 §6). `FileSource`/`normalizeFileSource`/`resolveFileKind`/`fileIconFor`/`FileCategory` in `packages/ui/src/lib/`.

History and measurements: docs/rules-history/viewer-components.md
