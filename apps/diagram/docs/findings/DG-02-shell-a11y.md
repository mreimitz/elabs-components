# DG-02 — shell accessibility gaps (wave-0 review)

Source: the wave-0 `brand-ui-reviewer` pass over the DG-02 shell and the DG-03 canvas
(2026-09-26). Axe-core 4.13.0 was run in `light`, `dark` and `qlik-light`. After the app
fixes below, it reports 0 violations in all three themes; before them, it reported
`region` ×15 in each. Each gap is worked around in the app, marked with a
`// P4: library gap` comment, and proposed for the library here.

## 1. `CodeEditor` traps Tab and hides Monaco's accessibility hint (WCAG 2.1.2)

- **Where needed:** `src/panes/editor-pane.tsx`.
- **Evidence:**
  - Inside the editor, Tab, Shift+Tab and Esc-then-Tab all insert indentation. Twelve
    presses took the text from 181 to 205 characters.
  - The only way out is Monaco's `editor.action.toggleTabFocusMode` chord: Ctrl+Shift+M
    on macOS, Ctrl+M elsewhere. Nothing tells the user about it.
  - `packages/editor/src/code-editor/code-editor.tsx:230-236` overwrites the textarea's
    `aria-label`, which drops Monaco's own "Alt+F1 for accessibility options" hint.
- **App workaround:**
  - A caption under the editor states the chord with `Kbd`.
  - The caption is linked through `CodeEditor`'s `ariaDescribedBy`, so the user is
    advised of the way out, as 2.1.2 requires.
  - Verified in the browser: after the chord, Tab moves focus to the resize handle and
    the text stays at 181 characters.
- **Proposed API:** `CodeEditor` `tabExit?: "escape-then-tab" | "chord"` (default
  `"escape-then-tab"`, announced through a live region). `ariaLabel` should append to
  Monaco's default label instead of replacing it.

## 2. `Sidebar` renders no landmark (axe `region`)

- **Where needed:** `src/shell/diagram-shell.tsx`.
- **Evidence:** the sidebar is plain `div`s, so its header, menu and `NavUser` fall
  outside every landmark (15 nodes). The dashboard template has the same violation.
- **App workaround:** `<Sidebar role="navigation" aria-label="Diagram">`. The props
  spread onto `sidebar-container` (`packages/ui/src/components/sidebar/sidebar.tsx:357`).
- **Proposed API:** `Sidebar` renders `<nav>` (or `<aside>` with an `aria-label` prop)
  by default.

## 3. `SkipLink` assumes hash navigation is free

- **Where needed:** `src/shell/diagram-shell.tsx`.
- **Evidence:** `SkipLink` is `<a href="#<targetId>">`
  (`packages/ui/src/components/skip-link/skip-link.tsx:22`). In an app that routes on
  `location.hash` (`#icons`, `#edges`, …), following it navigates away from the current
  route.
- **App workaround:** an `onClick` that calls `preventDefault()` and focuses the target
  directly. Verified: on `#icons/aws`, Enter moves focus to `#diagram-workspace` and the
  hash stays `#icons/aws`.
- **Proposed API:** `SkipLink` focuses its target programmatically by default, keeping
  `href` only as the no-JS fallback.

## 4. Sidebar header does not share the top bar's band

- **Where needed:** `src/shell/diagram-shell.tsx`.
- **Evidence:**
  - `SidebarHeader` with `py-2` is 40 px tall next to the 56 px `h-header` top bar, so
    "Diagram" sat about 8 px above "Untitled diagram".
  - The line was copied from `packages/cli/templates/dashboard.tsx:132`, which has the
    same offset.
  - The `header-band` check misses it because the header has no `border-b`.
- **App workaround:** `<SidebarHeader className="h-header justify-center px-3">`. Both
  bands now measure 56 px.
- **Proposed fix:** the dashboard template and the `header-band` rule should cover a
  `SidebarHeader` without a border.

## 5. Theme switcher marks the current theme visually only

- **Where needed:** the top bar's `ThemeSwitcher`. No app workaround.
- **Evidence:** in `packages/ui/src/components/theme-switcher/theme-switcher.tsx:349-356`,
  theme items are plain `menuitem`s with a check icon. There is no
  `menuitemradio`/`aria-checked`.
- **Proposed fix:** `DropdownMenuRadioGroup`/`DropdownMenuRadioItem`, which the same file
  already uses for families at `:295-301`.

## 6. `ResizableHandle` has no default accessible name

- **Where needed:** `src/app.tsx`.
- **App workaround:** `aria-label="Resize editor and canvas"`. The handle spreads props
  (`packages/ui/src/components/resizable/resizable.tsx:57`).
- **Proposed API:** a default name such as "Resize panels", overridable.

## Wave-2 review additions (2026-09-26)

