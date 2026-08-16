#!/usr/bin/env node
/**
 * check-playbooks.mjs — playbook registration gate (WP-09 #66 / #84).
 *
 * The archetype playbooks (`docs/playbooks/*.md`) are the composition recipes an
 * agent should reach for before assembling a whole screen. Until #84 they were
 * INVISIBLE to every discovery surface: no manifest entry, no context section, no
 * `brand-ui search` hit, a hand-kept README table. Adding a 7th playbook therefore
 * "worked" while reaching nobody.
 *
 * The fix is generation (each playbook's own YAML front matter → manifest → context
 * → search → README index). This is its teeth — a convention ships with its
 * enforcement (.claude/rules/quality-gates.md). It fails when:
 *
 *   1. FRONT MATTER — a `docs/playbooks/*.md` has no front matter, or is missing
 *      `archetype` / `intent` / `keywords` / `packages`.
 *   2. IDENTITY     — `archetype` disagrees with the file name, or names an
 *      archetype the engine doesn't know (packages/cli/lib/engine.mjs ARCHETYPES).
 *   3. TEMPLATE     — there is no `docs/playbooks/templates/<archetype>.tsx`.
 *   4. MANIFEST     — the committed `brand-ui.manifest.json` `playbooks` block does
 *      not equal a fresh read (someone skipped `pnpm manifest`).
 *   5. SURFACED     — the generated agent-context file has no line for the playbook
 *      (someone skipped `pnpm context`).
 *
 * Run via `pnpm playbooks:check`; the self-test (`pnpm playbooks:check:test`) plants
 * an unregistered fixture playbook and asserts a non-zero exit, so the gate can't rot.
 *
 * Dependency-free; resolves the repo root relative to this file (cwd-independent).
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadPlaybooks, parseFrontMatter } from "../packages/cli/lib/core.mjs";
import { ARCHETYPES } from "../packages/cli/lib/engine.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = dirname(HERE); // scripts/ -> repo root

/** Front-matter keys every playbook must carry to be routable. */
export const REQUIRED_KEYS = ["archetype", "intent", "keywords", "packages"];

/**
 * The pure checker — driven by already-read data so the self-test is hermetic.
 *
 * @param {object} input
 * @param {{slug:string,text:string,hasTemplate:boolean}[]} input.files  one per docs/playbooks/*.md
 * @param {object[]} input.fresh         loadPlaybooks() over the same tree
 * @param {object[]|undefined} input.committed  the committed manifest's `playbooks`
 * @param {string} input.contextText     the generated agent-context file
 * @param {string[]} input.archetypes    the engine's known archetypes
 * @returns {string[]} violation messages (empty = pass)
 */
export function findPlaybookViolations({ files, fresh, committed, contextText, archetypes }) {
  const violations = [];
  const known = new Set(archetypes);

  for (const { slug, text, hasTemplate } of [...files].sort((a, b) =>
    a.slug.localeCompare(b.slug),
  )) {
    const rel = `docs/playbooks/${slug}.md`;
    const { data } = parseFrontMatter(text);
    if (!Object.keys(data).length) {
      violations.push(
        `${rel}: no YAML front matter — a playbook is discoverable only via its front ` +
          `matter (${REQUIRED_KEYS.join(", ")}). See docs/playbooks/README.md.`,
      );
      continue;
    }
    for (const key of REQUIRED_KEYS) {
      const v = data[key];
      const empty = v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === "");
      if (empty) violations.push(`${rel}: front matter is missing \`${key}\``);
    }
    if (typeof data.archetype === "string" && data.archetype && data.archetype !== slug) {
      violations.push(
        `${rel}: front-matter archetype "${data.archetype}" disagrees with the file name "${slug}"`,
      );
    }
    if (typeof data.archetype === "string" && data.archetype && !known.has(data.archetype)) {
      violations.push(
        `${rel}: archetype "${data.archetype}" is not in ARCHETYPES ` +
          "(packages/cli/lib/engine.mjs) — add it there so `brand-ui scaffold` can plan it",
      );
    }
    if (!hasTemplate) {
      violations.push(
        `${rel}: no docs/playbooks/templates/${slug}.tsx — add a ` +
          `packages/<pkg>/src/templates-${slug}.stories.tsx and run \`pnpm gen:templates\``,
      );
    }
  }

  // 4 — the committed manifest must already carry this exact block.
  if (JSON.stringify(committed ?? null) !== JSON.stringify(fresh)) {
    violations.push(
      "brand-ui.manifest.json: the `playbooks` block is stale (or missing) — run " +
        "`pnpm manifest` and commit the result",
    );
  }

  // 5 — the generated agent-context file must mention every playbook.
  for (const p of fresh) {
    if (!contextText.includes(p.file)) {
      violations.push(
        `apps/docs/public/brand-ui-context.md: no entry for ${p.file} — run \`pnpm context\``,
      );
    }
  }

  return violations;
}

/** Read the on-disk inputs the checker needs. Exported so the self-test can point it at a fixture. */
export function collectInputs(root) {
  const dir = join(root, "docs/playbooks");
  const files = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".md") && f !== "README.md")
        .map((f) => {
          const slug = f.replace(/\.md$/, "");
          return {
            slug,
            text: readFileSync(join(dir, f), "utf8"),
            hasTemplate: existsSync(join(dir, "templates", `${slug}.tsx`)),
          };
        })
    : [];
  const manifestPath = join(root, "brand-ui.manifest.json");
  const committed = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8")).playbooks
    : undefined;
  const contextPath = join(root, "apps/docs/public/brand-ui-context.md");
  return {
    files,
    fresh: loadPlaybooks(root),
    committed,
    contextText: existsSync(contextPath) ? readFileSync(contextPath, "utf8") : "",
    archetypes: ARCHETYPES,
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────
const invokedDirectly = process.argv[1] && process.argv[1].endsWith("check-playbooks.mjs");
if (invokedDirectly) {
  const violations = findPlaybookViolations(collectInputs(REPO_ROOT));
  if (violations.length) {
    console.error(`✖ playbook registration (${violations.length} problem(s)):`);
    for (const v of violations) console.error("  - " + v);
    console.error(
      "\n  Fix: give the playbook front matter (see docs/playbooks/README.md ▸ Adding a\n" +
        "  playbook), then run `pnpm agent-docs` and commit the regenerated artifacts.",
    );
    process.exit(1);
  }
  const n = loadPlaybooks(REPO_ROOT).length;
  console.log(`✔ playbooks: ${n} registered, surfaced in the manifest, context and search.`);
}
