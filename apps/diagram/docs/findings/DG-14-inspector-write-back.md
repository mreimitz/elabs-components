# DG-14 — inspector and write-back: library gaps

Measured while hardening DG-14 (2026-09-26) against `diagram/integrate` at `de58eeb6`, in the
app's dev server (React 19 StrictMode) and in `agent-browser`.

## 1. `SchemaFormProvider` in controlled mode drops every other keystroke under StrictMode

- **Where:** `packages/ui/src/components/schema-form/schema-form.tsx:205-208`
  (`const changed = store.syncProps(storeProps)` in render, `if (changed) store.notify()` in
  a layout effect) and `schema-form-store.ts:308` (`syncProps` compares with the props of the
  previous call).
- **Evidence:** a controlled form whose `onChange` writes the value back through the parent.
  Typing ` (Kafka)` into a title field left `Amazon MSK(ak)`; typed one key at a time, every
  second key was lost and the input showed the value one keystroke behind the text. With
  `<StrictMode>` removed from `main.tsx`, the same typing gave `Amazon MSK (Kafka)`.
- **Cause:** StrictMode renders the provider twice with the same props. The first call to
  `syncProps` sees the new `values` and returns `true`; the second compares against the
  first and returns `false`. The committed render keeps `false`, so the layout effect does
  not notify, and the `memo`-wrapped field (its props unchanged) keeps the old value.
  React then restores the controlled input to that old value.
- **App workaround:** `panes/inspector-pane.tsx` runs the form uncontrolled. Each field's
  `default` is seeded from the text (`seedFormSpec`), and the form is re-mounted (a new
  `key`) whenever the text changes from anywhere but the form itself.
- **Proposed fix:** remember the props that were last _notified_ in the store and compare
  in the layout effect (`if (store.propsChangedSinceNotify()) store.notify()`), so the
  decision does not depend on how many times render ran.

## 2. `EnumControl` has no way to clear a value

- **Where:** `packages/ui/src/components/schema-form/schema-form.tsx:371` (`EnumControl`).
- **Evidence:** an optional dialect enum without a default (`owner`, `tone`, `variant`,
  `secure`, `style`, `direction`) cannot go back to "not set" once chosen.
- **App workaround:** `spec/dialect/form-spec.ts` adds a first option
  `{ const: "__unset", title: "Not set" }`; choosing it removes the key from the YAML.
- **Proposed API:** `EnumFieldSpec.clearable?: boolean` (a "None" item that emits
  `undefined`).

## 3. No tag input and no icon picker field

- **Where:** `packages/ui/src/components/schema-form/schema-form-spec.ts:102-195` (the field
  kinds).
- **Evidence:** `badges` and `class` are lists of short words; `icon` is one of the ~700
  names in `public/icons/index.json`. There is no chip/tag field and no combobox with
  previews.
- **App workaround:** `list` (ListEditor) for `badges`/`class`, a plain `string` for `icon`.
  The validator still flags an unknown icon name in the editor.
- **Proposed API:** a `tags` field kind; an `enum` with `searchable: true` and an
  `optionIcon` slot (or a `combobox` kind).

## 4. `visibleWhen` has no "one of"

- **Where:** `schema-form-spec.ts:84-91` (`visibleWhen: { field, equals }`) against
  `packages/ui/src/lib/definition/field.ts:50` (`AppliesWhen` has `equals` and `in`).
- **App workaround:** `form-spec.ts` maps `equals` and drops `in` (no dialect field uses it
  yet).
- **Proposed API:** `visibleWhen: { field, in: [...] }`, mirroring `AppliesWhen`.

## 5. The definition base does not export its merged field table

