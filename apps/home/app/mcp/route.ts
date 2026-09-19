/**
 * Hosted brand-ui MCP server — https://elabs-ai.com/mcp (ADR 0038 §4).
 *
 * The lookup tools (info, search, docs, tokens, chart_for) over stateless Streamable HTTP,
 * answered from the committed repo manifest bundled into this route. `audit` reads the caller's
 * files, so it stays in the local server (`npx @elabs-ai/components-cli mcp`). The transport is
 * shared with apps/docs/api/mcp.mjs, which keeps serving /mcp from the Storybook project until
 * the domain moves: both are thin adapters over packages/cli/lib/mcp-http.mjs.
 *
 * Stateless on purpose: no Mcp-Session-Id, so any instance answers any request and nothing has
 * to survive between invocations.
 */
import { createMcpHttpHandler } from "@elabs-ai/components-cli/lib/mcp-http.mjs";
// The committed, `pnpm gen`-fresh manifest at the repo root: data, not code.
import manifest from "../../../../brand-ui.manifest.json";

// This site's own /storybook/ rewrite and (once RM-105 ships it) /r route are real, so its
// hosted URLs use them — unlike apps/docs/api/mcp.mjs's handler, which has neither yet.
const handler = createMcpHttpHandler({ manifest, hosted: true, siteRoutes: true });

export { handler as GET, handler as POST, handler as OPTIONS };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
