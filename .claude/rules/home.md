---
paths:
  - "apps/home/**"
---

# The website (`apps/home`, ADR 0038)

`apps/home` is the site behind `elabs-ai.com` AND `elabs-components.vercel.app` — the same Vercel
project, and both addresses must behave identically. It is a Next.js App Router app that consumes
the library exactly as a customer would. Storybook is its own Vercel project on
`storybook.elabs-ai.com`, reached at `/storybook/` through a rewrite; `/mcp` is served by
`app/mcp/route.ts`. Read `docs/ADR/0038-home-site-in-apps-home.md` (§2 and § Operations) before
changing routing, the rewrite or the deploy, and prove a deploy with
`node scripts/site-smoke.mjs <base-url>` on BOTH addresses.

## Standing rules

- **Library only.** Import React, Next, `motion`, `@vercel/analytics`, `lucide-react`,
  `@elabs-ai/*` and copy-own registry blocks (copied into `apps/home/components/blocks/` with
  their `// registry: <name> — copied <YYYY-MM-DD>` provenance header). No other UI dependency.
  `pnpm check --rule home-imports` enforces it.
- **Tokens only.** No raw colour, no non-token duration/easing, no arbitrary Tailwind values
  outside `app/globals.css`, which may only reference `var(--…)`. `pnpm check --rule home-tokens`,
  `--rule raw-palette` and `--rule motion-tokens` all scan `apps/home`.
- **Generated, not typed.** Any count, list of packages/themes/gates/verbs/blocks, or install
  command comes from `apps/home/content/generated/*.json`, never typed by hand; `pnpm gen:check`
  fails on drift.
- **Motion under the gate.** Everything animated rides `--motion-factor`;
  `prefers-reduced-motion: reduce` removes parallax, drift, count-ups and staggers and keeps
  opacity crossfades. Animate `transform`/`opacity` only.
- **Decoration policy applies.** Grounds paint on masked `::before` layers; nothing paints or
  animates inside a control.
- **Honest copy.** No superlatives, no "#1", no invented testimonials, no counters until the
  maintainer switches them on. The scope line (D5) stays visible under the agent loop.
- **Heavy packages load per section.** Monaco, MapLibre, React Flow, Milkdown, the process package
  and the terminal package are dynamic imports behind the tab or section that needs them; the hero
  ships only `tokens`, `ui`, `icons`, `charts`, `data`, `ai`, `marketing`.
- **Storybook links resolve.** Every "Open in Storybook" target is a story id from
  `apps/home/content/generated/story-ids.json` and is checked at build.

## Routing invariants (ADR 0038 §2)

- `/storybook` redirects to `/storybook/`; only `/storybook/:path*` is rewritten to
  `STORYBOOK_ORIGIN`. Storybook loads its assets by relative URL, so the trailing slash is
  load-bearing — keep `skipTrailingSlashRedirect: true`.
- `/?path=…` and `/iframe.html` redirect (308) into `/storybook/`, so every shared deep link keeps
  working.

## Catalogue structure (2026-09 reorganisation)

- **Explore is use cases, Components is components.** Explore = Templates, Blocks, Visualizations
  (KPI/stat cards, infographics, editorial charts, command centers). Every
  chart type is a component under Components → charts; there is no `/charts` section. Where a
  Storybook page is filed — section, package, family, highlights — is authored once in
  `scripts/lib/home-catalog-layout.json`; the generator fails on a name it does not know.
- **A front page never draws its whole branch.** `/blocks`, `/components/<pkg>` show the
  highlights (≤ 12) and a family directory; a family's full list lives at
  `…/group/<family>` (`components/catalog/listing.tsx`). A live thumbnail is a Storybook frame —
  a hundred on one page is what made the catalogue slow (`e2e/js-off.spec.ts` guards the cap).
- **Never remove a Storybook thumbnail frame while the page lives.** `StoryThumb` points a
  far-away frame at `about:blank` instead: removing a frame whose story holds focus throws inside
  React's commit and takes the page down. It also wraps the story's `focus` so a play function
  neither scrolls the listing nor steals the page's keyboard focus.
- **A moved page keeps its old address.** `content/generated/catalog-redirects.json` (generated,
  one 308 per moved page) feeds `next.config.ts`; `gen-home.test.mjs` checks none hides a live page.
