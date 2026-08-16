/**
 * @elabs/components-cli — `brand-ui gen` generator (WP-10 #87 + WP-12 #96).
 *
 * The KEYSTONE of the self-maintaining-repo block: the package tables, the
 * decision summary, and the package-selection table that today are hand-copied
 * across the human/agent docs (CLAUDE.md / AGENTS.md / PROJECT.md / Introduction.mdx)
 * become GENERATOR-OWNED and stale-gated, so they can't drift (gap C5).
 *
 * Single source → generate → gate, the same contract as `brand-ui context`
 * (context.mjs) / `pnpm inventory` / `pnpm llms`. EVERYTHING is deterministic
 * (stable order, no timestamps) so the gate diffs only real content changes.
 *
 * Marker taxonomy — named regions, family:
 *   <!-- brand-ui:gen:<artifact>:start --> … <!-- brand-ui:gen:<artifact>:end -->
 * Artifacts: `packages`, `decisions`, `selection`. The shipped `brand-ui:context:*`
 * markers and the `DECISIONS:SUMMARY:*` source markers are NOT touched.
 *
 * BOUNDARY: the named regions are placed BY HAND in the target docs (the empty
 * `:start`/`:end` pair sits at the exact spot the table belongs). The writer
 * never blind-appends — a missing pair is a loud error (applyNamedMarkerBlock),
 * so hand-written prose OUTSIDE the markers is always preserved verbatim.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import prettier from "prettier";
import { loadManifest } from "./core.mjs";
import { applyNamedMarkerBlock } from "./context.mjs";
import {
  renderPackageTable,
  renderDecisionSummary,
  renderSelectionTable,
  renderSkillCatalogue,
  renderAgentOutputGuidance,
  renderPlaybookIndex,
} from "./render-docs.mjs";

/**
 * The four gen targets are HAND-WRITTEN prose files that ARE Prettier-formatted in
 * CI (`pnpm format:check`) — unlike the fully-generated `.cursor`/inventory/llms
 * docs, which are `.prettierignore`d. So the generated regions must be Prettier-
 * STABLE or the gen-gate and the format-gate would fight forever (Prettier pads
 * table columns + inserts blank lines around blocks). We therefore run the
 * assembled file through Prettier with the repo's own config, so `gen --write`
 * emits exactly what `format:check` expects: one authority, no tug-of-war.
 */
async function formatForFile(file, content) {
  const config = (await prettier.resolveConfig(file)) ?? {};
  return prettier.format(content, { ...config, filepath: file });
}

/**
 * The generated regions per target doc (the B table from the approved design).
 * Each `render(manifest, root)` returns the block BODY (markers added by the writer).
 * @param {string} root      repo root
 * @param {object} manifest  the loaded manifest
 */
export function genTargets(root, manifest) {
  return [
    {
      file: join(root, "CLAUDE.md"),
      regions: [
        // CLAUDE.md stays LEAN (D9): the decision summary ONLY — no package table,
        // no component index (the full index lives in the generated inventory).
        { name: "decisions", render: () => renderDecisionSummary(root) },
      ],
    },
    {
      file: join(root, "AGENTS.md"),
      regions: [
        // The full package map (10 manifest packages + 5 infra rows).
        { name: "packages", render: () => renderPackageTable(manifest, { scope: "all" }) },
        { name: "decisions", render: () => renderDecisionSummary(root) },
        { name: "selection", render: () => renderSelectionTable(manifest) },
      ],
    },
    {
      file: join(root, "PROJECT.md"),
      regions: [
        // Product packages only (the 10 manifest packages).
        { name: "packages", render: () => renderPackageTable(manifest, { scope: "product" }) },
      ],
    },
    {
      file: join(root, "apps/docs/stories/Introduction.mdx"),
      regions: [
        // Product packages, rendered as the existing bulleted-LIST format.
        {
          name: "packages",
          render: () => renderPackageTable(manifest, { scope: "product", format: "list" }),
        },
      ],
    },
    {
      // The `brand-ui` skill's factual catalogue (#87): themes/tokens + per-package
      // component/hook counts. The skill's hand-written judgment prose (when to use
      // what, composition patterns) lives OUTSIDE the markers and is preserved.
      // Other skills carry routing PROSE, not list-of-things, so they have no region.
      file: join(root, "skills/brand-ui/SKILL.md"),
      regions: [
        { name: "catalogue", render: () => renderSkillCatalogue(manifest) },
        // The agent-output contract (how an agent structures output for @elabs/components-ai).
        { name: "agent-output", render: () => renderAgentOutputGuidance(manifest) },
      ],
    },
    {
      // The agent-facing "AI Output Contract" Storybook page carries the SAME
      // generated contract region as the skill (one source — they can't diverge);
      // the page's hand-authored intro + live story embeds live OUTSIDE the markers.
      // `.mdx` → `{/* … */}` markers (HTML comments break the MDX indexer).
      file: join(root, "apps/docs/stories/AI-Output-Contract-for-Agents.mdx"),
      regions: [{ name: "agent-output", render: () => renderAgentOutputGuidance(manifest) }],
    },
    {
      // The human playbook index (WP-09 #84). It used to be a hand-kept table, so a
      // 7th playbook could exist and never appear here; now the archetype/intent/
      // template columns come from each playbook's front matter via the manifest.
      file: join(root, "docs/playbooks/README.md"),
      regions: [{ name: "playbooks", render: () => renderPlaybookIndex(manifest) }],
    },
  ];
}

/**
 * Compute each target's expected content from the current manifest + sources.
 * Applies every named region in the file in turn, so a file with two generated
 * regions gets both replaced, then runs the whole file through Prettier so the
 * result matches `format:check`. Throws (via applyNamedMarkerBlock) if a region's
 * markers are missing — the regions must be hand-placed first.
 * @returns {Promise<{ file: string, content: string }[]>}
 */
export async function computeGen(root) {
  const manifest = loadManifest(root);
  const out = [];
  for (const { file, regions } of genTargets(root, manifest)) {
    // MDX cannot carry HTML comments (they break Storybook's MDX indexer), so
    // `.mdx` targets use `{/* … */}` markers instead of `<!-- … -->`.
    const mdx = file.endsWith(".mdx");
    let content = existsSync(file) ? readFileSync(file, "utf8") : null;
    for (const { name, render } of regions) {
      content = applyNamedMarkerBlock(content, name, render(), { mdx });
    }
    out.push({ file, content: await formatForFile(file, content) });
  }
  return out;
}

/** Write the generated regions into the target docs. Returns written paths. */
export async function writeGen(root) {
  const written = [];
  for (const { file, content } of await computeGen(root)) {
    writeFileSync(file, content);
    written.push(file);
  }
  return written;
}

/**
 * Stale-check: are all generated regions up to date? Returns the list of stale
 * file paths (empty = fresh). Same contract as checkContext / the manifest gate.
 * @returns {Promise<string[]>}
 */
export async function checkGen(root) {
  const stale = [];
  for (const { file, content } of await computeGen(root)) {
    const current = existsSync(file) ? readFileSync(file, "utf8") : null;
    if (current !== content) stale.push(file);
  }
  return stale;
}
