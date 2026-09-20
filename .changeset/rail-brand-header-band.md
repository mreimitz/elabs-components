---
"@elabs-ai/components-cli": patch
---

The nav rail’s brand row in the `app-shell` and `workspace-shell` registry blocks is now a header band: it takes the shared `h-header` height and a bottom rule, so it lines up with the top bar beside it in every theme and at every density. It used to be content-sized (30px inside the sidebar header’s padding) next to a 56px top bar. Every `*-page` template built on `workspace-shell` gets the fix. If you copied either block, give the brand row `h-header shrink-0 items-center border-b border-sidebar-border px-3` and set the surrounding `SidebarHeader` to `gap-0 p-0`.
