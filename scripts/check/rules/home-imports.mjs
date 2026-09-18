/**
 * home-imports — the website (`apps/home`, ADR 0038) is built only from the library. Every import
 * in apps/home/**\/*.{ts,tsx} resolves to react, react-dom, next, motion, @vercel/analytics,
 * `@elabs-ai/*`, a relative path, or a copy-own registry block copied under
 * `apps/home/components/blocks/` — and such a copy keeps its
 * `// registry: <name> — copied <YYYY-MM-DD>` provenance header. Comments are ignored.
 */
import { lineOf } from "../context.mjs";
import { blankJsComments } from "../lib/css.mjs";

export const HOME_ALLOWED_IMPORTS = [
  /^react(?:\/|$)/,
  /^react-dom(?:\/|$)/,
  /^next(?:\/|$)/,
  /^motion(?:\/|$)/,
  /^@vercel\/analytics(?:\/|$)/,
  /^@elabs-ai\//,
];
const BLOCKS_DIR = "apps/home/components/blocks/";
const PROVENANCE_RE = /^\s*\/\/\s*registry:\s*\S+\s+—\s+copied\s+\d{4}-\d{2}-\d{2}\b/m;
const IGNORE = ["**/{node_modules,.next,.turbo}/**"];

/** Disallowed import specifiers in one source string → `[{ spec, line }]`. */
export function findHomeImportViolations(src) {
  const code = blankJsComments(src);
  const found = [
    ...code.matchAll(/\b(?:import|export)\b[^;]*?\bfrom\s*['"]([^'"]+)['"]/g),
    ...code.matchAll(/(?:^|[\n;])\s*import\s*['"]([^'"]+)['"]/g),
    ...code.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    ...code.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
  ];
  return found
    .filter((m) => !m[1].startsWith(".") && !HOME_ALLOWED_IMPORTS.some((re) => re.test(m[1])))
    .map((m) => ({ spec: m[1], line: lineOf(code, m.index + m[0].lastIndexOf(m[1])) }))
    .sort((a, b) => a.line - b.line);
}

const home = (body, file = "apps/home/app/page.tsx") => ({ files: { [file]: body } });

export default {
  id: "home-imports",
  scope: "packages",
  doc: "Build the website (`apps/home`, ADR 0038) only from the library: import react, react-dom, next, motion, @vercel/analytics, `@elabs-ai/*` or a relative path; a registry block copied under `apps/home/components/blocks/` keeps its `// registry: <name> — copied <YYYY-MM-DD>` header.",
  baseline: "none",
  run(ctx) {
    const out = [];
    for (const file of ctx.glob("apps/home/**/*.{ts,tsx}", { ignore: IGNORE })) {
      const text = ctx.readFile(file);
      for (const v of findHomeImportViolations(text))
        out.push({
          file,
          line: v.line,
          msg: `imports "${v.spec}" — apps/home may import only react, react-dom, next, motion, @vercel/analytics, @elabs-ai/* and relative paths; compose a library component or copy a registry block into ${BLOCKS_DIR} (ADR 0038)`,
        });
      if (file.startsWith(BLOCKS_DIR) && !PROVENANCE_RE.test(text))
        out.push({
          file,
          line: 1,
          msg: "registry block copy without its `// registry: <name> — copied <YYYY-MM-DD>` provenance header",
        });
    }
    return out;
  },
  fixtures: {
    pass: [
      home(
        'import type { Metadata } from "next";\nimport Script from "next/script";\nimport { useState } from "react";\nimport { createPortal } from "react-dom";\nimport { motion } from "motion/react";\nimport { Analytics } from "@vercel/analytics/next";\nimport { Button } from "@elabs-ai/components-ui";\nimport "./globals.css";\nimport { Section } from "../components/section";',
      ),
      home(
        'import manifest from "../../../../brand-ui.manifest.json";',
        "apps/home/app/mcp/route.ts",
      ),
      home('const Map = () => import("@elabs-ai/components-maps");'),
      home('// import clsx from "clsx";\n/* import { x } from "lodash"; */\nexport const A = 1;'),
      home(
        '// registry: hero-split — copied 2026-09-18\nimport { Button } from "@elabs-ai/components-ui";',
        "apps/home/components/blocks/hero-split/hero-split.tsx",
      ),
      { files: { "apps/docs/stories/x.tsx": 'import clsx from "clsx";' } },
      { files: { "apps/home/.next/server/x.ts": 'import clsx from "clsx";' } },
    ],
    fail: [
      home('import clsx from "clsx";'),
      home('import { Slot } from "@radix-ui/react-slot";'),
      home('const load = () => import("lodash");'),
      home('export { Toaster } from "sonner";'),
      home(
        'import { Button } from "@elabs-ai/components-ui";',
        "apps/home/components/blocks/hero-split/hero-split.tsx",
      ),
    ],
  },
};
