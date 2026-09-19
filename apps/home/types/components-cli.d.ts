// The CLI ships plain ESM without declarations; these are the entries the site imports.
declare module "@elabs-ai/components-cli/lib/mcp-http.mjs" {
  export function createMcpHttpHandler(options?: {
    manifest?: unknown;
    root?: string | null;
    hosted?: boolean;
    // Where this instance's own URLs point, and whether its site actually serves
    // `/storybook/` + `/r` (RM-100 follow-up, wave-3 ruling 18) — `apps/home/app/mcp/route.ts`
    // passes `siteRoutes: true` since this site's own routes are real.
    siteOrigin?: string;
    siteRoutes?: boolean;
  }): (request: Request) => Promise<Response>;
}

// RM-093 — the `/llms.txt` + `/llms/[pkg]` route handlers, `robots.ts`/`sitemap.ts` and the
// root layout's metadata all read the same deterministic renderers/constants the generator
// uses for `apps/docs/public/llms.txt` (`.claude/rules/home.md` "Storybook links resolve").
declare module "@elabs-ai/components-cli/lib/render-docs.mjs" {
  export const HOSTED_DOCS_URL: string;
  export function renderLlmsHub(
    manifest: unknown,
    // Same siteOrigin/siteRoutes pair as createMcpHttpHandler above (RM-100 follow-up).
    options?: { siteOrigin?: string; siteRoutes?: boolean },
  ): string;
  export function renderLlmsSpoke(manifest: unknown, pkgName: string): string;
}
