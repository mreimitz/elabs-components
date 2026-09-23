import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Locks issue #597: the gallery's chat tile and emit-ui's A2UI catalog schema must never ride
 * the initial `/` chunk. Both used to statically import from `@elabs-ai/components-ai` at
 * module scope; both now reach it only through a dynamic `import()` gated on their section
 * nearing the viewport (`useNearViewport` / the shared `useOnEnter`). `apps/home`'s Vitest runs
 * in the `node` environment with no DOM/Testing Library (no render test exists for this app),
 * so this is a source scan of the built files — the same "no static value import of the heavy
 * module, reach it only via `import()`" shape `eager-heavy-deps` checks for package sources,
 * applied here by hand since `apps/home` isn't in that rule's scope.
 */

const AI_PACKAGE = "@elabs-ai/components-ai";
const here = fileURLToPath(new URL(".", import.meta.url));

const FILES: Record<string, string> = {
  "gallery chat tile (component-tiles.tsx)": join(here, "component-tiles.tsx"),
  "emit-ui A2UI catalog schema (emit-ui.tsx)": join(here, "../agent-loop/emit-ui.tsx"),
};

/** Every `import ... from "@elabs-ai/components-ai"` statement's clause — the text between
 *  `import` and `from` — so a `type`-only import can be told apart from a value one. Matches
 *  across the multi-line brace imports both files used before this fix. */
function aiImportClauses(source: string): string[] {
  const re = /import\s+([^;]+?)\s+from\s+["']@elabs-ai\/components-ai["']/g;
  return [...source.matchAll(re)].map((m) => m[1]!.trim());
}

const hasDynamicAiImport = (source: string) =>
  new RegExp(`import\\(\\s*["']${AI_PACKAGE.replace(/\//g, "\\/")}["']\\s*\\)`).test(source);

describe.each(Object.entries(FILES))("%s — issue 597", (_label, path) => {
  const source = readFileSync(path, "utf8");

  it("has no static VALUE import of the ai package (a `type`-only import is fine)", () => {
    const valueImports = aiImportClauses(source).filter((clause) => !clause.startsWith("type "));
    expect(valueImports).toEqual([]);
  });

  it("reaches the ai package only through a dynamic import()", () => {
    expect(hasDynamicAiImport(source)).toBe(true);
  });
});
