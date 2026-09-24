---
"@elabs-ai/components-ui": patch
---

App shells no longer rubber-band. Scrolling past the top or bottom of `AppShell`'s `<main>`, a `PageShell` with `scroll="content"`, or a `SidebarContent` rail used to hand the leftover scroll to the page, and on macOS and iOS the elastic bounce then dragged the whole frame, top bar included. Each of these scroll areas now sets `overscroll-behavior: contain`, so the leftover scroll stays inside it. The copy-own shell blocks (`app-shell`, `sidebar-02`, `sidebar-04`, `sidebar-05`, `workspace-shell`) do the same for their own scroll areas. A scroll that starts outside every scroll area, such as over the top bar, can still reach the page. To stop that too, set `html { overscroll-behavior-y: none }` in a viewport-locked app.
