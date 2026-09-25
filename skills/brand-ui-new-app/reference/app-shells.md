# App shells (the frame every screen lives in)

The **app shell** is the frame around every screen — nav rail, top bar, and
whatever right-hand surface the app has. It is the single most visible decision
in a new or migrated app, and it is **always asked**, never defaulted silently:
the archetype templates ship in a bare `SidebarProvider` + `Sidebar` +
`SidebarInset` frame that exists only so the Storybook story renders. That bare
frame is **not** one of the library's shells, and an app that ships in it looks
unfinished (a plain rail, a one-word header, nothing else). Both flows — new app
and migrate — pick one of the five shells below and put the screens in it.

The five shells are the five entries under Storybook **Layout/App Shell**. Each
is a copy-own registry block; `brand-ui scaffold` lays the block down in
`src/components/<block>/` and renders the archetype screen inside it, from the
spec's `shell` field. In a migration the same block arrives via
`npx shadcn add <registry>/<block>.json` and the app's screens become its children.

| `shell`        | Storybook story                 | Registry block    | Shape                                                                                                                                                           | Reach for it when                                                                                                  |
| -------------- | ------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `flagship`     | `Layout/App Shell/Flagship`     | `workspace-shell` | Nav rail (groups, badges, signed-in user) + top bar with breadcrumb trail, ⌘K search, notifications, theme switch + a **summoned** right-hand dock (`SideDock`) | The default. Any product whose navigation fits one tree; the frame every full-screen template sits in.             |
| `dashboard`    | `Layout/App Shell/Dashboard`    | `sidebar-02`      | Collapsible nav rail with tenant switcher + **inset content card** + a **permanent** details rail on the right (`ContextRail`, rests as a 48px icon strip)      | Briefing screens where the details of what you look at must always be one glance away; multi-tenant consoles.      |
| `mail`         | `Layout/App Shell/Mail`         | `sidebar-04`      | Three zones: icon rail, searchable list column, reading pane — one floating inset surface                                                                       | List-and-detail triage: mail, tickets, approvals, any queue you work through one item at a time.                   |
| `double-sided` | `Layout/App Shell/Double-Sided` | `sidebar-05`      | Two navigation levels — a permanent 56px icon rail picks the area, a collapsible second panel lists its sections — plus a summoned history dock                 | Nested navigation: settings/admin portals, anything with areas × sections.                                         |
| `minimal`      | `Layout/App Shell/Minimal`      | — (none)          | The template's own bare `SidebarProvider` frame (the `AppShell` primitive's shape): a rail, a one-line header, the screen                                       | Only when the person explicitly wants to build their own frame from the primitives. A starting point, not a shell. |

`marketing` has no app shell (top nav + single scroll) — the question is skipped
for it.

## How to ask (both flows)

One `AskUserQuestion` round, one question, the four real shells as options
(recommend `flagship`; the harness adds "Other" — `minimal` lives there for the
person who wants to build a frame themselves):

> **Which app shell should the screens live in?**
>
> - **Flagship (recommended)** — nav rail + top bar with trail and search, a
>   side panel you summon when you need it. The library's own frame.
> - **Dashboard** — nav rail + inset content card + a details rail that is
>   always there on the right.
> - **Mail** — icon rail + list column + reading pane, for working through a
>   queue.
> - **Double-sided** — icon rail + section panel for nested navigation, plus a
>   history dock.

**Run the visual loop on it** (`visual-loop.md`): the four stories above render
in Storybook (`layout-app-shell-flagship--default`,
`layout-app-shell-dashboard--default`, `layout-app-shell-mail--default`,
`layout-app-shell-double-sided--default`) — show them before the person picks,
never decide a frame on prose. Skip the question only when the description
already names the shell ("in the flagship shell", "mail-style").

Record the answer as `"shell": "<id>"` in the Machine spec (new app) or in
`migration/plan.md` (migrate). Never leave it out: a spec without `shell` gets
`flagship` from the CLI, which is a floor, not a decision the person made.

## What the scaffold does with it

- Copies the block's files into `src/components/<block>/` (only the files the
  shell entry reaches — `workspace-shell` does not drag in its assistant).
- Rewrites `src/App.tsx` so the archetype screen is the shell's `children`; the
  template's bare frame is gone. For `flagship` the template's `nav` list and
  `active` state drive the rail (`nav` / `activeId` / `onNavigate` / `trail`).
  For `dashboard` / `mail` / `double-sided` the rail is the block's own
  `nav-items.ts` — the scaffold prints a `TODO(spec)` to carry the spec's
  surfaces into it.
- Adds the block's own dependencies (`…-charts` and `@visx/curve` for the
  dashboard shell, say) to `package.json`, the `@source` lines and the install
  handoff.
- Writes the chosen shell into `CLAUDE.md` ("the frame is the **flagship** app
  shell … never hand-roll a second `SidebarProvider` frame").

`minimal` copies nothing and leaves the template's frame — say so to the person.
