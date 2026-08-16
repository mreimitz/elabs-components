# Enterprise app baseline — the default skeleton

_Props are **verified against the `@elabs/components-*` v1.0.0 source** (vendored tarballs). Re-confirm
with `brand-ui docs <Component>` if the version changes._

Every **professional** brand-ui app starts from this skeleton. The agent must put
all of it in place by default — not on request. (Marketing surfaces are the
exception: see §0.) This is the "definition of a brand-ui app," not a menu.

---

## 0. Step one — classify, then pick the shell (do this FIRST)

Before any component, decide the surface type (see
`professional-vs-marketing.md`) and pick the shell.
**The shell is chosen at the very beginning and is hard to change later — get it right up front.**

| App style / archetype          | Shell to start from                                | Notes                                                    |
| ------------------------------ | -------------------------------------------------- | -------------------------------------------------------- |
| Dashboard (KPIs, overview)     | `template-dashboard` → `sidebar-02`                | collapsible-icon sidebar + inset content + team switcher |
| Data app / admin / back-office | `template-data-app` → `sidebar-02`                 | sidebar + DataTable workspace                            |
| Mail / list–detail / triage    | `sidebar-04`                                       | three-column mail shell                                  |
| Nested or dual navigation      | `sidebar-05`                                       | double-sided sidebar                                     |
| AI assistant / copilot         | `template-ai-assistant`                            | sidebar + `ChatShell`                                    |
| Flow / pipeline / canvas       | `template-flow-workspace`                          | sidebar + `CanvasShell`                                  |
| Settings-heavy portal          | `template-settings`                                | sidebar-switched sections                                |
| **Marketing / presales**       | **`template-marketing` — TopNav only, NO sidebar** | expressive register; the exception                       |

See **`shell-and-navigation.md`** for the two shell archetypes (tool/workspace vs
enterprise admin), the navigation-type catalog, and canonical snippets (app icon,
theme switcher, settings modal) lifted from shipping qLabs apps.

How to discover them in-repo: `brand-ui search sidebar` (registry blocks
`sidebar-02` dashboard, `sidebar-04` mail, `sidebar-05` double-sided) and
`brand-ui search template-` (per-archetype full pages). Every professional template
is a **collapsible app-shell sidebar + archetype content**. (Shell/template IDs named in this
skill are indicative — confirm the current ones with `brand-ui search`.)

**Frame primitive:** `AppShell` (`@elabs/components-ui`) is the top-level frame —
slots `sidebar` (a `<Sidebar/>`/`<AppSidebar/>`), `topNav` (a `<TopNav/>`), and
`children` (scrolling main, `mainClassName` to style). Compose the chosen shell
inside it. For bespoke shells use `SidebarProvider` + `Sidebar` + `SidebarInset`.

---

## 1. Mandatory chrome — every professional app gets these by default

### 1a. Collapsible Qlik app icon + matching favicon

- **Component:** `BrandLogo` (`@elabs/components-icons`). `variant="lockup"` = Q + "Qlik"
  wordmark (default, height 28); `variant="mark"` = the Q glyph only.
- **Placement:** in the sidebar header (`AppSidebar` `header` slot).
- **Collapse behavior:** show `lockup` when the sidebar is expanded, swap to `mark`
  when collapsed-to-icon — driven by the sidebar's collapsed state (`useSidebar`).
- **Favicon:** set the document favicon to the **Qlik mark** so the browser tab
  matches the in-app icon. (App-level asset step, not a component — wire it in
  `index.html` / the head; export the mark SVG from `@elabs/components-icons`.)

### 1b. Theme switcher — System / Light / Dark

- **Components:** `ThemeProvider` (`@elabs/components-tokens`, wrap the app root, persists
  choice) + `ThemeSwitcher` (`@elabs/components-ui`, a self-contained button).
- **Placement:** `TopNav` `end` slot (always reachable), and mirrored in the
  Settings modal's Appearance section (§1c).
- **Options to expose:** **System · Light · Dark.** "System" follows the
  OS and resolves across the light / dark pair (`DEFAULT_THEME_PAIR`).
- **Default theme:** `light`.
- ✅ **Verified:** the library `<ThemeSwitcher />` (`@elabs/components-ui`) already does
  this out of the box — its `themes` prop **defaults to the Qlik light/dark pair** and
  `showSystem` **defaults to `true`**, so a bare `<ThemeSwitcher />` renders **System /
  Light / Dark** (whole-screen animated transition, reduced-motion safe). Use
  it directly. A curated labeled `Select` (`assets/theme-switcher.tsx`) is an optional
  alternative if you want text labels instead of the icon toggle.

### 1c. Settings panel — as a modal, by default

- **Pattern:** a `Dialog` (`@elabs/components-ui`) opened from a gear/account control in the
  `TopNav` `end` slot. Inside: a small section nav or `Tabs` with at least an
  **Appearance** section (hosting the theme switcher) plus app preference sections.
- **Why modal:** keeps the user on their work surface (rulebook R012/R033 — preserve
  context) instead of navigating to a settings page for quick changes.
- **Modal vs route — the boundary** (this deliberately overrides the `settings`
  _playbook_ default of a full sidebar-switched page). **Test:** quick + device-level
  → **modal**; deep + shareable + multi-section → **route**.

  | Shape                                  | When                                                                                                                                                                   | `@brand`                                         |
  | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
  | **Modal `Dialog`** (baseline default)  | Quick, always-available, device/appearance prefs (theme, density, notifications); few sections; no deep-linking need; reached from the top-bar gear                    | `Dialog` — reuse `../assets/settings-dialog.tsx` |
  | **Dedicated route/page**               | Deep or numerous config (account, org, billing, integrations, security, token/profile config); needs deep-linkable/shareable URLs; multi-section nav; admin-only areas | routed `PageShell` (the `settings` playbook)     |
  | **Hybrid** (recommended for real apps) | Both: a quick-settings modal (Appearance + a "View all settings" link) **plus** a full Settings route for deep config                                                  | `Dialog` + routed `PageShell`                    |

