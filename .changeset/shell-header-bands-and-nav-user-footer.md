---
"@elabs-ai/components-ui": minor
"@elabs-ai/components-ai": patch
---

App shell headers now share one height in every theme. `SideDock`'s header is a fixed `h-header` band (its `description` moves to the top of the body), and `ChatShell`'s header and `ContextPanelHeader` use `h-header` too, so they line up with the top bar even when a theme retunes `--header-size`. `ContextRail` no longer draws an edge line or a leading bar on the active switcher icon, and its count badge is no longer clipped. `NavUser` is now the standard sidebar footer: the user row opens an account menu with Settings (`settingsHref` or `onSettings`) and Sign out (`onSignOut`), plus any extra items passed as `children`; its previous placeholder items (Upgrade to Pro, Account, Billing, Notifications) are gone. A collapsed `Sidebar` no longer clips `lg` menu buttons: the icon-rail padding now lives per size, so the footer avatar sits whole in its 32px square.
