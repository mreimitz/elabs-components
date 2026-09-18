// The CLI ships plain ESM without declarations; this is the one entry the site imports.
declare module "@elabs-ai/components-cli/lib/mcp-http.mjs" {
  export function createMcpHttpHandler(options?: {
    manifest?: unknown;
    root?: string | null;
    hosted?: boolean;
  }): (request: Request) => Promise<Response>;
}
