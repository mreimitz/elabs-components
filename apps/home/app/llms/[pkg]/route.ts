/**
 * A per-package `llms.txt` spoke (ADR 0038 §6). `[pkg]` accepts either the short form the hub's
 * own links use (`ai.txt`, matching `apps/docs/public/llms/ai.txt` today) or the full package
 * id minus scope (`components-ai.txt`) — both resolve to `@elabs-ai/components-ai`, so a link
 * copied from either place still works.
 */
import { renderLlmsSpoke } from "@elabs-ai/components-cli/lib/render-docs.mjs";
import manifest from "../../../../../brand-ui.manifest.json";

interface PackageManifest {
  packages: Record<string, unknown>;
}

function resolvePackageName(slugParam: string): string | null {
  const slug = slugParam.replace(/\.txt$/, "");
  const packages = Object.keys((manifest as PackageManifest).packages);
  return (
    packages.find(
      (name) => name === `@elabs-ai/${slug}` || name === `@elabs-ai/components-${slug}`,
    ) ?? null
  );
}

export async function GET(_request: Request, { params }: { params: Promise<{ pkg: string }> }) {
  const { pkg } = await params;
  const pkgName = resolvePackageName(pkg);
  if (!pkgName) {
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  }
  return new Response(renderLlmsSpoke(manifest, pkgName), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
