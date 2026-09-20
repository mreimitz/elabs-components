# `@elabs-ai/home` — the elabs-ai.com website

A Next.js App Router app (ADR 0038, `docs/ADR/0038-home-site-in-apps-home.md`) built only from
`@elabs-ai/*` packages and registry blocks. It owns the domain; Storybook stays its own project and
is reached at `/storybook/`.

## Run

```bash
pnpm site                             # http://localhost:3000 (same as --filter @elabs-ai/home dev)
pnpm --filter @elabs-ai/home build
pnpm --filter @elabs-ai/home start
```

## `/storybook/` locally

Every live example on the site is a Storybook story embedded through `/storybook/`, which
`next.config.ts` rewrites to `STORYBOOK_ORIGIN`. The deployed Storybook only moves on a release, so
a working tree that is ahead of it has stories the release cannot serve. `pnpm site` (the `dev`
script, `scripts/dev.mjs`) handles that:

- It counts how many embedded stories the local static build (`apps/docs/storybook-static`) and
  the deployed Storybook each lack, serves whichever lacks fewer, and prints the count.
- `pnpm site:stories` rebuilds the local Storybook (a few minutes). Run it after adding or
  renaming stories, then start the site again.
- `STORYBOOK_ORIGIN=<url>` set by you always wins. `pnpm --filter @elabs-ai/home dev:next` is plain
  `next dev` against the deployed Storybook.

It has to be a static build: `storybook dev` loads its modules by root-absolute URL, which cannot
sit behind the `/storybook/` sub-path. Keep the trailing slash: Storybook loads its files by
relative URL, so `/storybook` redirects to `/storybook/`, and old `/?path=…` links redirect there
too.

A page never shows one placeholder per missing story. Registry blocks and templates render from
the site's own copy (`components/catalog/block-render-meta.ts`); other pages drop the examples the
live Storybook lacks and say so once (`components/catalog/story-availability.tsx`).

## `/mcp`

`app/mcp/route.ts` serves the hosted brand-ui MCP server from the committed
`brand-ui.manifest.json`, through the same handler as the CLI (`packages/cli/lib/mcp-http.mjs`).
Check it with an `initialize` POST:

```bash
curl -X POST http://localhost:3000/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}'
```

## What the rules forbid

`.claude/rules/home.md` holds the standing rules. In short: `pnpm check --rule home-imports` fails
any import that is not React, Next, `motion`, `@vercel/analytics`, `@elabs-ai/*` or relative;
`--rule home-tokens`, `--rule raw-palette` and `--rule motion-tokens` fail raw colours, palette
utilities and non-token motion anywhere in this app.
