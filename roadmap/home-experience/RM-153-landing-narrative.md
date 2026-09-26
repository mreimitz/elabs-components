---
id: RM-153
title: "Landing narrative: “pick your world” domain entry on `/` and `/templates`, theme-family swap on template pages"
status: done
priority: P1
effort: M (2 days)
wave: 3
depends_on: [RM-148, RM-150, RM-151]
blocks: []
agent: brand-ui-component-builder
model: sonnet
touches:
  - apps/home/components/gallery/sections.tsx (a domain row above the showcase)
  - apps/home/app/(catalog)/templates/page.tsx (domain grouping)
  - apps/home/components/catalog/template-story.tsx (theme-family control on the screen)
  - apps/home/content/template-tours.ts (`domain` per template)
  - apps/home/e2e (theme-sweep covers a template page)
source: docs/review/2026-09-23-home-experience.md §1 g
---

# RM-153 Landing narrative

## Finding

"What are you building?" is a grid of six; a visitor from a domain has to know the product name to find their world, and cannot see a template in a brand family without leaving the page.

## Change

- Each tour entry names a `domain` (operations, revenue, support, agents, security, energy, engineering …). `/` gets a row of domains that scrolls the showcase to that world; `/templates` groups by domain.
- A template page's screen gets the theme-family control (the built-in themes + the shipped families), persisted through `ThemeProvider` like the shell's own switcher.

## Acceptance

- Every template belongs to a domain; the row on `/` links to a live anchor; the family control re-themes the native screen without reload.

## Test / gate

`pnpm --filter home build`, e2e theme-sweep + keyboard, `lhci`.

## Orchestrator notes

Last; only worth it once wave 2 gives the domains more than one product each side of business ops.

## Outcome (2026-09-23)

Every template now resolves a domain: the 14 toured ones through their tour, the two untoured AI products through `UNTOURED_DOMAINS`, the nine starters through a new `starters` domain (`templateDomainOf`, unit-tested against the catalogue). `/` gets a `DomainRow` under "What are you building?" — eight pills (domain + count) that link to `/templates#<domain>` rather than scrolling the showcase in place: a cross-page anchor is the same one the index owns, works with JavaScript off and lands on the domain's heading (`scroll-mt` clears the top bar). `/templates` now opens with the same row, keeps the nine live highlights, then "Pick your world": one section per domain (heading = anchor, one-line lead) with a compact card per template — audience question, name, pitch and up to four of the views its navigation names. No frames in the world sections (a front page never draws its whole branch); the Storybook families keep `/templates/group/<family>` and the rail. Every template page grows a theme bar above the live screen — the library's own `ThemeSwitcher`, persisted through `ThemeProvider`, so the native template and any Storybook-frame view re-skin in place without a reload. Copy lives in `catalogCopy.worlds`/`template.themeCaption`.

Verified: vitest (`template-tours.test.ts` + 51 existing), typecheck, eslint, `pnpm gen && pnpm check` 90/90, home build (604 pages), `home-bundle` + `bundle-budget` (initial JS 1004.7 KB, under the 1038.9 KB budget and below the ratchet), e2e `tour-tabs` (index reaches every template by world; the home row's anchors match live `h2` ids), `template-page`, `theme-sweep` (now also the default and one shipped family × light/dark on `/templates/customer-360`, asserting one navigation entry), `smoke`, `a11y`; axe on `/templates` and a template page in both modes: no serious/critical (the moderate landmark notes are the pre-existing shell-inside-a-page ones). Real Chromium screenshots of the built site in light + dark at 1440 and 390: row wraps cleanly, `/templates#agents` lands on the heading, the theme bar switches a family and the screen follows. One local Lighthouse desktop run on `/` (2-core sandbox): accessibility 0.99, best practices 0.96, SEO 1.0, CLS 0.004 pass; performance 0.70 / TBT 620 ms did not clear the gate here — the change adds only server-rendered HTML and the initial JS shrank, so CI's three-run median on its runner is the reading that counts.

## Reverted (2026-09-26)

The per-page theme bar is gone, at the maintainer's request: themes are picked in the app shell (top bar and agent panel), never in a bar inside a page. The same removal took the matching bar off the component wall on `/`. Do not re-add an in-page theme control; `theme-sweep` still proves a template's native screen re-themes in place, now through the shell's switcher.
