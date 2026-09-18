---
paths:
  - "apps/home/**"
---

# The website (`apps/home`, ADR 0038)

`apps/home` is the elabs-ai.com site: a Next.js App Router app that consumes the library exactly
as a customer would. Storybook stays its own project, reached at `/storybook/` through a rewrite;
`/mcp` is served by `app/mcp/route.ts`. Read `docs/ADR/0038-home-site-in-apps-home.md` before
changing routing, the rewrite or the deploy.

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
