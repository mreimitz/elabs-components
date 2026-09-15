import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_MESSAGES } from "./messages";

// ---------------------------------------------------------------------------
// Guards `t("some.key")` call sites across every package against the shipped
// English dictionary — a key used in source but never registered in
// `DEFAULT_MESSAGES` silently renders the RAW KEY to end users (t()'s last
// fallback rung), which is exactly what shipped when a i18n sweep added
// `t()` call sites but the matching messages.ts entries lagged behind
// (#4 i18n review). Source is the one true list of "keys a component can
// render" (see docs/I18N.md); this test keeps that list honest without
// hand-maintaining a duplicate inventory.
// ---------------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/ui/src/components/locale-provider -> repo root
const REPO_ROOT = join(HERE, "../../../../..");

/** Source `.tsx`/`.ts` files under a package's `src/`, excluding tests/stories. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec|stories)\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Strip `//` and `/* *‍/` comments so example code in comments never counts as a call site. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

/**
 * Extract every string-literal key passed as (or inside a ternary forming)
 * the FIRST argument of a `t(...)` call in `source`. Handles the shapes this
 * codebase actually uses:
 *   t("ui.foo.bar")
 *   t("ui.foo.bar", { count })
 *   t(cond ? "ui.foo.a" : "ui.foo.b", { name })
 *   t(SOME_MAP[status])            — dynamic; no literal to extract, skipped
 *
 * A literal only counts as a candidate KEY when it stands as a whole ternary
 * branch or the whole argument — i.e. bounded (modulo whitespace) by the
 * start of the argument, `?`, `:`, or the argument's end — so a literal used
 * mid-condition (`zoom === "fit-width" ? a : b`) is correctly NOT treated as
 * a translation key.
 */
export function extractTranslationKeys(source: string): string[] {
  const clean = stripComments(source);
  const keys: string[] = [];
  const callRe = /(?<![A-Za-z0-9_.])t\(/g;
  let match: RegExpExecArray | null;

  while ((match = callRe.exec(clean))) {
    const start = match.index + match[0].length;
    let depth = 0;
    let end = start;
    // Walk to the first top-level comma or closing paren — the boundary of
    // the first argument expression.
    for (; end < clean.length; end++) {
      const ch = clean[end];
      if (ch === "(" || ch === "{" || ch === "[") depth++;
      else if (ch === ")" || ch === "}" || ch === "]") {
        if (depth === 0) break;
        depth--;
      } else if (ch === "," && depth === 0) {
        break;
      }
    }
    const firstArg = clean.slice(start, end);
    const literalRe = /(?:^|[?:(,])\s*(["'])((?:(?!\1).)*)\1\s*(?=$|[):,])/g;
    for (const lit of firstArg.matchAll(literalRe)) {
      if (lit[2]) keys.push(lit[2]);
    }
  }
  return keys;
}

interface Finding {
  file: string;
  key: string;
}

function collectMissingKeys(): Finding[] {
  const missing: Finding[] = [];
  const pkgsDir = join(REPO_ROOT, "packages");
  for (const pkg of readdirSync(pkgsDir, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue;
    const src = join(pkgsDir, pkg.name, "src");
    try {
      if (!statSync(src).isDirectory()) continue;
    } catch {
      continue;
    }
    for (const file of sourceFiles(src)) {
      const source = readFileSync(file, "utf8");
      for (const key of extractTranslationKeys(source)) {
        if (!(key in DEFAULT_MESSAGES)) {
          missing.push({ file: relative(REPO_ROOT, file), key });
        }
      }
    }
  }
  return missing;
}

describe("t() call sites vs. DEFAULT_MESSAGES", () => {
  it("every literal key passed to t() across every package exists in the shipped dictionary", () => {
    const missing = collectMissingKeys();
    if (missing.length > 0) {
      const report = missing.map((m) => `  ${m.file}: t("${m.key}")`).join("\n");
      throw new Error(
        `Found ${missing.length} t() call(s) whose key has no entry in ` +
          `packages/ui/src/components/locale-provider/messages.ts — this key would ` +
          `render as the raw key string to end users instead of English copy:\n${report}`,
      );
    }
    expect(missing).toEqual([]);
  });
});
