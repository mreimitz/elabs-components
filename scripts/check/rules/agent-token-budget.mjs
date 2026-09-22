/**
 * agent-token-budget — the files an agent reads before its first edit stay small (RM-129).
 *
 * `skills/brand-ui/SKILL.md` reached 43,880 bytes and every created app shipped a
 * 29 KB `brand-ui-context.md`; an agent read both whole before writing a line.
 * RM-129 cut them to a router and a per-template list. This rule holds the new
 * sizes: a byte ceiling per surface, set at the size it landed with plus a margin
 * (10 %, at least 1 KiB, rounded up to 256 bytes; the router's is the 8 KiB target).
 *
 * Measured surfaces:
 *   - committed files: the skill router, `llms.txt` and each `llms/<pkg>.txt`;
 *   - the created app's `brand-ui-context.md`, rendered for every template in
 *     `docs/playbooks/templates/` (the one `brand-ui create` writes);
 *   - every component's `docs --brief` card (the MCP `docs` brief), one ceiling.
 *
 * Raising a ceiling is raising a baseline: say why in the change. A new
 * `llms/<pkg>.txt` needs its own entry.
 */
import { flat } from "../../../packages/cli/lib/core.mjs";
import { renderDocsBrief } from "../../../packages/cli/lib/docs-brief.mjs";
import { renderAppContext } from "../../../packages/cli/lib/render-docs.mjs";

export const MANIFEST = "brand-ui.manifest.json";
export const TEMPLATES = "docs/playbooks/templates/*.tsx";
const SCOPE = "@elabs-ai/components-";
/** Every created app installs these, whatever the template imports (engine BASE_PACKAGES). */
const BASE_PACKAGES = [`${SCOPE}tokens`, `${SCOPE}ui`];

/** Byte ceilings for committed files. */
export const FILE_CEILINGS = {
  "skills/brand-ui/SKILL.md": 8192,
  "apps/docs/public/llms.txt": 6656,
  "apps/docs/public/llms/ai.txt": 60416,
  "apps/docs/public/llms/charts.txt": 45824,
  "apps/docs/public/llms/data.txt": 2304,
  "apps/docs/public/llms/editor.txt": 5632,
  "apps/docs/public/llms/flow.txt": 3328,
  "apps/docs/public/llms/icons.txt": 2816,
  // Raised from 2816 when the package grew custom plan maps: a plan has its own
  // coordinate system, its own keyboard overlay and its own status encoding, and
  // an agent that does not read them writes a mouse-only plan in degrees.
  "apps/docs/public/llms/maps.txt": 6656,
  "apps/docs/public/llms/marketing.txt": 2560,
  "apps/docs/public/llms/process.txt": 6912,
  "apps/docs/public/llms/terminal.txt": 19712,
  "apps/docs/public/llms/tokens.txt": 2816,
  // 2026-09-22: 40 ui components that had no authored purpose (Accordion, Avatar, Drawer,
  // Tree, …) got one-line purposes so the website's headers stop falling back to file
  // comments; each purpose is one line in this file too.
  "apps/docs/public/llms/ui.txt": 22528,
  "apps/docs/public/llms/viewer.txt": 2816,
};
/** The largest created-app `brand-ui-context.md` over all templates. */
export const APP_CONTEXT_CEILING = 6656;
/** Every component's brief card. */
export const BRIEF_CEILING = 6656;

const bytes = (text) => Buffer.byteLength(text, "utf8");

/** The packages a created app installs for one template's source. */
export function templatePackages(src) {
  const imported = [
    ...src.matchAll(/from\s+["'](@elabs-ai\/components-[a-z-]+)(?:\/[^"']*)?["']/g),
  ];
  return [...new Set([...BASE_PACKAGES, ...imported.map((m) => m[1])])].sort();
}

function overMsg(what, size, ceiling) {
  return `${what} is ${size} bytes, over its ${ceiling}-byte ceiling — trim it (move detail into a file loaded on need), or raise the ceiling in scripts/check/rules/agent-token-budget.mjs and say why`;
}

