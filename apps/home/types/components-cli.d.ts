// The CLI ships plain ESM without declarations; these are the entries the site imports.
declare module "@elabs-ai/components-cli/lib/mcp-http.mjs" {
  export function createMcpHttpHandler(options?: {
    manifest?: unknown;
    root?: string | null;
    hosted?: boolean;
  }): (request: Request) => Promise<Response>;
}

// RM-093 — the `/llms.txt` + `/llms/[pkg]` route handlers, `robots.ts`/`sitemap.ts` and the
// root layout's metadata all read the same deterministic renderers/constants the generator
// uses for `apps/docs/public/llms.txt` (`.claude/rules/home.md` "Storybook links resolve").
declare module "@elabs-ai/components-cli/lib/render-docs.mjs" {
  export const HOSTED_DOCS_URL: string;
  export function renderLlmsHub(manifest: unknown): string;
  export function renderLlmsSpoke(manifest: unknown, pkgName: string): string;
}