- **Destructive items inside:** `AlertDialog` with a named consequence (never
  destructive-on-click).

### 1d. Sonner messaging system

- **Components:** mount `<Toaster />` (`@elabs/components-ui`, Sonner) **once** at the app root;
  fire with `toast(...)` from anywhere.
- **Discipline (rulebook R040–R041):** toast for async results and confirmations
  ("Export finished", "Changes saved"), **not** for obvious in-context actions
  (opening a tab, expanding a row). Inline `role="alert"` for form validation, not toasts.

### 1e. Right-side context / detail panel (preserve the work surface)

- **Which to use (verified):**
  - **AI workspace** → the `ContextPanel` family lives in **`@elabs/components-ai`** (not `@elabs/components-ui`):
    `ContextPanelProvider` (`defaultOpen` true; controlled `open`/`view` root↔detail +
    `selectedAsset`), `ContextPanel` (`width` default `"20rem"`), `ContextPanelHeader`/
    `Body`/`Section`/`Detail`/`Trigger`, `useContextPanel`. It models produced **assets**
    (markdown/code/sql/csv/image) with grounding/sources/status — purpose-built for agent
    output, animated, reduced-motion safe.
  - **Generic** record detail / inspector on non-AI surfaces → a right `Sheet` or `Drawer`
    (`@elabs/components-ui`, `side="right"`), or an inspector `<aside>` (the archetype-A tool-shell
    already provides one). Same "preserve the work surface" intent, lighter API.
- **Why it matters:** realises "preserve the work surface" (rulebook R012/R024/R033) —
  show detail beside the list instead of a page jump.

---

## 2. Root wiring (once, at the app root)

```
import "@elabs/components-tokens/styles.css";
// providers, outermost → in:
<ThemeProvider defaultTheme="light">      // 1b — theme + persistence
  <SidebarProvider>                             // 0  — shell state (collapse)
    {/* AI workspaces only: wrap in <ContextPanelProvider> from @elabs/components-ai (1e) */}
      <AppShell sidebar={<AppSidebar header={<BrandLogo/>} …/>}  // 0 + 1a
                topNav={<TopNav end={<>…ThemeSwitcher…SettingsTrigger…</>}/>}>
        {/* routed page content */}
      </AppShell>
      {/* 1e: AI → <ContextPanel/> (@elabs/components-ai); generic detail → Sheet/Drawer (side="right") */}
  </SidebarProvider>
  <Toaster/>                                     // 1d — once, at root
</ThemeProvider>
// + set the favicon to the Qlik mark in index.html head (1a)
// flow apps also: import "@xyflow/react/dist/style.css"
```

Provider nesting/exact props are indicative — confirm with `brand-ui docs`.

---

## 3. Definition of done — baseline checklist

A new professional app is not "scaffolded" until all are true:

- [ ] Surface classified (professional/consumer/marketing) and **register stated**.
- [ ] Correct **app shell** chosen for the style (table §0), inside `AppShell`.
- [ ] **Qlik app icon** in the sidebar header, **collapsing** lockup↔mark.
- [ ] **Favicon** set to the Qlik mark.
- [ ] **ThemeProvider** at root (`defaultTheme="light"`); **ThemeSwitcher**
      in the TopNav exposing **System / Light / Dark**; choice persists.
- [ ] **Settings modal** reachable from the chrome, with an Appearance section.
- [ ] **`<Toaster/>`** mounted once; feedback uses `toast()` with R040–R041 discipline.
- [ ] **Right-side detail panel** present (generic → `Sheet`/`Drawer` or inspector `aside`; AI → `@elabs/components-ai` `ContextPanel`).
- [ ] Every state designed (default/hover/focus/active/disabled/loading/empty/error).
- [ ] Semantic tokens only; reads correctly in light + dark.

---

## Component reference (exact names, brand-ui v1.0.0)

| Need                       | Component (package)                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Top-level frame            | `AppShell` · `AppSidebar` · `TopNav` (`@elabs/components-ui`)                                                                                                                                           |
| Shell primitives           | `SidebarProvider`/`Sidebar`/`SidebarInset`/`SidebarTrigger`/`useSidebar` (`@elabs/components-ui`)                                                                                                       |
| Ready shells               | `sidebar-02` · `sidebar-04` · `sidebar-05` (registry)                                                                                                                                                   |
| App icon                   | `BrandLogo` (`variant` mark\|lockup) (`@elabs/components-icons`)                                                                                                                                        |
| Theme                      | `ThemeProvider`/`useTheme`/`THEMES`/`THEME_META` (`@elabs/components-tokens`) · `ThemeSwitcher` (`@elabs/components-ui`; `themes` defaults to Qlik pair, `showSystem` default true → System/Light/Dark) |
| Settings modal             | `Dialog` + `Tabs` + `AlertDialog` (`@elabs/components-ui`)                                                                                                                                              |
| Toasts                     | `Toaster` + `toast` (`@elabs/components-ui`, Sonner)                                                                                                                                                    |
| Right detail panel         | generic → `Sheet`/`Drawer` (`@elabs/components-ui`, `side="right"`) or inspector `aside`; AI → `ContextPanel*` + `useContextPanel` (**`@elabs/components-ai`**)                                         |
| Command palette (optional) | `Command`/`CommandDialog` (`@elabs/components-ui`)                                                                                                                                                      |