- **Where:** `packages/ui/src/lib/definition/effective-fields.ts:1-8` ("Not exported from
  the subpath").
- **App workaround:** `form-spec.ts` merges `def.groups[].fields` and `def.fields` itself
  (own field wins, as `planOf` does).
- **Proposed API:** export `planOf` (or an `effectiveFields(def)`) from
  `@elabs-ai/components-ui/definition`; the review's `FlowNodeInspector` needs the same.

## 6. `InspectorPanel`'s empty state takes text only

- **Where:** `packages/flow/src/inspector-panel/inspector-panel.tsx:138` (the empty message
  renders inside a `<p>`).
- **Evidence:** a `StatePanel` there would put a `<div>` inside a `<p>` (invalid HTML).
- **App workaround:** a plain string.
- **Proposed API:** render `emptyMessage` in a `<div>` (or a `StatePanel kind="empty"` by
  default).

## 7. Canvas delete: React Flow listens on the whole document, and nothing restores focus

- **Where:** `@xyflow/react` 12.11.1 `dist/esm/index.mjs:1238`
  (`useKeyPress(deleteKeyCode, …)`, default target `document`); flow has no focus handling
  after a delete.
- **Evidence:** the listener's target is `document` (source above), so a Delete pressed on a
  top-bar button reaches it while a node is still selected. The deleted node was the focused
  element and nothing in flow moves focus when it unmounts. Measured with the workaround
  (re-checked at `62aa5f55`, lakehouse example): Delete on the top-bar Inspector button with
  `vpc` selected left the text unchanged; Delete on `msk` moved focus to `dbx-jobs` (its next
  sibling in the private subnet), on the edge `okta->qlik-cloud` to `okta`, on the zone `vpc`
  to `s3-landing`.
- **App workaround:** `panes/use-canvas-delete.ts` answers `onBeforeDelete` only while focus
  is on the canvas (or on `<body>`), writes the delete to the text, returns `false`, and
  focuses a neighbour (`panes/focus-canvas.ts`, retrying per frame until the element exists).
- **Proposed API:** `CanvasShell` restores focus to a neighbour after a delete (the
  sibling/parent rule above) and scopes the delete key to the canvas.

## 8. Monaco merges programmatic edits into one undo step

- **Where:** `packages/editor/src/code-editor/code-editor.tsx:306-322` (controlled sync via
  `executeEdits`, no undo stop).
- **Evidence:** three canvas deletes followed by ⌘Z in the editor restored all three at
  once.
- **Consequence:** until DG-16, a canvas delete can be undone only in the editor, and
  coarsely. DG-16's text history owns undo; this is recorded, not worked around.

## 9. `DropdownMenuContent` clips a tall menu

- **Where:** `packages/ui/src/components/dropdown-menu/dropdown-menu.tsx:120`
  (`overflow-hidden`, no maximum height).
- **Evidence:** with every wave-3 entry in the compact top bar's "Diagram options" menu
  (re-checked at `90aaa41f`), the menu is 704 px tall. In a 1280 × 720 window its lower
  entries (Present, the chars count) were cut off and could not be reached by pointer.
- **App workaround:** `shell/top-bar.tsx` gives the content
  `max-h-(--radix-dropdown-menu-content-available-height) overflow-y-auto`, the room Radix
  measures (676.5 px there); the menu then scrolls, and arrow keys scroll the focused item
  into view.
- **Proposed API:** `DropdownMenuContent` caps itself at the available height and scrolls,
  as `SelectContent` does.

## 10. The compact top bar follows the window, not the room beside the sidebar

- **Where:** ui `useIsMobile(breakpoint)` (`packages/ui/src/lib/use-mobile.ts:32`) is a
  viewport media query.
- **Evidence:** the wide row's controls, gaps and padding measure 1,195 px (light theme,
  lakehouse), so the fold point is 1,440 px with the icon rail. With the sidebar expanded
  (256 px) at 1,440 px, the row still shows and the title truncates to 73 px ("Lakehous…"),
  with no overflow.
- **App choice:** `COMPACT_BELOW = 1440`; the header's children never shrink
  (`[&>*:not(h1)]:shrink-0`), so only the title truncates.
- **Proposed API:** a container-width hook (or a `TopBar` overflow menu in ui) that folds
  controls by the header's own width.

## 11. `InspectorPanel` has no small-screen form

- **Where:** `packages/flow/src/inspector-panel/inspector-panel.tsx:56-88` — a fixed
  `width` (default 18rem) reserved beside its host by a spacer.
- **Evidence:** on a 390 px phone (the Canvas tab, re-checked at `90aaa41f`) the open
  inspector left the canvas 102 px wide.
- **App workaround:** on phones `panes/inspector-pane.tsx` passes `width="100%"` and
  `absolute inset-0 z-10 data-[state=collapsed]:pointer-events-none`, so the open inspector
  covers the canvas and the closed one lets the canvas take the pointer; Esc in the form
  closes it and focuses the node (`app.tsx` `CanvasWithInspector` is `relative`).
- **Proposed API:** `InspectorPanel` `overlay` (or a sheet below a breakpoint).
