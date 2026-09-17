/**
 * Hosted brand-ui MCP server — https://<docs deployment>/mcp (rewritten here).
 *
 * The lookup tools (info, search, docs, tokens, chart_for) over stateless
 * Streamable HTTP, answered from the committed repo manifest bundled into this
 * function. `audit` reads the caller's files, so it stays in the local server
 * (`npx @elabs-ai/components-cli mcp`). Transport: packages/cli/lib/mcp-http.mjs.
 */
import { createMcpHttpHandler } from "@elabs-ai/components-cli/lib/mcp-http.mjs";
// The committed, `pnpm gen`-fresh manifest at the repo root: data, not code, so
// the no-relative-cross-package-import rule does not apply.
import manifest from "../../../brand-ui.manifest.json" with { type: "json" };

const handler = createMcpHttpHandler({ manifest, hosted: true });

export const POST = handler;
export const GET = handler;
export const OPTIONS = handler;
