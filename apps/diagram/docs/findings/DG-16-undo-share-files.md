# DG-16 — undo, share links and files: library gaps

Measured while hardening DG-16 (2026-09-26) against `diagram/integrate` at `de58eeb6`, in the
app's dev server (React 19 StrictMode) and in `agent-browser`.

## 1. `IconButton` cannot show a keyboard shortcut

- **Where:** `packages/ui/src/components/icon-button/icon-button.tsx:17-49`
  (`IconButtonProps`: `label`, `icon`, `size`, `disabledReason`, `side`). The tooltip text is
  `label`, or `label — disabledReason` (`:80`).
- **Evidence:** the plan asks for Undo and Redo with their shortcut shown. There is no slot
  for a `Kbd` in the tooltip. Putting the shortcut into `label` would also put it into the
  accessible name.
- **App workaround:** `io/document-controls.tsx` passes `aria-keyshortcuts` through to the
  button, which announces the shortcut. Nothing is shown visually.
- **Proposed API:** `IconButton` `shortcut?: string[]`, for example `["⌘", "Z"]`. It renders
  `Kbd`s in the tooltip, outside the accessible name, and sets `aria-keyshortcuts`.

## 2. A toast from the first effects is lost unless `Toaster` mounts before them

- **Where:** ui `Toaster` (`packages/ui/src/components/sonner/sonner.tsx:80`), which wraps
  sonner 1.7.4. The host subscribes to `toast()` in an effect, and a toast published before
  that subscription is dropped.
- **Evidence:** a share link that cannot be read is reported from `DocumentControls`'s
  first effect. With `<Toaster />` placed after `<App />`, no toast appeared. Placed
  before `<App />`, the toast "This share link could not be read" showed.
- **App workaround:** `main.tsx` renders `<Toaster />` before `<App />`, with a comment
  saying why. DG-14 mounts it there, once for every wave-3 item that toasts.
- **Proposed fix:** a note in the `Toaster` docs, or a `Toaster` that shows toasts queued
  before it mounted.

## 3. `ConfirmDialog` without a trigger drops focus

This is the same gap as DG-13 (`DG-13-examples-review.md`). The "Open over edits" dialog
returns focus by hand, the way DG-13 does (`setTimeout(() => element.focus())`).

## 4. `CodeEditor`'s `path` cannot start a new undo history

Found fixing the wave-3 review's M2 (⌘Z in the editor undid across a document load), 2026-09-27.

- **Where:** `packages/editor/src/code-editor/code-editor.tsx:284-304` (the `path` effect) and
  `:306-322` (the controlled-value sync). A changed `path` creates the new model from
  `current?.getValue()`, the OLD model's text (`:291-292`). The new `value`, which arrives in
  the same render, is then applied by `executeEdits("controlled-value-sync", …)`, so it lands
  on the new model's undo stack.
- **Evidence:** with `path={`diagram-${loadCount}.yaml`}` on the app's `CodeEditor`, loading
  ClickHouse (3,071 chars) and pressing ⌘Z in the editor brought the whole Lakehouse text back
  (3,367 chars, heading "Lakehouse on AWS…", app Undo enabled), exactly as without `path`.
- **App workaround:** `panes/editor-pane.tsx` keys `CodeEditor` on the store's `loadCount`, so
  every load mounts a new editor whose model starts from the loaded text (Monaco's undo stack
  begins at the load). `onMount` records the new instance; the marker, highlight and "Show in
  YAML" effects re-run against it.
- **Proposed API:** seed the swapped-in model from `value` when `value` is controlled, or add
  `historyKey?: string | number`: when it changes, the model's value is replaced with
  `setValue` (which clears the undo stack) instead of `executeEdits`. Document it as the
  "new document" lever.

## Build note (not a library gap)

The reference code (29d9986c) focused a still-mounted element that React was about to
unmount, so an undo or redo that removed the focused node dropped focus to `<body>`;
`state/history.ts` `restore()` now sends focus to the workspace in that case (DG-16 build,
2026-09-27).
