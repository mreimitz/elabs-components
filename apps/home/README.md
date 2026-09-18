# `@elabs-ai/home` — the elabs-ai.com website

A Next.js App Router app (ADR 0038, `docs/ADR/0038-home-site-in-apps-home.md`) built only from
`@elabs-ai/*` packages and registry blocks. It owns the domain; Storybook stays its own project and
is reached at `/storybook/`.

## Run

```bash
pnpm --filter @elabs-ai/home dev      # http://localhost:3000
pnpm --filter @elabs-ai/home build
pnpm --filter @elabs-ai/home start
```

## `/storybook/` locally

`next.config.ts` rewrites `/storybook/:path*` to `STORYBOOK_ORIGIN` (default: the production
Storybook project). To use a local Storybook, run it on port 6006 (`pnpm storybook`) and start
the site with `STORYBOOK_ORIGIN=http://localhost:6006`. Keep the trailing slash: Storybook loads
its files by relative URL, so `/storybook` redirects to `/storybook/`, and old `/?path=…` links
redirect there too.

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