Found while fixing the wave-2 review's M1, m4, m7 and m9 in the shell (branch
`diagram/wave2-fix-shell`). Evidence: `apps/diagram/.evidence/review-wave2-fixes-shell/`.

### 7. `SidebarProvider` writes its state cookie but never reads it

- **Where needed:** `src/shell/diagram-shell.tsx` (`defaultOpen={false}`, the sidebar now
  starts on the icon rail).
- **Evidence:** `packages/ui/src/components/sidebar/sidebar.tsx:112` writes
  `sidebar_state=<open>` on every toggle. Nothing in the package reads it (grep for
  `sidebar_state` finds only the constant and the write). The pattern assumes a server
  that reads the cookie and passes `defaultOpen`; a client-only app has no such step, so
  a user who opens the sidebar gets the rail back after every reload.
- **App workaround:** none. The app builds no persistence of its own (orchestrator ruling).
- **Proposed API:** an opt-in `persist` prop on `SidebarProvider` (uncontrolled only) that
  reads the cookie for the initial `open`, falling back to `defaultOpen`; or an exported
  `readSidebarState(): boolean | undefined` for client-only consumers.

### 8. `ResizableHandle`: Enter collapses or expands a panel without notifying it

- **Where needed:** `src/app.tsx` (the editor panel is `collapsible`; the top bar's "Canvas
  only" toggle mirrors it through `onCollapse`/`onExpand`).
- **Evidence:** in react-resizable-panels 2.1.9 (the primitive under ui `ResizablePanel`/
  `ResizableHandle`, `packages/ui/src/components/resizable/resizable.tsx:22`), the handle's
  Enter key is handled in `useWindowSplitterPanelGroupBehavior`
  (`dist/react-resizable-panels.browser.esm.js:1179-1203`), which calls the bare `setLayout`
  state setter. Every other path (drag, arrow keys, Home/End, the imperative
  `collapse()`/`expand()`) goes through `callPanelCallbacks`. Measured before the
  workaround: Enter on the collapsed handle expanded the editor to 468 px while
  `onExpand` never fired, so the panel stayed `inert` (visible, but unreachable) and the
  toggle stayed pressed.
- **App workaround:** `onKeyDownCapture` on the handle takes Enter first (the library's
  listener bails on `defaultPrevented`) and calls the panel's imperative
  `collapse()`/`expand()`, which notify (`src/app.tsx:67`, marked `P4: library gap`).
  Verified: Enter, Enter, Home, End, Home, ArrowRight all keep `aria-pressed` and `inert`
  in step.
- **Proposed fix:** ui `ResizableHandle` routes Enter through the panel API itself, or ui
  moves to a react-resizable-panels release whose Enter path notifies (later releases not
  checked).

### 9. No responsive toolbar that folds its overflow into a menu

- **Where needed:** `src/shell/top-bar.tsx` (wave-2 review m7: the bar overflowed by 124 px
  at 390 px).
- **Evidence:** ui `Toolbar` (`packages/ui/src/components/toolbar/toolbar.tsx`) and
  `ViewToolbar` lay out a fixed row; neither measures itself or offers an overflow menu.
- **App workaround:** below 1024 px (`useIsMobile(1024)`) the bar renders a second copy of
  its controls as `DropdownMenu` radio/checkbox items behind one "Diagram options" button
  (`src/shell/top-bar.tsx:200`, marked `P4: library gap`). The switch is viewport-based, so
  it cannot see the sidebar: at 1024 px with the sidebar expanded the heading shrinks to
  161 px (measured) before the menu takes over.
- **Proposed API:** a `Toolbar`/`ViewToolbar` overflow slot (`ToolbarOverflow`) that measures
  the row (a `ResizeObserver` on the container, not the viewport) and moves the trailing
  items into a menu, with each item declaring its menu form (radio group, checkbox, action).

### 10. `Heading`'s `text-balance` defeats `truncate`

- **Where needed:** `src/shell/top-bar.tsx` (wave-2 review m9: the raw `<h1>` became ui
  `Heading level={1}`; `Text` accepts only `as="p" | "span" | "div"`).
- **Evidence:** `headingVariants` starts with `text-balance`
  (`packages/ui/src/components/typography/typography.tsx:84`). With `truncate` added, the
  computed `text-wrap-mode` is `wrap` and the title wraps to two lines (40 px tall in the
  56 px bar at 390 px, measured). Also, `level={1}` defaults to the `display` size, which
  brings `font-display` along even when the caller overrides the size with `text-body`.
- **App workaround:** `size="subtitle"` plus `text-nowrap` in the className (tailwind-merge
  then drops `text-balance`); computed style matches the old `<h1>`: 14 px / 20 px, weight
  500, the body face.
- **Proposed API:** `Heading` drops `text-balance` when a `truncate` intent is given (a
  `truncate?: boolean` prop), and a `size="body"` rung for app-bar titles.
