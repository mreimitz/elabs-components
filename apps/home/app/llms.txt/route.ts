/**
 * The `llms.txt` hub (ADR 0038 §6, concept §6 "Agent surface on the site"). Same renderer the
 * generator writes to `apps/docs/public/llms.txt` (`packages/cli/lib/render-docs.mjs`, content
 * fixed by RM-100) — an agent landing on either URL reads the identical hub, hosted MCP first.
 */
import { renderLlmsHub } from "@elabs-ai/components-cli/lib/render-docs.mjs";
// The committed, `pnpm gen`-fresh manifest at the repo root: data, not code (mirrors `app/mcp/route.ts`).
import manifest from "../../../../brand-ui.manifest.json";

export function GET() {
  return new Response(renderLlmsHub(manifest), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export const dynamic = "force-static";