export default {
  id: "agent-token-budget",
  scope: "repo",
  doc: "Keep what an agent reads first under its byte ceiling: the brand-ui skill router (8 KiB), `llms.txt` and each `llms/<pkg>.txt`, a created app's `brand-ui-context.md` for every template, and every component's `docs --brief` card.",
  baseline: "none",
  run(ctx) {
    const out = [];
    for (const [file, ceiling] of Object.entries(FILE_CEILINGS)) {
      if (!ctx.exists(file)) continue;
      const size = bytes(ctx.readFile(file));
      if (size > ceiling) out.push({ file, line: 1, msg: overMsg(file, size, ceiling) });
    }
    for (const file of ctx.glob("apps/docs/public/llms/*.txt"))
      if (!(file in FILE_CEILINGS))
        out.push({
          file,
          line: 1,
          msg: "no byte ceiling for this llms file — add one to FILE_CEILINGS",
        });

    if (!ctx.exists(MANIFEST)) return out;
    const manifest = ctx.json(MANIFEST);
    for (const template of ctx.glob(TEMPLATES)) {
      const size = bytes(renderAppContext(manifest, templatePackages(ctx.readFile(template))));
      if (size > APP_CONTEXT_CEILING)
        out.push({
          file: template,
          line: 1,
          msg: overMsg(
            "the brand-ui-context.md an app created from this template gets",
            size,
            APP_CONTEXT_CEILING,
          ),
        });
    }
    for (const hit of flat(manifest)) {
      if (hit.kind !== "component") continue;
      const size = bytes(renderDocsBrief(hit));
      if (size > BRIEF_CEILING)
        out.push({
          file: MANIFEST,
          line: 1,
          key: `brief:${hit.pkg}:${hit.name}`,
          msg: overMsg(`the \`docs ${hit.name} --brief\` card (${hit.pkg})`, size, BRIEF_CEILING),
        });
    }
    return out;
  },
  fixtures: (() => {
    const pkg = (components = []) => ({ components, hooks: [], types: [], otherExports: [] });
    const manifest = (extra = {}) =>
      JSON.stringify({
        packages: {
          [`${SCOPE}tokens`]: pkg([{ name: "ThemeProvider", module: "theme.tsx" }]),
          [`${SCOPE}ui`]: pkg([{ name: "Button", module: "button.tsx" }]),
          [`${SCOPE}flow`]: pkg([{ name: "FlowCanvas", module: "flow-canvas.tsx" }]),
          ...extra,
        },
      });
    const skill = (n) => ({ "skills/brand-ui/SKILL.md": "x".repeat(n) });
    const template = (from) => ({
      "docs/playbooks/templates/app.tsx": `import { X } from "${from}";\n`,
    });
    const tooManyNames = Array.from({ length: 800 }, (_, i) => ({
      name: `Widget${i}`,
      module: `widget-${i}.tsx`,
    }));
    const hugeProps = {
      props: Array.from({ length: 200 }, (_, i) => ({
        name: `prop${i}`,
        type: "string",
        description: "A prop that says what it does.",
      })),
    };
    return {
      pass: [
        { files: { ...skill(8192), [MANIFEST]: manifest(), ...template(`${SCOPE}flow`) } },
        { files: { "apps/docs/public/llms/ui.txt": "y".repeat(22528) } },
        // a big package the template does not import does not count against the app's file
        {
          files: {
            [MANIFEST]: manifest({ [`${SCOPE}ai`]: pkg(tooManyNames) }),
            ...template(`${SCOPE}flow`),
          },
        },
      ],
      fail: [
        // one byte over the router's ceiling
        { files: skill(8193) },
        { files: { "apps/docs/public/llms/ui.txt": "y".repeat(22529) } },
        { files: { "apps/docs/public/llms/new-package.txt": "z" } },
        // the template imports the big package, so the created app lists it
        {
          files: {
            [MANIFEST]: manifest({ [`${SCOPE}ai`]: pkg(tooManyNames) }),
            ...template(`${SCOPE}ai`),
          },
        },
        {
          files: {
            [MANIFEST]: JSON.stringify({
              packages: {
                [`${SCOPE}ui`]: {
                  ...pkg([{ name: "Giant", module: "giant.tsx" }]),
                  props: { Giant: hugeProps },
                },
              },
            }),
          },
        },
      ],
    };
  })(),
};
