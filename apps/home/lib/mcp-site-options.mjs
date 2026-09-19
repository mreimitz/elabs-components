/**
 * The exact options this site's own `/mcp` route (`apps/home/app/mcp/route.ts`) passes to the
 * shared hosted handler (`@elabs-ai/components-cli/lib/mcp-http.mjs`'s `createMcpHttpHandler`):
 * `siteRoutes: true`, because this site's `/storybook/` rewrite and (once RM-105 ships it) `/r`
 * route are real — unlike `apps/docs/api/mcp.mjs`'s copy or the stdio server, which stay on the
 * DEFAULT link forms (wave-3 ruling 18).
 *
 * `scripts/gen-home.mjs` imports this SAME object (never a second, hand-typed copy) to build the
 * "Ask your agent" offline fallback (`apps/home/content/generated/agent-loop-recorded.json`,
 * RM-099) through `handleMessage` directly, so the recorded answers can never drift from what
 * this route actually serves (wave-3 ruling 8, W3-M1). Plain `.mjs` (see the sibling `.d.mts`
 * for its type) so `node scripts/gen-home.mjs` can import it with no build step.
 */
export const HOME_MCP_OPTIONS = { hosted: true, siteRoutes: true };
