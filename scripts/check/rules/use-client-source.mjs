/**
 * use-client-source — RSC safety floor for client packages.
 * Ported from scripts/check-use-client-source.mjs.
 *
 * Packages export TypeScript source, so a `"use client"` directive must live in the
 * SOURCE (the tsup banner only covers `dist/`). Deliberately a floor, per package:
 * a client package whose source uses React hooks must carry at least one
 * `"use client"` module. It does not check every hook-using file.
 */

export const CLIENT_PACKAGES = [
  "ui",
  "data",
  "ai",
  "flow",
  "maps",
  "charts",
  "editor",
  "viewer",
  "terminal",
];

const HOOK_RE =
  /\buse(?:State|Ref|Effect|Callback|Context|Reducer|LayoutEffect|Id|Memo|ImperativeHandle|DebugValue|Transition|DeferredValue)\b/;
const USE_CLIENT_RE = /^\s*["']use client["'];?/m;

const IGNORE = [
  "**/*.{test,stories}.{ts,tsx}",
  "**/.*/**",
  "**/.*",
  "**/{node_modules,__tests__}/**",
];

const src = (files) => ({
  files: Object.fromEntries(Object.entries(files).map(([k, v]) => [`packages/data/src/${k}`, v])),
});
const HOOK =
  'import { useState } from "react";\nexport function C() { useState(0); return null; }\n';

export default {
  id: "use-client-source",
  scope: "packages",
  doc: 'A client package (`ui`, `data`, `ai`, `flow`, `maps`, `charts`, `editor`, `viewer`, `terminal`) whose source uses React hooks carries `"use client"` in its source modules, not only in the build banner.',
  baseline: "none",
  run(ctx) {
    const out = [];
    for (const pkg of CLIENT_PACKAGES) {
      const files = ctx.glob(`packages/${pkg}/src/**/*.{ts,tsx}`, { ignore: IGNORE });
      const texts = files.map((f) => ctx.readFile(f));
      if (texts.some((t) => HOOK_RE.test(t)) && !texts.some((t) => USE_CLIENT_RE.test(t))) {
        out.push({
          file: files.find((_, i) => HOOK_RE.test(texts[i])),
          line: 1,
          msg: `@elabs-ai/components-${pkg} uses hooks but has zero "use client" modules in source`,
        });
      }
    }
    return out;
  },
  fixtures: {
    pass: [
      src({ "a.tsx": `"use client";\n\n${HOOK}`, "b.tsx": HOOK }),
      src({ "plain.tsx": "export function C() { return <div>Hello</div>; }\n" }),
      src({ "a.tsx": `'use client'\n${HOOK}` }),
      // tests/stories and non-client packages are out of scope
      src({ "a.test.tsx": HOOK, "a.stories.tsx": HOOK }),
      { files: { "packages/tokens/src/theme.tsx": HOOK } },
    ],
    fail: [
      src({ "hook-file-1.tsx": HOOK, "hook-file-2.tsx": HOOK.replace(/useState/g, "useEffect") }),
      src({ "a.ts": "const x = useRef(null);", "b.tsx": "// use client later\n" }),
    ],
  },
};
