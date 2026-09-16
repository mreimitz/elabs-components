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
  clear: "Clear",
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
  "ui.breadcrumb.label": "breadcrumb",
  "ui.pagination.label": "pagination",
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
  // ContextRail's switcher count phrase (composed into the accessible name,
  // e.g. "Sources 3 items") and its default empty-state copy.
  "ui.contextRail.sectionCount": { one: "{count} item", other: "{count} items" },
  "ui.contextRail.empty": "No sections",
  // SideDock's resize handle — its sr-only label and its live width readout.
  "ui.sideDock.resize": "Resize",
  "ui.sideDock.widthValue": { one: "{size} pixel", other: "{size} pixels" },
  // Tree's error row — shared by the virtualized and non-virtualized branches.
  "ui.tree.failedToLoad": "Failed to load",
  // ThemeSwitcher's "follow the OS" option, in both dropdown and toggle modes.
  "ui.themeSwitcher.system": "System",
  // Group labels + scheme names in the family layout (ADR 0036).
  "ui.themeSwitcher.theme": "Theme",
  "ui.themeSwitcher.mode": "Mode",
  "ui.themeSwitcher.light": "Light",
  "ui.themeSwitcher.dark": "Dark",
  "ui.navNotifications.label": "Notifications",
  "ui.teamSwitcher.label": "Teams",
  "ui.teamSwitcher.addTeam": "Add team",
  // Table's own scroll wrapper (#366). Rendered ONLY when the wrapper actually
  // overflows, so it is never announced for a table that fits — see
  // `packages/ui/src/components/table/table.tsx`. Deliberately a `ui.*`
  // sibling of `data.table.scrollRegion` rather than a shared cross-package
  // key: `Table` is a `@elabs-ai/components-ui` component and each package
  // keeps its own namespace even where the English string coincides (compare
  // `viewer.content` vs this), so a translator can phrase either
  // independently and neither package depends on a string owned by another.
  "ui.table.scrollRegion": "Table contents, scrollable",
  // NumberInput's step buttons (#4 i18n sweep).
  "ui.numberInput.decrease": "Decrease",
  "ui.numberInput.increase": "Increase",
  // Combobox/VirtualSelect/TreeSelect each keep their own placeholder pair
  // (English text coincides, but a translator may phrase a search box
  // differently per surface — same rationale as `ui.table.scrollRegion`).
  "ui.combobox.placeholder": "Select…",
  "ui.combobox.searchPlaceholder": "Search…",
  "ui.virtualSelect.placeholder": "Select…",
  "ui.virtualSelect.searchPlaceholder": "Search…",
  "ui.treeSelect.placeholder": "Select…",
  "ui.treeSelect.moreSelected": "and {count} more selected",
  "ui.fileUpload.selectedFiles": "Selected files",
  "ui.fileUpload.dragDropHere": "Drag & drop files here",
  "ui.fileUpload.browseFiles": "Browse files",
  // Sidebar's mobile Sheet description (sr-only) and the collapse/expand
  // trigger's shared name (SidebarTrigger's sr-only text + SidebarRail's
  // aria-label/title).
  "ui.sidebar.mobileDescription": "Displays the mobile sidebar.",
  "ui.sidebar.toggle": "Toggle Sidebar",
  "ui.revisionTimeline.label": "Revisions",
  "ui.tree.retry": "Retry",
  "ui.tree.retryLoadingChildren": "Retry loading children",
  // Spinner's bare default label — kept WITHOUT an ellipsis (unlike the
  // generic `loading` key) to stay byte-identical to its pre-i18n default.
  "ui.spinner.label": "Loading",
  "ui.statePanel.errorTitle": "Something went wrong",
  "ui.statePanel.errorDescription": "An unexpected error occurred. Please try again.",
  "ui.statePanel.errorEyebrow": "Error",
  "ui.carousel.label": "Carousel",
  // Transfer (#4 i18n sweep). `panelFallback`/`itemsFallback` back the two
  // spots where the panel title isn't a plain string (a ReactNode) and the
  // sr-only text falls back to a generic word instead.
  "ui.transfer.selectAllIn": "Select all in {title}",
  "ui.transfer.panelFallback": "panel",
  "ui.transfer.searchIn": "Search {title}",
  "ui.transfer.itemsFallback": "items",
  "ui.transfer.searchPlaceholder": "Search…",
  "ui.transfer.empty": "No items",
  "ui.transfer.defaultSourceTitle": "Source",
  "ui.transfer.defaultTargetTitle": "Target",
  "ui.transfer.movedToTarget": {
    one: "{count} item moved to the target list.",
    other: "{count} items moved to the target list.",
  },
  "ui.transfer.movedToSource": {
    one: "{count} item moved to the source list.",
    other: "{count} items moved to the source list.",
  },
  "ui.transfer.moveControls": "Move controls",
  "ui.transfer.moveSelectedRight": "Move selected right",
  "ui.transfer.moveAllRight": "Move all right",
  "ui.transfer.moveSelectedLeft": "Move selected left",
  "ui.transfer.moveAllLeft": "Move all left",
  // ChangeReview (#4 i18n sweep).
  "ui.changeReview.heading": "Review changes",
  "ui.changeReview.approvedCount": "{approved} of {total} approved",
  "ui.changeReview.rejectAll": "Reject all",
  "ui.changeReview.rejectAllLabel": "Reject all changes",
  "ui.changeReview.approveAll": "Approve all",
  "ui.changeReview.approveAllLabel": "Approve all changes",
  "ui.changeReview.provenanceLabel": "Change provenance",
  "ui.changeReview.emptyTitle": "No changes to review",
  "ui.changeReview.emptyDescription":
    "When an agent proposes edits, they'll appear here for your approval.",
  "ui.changeReview.statusAdded": "added",
  "ui.changeReview.statusRemoved": "removed",
  "ui.changeReview.statusModified": "modified",
  "ui.changeReview.phaseBefore": "Before",
  "ui.changeReview.phaseAfter": "After",
  "ui.changeReview.checkPassed": "Passed",
  "ui.changeReview.checkFailed": "Failed",
  "ui.changeReview.showDetail": "Show detail",
  "ui.changeReview.hideDetail": "Hide detail",
  "ui.changeReview.rejectHunk": "Reject hunk: {title}",
  "ui.changeReview.approveHunk": "Approve hunk: {title}",
  "ui.changeReview.changeType": "Change type: {status}",
  "ui.changeReview.beforePrefix": "Before: ",
  "ui.changeReview.afterPrefix": "After: ",
  "ui.changeReview.approvedBadge": "Approved",
  "ui.navNotifications.trigger": "Open notifications",
  "ui.colorPicker.pickColor": "Pick color",
  "ui.colorPicker.none": "None",
  "ui.colorPicker.swatches": "Color swatches",
  "ui.colorPicker.customHexLabel": "Custom hex",
  "ui.colorPicker.notThemeAware": "(not theme-aware)",
  "ui.colorPicker.customHex": "Custom hex color",

  // ── @elabs-ai/components-data ─────────────────────────────────────────────────────────────
  // The scroll region's accessible name is rendered ONLY when the table actually
  // overflows its container, so it is never announced for a table that fits.
  "data.table.scrollRegion": "Table contents, scrollable",
  "data.table.loading": "Loading table data…",
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
  "data.columnPicker.label": "Columns",
  "data.searchInput.label": "Search",
  "data.searchInput.placeholder": "Search…",
  "data.searchInput.clear": "Clear search",

  // ── @elabs-ai/components-charts ───────────────────────────────────────────────────────────
  // Shared caption for any bare chart surface's layout-shaped skeleton
  // (ChartFrame, ChartCard, AutoChart all show the same "a chart is loading"
  // concept — one key, reused, rather than three near-duplicate strings).
  "charts.chart.loading": "Loading chart…",
  // ChartFallback's default copy per `kind` (#304). Written for the reader of
  // the page, not the developer: the unsupported chart type name goes to a
  // dev-only console warning, never into this string.
  "charts.chart.empty": "No data to display",
  "charts.chart.unsupported": "This chart can’t be displayed.",
  "charts.metricGrid.loading": "Loading metrics…",
  // Chart drill-down (#349). The chart SVG is aria-hidden, so these names are
  // the ONLY thing AT reads for an interactive datapoint — there is no
  // consumer-side workaround if they stay English.
  "charts.datapointLayer.label": "Chart data points",
  "charts.datapoint.label": "{series}, {category}: {value}",
  "charts.datapoint.labelNoSeries": "{category}: {value}",
  // A target with no value (a tree node, a parallel-coordinates line, an empty
  // heatmap cell) drops the separator rather than announcing a dangling ":".
  "charts.datapoint.labelNoValue": "{series}, {category}",
  "charts.datapoint.labelNoSeriesNoValue": "{category}",
  // Stands in for {category} when a target has none, so the name is never a
  // bare value or an empty string. {position} is 1-based.
  "charts.datapoint.position": "Data point {position}",
  // DumbbellChart: a target spans two values, so both ends are announced.
  "charts.datapoint.labelRange": "{category}: {start} to {end}",
  // Announced when `copyValueOnActivate` puts a datapoint's exact value on the
  // clipboard — the recovery path for a compact axis label.
  "charts.datapoint.copied": "Exact value copied",
  // chart selection — RM-073
  // Appended to a datapoint's name when a host's `selectionStates` resolves it,
  // so the selection tri-state never rides on colour/opacity alone (WCAG 1.4.1).
  // `associated` is the resting state and adds nothing.
  "charts.datapoint.selected": "{label}, selected",
  "charts.datapoint.excluded": "{label}, excluded",
  // ChartFrame's SVG/PNG export actions (RM-025). Each string is used twice —
  // as the icon button's `aria-label` (its ONLY accessible name) and as the
  // tooltip a sighted user reads — so one key serves both and they cannot
  // drift apart in translation.
  "charts.chartFrame.exportSvg": "Export as SVG",
  "charts.chartFrame.exportPng": "Export as PNG",
  "charts.chartFrame.flipToTable": "Flip to table view",
  "charts.chartFrame.showChart": "Show chart",
  "charts.chartFrame.showAsTable": "Show as table",
  "charts.chartFrame.downloadCsv": "Download CSV",
  "charts.chartFrame.expandChart": "Expand chart",
  "charts.chartFrame.expand": "Expand",
  "charts.chartFrame.summary": "Summary",
  "charts.chartFrame.noDataToSummarize": "No data to summarize.",
  "charts.chartFrame.defaultTitle": "Chart",
  "charts.chartFrame.summaryDetailLabel": "Chart summary",
  "charts.legend.label": "Chart legend",
  "charts.gantt.timeline": "Timeline",
  "charts.gantt.dragToResizeColumn": "Drag to resize column",
  "charts.gantt.viewControls": "Gantt view controls",
  "charts.gantt.viewMode": "View mode",
  "charts.gantt.viewModeLabel": "View mode:",
  "charts.gantt.taskList": "Task list",
  "charts.gantt.taskListLabel": "Tasks",
  "charts.gantt.noTasksToDisplay": "No tasks to display",
  "charts.gantt.unitDay": "Day",
  "charts.gantt.unitWeek": "Week",
  "charts.gantt.unitMonth": "Month",
  "charts.gantt.unitQuarter": "Quarter",
  "charts.gantt.unitHour": "Hour",
  "charts.gantt.unitMinute": "Minute",
  "charts.gantt.unitSecond": "Second",
  "charts.gantt.unitMillisecond": "Millisecond",
  // RM-075 follow-up: `container` dashboard tile's default tablist name when the tile
  // has no `title`.
  "charts.dashboard.containerTabs": "Container tabs",
  // dashboard edit — RM-078: edit-layer handles, size badge and screen-reader announcements.
  // Columns and rows are announced 1-based; the badge shows the same numbers.
  "charts.dashboard.edit.instructions":
    "To pick up a tile, press Enter. Use the arrow keys to move it one cell, or four cells with Shift. Press Enter to drop it, or Escape to cancel. On a resize handle, the arrow keys resize directly.",
  "charts.dashboard.edit.moveTile": "Move {title}",
  "charts.dashboard.edit.resizeTile": "Resize {title} from {edge}",
  "charts.dashboard.edit.edgeTop": "top",
  "charts.dashboard.edit.edgeTopRight": "top-right",
  "charts.dashboard.edit.edgeRight": "right",
  "charts.dashboard.edit.edgeBottomRight": "bottom-right",
  "charts.dashboard.edit.edgeBottom": "bottom",
  "charts.dashboard.edit.edgeBottomLeft": "bottom-left",
  "charts.dashboard.edit.edgeLeft": "left",
  "charts.dashboard.edit.edgeTopLeft": "top-left",
  "charts.dashboard.edit.sizeBadge": "({x},{y}) ⤢ {w} × {h}",
  "charts.dashboard.edit.pickedUp": "Picked up {title} at column {x}, row {y}",
  "charts.dashboard.edit.moved": "Moved to column {x}, row {y}",
  "charts.dashboard.edit.dropped": "Dropped {title} at column {x}, row {y}, size {w} by {h}",
  "charts.dashboard.edit.rejected": "Cannot place here — not enough room",
  "charts.dashboard.edit.resizing": "Resizing {title}: {w} by {h}",
  "charts.dashboard.edit.resized": "Resized {title} to {w} by {h}",
  "charts.dashboard.edit.cancelled": "Cancelled",
  // dashboard toolbar — RM-079: mode switch, undo/redo, grid settings, save/discard, shortcuts.
  "charts.dashboard.toolbar.ariaLabel": "Dashboard toolbar",
  "charts.dashboard.toolbar.viewMode": "View",
  "charts.dashboard.toolbar.editMode": "Edit",
  "charts.dashboard.toolbar.editDisabledNarrow": "Editing needs a wider screen",
  "charts.dashboard.toolbar.undo": "Undo",
  "charts.dashboard.toolbar.redo": "Redo",
  "charts.dashboard.toolbar.add": "Add",
  "charts.dashboard.toolbar.grid": "Grid",
  "charts.dashboard.toolbar.gridSettings": "Grid settings",
  "charts.dashboard.toolbar.save": "Save",
  "charts.dashboard.toolbar.discard": "Discard",
  "charts.dashboard.toolbar.unsavedChanges": "Unsaved changes",
  "charts.dashboard.toolbar.discardTitle": "Discard changes?",
  "charts.dashboard.toolbar.discardDescription":
    "Your edits since the last save will be lost. This cannot be undone.",
  "charts.dashboard.toolbar.discardConfirm": "Discard changes",
  "charts.dashboard.toolbar.shortcuts": "Keyboard shortcuts",
  "charts.dashboard.toolbar.shortcutsDescription":
    "Every shortcut available while this sheet is focused.",
  "charts.dashboard.toolbar.shortcutsGroup": "Dashboard",
  "charts.dashboard.toolbar.shortcutUndo": "Undo",
  "charts.dashboard.toolbar.shortcutRedo": "Redo",
  "charts.dashboard.toolbar.shortcutToggleEdit": "Toggle edit mode",
  "charts.dashboard.toolbar.shortcutDelete": "Delete focused tiles",
  "charts.dashboard.toolbar.shortcutDuplicate": "Duplicate focused tiles",
  "charts.dashboard.toolbar.shortcutClearFocus": "Clear focus",
  "charts.dashboard.toolbar.shortcutSave": "Save",
  "charts.dashboard.grid.mode": "Layout mode",
  "charts.dashboard.grid.modeFit": "Fit to screen",
  "charts.dashboard.grid.modeFlow": "Flow",
  "charts.dashboard.grid.density": "Density",
  "charts.dashboard.grid.densityWide": "Wide",
  "charts.dashboard.grid.densityMedium": "Medium",
  "charts.dashboard.grid.densityNarrow": "Narrow",
  "charts.dashboard.grid.densityCustom": "Custom",
  "charts.dashboard.grid.columns": "Columns",
  "charts.dashboard.grid.rows": "Rows",
  "charts.dashboard.grid.rowHeight": "Row height",
  "charts.dashboard.grid.gap": "Gap",
  "charts.dashboard.grid.extendable": "Extend sheet",
  "charts.dashboard.grid.extendableDescription":
    "Adds 50 % more rows so it never runs out of room.",
  // dashboard tile ops — RM-081: the tile context menu (right-click, header kebab, Shift+F10)
  // and its "Replace with…" submenu, plus the toast on a destructive multi-tile delete.
  "charts.dashboard.tileOps.menuLabel": "Tile actions",
  "charts.dashboard.tileOps.duplicate": "Duplicate",
  "charts.dashboard.tileOps.replaceWith": "Replace with…",
  "charts.dashboard.tileOps.addToLibrary": "Add to library",
  "charts.dashboard.tileOps.copy": "Copy",
  "charts.dashboard.tileOps.cut": "Cut",
  "charts.dashboard.tileOps.paste": "Paste",
  "charts.dashboard.tileOps.pasteAndReplace": "Paste and replace",
  "charts.dashboard.tileOps.bringForward": "Bring forward",
  "charts.dashboard.tileOps.sendBackward": "Send backward",
  "charts.dashboard.tileOps.delete": "Delete",
  "charts.dashboard.tileOps.deletedOne": "Tile deleted",
  "charts.dashboard.tileOps.deletedMany": "{count} tiles deleted",
  "charts.dashboard.tileOps.undo": "Undo",

  // ── @elabs-ai/components-maps ─────────────────────────────────────────────────────────────
  "maps.popup.close": "Close popup",
  "maps.canvas.unavailableTitle": "Map unavailable",
  "maps.canvas.unavailableDescription": "This browser can’t render WebGL maps.",

  // ── @elabs-ai/components-flow ─────────────────────────────────────────────────────────────
  "flow.inspectorPanel.close": "Close inspector",
  "flow.inspectorPanel.title": "Inspector",
  "flow.inspectorPanel.emptyMessage": "Select a node to see its details.",

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
  "ai.agent.outputSchema": "Output Schema",
  "ai.codeBlock.generating": "Generating…",
  "ai.composer.placeholder": "Ask me anything…",
  "ai.tokenUsage.usage": "Model context usage",
  "ai.tokenUsage.totalCost": "Total cost",
  "ai.tokenUsage.input": "Input",
  "ai.tokenUsage.output": "Output",
  "ai.tokenUsage.reasoning": "Reasoning",
  "ai.tokenUsage.cache": "Cache",
  "ai.contextPanel.back": "Back to context",
  "ai.contextPanel.toggle": "Toggle context panel",
  // The mobile Sheet's sr-only title (#18) — distinct from `contextPanel.toggle`,
  // which labels the button that opens/closes it.
  "ai.contextPanel.title": "Context panel",
  "ai.contextPanel.description": "Displays the chat context panel.",
  "ai.environmentVariables.toggleVisibility": "Toggle value visibility",
  "ai.gallery.label": "Image gallery",
  "ai.gallery.expandImage": "Expand image",
  "ai.gallery.downloadImage": "Download image",
  "ai.gallery.noImages": "No images",
  "ai.gallery.noDetails": "No details",
  // Shared by Tool's technical view and SchemaDisplay's request panel.
  "ai.schemaDisplay.parameters": "Parameters",
  "ai.schemaDisplay.response": "Response",
  "ai.schemaDisplay.requestBody": "Request Body",
  // ReasoningTrigger's default not-yet-timed message (before `duration` is known).
  "ai.reasoning.thoughtDefault": "Thought for a few seconds",
  "ai.reasoning.thinking": "Thinking…",
  "ai.reasoning.thoughtForDuration": "Thought for {duration} seconds",
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
  // Tool (#4 i18n sweep).
  "ai.tool.showTechnicalDetails": "Show technical details",
  "ai.tool.error": "Error",
  "ai.tool.result": "Result",
  // AssetPreview.
  "ai.assetPreview.rowCount": { one: "{count} row", other: "{count} rows" },
  "ai.assetPreview.noPreview": "No preview available…",
  "ai.assetPreview.preview": "Preview",
  "ai.assetPreview.raw": "Raw",
  // WebPreview's sandboxed iframe accessible name.
  "ai.webPreview.previewTitle": "Preview",
  // FileTree's expand/collapse chevron control.
  "ai.fileTree.expandFolder": "Expand {name}",
  "ai.fileTree.collapseFolder": "Collapse {name}",
  "ai.fileTree.noAssetsProduced": "No assets produced yet.",
  "ai.conversation.download": "Download conversation",
  // OpenInChat. `provider` is a brand name (ChatGPT, Claude, …) — kept
  // untranslated data, interpolated into the translated "Open in …" phrase.
  "ai.openInChat.trigger": "Open in chat",
  "ai.openInChat.openInProvider": "Open in {provider}",
  // TestResults.
  "ai.testResults.passedCount": { one: "{count} passed", other: "{count} passed" },
  "ai.testResults.failedCount": { one: "{count} failed", other: "{count} failed" },
  "ai.testResults.skippedCount": { one: "{count} skipped", other: "{count} skipped" },
  "ai.testResults.testsPassed": "{passed}/{total} tests passed",

  // ── @elabs-ai/components-editor ───────────────────────────────────────────
  // DecisionCard (ai-objects). Status vocabulary + the card's own accessible name
  // and the "Alternatives considered" section (shared by its heading and its list's
  // aria-label).
  "editor.decisionCard.statusAccepted": "Accepted",
  "editor.decisionCard.statusRejected": "Rejected",
  "editor.decisionCard.statusProposed": "Proposed",
  "editor.decisionCard.statusSuperseded": "Superseded",
  "editor.decisionCard.label": "Decision: {label}",
  "editor.decisionCard.alternativesConsidered": "Alternatives considered",
  // KnowledgeCard (ai-objects).
  "editor.knowledgeCard.label": "Knowledge fact",
  "editor.knowledgeCard.heading": "Knowledge",
  "editor.knowledgeCard.sources": "Sources",
  "editor.knowledgeCard.source": "Source: {name}",
  "editor.knowledgeCard.sourceUnresolved": "Source (unresolved): {name}",
  // CalcBlock. `equals` is the sr-only prefix read before a computed value —
  // intentionally ends in a space so it reads as a prefix (mirrors `ai.diffView.addedLine`).
  "editor.calcBlock.error": "Error: {message}",
  "editor.calcBlock.equals": "equals ",
  "editor.calcBlock.total": "Total",
  "editor.calcBlock.emptyBlock": "Empty calc block.",
  // CopyButton. The "Copy" state reuses the shared generic `copy` key.
  "editor.copyButton.copied": "Copied",
  // EditorToolbar.
  "editor.editorToolbar.language": "Language",
  // Citations (markdown-academic).
  "editor.citations.citationLabel": "Citation: {name}",
  "editor.citations.unresolvedCitation": "Unresolved citation",
  "editor.citations.unresolvedKey": "Unresolved: @{key}",
  "editor.citations.references": "References",
  // Math (markdown-academic).
  "editor.math.renderError": "Could not render math",
  "editor.math.renderErrorLabel": "Math (could not render): {tex}",
  // CompletionMenu (markdown-editor).
  "editor.completions.suggestions": "Suggestions",
  "editor.completions.noSuggestions": "No suggestions",
  // SlashMenu (markdown-editor).
  "editor.slashMenu.insertBlock": "Insert block",
  "editor.slashMenu.noMatchingBlocks": "No matching blocks",
  // TableControlsView (markdown-editor/table-view — the WYSIWYG GFM table toolbar).
  "editor.tableView.tableControls": "Table controls",
  "editor.tableView.row": "Row",
  "editor.tableView.col": "Col",
  "editor.tableView.addRowAbove": "Add row above",
  "editor.tableView.addRowBelow": "Add row below",
  "editor.tableView.deleteRow": "Delete row",
  "editor.tableView.addColumnLeft": "Add column left",
  "editor.tableView.addColumnRight": "Add column right",
  "editor.tableView.deleteColumn": "Delete column",
  // Directive node-views (markdown-editor/directive-views — Milkdown WYSIWYG).
  "editor.directiveViews.cardTitle": "Card title",
  "editor.directiveViews.calloutTitle": "Callout title",
  "editor.directiveViews.unknownBlock": "Unknown block: {name}",
  "editor.directiveViews.unknownInlineBlock": "Unknown inline block:",
  "editor.directiveViews.metricLabel": "Metric label",
  "editor.directiveViews.metricLabelPlaceholder": "Label",
  "editor.directiveViews.metricValue": "Metric value",
  "editor.directiveViews.metricValuePlaceholder": "0",
  "editor.directiveViews.editIteration": "Edit iteration…",
  "editor.directiveViews.changeLayout": "Change layout",
  "editor.directiveViews.transpose": "Transpose",
  "editor.directiveViews.convertToStatic": "Convert to static",
  "editor.directiveViews.needsEmbeddedValues": "— needs embedded values",
  "editor.directiveViews.pivot": "Pivot",
  "editor.directiveViews.iterate": "Iterate",
  "editor.directiveViews.perItem": "· per {as}",
  "editor.directiveViews.templateSuffix": "— template",
  "editor.directiveViews.iterationActions": "Iteration actions",
  "editor.directiveViews.iterationActionsTitle": "Iteration actions…",
  // IterationBuilderDialog (markdown-iteration) — the guided iterate/pivot authoring modal.
  "editor.iterationBuilder.pivotNoun": "pivot",
  "editor.iterationBuilder.iterationNoun": "iteration",
  "editor.iterationBuilder.editTitle": "Edit {noun}",
  "editor.iterationBuilder.insertTitle": "Insert {noun}",
  "editor.iterationBuilder.pivotDescription":
    "Pick the row and column values, then write the per-cell template. The matrix below fills in live.",
  "editor.iterationBuilder.iterationDescription":
    "Add the list values, then write the per-row template. The result below fills in live.",
  "editor.iterationBuilder.bindName": "Bind name",
  "editor.iterationBuilder.bindNamePlaceholder": "item",
  "editor.iterationBuilder.bindNameHintPrefix": "Use ",
  "editor.iterationBuilder.bindNameHintSuffix": " in the template.",
  "editor.iterationBuilder.rowValues": "Row values",
  "editor.iterationBuilder.values": "Values",
  "editor.iterationBuilder.valuePlaceholder": "Type a value, press Enter…",
  "editor.iterationBuilder.columnValues": "Column values",
  "editor.iterationBuilder.layout": "Layout",
  "editor.iterationBuilder.perCellTemplate": "Per-cell template",
  "editor.iterationBuilder.perRowTemplate": "Per-row template",
  "editor.iterationBuilder.livePreview": "Live preview",
  "editor.iterationBuilder.cancel": "Cancel",
  "editor.iterationBuilder.save": "Save",
  "editor.iterationBuilder.insert": "Insert",
  // IterationTemplateDialog (markdown-iteration) — the lighter template-only modal.
  "editor.templateDialog.editPivotTitle": "Edit pivot template",
  "editor.templateDialog.editIterationTitle": "Edit iteration template",
  "editor.templateDialog.descriptionPrefix": "The per-{unit} template. Use ",
  "editor.templateDialog.descriptionMiddle": " placeholders (e.g. ",
  "editor.templateDialog.descriptionSuffix":
    ") — each is filled per {unit} when the block renders.",
  "editor.templateDialog.editorLabel": "Iteration template editor",
  "editor.templateDialog.cancel": "Cancel",
  "editor.templateDialog.saveTemplate": "Save template",
  // DocumentOutline (markdown-outline).
  "editor.documentOutline.label": "Document outline",
  "editor.documentOutline.empty": "No headings yet.",
  // MarkdownToolbar (the source-pane formatting bar). Directive snippet labels
  // are the Insert menu's fallback item text (`DIRECTIVE_SNIPPETS`); the snippet
  // MARKDOWN they insert is example document content, not UI chrome, and stays
  // English (see the `i18n-exempt` comments at each snippet).
  "editor.markdownToolbar.label": "Markdown formatting",
  "editor.markdownToolbar.bold": "Bold",
  "editor.markdownToolbar.italic": "Italic",
  "editor.markdownToolbar.inlineCode": "Inline code",
  "editor.markdownToolbar.link": "Link",
  "editor.markdownToolbar.headingLevel": "Heading level",
  "editor.markdownToolbar.heading": "Heading",
  "editor.markdownToolbar.headingLevelItem": "Heading {level}",
  "editor.markdownToolbar.quote": "Quote",
  "editor.markdownToolbar.bulletList": "Bullet list",
  "editor.markdownToolbar.numberedList": "Numbered list",
  "editor.markdownToolbar.divider": "Divider",
  "editor.markdownToolbar.insertBlock": "Insert block",
  "editor.markdownToolbar.insert": "Insert",
  "editor.markdownToolbar.insertBrandBlock": "Insert brand block",
  "editor.markdownToolbar.directiveCard": "Card",
  "editor.markdownToolbar.directiveCallout": "Callout",
  "editor.markdownToolbar.directiveMetric": "Metric",
  "editor.markdownToolbar.directiveTimeline": "Timeline",
  // MarkdownWorkspace's focus-writing toggle.
  "editor.markdownWorkspace.focusWriting": "Focus writing",
  "editor.markdownWorkspace.focus": "Focus",
  "editor.markdownWorkspace.focusWritingHint": "Typewriter scrolling · inactive paragraphs dim",
  // MermaidDiagram (the inline renderer).
  "editor.mermaidDiagram.label": "Diagram",
  "editor.mermaidDiagram.expand": "Expand diagram",
  "editor.mermaidDiagram.downloadSvg": "Download diagram as SVG",
  "editor.mermaidDiagram.copySource": "Copy diagram source",
  "editor.mermaidDiagram.renderFailed": "Diagram failed to render",
  "editor.mermaidDiagram.rendering": "Rendering diagram…",
  // MermaidViewer (the expanded zoom/pan/search surface). `nodeCountHint` mirrors
  // the ORIGINAL (pre-i18n) copy exactly, including its always-plural "nodes" —
  // it is a static hint ("N nodes · type to filter"), not a real plural form, so
  // it stays a plain interpolated string rather than a `PluralMessage`.
  "editor.mermaidViewer.findPlaceholder": "Find in diagram…",
  "editor.mermaidViewer.findLabel": "Find in diagram",
  "editor.mermaidViewer.matchCount": { one: "{count} node", other: "{count} nodes" },
  "editor.mermaidViewer.nodeCountHint": "{count} nodes · type to filter",
  "editor.mermaidViewer.zoomOut": "Zoom out",
  "editor.mermaidViewer.zoomIn": "Zoom in",
  "editor.mermaidViewer.resetZoom": "Reset zoom to 100%",
  "editor.mermaidViewer.fitDiagram": "Fit diagram",

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
  // State column (#373) — the table twin's own channel for the selection/filter state the
  // canvas already says through real text in its accessible names; the twin used to carry
  // it only as a `data-*` attribute, which reaches no user.
  "process.map.columnState": "State",
  // The State column's own CELL values (#413 review, PRRT_kwDOT6D7ts6gJX2C). #373 localized
  // the column HEADER but left every cell printing the literal English word — since that cell
  // is also the row's screen-reader channel for its selection/filter state
  // (`selectionStateLabel` below is the un-localized canonical word `process-map.tsx` maps
  // through these keys at the render site), a non-English `LocaleProvider` left both the
  // visible AND the accessible content untranslated. `"associated"` (the ordinary case) has
  // no key: it prints nothing, by design.
  "process.map.stateSelected": "Selected",
  "process.map.stateExcluded": "Excluded",
  // Filter-intent menu item ACCESSIBLE names (#346). A transition's menu offers the same
  // four intents once per endpoint (eight items total); the visible text
  // (`PROCESS_FILTER_INTENT_LABELS` in map-model.ts) stays unsuffixed and compact, so these
  // compose the activity into the item's real accessible name instead — the channel a
  // screen-reader user actually hears, and the one the visible-only text left ambiguous.
  "process.map.filterIntentWith": "Keep cases containing {activity}",
  "process.map.filterIntentWithout": "Keep cases without {activity}",
  "process.map.filterIntentStartsWith": "Keep cases starting with {activity}",
  "process.map.filterIntentEndsWith": "Keep cases ending with {activity}",
  // The map's own live-region summary (#375) — one polite `role="status"` announces what
  // the active selection/filter just changed, mirroring `AbstractionControls`' hidden-count
  // summary below: two independently-pluralized fragments, composed at the call site
  // (`process-map.tsx`) rather than merged into one message, for the same reason.
  "process.map.excludedActivities": {
    one: "{count} of {total} activity excluded",
    other: "{count} of {total} activities excluded",
  },
  "process.map.excludedTransitions": {
    one: "{count} of {total} transition excluded",
    other: "{count} of {total} transitions excluded",
  },
  // The live region's AFFECTED-SET fragments (#413 review, PRRT_kwDOT6D7ts6gJX2I). Counts
  // alone are not enough: two selections/filters that exclude DIFFERENT elements but land on
  // the SAME counts produce byte-for-byte identical text, so the polite region — which
  // announces content CHANGES, not model changes — stays silent even though the map
  // re-inked. Naming which elements are excluded makes the string track the actual set, not
  // only its size. Composed at the call site alongside the two counts above, and omitted
  // entirely when nothing of that kind is excluded (so the common case stays as short as
  // before this fix).
  "process.map.excludedActivityNames": "excluding {names}",
  "process.map.excludedTransitionNames": "excluding {names}",
  // AbstractionControls (RM-052, issue #227). The two sliders' own labels,
  // the invert switch, the "Auto" heuristic button, and the hidden-count
  // status line. `hiddenActivities`/`hiddenPaths` are separate `PluralMessage`s
  // (not one combined key) because `t()` selects its plural category from a
  // SINGLE `count` var — see `resolveMessage` in `locale-provider.tsx` — so
  // the two independently-pluralizable counts are composed as two `t()` calls
  // joined at the call site (`abstraction-controls.tsx`), not one key with two
  // numbers.
  "process.abstractionControls.label": "Abstraction",
  "process.abstractionControls.activities": "Activities",
  "process.abstractionControls.paths": "Paths",
  "process.abstractionControls.invert": "Invert",
  "process.abstractionControls.auto": "Auto",
  "process.abstractionControls.hiddenActivities": {
    one: "{count} activity hidden",
    other: "{count} activities hidden",
  },
  "process.abstractionControls.hiddenPaths": {
    one: "{count} path hidden",
    other: "{count} paths hidden",
  },
  // MetricLayerSwitch (RM-052, issue #227). The Frequency/Performance/Rework
  // toggle group, the node/edge metric selects' field labels, and the lock
  // toggle's two accessible-name states. The per-VALUE metric labels
  // ("Occurrences", "Share of transitions", …) are deliberately NOT
  // duplicated here — they are read straight from `nodeMetricLabel`/
  // `edgeMetricLabel` (`process-map/map-model.ts`), which already resolve
  // each `ProcessMetric` to its correct, audience-specific text; see
  // `metric-layer-switch.tsx`'s module docblock.
  "process.metricLayerSwitch.label": "Metric",
  "process.metricLayerSwitch.layer": "Metric layer",
  "process.metricLayerSwitch.frequency": "Frequency",
  "process.metricLayerSwitch.performance": "Performance",
  "process.metricLayerSwitch.rework": "Rework",
  "process.metricLayerSwitch.node": "Activity",
  "process.metricLayerSwitch.edge": "Transition",
  "process.metricLayerSwitch.lockOn": "Unlock activity and transition metrics",
  "process.metricLayerSwitch.lockOff": "Lock activity and transition metrics together",
  // ProcessKpiStrip (RM-052, issue #227). Six tiles' labels, plus the
  // conformance tile's genuine "not available" state (no conformance model
  // has run yet) — a real state, not a fabricated 0%.
  "process.kpiStrip.cases": "Cases",
  "process.kpiStrip.events": "Events",
  "process.kpiStrip.variants": "Variants",
  "process.kpiStrip.medianThroughput": "Median throughput",
  "process.kpiStrip.reworkRate": "Rework rate",
  "process.kpiStrip.conformance": "Conformance",
  "process.kpiStrip.conformanceUnavailable": "Not available",
  "process.kpiStrip.conformanceUnavailableHint": "Run conformance checking to see this metric.",
  // Sparkline text alternative (#359). `Sparkline`'s own default alt text is more
  // informative than the tile's own label — passing the label straight through
  // overrode it and left a screen-reader user hearing the tile's name twice with no
  // sense of the trend. `direction` is itself a resolved `t()` value (trendRising/
  // Falling/Steady), composed into this template the same way `hiddenSummary`
  // (abstraction-controls.tsx) composes two already-localized fragments.
  "process.kpiStrip.trendAlt":
    "{subject}, {periods}-period trend, {direction} from {first} to {last}",
  "process.kpiStrip.trendRising": "rising",
  "process.kpiStrip.trendFalling": "falling",
  "process.kpiStrip.trendSteady": "steady",
  // ProcessFilterBar (RM-056, #205). Filter-chain breadcrumb chip labels — label-in-value
  // text, one key per `FilterIntent["kind"]` — the "Clear all" action, the chip's own
  // "excluded" count label, and the summary line's two independently-omittable clauses
  // (see `process-filter-bar.tsx`'s module docblock for why they are composed, not merged).
  "process.filterBar.label": "Active filters",
  "process.filterBar.with": "Contains {activity}",
  "process.filterBar.without": "Excludes {activity}",
  "process.filterBar.startsWith": "Starts with {activity}",
  "process.filterBar.endsWith": "Ends with {activity}",
  "process.filterBar.variant": {
    one: "{count} variant selected",
    other: "{count} variants selected",
  },
  "process.filterBar.cases": {
    one: "{count} case selected",
    other: "{count} cases selected",
  },
  "process.filterBar.filter": "Filter",
  "process.filterBar.excludedLabel": "excluded",
  "process.filterBar.clearAll": "Clear all",
  "process.filterBar.showingAll": {
    one: "Showing all {total} case",
    other: "Showing all {total} cases",
  },
  "process.filterBar.showing": "Showing {filtered} of {total} cases",
  "process.filterBar.hiddenByAbstraction": {
    one: "{count} activity hidden by abstraction",
    other: "{count} activities hidden by abstraction",
  },
  // CaseTable (RM-055, issue #204). A column configuration over `data`'s
  // DataTable — see `.claude/rules/data.md`'s "primitives go down, compositions
  // go up". `conformance*` labels the three-state badge; `conformance` itself
  // is host-supplied (never fabricated here — same rule as `ProcessKpiStrip`'s
  // own conformance tile).
  "process.caseTable.columnCaseId": "Case",
  "process.caseTable.columnStart": "Start",
  "process.caseTable.columnEnd": "End",
  "process.caseTable.columnDuration": "Duration",
  "process.caseTable.columnEventCount": "Events",
  "process.caseTable.columnVariant": "Variant",
  "process.caseTable.columnConformance": "Conformance",
  "process.caseTable.conformanceConforming": "Conforming",
  "process.caseTable.conformanceNonConforming": "Non-conforming",
  "process.caseTable.conformanceUnknown": "Unknown",
  "process.caseTable.exportCsv": "Export CSV",
  "process.caseTable.empty": "No cases to display.",
  "process.caseTable.tableLabel": "Cases",
  // CaseTimeline (RM-055, issue #204). A thin `charts/Gantt` wrapper — one row
  // per activity instance, waiting time as gap bands, overlapping instances
  // flagged parallel. `parallelLabel` is the non-colour channel WCAG 1.4.1
  // requires alongside the `info` tone the bar itself carries.
  "process.caseTimeline.label": "Case timeline",
  "process.caseTimeline.parallelLabel": "Parallel",
  "process.caseTimeline.parallelSuffix": "parallel with another activity",
  "process.caseTimeline.gapLabel": "Waiting, {duration}",
  // ProcessCompare (RM-064, issue #211). `{label}` is the HOST-supplied side name
  // ("Before"/"After", a log's own file name, …), not a fixed "A"/"B" — see
  // `process-compare.tsx`'s module docblock for why the diff-state words name the
  // owning side instead of a generic letter.
  "process.compare.label": "Process comparison",
  "process.compare.tableView": "Table view",
  "process.compare.mapLabel": "Process map — {label}",
  "process.compare.superimposedMapLabel": "Process map — {aLabel} vs {bLabel}",
  "process.compare.legendTitle": "Comparison",
  "process.compare.diffSuffixCommon": "common",
  "process.compare.diffSuffixOnly": "{label} only",
  "process.compare.cases": "{label} — cases",
  "process.compare.medianThroughput": "{label} — median throughput",
};
