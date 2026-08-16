#!/usr/bin/env node
/**
 * build-agent-kit.mjs — assemble the brand-ui "agent kit" for external consumers.
 *
 * The released `@elabs/components-*` tarballs carry the components; this kit carries the
 * AGENT-LEGIBILITY layer so a coding agent in a CONSUMING project knows what
 * brand-ui offers and how to compose it (the gap RELEASING.md used to miss). It
 * is attached to the GitHub Release alongside the tarballs, version-pinned.
 *
 *   pnpm release:agent-kit        # regenerates manifest + llms, then builds the zip
 *   node scripts/build-agent-kit.mjs
 *
 * Output: release/v<version>/brand-ui-agent-kit-<version>.zip containing
 *   skills/        the consumer-facing skills (brand-ui + audit + theme + new-app + enterprise)
 *   playbooks/     whole-screen recipes the new-app skill references
 *   brand-ui.manifest.json   machine-readable inventory (components/variants/tokens)
 *   llms.txt + llms/<pkg>.txt portable agent docs (Cursor/Copilot/Claude Projects)
 *   KIT-README.md  install + usage, generated
 *
 * Skill copies are SANITIZED: monorepo-internal paths a vendored skill can't
 * resolve (`packages/…`, `.claude/…`, `apps/…`, `docs/playbooks/…`) are rewritten
 * to consumer-appropriate equivalents, and the script FAILS if any slip through —
 * a kit that tells an agent to read files that don't exist is worse than none.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  cpSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { findRepoRoot } from "../packages/cli/lib/core.mjs";

const root = findRepoRoot(process.cwd());
if (!root) {
  console.error("build-agent-kit: must run inside the brand-ui monorepo.");
  process.exit(1);
}

const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

// Consumer-facing skills only. The maintainer skills (brand-ui-component,
// brand-ui-registry) are "work IN the monorepo" and reference build internals —
// they don't belong in a consuming project's agent.
const SKILLS = [
  "brand-ui",
  "brand-ui-audit",
  "brand-ui-theme",
  "brand-ui-new-app",
  "brand-ui-migrate",
  "brand-ui-enterprise",
];

// Rewrite monorepo-internal references → consumer equivalents. Applied in order
// (specific before general), to every *.md in the staged skills tree.
const SANITIZE = [
  ["packages/tokens/src/themes.css", "@elabs/components-tokens/styles.css"],
  [
    "packages/charts/src/charts/area-chart.stories.tsx",
    "the @elabs/components-charts area-chart example",
  ],
  // Generator-provenance notes in the generated SKILL.md prose ("edit the source,
  // not here") — meaningless in a vendored kit; rewrite to consumer-neutral text.
  ["packages/cli/lib/render-docs.mjs", "the brand-ui doc generator"],
  ["packages/cli/lib/agent-output.mjs", "the brand-ui agent-output contract"],
  [".claude/rules/icons.md", "the brand-ui icons rule"],
  [".claude/rules/theming.md", "reference/theming.md"],
  [".claude/commands/new-theme.md", "the brand-ui-theme skill"],
  [".claude/rules/", "the brand-ui rules"],
  ["apps/e2e/reports/visual-ux-", "reports/visual-ux-"],
  ["apps/e2e/reports/screenshots/", "reports/screenshots/"],
  ["apps/<name>", "your app folder"],
  ["apps/playground", "a Vite app"],
  ["docs/playbooks/", "playbooks/"],
];
// After sanitizing, NO skill/playbook prose may still point at these prefixes.
const DANGLING = ["packages/", ".claude/", "apps/", "docs/playbooks"];

const stage = join(root, "release", "agent-kit");
const outDir = join(root, "release", `v${version}`);
const zipName = `brand-ui-agent-kit-${version}.zip`;

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

// 1. Skills (copied, then sanitized).
for (const s of SKILLS) {
  const src = join(root, "skills", s);
  if (!existsSync(src)) throw new Error(`missing skill: skills/${s}`);
  cpSync(src, join(stage, "skills", s), { recursive: true });
}

// 2. Playbooks (self-contained; the new-app + brand-ui skills point at them).
cpSync(join(root, "docs", "playbooks"), join(stage, "playbooks"), { recursive: true });

// 3. Machine-readable inventory + portable agent docs.
cpSync(join(root, "brand-ui.manifest.json"), join(stage, "brand-ui.manifest.json"));
cpSync(join(root, "apps/docs/public/llms.txt"), join(stage, "llms.txt"));
cpSync(join(root, "apps/docs/public/llms"), join(stage, "llms"), { recursive: true });

// --- sanitize every *.md under stage/skills ---
function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// Sanitize skills AND playbooks. These two lists must stay THE SAME set: the
// self-check below covers both, so sanitizing only `skills/` meant a monorepo
// path in a playbook could never be rewritten — only fail the build. That is
// exactly what blocked the v2.1.1 release (`playbooks/README.md → docs/playbooks`)
// AFTER the packages had already published, leaving no GitHub Release.
const mdFiles = [...walk(join(stage, "skills")), ...walk(join(stage, "playbooks"))].filter((f) =>
  f.endsWith(".md"),
);
for (const f of mdFiles) {
  let text = readFileSync(f, "utf8");
  for (const [from, to] of SANITIZE) text = text.split(from).join(to);
  writeFileSync(f, text);
}

// --- self-check: no dangling monorepo paths survive in skills OR playbooks prose ---
const checkFiles = mdFiles;
const offenders = [];
for (const f of checkFiles) {
  const text = readFileSync(f, "utf8");
  for (const bad of DANGLING) {
    if (text.includes(bad)) offenders.push(`${relative(stage, f)} → ${bad}`);
  }
}
if (offenders.length) {
  console.error(
    "build-agent-kit: dangling monorepo paths in the kit (add a SANITIZE rule):\n" +
      offenders.map((o) => "  - " + o).join("\n"),
  );
  process.exit(1);
}

// 4. KIT-README.md (generated).
writeFileSync(
  join(stage, "KIT-README.md"),
  `# brand-ui agent kit — v${version}

The coding-agent layer for the brand-ui design system, pinned to the \`@elabs/components-*\`
v${version} packages. Install it so your AI coding agent knows **what brand-ui
offers and how to compose it** — instead of guessing component names and props.

Pairs with the \`@elabs/components-*\` packages published to GitHub Packages — see
\`docs/CONSUMING.md\` in the repo for installing them (an \`.npmrc\` scope mapping +
a \`read:packages\` PAT).

## Contents

- \`skills/\` — the consumer-facing skills (\`brand-ui\` build/compose, plus
  \`brand-ui-audit\`, \`brand-ui-theme\`, \`brand-ui-new-app\`,
  \`brand-ui-migrate\` (brownfield adoption), and \`brand-ui-enterprise\`
  (enterprise design-judgment layer)).
- \`playbooks/\` — whole-screen recipes (dashboard, ai-assistant, data-app, …).
- \`brand-ui.manifest.json\` — machine-readable inventory: every component, its
  variants, intent and (where resolved) props, plus tokens, themes, registry.
- \`llms.txt\` + \`llms/<pkg>.txt\` — portable agent docs for tools that
  auto-discover \`llms.txt\` (Cursor, Copilot, Claude Projects).

## Install (Claude Code)

Either install the plugin (live, repo-backed):

\`\`\`
/plugin marketplace add <path-to-this-repo>
\`\`\`

…or vendor this pinned kit into your project: copy \`skills/\` into your repo's
\`.claude/skills/\` and keep \`playbooks/\` + \`brand-ui.manifest.json\` +
\`llms.txt\` alongside them.

Then install the CLI so the skills' \`brand-ui\` commands work in your project.
It is a **private GitHub Packages** dependency (see \`docs/CONSUMING.md\` §1+§7a
for the \`.npmrc\` scope mapping + a \`read:packages\` PAT):

\`\`\`
pnpm add -D @elabs/components-cli
pnpm exec brand-ui info            # themes, tokens, installed @elabs/components-* packages
pnpm exec brand-ui search <query>  # find a component / hook / registry item
pnpm exec brand-ui docs <Name>     # real props + intent for a component
\`\`\`

The CLI reads the manifest bundled inside \`@elabs/components-cli\`, so \`search\`/\`docs\`
work with no monorepo present. (\`docs\` omits the raw source snippet outside the
monorepo; the resolved props + intent come from the manifest.)

## Other harnesses (Cursor / Copilot / Gemini)

Point the tool at \`llms.txt\` (and the per-package \`llms/<pkg>.txt\`), or drop
\`skills/\` into the harness's skills directory.

## Note

\`brand-ui.manifest.json\` records each component's \`module\` as a path in
brand-ui's own source tree (e.g. \`packages/ui/src/...\`) — informational, a
pointer into the upstream repo, not a path in your project.
`,
);

// 5. Zip it (system `zip`; this runs in the monorepo at release time).
mkdirSync(outDir, { recursive: true });
const zipPath = join(outDir, zipName);
rmSync(zipPath, { force: true });
execFileSync("zip", ["-rq", zipPath, "."], { cwd: stage });

const size = statSync(zipPath).size;
console.log(`✅ ${relative(root, zipPath)}  (${(size / 1024).toFixed(0)} KB)`);
console.log(`   skills: ${SKILLS.join(", ")}  ·  + playbooks, manifest, llms.txt, KIT-README.md`);
