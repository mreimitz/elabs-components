"use client";

/**
 * ICU cardinal-plural category, per `Intl.PluralRules` ("zero" | "one" | "two"
 * | "few" | "many" | "other"). Locales vary in which categories they use —
 * English has only "one"/"other"; Polish and Russian also use "few"/"many" —
 * so a `PluralMessage` may omit any category it doesn't need. `"other"` is the
 * universal fallback every locale defines.
 */
export type PluralCategory = Intl.LDMLPluralRule;

/**
 * A per-count message: one string per plural category, selected at render
 * time via `Intl.PluralRules(locale).select(count)`. Each string still
 * supports the same `{name}`-style interpolation as a plain message.
 * Note: when passed to `t()`, `count` in `vars` must be a number, not a
 * numeric string, to select the correct plural category.
 */
export type PluralMessage = Partial<Record<PluralCategory, string>>;

/** A single message value: a plain string, or a plural-form map. */
export type MessageValue = string | PluralMessage;

/**
 * Shipped English (en-US) default microcopy bundle.
 *
 * Keys are intentionally terse, semantic, and framework-agnostic so they
 * translate cleanly into any target locale. Keep this list small and real —
 * only add a key here when a component actually needs it.
 */
export const DEFAULT_MESSAGES: Record<string, MessageValue> = {
  // ── Generic (shared across packages — reuse these before minting a new key) ──
  close: "Close",
  copy: "Copy",
  previous: "Previous",
  next: "Next",
  previousSlide: "Previous slide",
  nextSlide: "Next slide",
  noResults: "No results.",
  noRows: "No rows.",
  loading: "Loading…",
  more: "More",
  selectAll: "Select all",
  // Cardinal-plural example (#19) — a shared "N item(s) selected" microcopy
  // any multi-select surface can reuse via `t("itemsSelected", { count })`.
  // Demonstrates the plural-form shape: pick the primitive over inventing a
  // near-duplicate flat string per component.
  itemsSelected: { one: "{count} item selected", other: "{count} items selected" },

  // ── @elabs-ai/components-ui ───────────────────────────────────────────────────────────────
  "ui.metricCard.loading": "Loading metric…",
  // CopyableValue. `hint` is APPENDED to the visible (compact) value, so the
  // accessible name contains what the reader sees — WCAG 2.5.3, Label in Name.
  "ui.copyableValue.hint": "Copy exact value",
  "ui.copyableValue.copied": "Copied",
  // ExpandDialog. Names the context pane beside the enlarged content, so a
  // screen-reader user can tell the two scrollable regions apart.
  "ui.expandDialog.detail": "Details",
  // AttributionPanel. `required` labels a notice a licence obliges us to show —
  // it is the WORD, not a colour, so the distinction survives greyscale (1.4.1).
  "ui.attributionPanel.label": "Third-party attributions",
  "ui.attributionPanel.required": "Required",
  "ui.attributionPanel.empty": "No attributions match this filter.",
  // ModelPicker. `refreshFailed` sits ABOVE a list that still works; `loadFailed`
  // replaces the list. The distinction is load-bearing — see modelPickerBody.
  "ui.modelPicker.label": "Choose a target",
  "ui.modelPicker.searchPlaceholder": "Search…",
  "ui.modelPicker.refreshFailed": "Couldn't refresh the list",
  "ui.modelPicker.loadFailed": "Couldn't load the list",
  "ui.modelPicker.nothingYet": "Nothing to show yet",
  "ui.modelPicker.retry": "Retry",
  // ViewToolbar (#331). `removeFilter` deliberately WRAPS the visible chip text
  // so the accessible name contains it (WCAG 2.5.3 Label in Name).
  "ui.viewToolbar.about": "About this view",
  "ui.viewToolbar.activeFilters": "Active filters",
  "ui.viewToolbar.clearAll": "Clear all",
  "ui.viewToolbar.countOfTotal": "{count} of {total}",
  "ui.viewToolbar.removeFilter": "Remove filter: {label}",
  // Combobox `allowCustomValue` mode (#359) — `{value}` interpolates the
  // currently typed, non-matching search text.
  "ui.combobox.useCustomValue": 'Use "{value}"',
  "ui.combobox.emptyAllowCustom": "No matches. Type to add a custom value.",
  // Form kit (#370–#374).
  "ui.boundedNumber.emptyLabel": "No limit",
  "ui.keyValueEditor.addRow": "Add row",
  "ui.keyValueEditor.keyLabel": "Key {n}",
  "ui.keyValueEditor.valueLabel": "Value {n}",
  "ui.keyValueEditor.removeRow": "Remove row {n}",
  "ui.keyValueEditor.reveal": "Reveal value {n}",
  "ui.keyValueEditor.hide": "Hide value {n}",
  "ui.keyValueEditor.empty": "No entries yet.",
  "ui.listEditor.addItem": "Add item",
  "ui.listEditor.itemLabel": "Item {n}",
  "ui.listEditor.removeItem": "Remove item {n}",
  "ui.listEditor.moveUp": "Move item {n} up",
  "ui.listEditor.moveDown": "Move item {n} down",
  "ui.listEditor.empty": "No items yet.",
  "ui.sliderNumber.reset": "Reset",
  // MentionInput (#368). The listbox lives in a portal with no visible label of
  // its own, so this IS its accessible name. The empty state deliberately
  // reuses the generic `noResults` key rather than minting a near-duplicate.
  "ui.mentionInput.listLabel": "Mention suggestions",
  // ConfirmDialog's fallback action labels. A real confirmation replaces
  // `confirmLabel` with the CONSEQUENCE ("Delete skill"); this generic default
  // exists so the component is never unlabelled.
  "ui.confirmDialog.confirm": "Confirm",
  "ui.confirmDialog.cancel": "Cancel",
  "ui.advancedGroup.title": "Advanced",
  "ui.advancedGroup.changed": "{count} changed",

  // ── @elabs-ai/components-data ─────────────────────────────────────────────────────────────
  // The scroll region's accessible name is rendered ONLY when the table actually
  // overflows its container, so it is never announced for a table that fits.
  "data.table.scrollRegion": "Table contents, scrollable",
  // Fallback name for a row's activation control when the row's first cell holds
  // no primitive value to name it after (see `rowActionLabel`).
  "data.table.rowAction": "Activate row",
  // createSelectionColumn (#11) — the header select-all checkbox and each row's
  // own checkbox. Kept table-scoped (not the generic `selectAll` key) so a
  // translator can phrase "rows" distinctly from other bulk-select surfaces.
  "data.table.selectAllRows": "Select all rows",
  // `selectRowNamed` names each row's checkbox from its own first data column
  // (#11 I4) so screen-reader users hear "Select Alpha", not `selectRow`'s
  // identical generic label repeated on every row; `selectRow` stays the
  // fallback when no data column value is derivable.
  "data.table.selectRowNamed": "Select {name}",
  "data.table.selectRow": "Select row",

  // ── @elabs-ai/components-charts ───────────────────────────────────────────────────────────
  // Shared caption for any bare chart surface's layout-shaped skeleton
  // (ChartFrame, ChartCard, AutoChart all show the same "a chart is loading"
  // concept — one key, reused, rather than three near-duplicate strings).
  "charts.chart.loading": "Loading chart…",
  "charts.metricGrid.loading": "Loading metrics…",
  // Chart drill-down (#349). The chart SVG is aria-hidden, so these names are
  // the ONLY thing AT reads for an interactive datapoint — there is no
  // consumer-side workaround if they stay English.
  "charts.datapointLayer.label": "Chart data points",
  "charts.datapoint.label": "{series}, {category}: {value}",
  "charts.datapoint.labelNoSeries": "{category}: {value}",
  // Announced when `copyValueOnActivate` puts a datapoint's exact value on the
  // clipboard — the recovery path for a compact axis label.
  "charts.datapoint.copied": "Exact value copied",

  // ── @elabs-ai/components-ai ───────────────────────────────────────────────────────────────
  // Namespaced `ai.<area>.<key>` so package microcopy can't collide with the
  // generic keys above, or with a future package's. See ADR 0017.
  //
  // The three attachment errors are the only @elabs-ai/components-ai strings a user reads as a
  // SYSTEM MESSAGE rather than a control label — they are the reason this bundle
  // grew beyond the generic set.
  "ai.promptInput.errorAccept": "No files match the accepted types.",
  "ai.promptInput.errorMaxFileSize": "All files exceed the maximum size.",
  "ai.promptInput.errorMaxFiles": "Too many files. Some were not added.",
  "ai.promptInput.placeholder": "What would you like to know?",
  "ai.promptInput.uploadFiles": "Upload files",
  "ai.promptInput.submit": "Submit",
  "ai.promptInput.stop": "Stop",
  "ai.codeBlock.generating": "Generating…",
  "ai.composer.placeholder": "Ask me anything…",
  "ai.context.usage": "Model context usage",
  "ai.contextPanel.back": "Back to context",
  "ai.contextPanel.toggle": "Toggle context panel",
  "ai.environmentVariables.toggleVisibility": "Toggle value visibility",
  "ai.gallery.label": "Image gallery",
  "ai.gallery.expandImage": "Expand image",
  "ai.gallery.downloadImage": "Download image",
  "ai.message.actions": "Message actions",
  "ai.message.editMessage": "Edit message",
  "ai.message.feedback": "Message feedback",
  "ai.message.previousBranch": "Previous branch",
  "ai.message.nextBranch": "Next branch",
  "ai.persona.idle": "Assistant idle",
  "ai.persona.listening": "Assistant listening",
  "ai.persona.thinking": "Assistant thinking…",
  "ai.persona.speaking": "Assistant speaking",
  "ai.persona.asleep": "Assistant asleep",
  "ai.selectionToolbar.label": "Selection actions",
  "ai.webPreview.urlPlaceholder": "Enter URL...",
  "ai.micSelector.searchPlaceholder": "Search microphones...",
  "ai.messageForm.selectPlaceholder": "Select…",
  "ai.messageForm.label": "Form",
  "ai.messageTable.label": "Data table",
  "ai.voiceSelector.playPreview": "Play preview",
  "ai.voiceSelector.pausePreview": "Pause preview",

  // ── Streamdown chrome (third-party rendering surface) ──────────────────────
  // `streamdown` renders its OWN controls inside every streamed-markdown block
  // (code header, table menus, Mermaid toolbar, external-link interstitial) and
  // exposes them through a `translations` prop. Those strings live in the
  // dependency, not in our source, so `pnpm microcopy:check` structurally cannot
  // see them — without this block a `<LocaleProvider>` stops at the boundary and
  // the chrome stays English (#310).
  //
  // Values are BYTE-IDENTICAL to streamdown@2.5.0's `defaultTranslations`, so
  // wiring them through `t()` is a no-op for anyone who overrides nothing
  // (ADR 0017's defaults-unchanged property). Keep them that way on upgrade.
  //
  // Deliberately NOT aliased onto the generic `close` / `ai.gallery.downloadImage`
  // keys: a locale may want different wording inside markdown chrome than in the
  // surrounding app, and a translator needs the Streamdown surface addressable as
  // one block.
  "ai.streamdown.copyCode": "Copy Code",
  "ai.streamdown.downloadFile": "Download file",
  "ai.streamdown.downloadDiagram": "Download diagram",
  "ai.streamdown.downloadDiagramAsSvg": "Download diagram as SVG",
  "ai.streamdown.downloadDiagramAsPng": "Download diagram as PNG",
  "ai.streamdown.downloadDiagramAsMmd": "Download diagram as MMD",
  "ai.streamdown.viewFullscreen": "View fullscreen",
  "ai.streamdown.exitFullscreen": "Exit fullscreen",
  "ai.streamdown.mermaidFormatSvg": "SVG",
  "ai.streamdown.mermaidFormatPng": "PNG",
  "ai.streamdown.mermaidFormatMmd": "MMD",
  "ai.streamdown.copyTable": "Copy table",
  "ai.streamdown.copyTableAsMarkdown": "Copy table as Markdown",
  "ai.streamdown.copyTableAsCsv": "Copy table as CSV",
  "ai.streamdown.copyTableAsTsv": "Copy table as TSV",
  "ai.streamdown.downloadTable": "Download table",
  "ai.streamdown.downloadTableAsCsv": "Download table as CSV",
  "ai.streamdown.downloadTableAsMarkdown": "Download table as Markdown",
  "ai.streamdown.tableFormatMarkdown": "Markdown",
  "ai.streamdown.tableFormatCsv": "CSV",
  "ai.streamdown.tableFormatTsv": "TSV",
  "ai.streamdown.imageNotAvailable": "Image not available",
  "ai.streamdown.downloadImage": "Download image",
  "ai.streamdown.openExternalLink": "Open external link?",
  // Straight apostrophe on purpose — must stay byte-identical to streamdown's
  // default, so the micro-typography curly-quote preference does not apply here.
  "ai.streamdown.externalLinkWarning": "You're about to visit an external website.",
  "ai.streamdown.close": "Close",
  "ai.streamdown.copyLink": "Copy link",
  "ai.streamdown.copied": "Copied",
  "ai.streamdown.openLink": "Open link",

  // ── @elabs-ai/components-viewer (ADR 0024) ─────────────────────────
  // FileViewer chrome. Every control here is icon-only, so these ARE the
  // accessible names — a non-English screen-reader user has no workaround.
  "viewer.label": "File viewer",
  // The scrolling content region's accessible name. It is a focusable tab stop
  // (WCAG 2.1.1: a pane that scrolls but holds nothing focusable is unreachable
  // from a keyboard), so it needs a name as well as a role.
  "viewer.content": "File content",
  "viewer.download": "Download {name}",
  "viewer.raw": "Show source",
  "viewer.rendered": "Show rendered",
  // States. `loading` announces the region once (role="status"); the skeleton
  // itself is aria-hidden, so this is the only thing AT hears.
  "viewer.loading": "Loading {name}…",
  "viewer.empty": "No file selected",
  "viewer.emptyBody": "Choose a file to preview it here.",
  // Failures. Each maps to one ViewerErrorCode, so the code is the contract and
  // the wording can change per locale without touching component logic.
  "viewer.error.unsupportedFormat": "Can't preview this file type",
  "viewer.error.unsupportedFormatBody":
    "{name} can be downloaded, but there's no preview for it here.",
  "viewer.error.parserMissing": "Preview unavailable",
  "viewer.error.parserMissingBody": "Previewing {name} needs {packages} to be installed.",
  "viewer.error.readFailed": "Couldn't open this file",
  "viewer.error.readFailedBody":
    "{name} couldn't be read. It may have moved, or you may not have access.",
  "viewer.error.parseFailed": "Couldn't read this file",
  "viewer.error.parseFailedBody": "{name} isn't a valid {format} file, or it's damaged.",
  "viewer.error.imageFailedTitle": "Couldn't show this image",
  "viewer.error.imageFailed": "{name} could not be displayed.",
  "viewer.retry": "Try again",
  // Table view (CSV/TSV). The count is a summary for the whole grid.
  "viewer.table.caption": "{rows} rows, {columns} columns",
  "viewer.table.truncated": "Showing the first {count} rows.",
  "viewer.table.emptyCell": "Empty",
  // Text and JSON views.
  "viewer.text.truncated": "Showing the first {shown} of {total} characters.",
  "viewer.json.tree": "JSON structure",
  // Page, scale and rotation chrome (ADR 0026). Format-agnostic: one pager
  // serves PDF pages and PowerPoint slides, so the words are about "pages" and
  // the slide-specific wording lives on the slide itself.
  "viewer.pager.controls": "Pages",
  "viewer.pager.previous": "Previous page",
  "viewer.pager.next": "Next page",
  // The field's own accessible name. The visible "of {total}" beside it is not
  // a label — a screen reader would read the two as one run without this.
  "viewer.pager.pageNumber": "Page number",
  "viewer.pager.of": "of {total}",
  // Live region: a repainted canvas and a changed input value both announce
  // nothing, so this sentence is the only confirmation a page turned.
  "viewer.pager.status": "Page {page} of {total}",
  "viewer.zoom.controls": "Zoom",
  "viewer.zoom.in": "Zoom in",
  "viewer.zoom.out": "Zoom out",
  "viewer.zoom.level": "Zoom level",
  "viewer.zoom.fitWidth": "Fit width",
  "viewer.zoom.fitPage": "Fit page",
  "viewer.zoom.status": "Zoom {level}",
  "viewer.rotate": "Rotate clockwise",
  // PDF view.
  "viewer.pdf.page": "Page {page}",
  "viewer.pdf.pages": "Document pages",
  "viewer.pdf.pageFailed": "Page {page} couldn't be drawn.",
  // Media view (video / audio).
  "viewer.media.label": "{name} player",
  "viewer.media.unsupportedTitle": "Can't play this file",
  "viewer.media.unsupported": "This browser can't play {name}.",
  // Office views. A preview shows a document's STRUCTURE, not Word's or
  // PowerPoint's page layout — the copy never promises a faithful reproduction.
  "viewer.docx.empty": "This document has no text",
  "viewer.sheet.tabs": "Sheets",
  "viewer.pptx.slide": "Slide {slide}",
  "viewer.pptx.untitled": "Untitled slide",
  "viewer.pptx.notes": "Speaker notes",
  "viewer.pptx.empty": "This slide has no text",
  // Code and markdown views. `file.empty` is shared: "the file opened and there
  // is nothing in it" is one message whatever the format.
  "viewer.file.empty": "This file is empty",
  // Find-in-document (ADR 0025). The count is a live region read on every step,
  // so it stays short; `findNone` replaces it rather than sitting beside it, so
  // a fruitless search never reads as "0 of 0".
  "viewer.find.open": "Find in document",
  "viewer.find.label": "Find in document",
  "viewer.find.placeholder": "Find…",
  "viewer.find.close": "Close find",
  "viewer.find.previous": "Previous match",
  "viewer.find.next": "Next match",
  "viewer.find.caseSensitive": "Match case",
  "viewer.find.count": "{index} of {total}",
  "viewer.find.none": "No matches",
  "viewer.find.capped": "Showing the first {limit} matches of {total}.",
  // Citations / passages the app points the viewer at. A miss is a STATE, not a
  // silent no-op — the reader is told the passage could not be located, and
  // "past the part we previewed" is different news from "not in this document".
  "viewer.highlight.notFound": "Couldn't find that passage in this document.",
  "viewer.highlight.notFoundTruncated":
    "That passage may be beyond the part of this document we could preview.",
  "viewer.highlight.unsupported": "This build can't point at part of a {format} file.",
  "viewer.highlight.previous": "Previous passage",
  "viewer.highlight.next": "Next passage",
  "viewer.highlight.count": "Passage {index} of {total}",
};
