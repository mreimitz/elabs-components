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
