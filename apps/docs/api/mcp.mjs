/**
 * Hosted brand-ui MCP server for the Storybook project —
 * https://storybook.elabs-ai.com/mcp (rewritten here from /api/mcp).
 *
 * The PUBLIC /mcp on elabs-ai.com and elabs-components.vercel.app is the website's own
 * route (apps/home/app/mcp/route.ts) since the addresses moved. This one stays because
 * it is a published endpoint someone may have configured, and because the Storybook host
 * answers it with no dependency on the website's deploy. Same tools, same manifest.
 *
 * The lookup tools (info, search, docs, tokens, chart_for) over stateless
 * Streamable HTTP, answered from the committed repo manifest bundled into this
 * function. `audit` reads the caller's files, so it stays in the local server
 * (`npx @elabs-ai/components-cli mcp`). Transport: packages/cli/lib/mcp-http.mjs.
 *
 * vercel.json excludes every .ts/.tsx file from this function's trace. Vercel's
 * Node builder type-checks each TypeScript file it reads, and without the
 * exclusion it walked the whole repo's component source — tens of thousands of
 * errors and a build that never finished. The function is plain .mjs and needs
 * no TypeScript.
 */
import { createMcpHttpHandler } from "@elabs-ai/components-cli/lib/mcp-http.mjs";
// The committed, `pnpm gen`-fresh manifest at the repo root: data, not code, so
// the no-relative-cross-package-import rule does not apply.
import manifest from "../../../brand-ui.manifest.json" with { type: "json" };

const handler = createMcpHttpHandler({ manifest, hosted: true });

export const POST = handler;
export const GET = handler;
export const OPTIONS = handler;
