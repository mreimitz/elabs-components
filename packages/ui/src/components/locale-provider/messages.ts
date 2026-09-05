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
  // KeyboardShortcuts (#113). `emptyFiltered` keeps the user's own query in the
  // sentence so the empty state says WHY it is empty, not merely that it is.
  "ui.keyboardShortcuts.searchPlaceholder": "Search shortcuts…",
  "ui.keyboardShortcuts.emptyTitle": "No shortcuts found",
  "ui.keyboardShortcuts.emptyFiltered": "No shortcuts match “{query}”.",
  "ui.keyboardShortcuts.empty": "No shortcuts to show.",
  // WorkspacePicker (#111). It composes ModelPicker, so it carries its OWN
  // label/search strings rather than inheriting the generic "Choose a target".
  // `current` is appended into the row's meta so the in-force workspace reaches
  // the option's accessible name as a WORD, not only a check glyph (1.4.1).
  "ui.workspacePicker.label": "Choose a workspace",
  "ui.workspacePicker.placeholder": "No workspace selected",
  "ui.workspacePicker.recent": "Recent workspaces",
  "ui.workspacePicker.searchPlaceholder": "Search workspaces…",
  "ui.workspacePicker.current": "Current",
  "ui.workspacePicker.pathLabel": "Workspace path",
  "ui.workspacePicker.pathPlaceholder": "/path/to/project…",
  "ui.workspacePicker.openPath": "Open",
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
  // SchemaForm — the spec-driven config-form renderer (issue #22).
  "ui.schemaForm.selectPlaceholder": "Select…",
  "ui.schemaForm.label": "Form",
  "ui.schemaForm.submit": "Submit",
  "ui.schemaForm.submitting": "Submitting…",
  "ui.schemaForm.submitted": "Submitted",
  // SchemaFormTestAction — a form/group-level "Test connection" affordance
  // (issue #22 maintainer ruling, 2026-09-01), independent of field validity
  // and never gating submit.
  "ui.schemaForm.testAction.label": "Test connection",
  "ui.schemaForm.testAction.pending": "Testing…",
  "ui.schemaForm.testAction.success": "Connected",
  "ui.schemaForm.testAction.failure": "Test failed",
  // Pagination's ellipsis (sr-only — the visible glyph is decorative).
  "ui.pagination.morePages": "More pages",
  // Pagination's prev/next links — the ACCESSIBLE NAME (`aria-label`), distinct
  // from the visible `previous`/`next` text below it: an `aria-label` overrides
  // visible text content as the accessible name, so leaving these hardcoded in
  // English meant a non-English `LocaleProvider` translated the visible label
  // but a screen-reader user still heard English (#12/#53 review, P2).
  "ui.pagination.previous": "Go to previous page",
  "ui.pagination.next": "Go to next page",
  // Sidebar's mobile Sheet title (sr-only header — the sheet itself has no
  // visible chrome, so this is only ever read by assistive tech).
  "ui.sidebar.title": "Sidebar",
  // Tree's error row — shared by the virtualized and non-virtualized branches.
  "ui.tree.failedToLoad": "Failed to load",
  // ThemeSwitcher's "follow the OS" option, in both dropdown and toggle modes.
  "ui.themeSwitcher.system": "System",
  "ui.navNotifications.label": "Notifications",
  "ui.teamSwitcher.label": "Teams",
  "ui.teamSwitcher.addTeam": "Add team",

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
  // Column resizing (#12) — the accessible name for the WAI-ARIA
  // separator-as-slider resize handle at the end of a resizable header cell.
  "data.table.resizeColumn": "Resize column, {name}",
  // #51 — the handle's accessible VALUE, paired with aria-valuenow (which
  // stays a plain number for AT/TanStack). A bare number reads as a
  // dimensionless ordinal; the unit makes it a size. A `PluralMessage` (PR
  // #81 review, "Format the announced resize value for the active locale") —
  // the call site passes both `count` (the raw number, so a locale whose
  // plural rules select something other than "other" for a given size is
  // reachable) and `size` (pre-formatted via `formatNumber`, so a locale
  // override renders locale-appropriate digits/grouping instead of a raw
  // Latin-digit JS number).
  "data.table.resizeColumnValue": { one: "{size} pixel", other: "{size} pixels" },
  // Row drag-reorder (#13). `reorderHandle`/`reorderColumnHeader` name the
  // grip control and its column; the four `reorder*` announcement keys back
  // the aria-live region dnd-kit's `accessibility.announcements` renders on
  // pickup/move/drop/cancel (WCAG 4.1.3) — `position`/`total` are 1-based so
  // the announcement reads like "3 of 8", not a 0-based index.
  "data.table.reorderColumnHeader": "Reorder",
  "data.table.reorderHandle": "Reorder {name}",
  "data.table.reorderPickedUp": "Picked up {name}.",
  "data.table.reorderMoved": "{name} moved to position {position} of {total}.",
  "data.table.reorderDropped": "{name} dropped at position {position} of {total}.",
  "data.table.reorderCancelled":
    "Reordering cancelled. {name} returned to position {position} of {total}.",
  // #98: `@dnd-kit` renders two more AT-visible strings for this same
  // feature that this repo's source never writes — the hidden keyboard
  // usage instructions (wired to the grip via `aria-describedby`) and the
  // activator's `aria-roledescription`. Both ship a hardcoded English
  // default deep inside the library; localizing them means overriding them
  // explicitly with these two keys. The English DEFAULT below is dnd-kit's
  // own default text verbatim (`defaultScreenReaderInstructions.draggable`
  // in `@dnd-kit/core`, and `useSortable`'s `roleDescription: 'sortable'` in
  // `@dnd-kit/sortable`) — not a rewrite — so an English consumer with no
  // `LocaleProvider` override sees byte-identical output to before this
  // fix; only a `messages` override changes it.
  "data.table.reorderInstructions":
    "\n    To pick up a draggable item, press the space bar.\n    While dragging, use the arrow keys to move the item.\n    Press space again to drop the item in its new position, or press escape to cancel.\n  ",
  "data.table.reorderRoleDescription": "sortable",
  "data.facetFilter.clearFilters": "Clear filters",
  "data.columnPicker.toggleColumns": "Toggle columns",

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
  // ChartFrame's SVG/PNG export actions (RM-025). Each string is used twice —
  // as the icon button's `aria-label` (its ONLY accessible name) and as the
  // tooltip a sighted user reads — so one key serves both and they cannot
  // drift apart in translation.
  "charts.chartFrame.exportSvg": "Export as SVG",
  "charts.chartFrame.exportPng": "Export as PNG",

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
  "ai.agent.instructions": "Instructions",
  "ai.agent.tools": "Tools",
  "ai.codeBlock.generating": "Generating…",
  "ai.composer.placeholder": "Ask me anything…",
  "ai.context.usage": "Model context usage",
  "ai.context.totalCost": "Total cost",
  "ai.context.input": "Input",
  "ai.context.output": "Output",
  "ai.context.reasoning": "Reasoning",
  "ai.context.cache": "Cache",
  "ai.contextPanel.back": "Back to context",
  "ai.contextPanel.toggle": "Toggle context panel",
  // The mobile Sheet's sr-only title (#18) — distinct from `contextPanel.toggle`,
  // which labels the button that opens/closes it.
  "ai.contextPanel.title": "Context panel",
  "ai.environmentVariables.toggleVisibility": "Toggle value visibility",
  "ai.gallery.label": "Image gallery",
  "ai.gallery.expandImage": "Expand image",
  "ai.gallery.downloadImage": "Download image",
  "ai.gallery.noImages": "No images",
  "ai.gallery.noDetails": "No details",
  // Shared by Tool's technical view and SchemaDisplay's request panel.
  "ai.schemaDisplay.parameters": "Parameters",
  "ai.schemaDisplay.response": "Response",
  // ReasoningTrigger's default not-yet-timed message (before `duration` is known).
  "ai.reasoning.thoughtDefault": "Thought for a few seconds",
  "ai.stackTrace.empty": "No stack frames",
  "ai.webPreview.noConsoleOutput": "No console output",
  // PlanTrigger's icon-only collapse/expand control (sr-only).
  "ai.plan.togglePlan": "Toggle plan",
  "ai.message.actions": "Message actions",
  "ai.message.editMessage": "Edit message",
  "ai.message.feedback": "Message feedback",
  "ai.message.previousBranch": "Previous branch",
  "ai.message.nextBranch": "Next branch",
  "ai.messageCompare.error": "Error",
  "ai.messageCompare.tabs": "Compare responses",
  "ai.persona.idle": "Assistant idle",
  "ai.persona.listening": "Assistant listening",
  "ai.persona.thinking": "Assistant thinking…",
  "ai.persona.speaking": "Assistant speaking",
  "ai.persona.asleep": "Assistant asleep",
  // Optional-peer lazy engines (issue #33) — one shared pair every lazy
  // boundary's missing-dependency panel resolves through, plus one
  // `feature`-name key per boundary that renders it (mermaid, the terminal).
  "ai.error.engineMissing": "{feature} unavailable",
  "ai.error.engineMissingBody": "{feature} needs {packages} to be installed.",
  "ai.error.retry": "Try again",
  "ai.mermaid.feature": "Mermaid diagrams",
  "ai.mermaid.renderError": "Diagram couldn't be drawn",
  "ai.terminal.feature": "Interactive terminal",
  "ai.terminal.renderError": "Terminal couldn't start",
  "ai.audioPlayer.feature": "Audio player",
  "ai.audioPlayer.renderError": "Audio player couldn't load",
  // AudioVisualizer. Announced through a throttled `role="status"` region —
  // the canvas itself is decorative (see .claude/rules/loading-states.md and
  // issue #21's accessibility guidance).
  "ai.audioVisualizer.idle": "Microphone not connected",
  "ai.audioVisualizer.silent": "No input detected",
  "ai.audioVisualizer.active": "Microphone active",
  "ai.selectionToolbar.label": "Selection actions",
  "ai.webPreview.urlPlaceholder": "Enter URL...",
  "ai.micSelector.searchPlaceholder": "Search microphones...",
  "ai.messageForm.selectPlaceholder": "Select…",
  "ai.messageForm.label": "Form",
  "ai.messageTable.label": "Data table",
  "ai.voiceSelector.playPreview": "Play preview",
  "ai.voiceSelector.pausePreview": "Pause preview",

  // TurnStatus / SessionStatusBar (#105). `label` itself is caller-supplied
  // ("Working…", "Editing files…") and rendered verbatim, so it needs no key
  // here — only the component-owned completed-turn sentence and controls do.
  "ai.turnStatus.completedIn": "Turn completed in {elapsed}",
  "ai.turnStatus.completed": "Turn completed",
  "ai.turnStatus.scrollToBottom": "Scroll to bottom",
  "ai.sessionStatusBar.connections": "{connected} of {total} connections",
  "ai.sessionStatusBar.connecting": "Connecting…",
  // SessionHeader (#110). The section headings and the quick-action group name
  // are component-owned chrome; the capability/what's-new item text itself is
  // caller-supplied and rendered verbatim.
  "ai.sessionHeader.capabilities": "Capabilities",
  "ai.sessionHeader.whatsNew": "What’s new",
  "ai.sessionHeader.quickActions": "Quick actions",
  // PermissionModeSelect (#104). The in-force marker is a WORD inside the mode
  // label, so the current mode survives greyscale and reaches the accessible name.
  "ai.permissionModeSelect.current": "Current",
  // AgentEvent (#109). The pass/fail WORD is the non-colour channel — the tone
  // is redundant with it, so a check outcome survives greyscale (WCAG 1.4.1).
  "ai.agentEvent.checkPassed": "Passed",
  "ai.agentEvent.checkFailed": "Failed",
  "ai.agentEvent.checksSummary": "{passed}/{ran} checks passed",
  "ai.agentEvent.phaseBefore": "Before",
  "ai.agentEvent.phaseAfter": "After",
  "ai.agentEvent.phaseLifecycle": "Lifecycle",
  // DiffView (#102). `addedLine` / `removedLine` are the sr-only polarity
  // prefixes — the +/− glyph is aria-hidden, so these WORDS are the channel a
  // greyscale or screen-reader user recovers the polarity from (WCAG 1.4.1).
  // They intentionally end in a space so they read as a prefix to the code line.
  "ai.diffView.addedLine": "Added: ",
  "ai.diffView.removedLine": "Removed: ",
  "ai.diffView.statsSummary": "{additions} additions, {deletions} deletions",
  "ai.diffView.showMore": { one: "Show {count} more line", other: "Show {count} more lines" },
  "ai.diffView.pagerLegend": "Arrow keys scroll, Page Up/Down page, Home/End jump",
  "ai.diffView.regionLabel": "Code diff",
  "ai.diffView.loading": "Loading diff…",
  // ApprovalCard (#103). The SCOPE sentence is what makes an N-option
  // permission prompt safe to answer: "Yes" and "Yes, and don't ask again" look
  // alike and mean very different things. Each option links its scope sentence
  // through aria-describedby, so the blast radius of a choice reaches assistive
  // tech as words — never as a colour or a data-* attribute.
  "ai.approvalCard.scopeOnceDescription": "Applies to this action only.",
  "ai.approvalCard.scopeSessionDescription":
    "Applies to actions like this for the rest of this session.",
  "ai.approvalCard.scopeAlwaysDescription": "Applies to actions like this from now on.",
  "ai.approvalCard.scopeDenyDescription": "Rejects this action.",
  "ai.approvalCard.reasonLabel": "Reason",
  "ai.approvalCard.reasonPlaceholder": "Add a reason (optional)…",
  // PromptInputSlash (#106). `listLabel` goes to cmdk's own `label` prop, not
  // `aria-label` — cmdk overwrites a consumer `aria-label` on CommandList and
  // reads its accessible name off `label` instead.
  "ai.promptInputSlash.listLabel": "Commands",
  "ai.promptInputSlash.empty": "No matching commands.",

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

  // ── @elabs-ai/components-terminal ─────────────────────────────────────────
  // Terminal (the read-only ANSI log): the ONE live-region announcement for
  // its `isStreaming` rung. The blinking cursor block is the only other
  // streaming signal and it is purely visual, so without this a screen-reader
  // user attached to a running build or deploy log gets no indication that
  // anything is still arriving.
  "terminal.output.streaming": "Streaming output…",
  // TerminalTranscriptRow (#117 T2): the gutter's meaning as words, so the
  // "who spoke / what it printed / did it fail" grammar survives greyscale
  // and reaches assistive tech, not only the glyph + colour.
  "terminal.transcriptRow.user": "Prompt",
  "terminal.transcriptRow.agent": "Agent",
  "terminal.transcriptRow.output": "Output",
  "terminal.transcriptRow.error": "Error",
  "terminal.transcriptRow.exitCode": "Exit {code}",
  // TerminalTodoList (#117 T5): the three-state checklist's announced word
  // per row — the second, non-colour channel beside the ✔ / ◼ / ◻ glyph and
  // the strikethrough/bold treatment. Wording verified 2026-09-01 against
  // Claude Code v2.1.207's own upstream state words, parentheses included.
  "terminal.todoList.done": "(completed)",
  "terminal.todoList.active": "(in progress)",
  "terminal.todoList.pending": "(pending)",
  // TerminalEventLine (#117 T6): the lifecycle/hook event line. `outcome*` is
  // the sr-only word beside the (always aria-hidden) StatusIcon glyph —
  // never omitted for the default "ok" case, so "succeeded" is exactly as
  // recoverable as "failed". `hooksTotal`/`hooksResult` are the terminal's
  // own literal `[hooks: …]` bracket vocabulary, verified live 2026-09-01
  // against Grok CLI v0.2.93; `hooksFailed` is the sr-only, count-aware
  // "N hooks failed" that makes a partial hook failure (e.g. `3/1`) read as
  // bad without relying on colour.
  "terminal.eventLine.outcomeOk": "Succeeded",
  "terminal.eventLine.outcomeBlocked": "Blocked",
  "terminal.eventLine.outcomeFailed": "Failed",
  "terminal.eventLine.phaseBefore": "Before",
  "terminal.eventLine.phaseAfter": "After",
  "terminal.eventLine.phaseLifecycle": "Lifecycle",
  "terminal.eventLine.hooksTotal": "[hooks: {total}]",
  "terminal.eventLine.hooksResult": "[hooks: {ran}/{passed}]",
  "terminal.eventLine.hooksFailed": {
    one: "{count} hook failed",
    other: "{count} hooks failed",
  },
  // TerminalWorking (#117 T3): the in-turn footer's default label and its two
  // icon-only controls' accessible names. No generic "stop"/"scroll to
  // bottom" key exists yet (only the ai-namespaced `ai.promptInput.stop` /
  // `ai.turnStatus.scrollToBottom`), so these are minted under the package's
  // own namespace rather than borrowed cross-package.
  "terminal.working.label": "Waiting for response…",
  "terminal.working.stop": "Stop",
  "terminal.working.scrollToBottom": "Scroll to bottom",
  // TerminalStatusBar (#117 T4): the ambient chrome row's accessible name and
  // the sr-only words beside its aria-hidden numerals/glyphs. Mirrors
  // `ai.sessionStatusBar.connections`' wording under this package's own
  // namespace (cannot import the `ai` key — sibling packages never import
  // each other, `.claude/rules/terminal-components.md` § Reuse means
  // promotion). `disconnected` and `stepsComplete` ("steps complete") are
  // verified live 2026-09-01 against Grok CLI v0.2.93.
  "terminal.statusBar.label": "Session status",
  "terminal.statusBar.connecting": "Connecting…",
  "terminal.statusBar.connections": "{connected} of {total} connections",
  "terminal.statusBar.disconnected": "Disconnected",
  "terminal.statusBar.context": "{used} of {limit} context used",
  "terminal.statusBar.stepsComplete": "{current} of {total} steps complete",
  // TerminalBanner (#117 T7): the launch card above an empty transcript.
  // Mirrors `ai.sessionHeader.*`'s wording under this package's own
  // namespace — sibling packages never import each other's locale keys
  // (`.claude/rules/terminal-components.md` § Reuse means promotion).
  "terminal.banner.capabilities": "Capabilities",
  "terminal.banner.whatsNew": "What’s new",
  "terminal.banner.quickActions": "Quick actions",
  // TerminalToolCall (#117 T8): the tool-call row's status word (announced
  // beside the glyph via TerminalRow's gutterLabel — never colour alone),
  // the result row's swapped heading (mirrors ToolOutput's own "Result"/
  // "Error" heading swap, `@elabs-ai/components-ai`), and the expand
  // trigger's accessible name. Unlike upstream's inert `"(ctrl+o to
  // expand)"` hint text, this IS a real focusable control's label — no CLI
  // chord required.
  "terminal.toolCall.succeeded": "Succeeded",
  "terminal.toolCall.failed": "Failed",
  "terminal.toolCall.running": "Running",
  "terminal.toolCall.result": "Result",
  "terminal.toolCall.error": "Error",
  "terminal.toolCall.expandHint": "Show details",
  // TerminalDiffHunk (#117 T9): the header's fixed "Update ({file})" phrase,
  // and the collapsed-context-run disclosure's count-aware label. Mirrors
  // `ai.diffView.showMore`'s wording under this package's own namespace —
  // sibling packages never import each other's locale keys
  // (`.claude/rules/terminal-components.md` § Reuse means promotion). The
  // per-line `add`/`del` polarity words are NOT duplicated here: they ride
  // the shared `diffLineAccessibleLabel()` keys (`ai.diffView.addedLine` /
  // `ai.diffView.removedLine`) above, the actual promoted channel.
  "terminal.diffHunk.header": "Update ({file})",
  "terminal.diffHunk.showMore": {
    one: "Show {count} more line",
    other: "Show {count} more lines",
  },
  // TerminalPermission (#117 T10): the per-call scoped approval prompt's
  // default title/question and its three scoped option labels, verified
  // live 2026-09-01 against Claude Code v2.1.207. The third option is the
  // vendor-free `deny` scope: upstream names its own product in this label,
  // ours reads "the agent" instead (#117 acceptance criterion). The reason
  // field reuses `ai.approvalCard.reasonLabel`/`reasonPlaceholder` and the
  // option descriptions reuse `APPROVAL_SCOPE_DESCRIPTION_KEYS` — both
  // already generic, so nothing new is minted for either.
  "terminal.permission.title": "Bash command",
  "terminal.permission.question": "Do you want to proceed?",
  "terminal.permission.optionOnce": "Yes",
  "terminal.permission.optionSession": "Yes, and don’t ask again this session",
  "terminal.permission.optionDeny": "No, and tell the agent what to do differently",
  // TerminalComposer (#117 T11): the prompt composer's placeholder, its
  // merged submit/stop affordance's accessible name (mirrors
  // `ai.promptInput.submit`/`stop` under this package's own namespace —
  // sibling packages never import each other's locale keys,
  // `.claude/rules/terminal-components.md` § Reuse means promotion), the
  // effort scale's default accessible name, and the shortcut-hint row's
  // three default words.
  "terminal.composer.placeholder": "Type your next instruction…",
  "terminal.composer.submit": "Send",
  "terminal.composer.stop": "Stop",
  "terminal.composer.effort": "Effort",
  "terminal.composer.shortcutSend": "send",
  "terminal.composer.shortcutNewline": "newline",
  "terminal.composer.shortcutCancel": "cancel",
  // TerminalSlashMenu (#117 T12): the `/`-command palette's listbox
  // accessible name (mirrors `ai.promptInputSlash.listLabel`'s wording under
  // this package's own namespace — sibling packages never import each
  // other's locale keys, `.claude/rules/terminal-components.md` § Reuse
  // means promotion). The empty state reuses the generic `noResults` key
  // rather than minting a second one.
  "terminal.slashMenu.listLabel": "Commands",
  // ── @elabs-ai/components-process ──────────────────────────────────────────────────────────
  // ProcessMap (RM-051). Namespaced `process.<area>.<key>` like every other
  // package; a sibling package's keys are never reused across the boundary.
  // The table twin's column headers are here because that table IS the
  // accessible reading of the canvas — an untranslated header would leave a
  // screen-reader user with numbers and no measure name.
  "process.map.loading": "Discovering the process…",
  "process.map.empty": "No activities to map",
  "process.map.emptyBody":
    "This log has no events, or the abstraction hid every activity. Widen the abstraction or load a different log.",
  "process.map.label": "Process map",
  "process.map.filter": "Filter…",
  "process.map.activityCaption": "Activities — {metric} per activity",
  "process.map.transitionCaption": "Transitions — {metric} per directly-follows pair",
  "process.map.columnActivity": "Activity",
  "process.map.columnRole": "Role",
  "process.map.columnRework": "Rework",
  "process.map.columnFrom": "From",
  "process.map.columnTo": "To",
  "process.map.columnShape": "Shape",
};
