#!/usr/bin/env node
/**
 * brand-ui — the deterministic backend for the brand-ui AI skills.
 *
 *   brand-ui info [--json]          Project context (packages, themes, registry)
 *   brand-ui manifest [--write]     Generate the component manifest
 *   brand-ui context [--check]      Generate portable agent context files (+ stale-gate)
 *   brand-ui gen [--check]          Generate doc regions (package tables, decisions) (+ stale-gate)
 *   brand-ui search <query>         Find components / registry items / archetype playbooks
 *   brand-ui docs <Component...>    Locate a component + print its real props
 *   brand-ui audit <path> [--json] [--strict]  Static token/style + anti-slop lint (no LLM)
 *
 * The vibe-coder-plugin experience engine (scaffold is implemented — VP-02 #123;
 * scan/map/codemod are #121 skeletons, full behavior in VP-03):
 *   brand-ui scaffold <app-spec.md> [--write <dir>]  Plan / emit a born-compliant app
 *   brand-ui scan [path]            Read-only repo profile (framework/UI/styling)
 *   brand-ui map <scan.json>        Map existing components → brand-ui (manifest)
 *   brand-ui codemod <map.json>     Plan AST codemods (generate/dry-run; read-only)
 */
import { readFileSync, existsSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  findRepoRoot,
  generateManifest,
  loadManifest,
  writeManifest,
  consumerContext,
  resolveTasteProfile,
  tasteSearchDirs,
  flat,
  matchPlaybooks,
} from "../lib/core.mjs";
import { writeContext, checkContext } from "../lib/context.mjs";
import { resolveAllProps } from "../lib/docgen.mjs";
import { scanText } from "../lib/audit.mjs";
import {
  planScaffold,
  emitScaffold,
  scanRepo,
  mapComponents,
  planCodemod,
  renderMigrationDocs,
} from "../lib/engine.mjs";
// NOTE: `../lib/gen.mjs` is imported lazily inside `cmdGen` (monorepo-only) — it
// pulls in `prettier` (a devDependency), which is absent when `@elabs-ai/components-cli` is
// installed as a consumer dependency. Keeping it out of the top-level import
// graph is what lets `info`/`search`/`docs` run in a consuming project.

const [cmd, ...argv] = process.argv.slice(2);
// `--out <dir>` is the ONLY value-taking flag; pull it (and its value) out before
// the plain flag/positional split so the directory isn't mistaken for an argument.
const rest = [];
let outDir = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--out") {
    outDir = argv[++i] ?? null;
    continue;
  }
  if (a.startsWith("--out=")) {
    outDir = a.slice("--out=".length);
    continue;
  }
  rest.push(a);
}
const flags = new Set(rest.filter((a) => a.startsWith("--")));
const args = rest.filter((a) => !a.startsWith("--"));
const json = flags.has("--json");
const root = findRepoRoot();

/**
 * The ACTIVE taste profile (#108): the shipped restrained defaults, overridden by
 * the nearest `brand-ui.config.json` `taste` key (searched from the TARGET being
 * judged, then the cwd, then the monorepo root — nearest wins), then by an
 * explicit `--register=` flag. This is what makes "judge against the active taste
 * profile" a thing the tooling READS instead of a question it asks a human.
 *
 * @param {object|null} manifest
 * @param {string|null} [target] the path being audited/scanned, when there is one.
 */
function activeTaste(manifest, target = null) {
  const dirs = tasteSearchDirs({ target, cwd: process.cwd(), root });
  const profile = resolveTasteProfile({ manifest, dirs });
  const override = flagValue("--register");
  if (override && (manifest?.taste?.axes?.register ?? ["product", "brand"]).includes(override)) {
    return { ...profile, register: override, source: "flag" };
  }
  return profile;
}

/**
 * A project-declared `motion: "full"` is an a11y problem, not a preference (ADR
 * 0020 §6): `[data-motion-pref="full"]` is the one state that keeps motion running
 * through a visitor's OS `prefers-reduced-motion: reduce`. The app-spec schema
 * refuses it at interview time; this is the backstop for a hand-written config.
 */
function warnProjectMotionFull(taste) {
  if (taste?.motion !== "full" || taste.source === "default") return;
  console.log(
    `  ⚠ taste.motion "full" is a PERSON's informed consent, not an app default — it keeps motion\n` +
      `    running through a visitor's OS reduce-motion request. Use "system" (full motion when the\n` +
      `    OS is neutral) or "reduced", and offer "full" from a control (useMotionPreference()).`,
  );
}

function out(obj, text) {
  if (json) console.log(JSON.stringify(obj, null, 2));
  else console.log(text ?? "");
}

function cmdInfo() {
  const consumer = consumerContext();
  const manifest = loadManifest(root);
  // In the monorepo, the package set IS the manifest. Only fall back to a
  // consuming project's declared @elabs-ai/components-* deps when we're outside the monorepo.
  const installed = root && manifest ? Object.keys(manifest.packages) : (consumer?.installed ?? []);
  const ctx = {
    mode: root ? "monorepo" : consumer ? "consumer" : "unknown",
    repoRoot: root,
    project: consumer?.name ?? null,
    installed,
    themes: manifest?.themes ?? [],
    defaultTheme: manifest?.defaultTheme ?? null,
    radius: manifest?.radius ?? null,
    tokenCount: manifest?.tokenCount ?? 0,
    registryItems: manifest?.registry?.length ?? 0,
    // The ACTIVE taste profile (#108) — read this instead of asking a human to
    // "pick a register". `expressiveness` IS the --decoration dial (ADR 0020).
    taste: activeTaste(manifest),
    addCommand: "npx shadcn@latest add <registry-url>/<item>.json",
  };
  if (json) return out(ctx);
  console.log(`brand-ui — ${ctx.mode} mode`);
  if (ctx.project) console.log(`project: ${ctx.project}`);
  console.log(`packages: ${ctx.installed.join(", ") || "(none)"}`);
  console.log(`themes: ${ctx.themes.join(", ")}  (default: ${ctx.defaultTheme})`);
  console.log(
    `radius: ${ctx.radius} · tokens: ${ctx.tokenCount} · registry items: ${ctx.registryItems}`,
  );
  console.log(
    `taste: register ${ctx.taste.register} · density ${ctx.taste.density} · motion ${ctx.taste.motion} ` +
      `· expressiveness ${ctx.taste.expressiveness} (the --decoration dial)  [${ctx.taste.source}]`,
  );
  if (ctx.taste.invalid.length) {
    console.log(
      `  ⚠ ignored invalid brand-ui.config.json taste value(s): ${ctx.taste.invalid.join(", ")}`,
    );
  }
  warnProjectMotionFull(ctx.taste);
  console.log(
    `\nRules of the road: semantic tokens only (no raw hex), forwardRef + cn() + spread props,`,
  );
  console.log(
    `Radix for overlays, compound composition, visible focus ring, works in every theme.`,
  );
  console.log(`Add components with: ${ctx.addCommand}`);
}

async function cmdManifest() {
  if (!root) {
    console.error("manifest: must run inside the brand-ui monorepo.");
    process.exit(1);
  }
  // Best-effort docgen enrichment (#79 / ADR 0013): resolve inherited prop
  // types / defaults / TSDoc via `react-docgen-typescript` if it's installed.
  // `resolveAllProps` returns null when the devDep is absent (or anything
  // throws), so `generateManifest` then produces the byte-identical
  // dependency-free manifest — this layer can NEVER break manifest generation.
  let resolved = null;
  try {
    resolved = await resolveAllProps(root);
  } catch {
    resolved = null;
  }
  const manifest = generateManifest(root, { resolved });
  if (flags.has("--write")) {
    writeManifest(root, manifest);
    console.log(
      `Wrote brand-ui.manifest.json — ${Object.keys(manifest.packages).length} packages, ` +
        `${flat(manifest).length} components/hooks, ${manifest.registry.length} registry items.`,
    );
    return;
  }
  out(manifest, JSON.stringify(manifest, null, 2));
}

/**
 * `brand-ui context [--write|--check]` (WP-03 #82).
 * Generates the manifest's ground truth into the portable, MCP-free files agents
 * read — currently `apps/docs/public/brand-ui-context.md` (the deprecated Cursor
 * `.cursor/rules/brand-ui.mdc` target was removed, 023cc89; CLAUDE.md/AGENTS.md are
 * owned by another workstream). Marker-wrapped + stale-gated.
 */
function cmdContext() {
  if (!root) {
    console.error("context: must run inside the brand-ui monorepo.");
    process.exit(1);
  }
  const rel = (p) => p.replace(root + "/", "");
  if (flags.has("--check")) {
    const stale = checkContext(root);
    if (stale.length) {
      console.error(
        "✖ brand-ui context files are STALE:\n" +
          stale.map((f) => "  - " + rel(f)).join("\n") +
          "\n  Run `pnpm context` and commit the result.\n" +
          "  (Generated from brand-ui.manifest.json; only edit OUTSIDE the markers.)",
      );
      process.exit(1);
    }
    console.log("✔ brand-ui context files are fresh.");
    return;
  }
  // default + --write both write (a context command with no output is useless).
  const written = writeContext(root);
  console.log(`Wrote ${written.length} context file(s):`);
  for (const f of written) console.log(`  ${rel(f)}`);
}

/**
 * `brand-ui gen [--write|--check]` (WP-10 #87 / WP-12 #96).
 * Generates the package tables + decision summary + selection table into marked
 * regions of CLAUDE.md / AGENTS.md / PROJECT.md / Introduction.mdx (the keystone
 * that makes those hand-doc inventories generator-owned). Marker-wrapped + stale-gated.
 */
async function cmdGen() {
  if (!root) {
    console.error("gen: must run inside the brand-ui monorepo.");
    process.exit(1);
  }
  const { writeGen, checkGen } = await import("../lib/gen.mjs");
  const rel = (p) => p.replace(root + "/", "");
  if (flags.has("--check")) {
    const stale = await checkGen(root);
    if (stale.length) {
      console.error(
        "✖ brand-ui generated doc regions are STALE:\n" +
          stale.map((f) => "  - " + rel(f)).join("\n") +
          "\n  Run `pnpm gen` and commit the result.\n" +
          "  (Package tables + decision summary are generated; only edit OUTSIDE the markers.)",
      );
      process.exit(1);
    }
    console.log("✔ brand-ui generated doc regions are fresh.");
    return;
  }
  // default + --write both write (a gen command with no output is useless).
  const written = await writeGen(root);
  console.log(`Wrote ${written.length} generated doc region target(s):`);
  for (const f of written) console.log(`  ${rel(f)}`);
}

function cmdSearch() {
  const q = args.join(" ").toLowerCase();
  const manifest = loadManifest(root);
  if (!manifest)
    return console.error(
      "search: no manifest (run inside the monorepo or install @elabs-ai/components-cli).",
    );
  if (!q) return console.error("usage: brand-ui search <query>");
  const rows = flat(manifest).filter(
    (r) => r.name.toLowerCase().includes(q) || r.pkg.toLowerCase().includes(q),
  );
  const reg = manifest.registry.filter((r) =>
    (r.name + " " + r.title + " " + r.description).toLowerCase().includes(q),
  );
  // Playbooks (WP-09 #66/#84): a free-text INTENT ("build a dashboard") must reach
  // the archetype recipe, not just a same-named icon. Matched on archetype/intent/
  // keywords so "kpi", "chatbot" or "landing page" all land on the right playbook.
  const books = matchPlaybooks(manifest, q);
  if (json) return out({ components: rows, registry: reg, playbooks: books });
  console.log(`Components/hooks matching "${q}":`);
  for (const r of rows.slice(0, 30)) console.log(`  ${r.name}  (${r.pkg} · ${r.kind})`);
  if (!rows.length) console.log("  (none)");
  if (reg.length) {
    console.log(`\nRegistry items matching "${q}":`);
    for (const r of reg) console.log(`  ${r.name}  [${r.type}] — ${r.title}`);
  }
  if (books.length) {
    console.log(`\nPlaybooks matching "${q}" (start a WHOLE screen here):`);
    for (const p of books) {
      console.log(`  ${p.archetype}  — ${p.intent}`);
      console.log(`    ${p.file}${p.template ? `  · template ${p.template}` : ""}`);
    }
  }
}

/**
 * Index of the `}`/`)`/`]` that closes the one opened at `open` — string- and
 * comment-aware, so a brace in prose can't move the boundary.
 */
function closingDelim(src, open) {
  let depth = 0;
  let q = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (q) {
      if (c === "\\") i++;
      else if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") q = c;
    else if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (c === "/" && n === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i++;
    } else if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") {
      if (--depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Verbatim source for the component's `Props` declaration + its render
 * signature — the "here is the real thing, don't guess" fallback under the
 * structured prop table.
 *
 * It reads the declaration to its OWN terminator. The previous regex ended at
 * the first `}` or `;` followed by a newline, which for any non-trivial
 * interface (`DataTableProps`, `GanttProps`) fell inside the first nested type
 * and printed a plausible-looking but TRUNCATED interface — the same class of
 * confidently-wrong output #60 exists to eliminate. A `type X = …` alias has no
 * brace to balance, so it terminates at its first depth-0 `;`.
 */
function extractProps(srcPath, name) {
  const file = root ? join(root, srcPath) : srcPath;
  const src = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (!src) return null;
  const snippets = [];
  // Props interface/type for this component, read to its own terminator.
  const declRe = new RegExp(`export\\s+(?:interface|type)\\s+${name}Props\\b`, "g");
  for (const m of src.matchAll(declRe)) {
    const open = src.indexOf("{", m.index);
    const semi = src.indexOf(";", m.index);
    // `interface X … { … }` → balance the brace; `type X = …;` → stop at the `;`.
    const useBrace = open >= 0 && (semi < 0 || open < semi);
    const end = useBrace ? closingDelim(src, open) : semi;
    snippets.push(src.slice(m.index, end < 0 ? src.length : end + 1).trim());
  }
  // The forwardRef/function signature line
  const sigRe = new RegExp(`(?:export\\s+(?:const|function)\\s+${name}\\b[^\\n]*)`, "g");
  for (const m of src.matchAll(sigRe)) snippets.push(m[0].trim());
  return { file: srcPath, snippets };
}

/**
 * The `--json` record for one `docs` hit (#325) — the same fields the markdown
 * card renders (purpose/relationships/stateTokens/antiPatterns, the resolved
 * prop table, expanded cva variants, the verbatim source snippets), collected
 * into a structured object instead of formatted text. This is a rendering
 * fork over the same manifest data `cmdDocs`'s markdown path prints — no new
 * extraction.
 */
function docsJsonRecord(hit, props) {
  const intent = hit.intent;
  return {
    name: hit.name,
    found: true,
    pkg: hit.pkg,
    importPath: hit.importPath ?? null,
    module: hit.module,
    purpose: intent?.purpose ?? null,
    category: intent?.category ?? null,
    relationships: intent?.relationships ?? null,
    stateTokens: intent?.stateTokens ?? null,
    antiPatterns: intent?.antiPatterns ?? null,
    props: hit.props ?? null,
    variants: hit.variants ?? null,
    snippets: props?.snippets ?? null,
  };
}

function cmdDocs() {
  const manifest = loadManifest(root);
  if (!manifest) return console.error("docs: no manifest.");
  if (!args.length) return console.error("usage: brand-ui docs <Component> [more...]");
  const rows = flat(manifest);
  const records = json ? [] : null;
  for (const name of args) {
    const hit = rows.find((r) => r.name.toLowerCase() === name.toLowerCase());
    if (!hit) {
      if (json) {
        records.push({ name, found: false });
      } else {
        console.log(`# ${name}\n  not found. Try: brand-ui search ${name}\n`);
      }
      continue;
    }
    if (json) {
      records.push(docsJsonRecord(hit, extractProps(hit.module, hit.name)));
      continue;
    }
    console.log(`# ${hit.name}  (${hit.pkg})`);
    if (hit.importPath) console.log(`import from: ${hit.importPath}`);
    console.log(`source: ${hit.module}`);
    // Intent metadata (#80): purpose / relationships / state→token / anti-patterns.
    // The agent-distinctive layer types can't encode — print it ABOVE the prop
    // table so an agent reads "what's correct/wrong" before "what's possible".
    const intent = hit.intent;
    if (intent) {
      if (intent.purpose)
        console.log(`purpose: ${intent.purpose}${intent.category ? `  [${intent.category}]` : ""}`);
      const rel = intent.relationships || {};
      const relLines = [
        rel.usedInside?.length && `used inside: ${rel.usedInside.join(", ")}`,
        rel.contains?.length && `contains: ${rel.contains.join(", ")}`,
        rel.pairsWith?.length && `pairs with: ${rel.pairsWith.join(", ")}`,
        rel.avoidNextTo?.length && `avoid next to: ${rel.avoidNextTo.join(", ")}`,
      ].filter(Boolean);
      for (const l of relLines) console.log(`  ${l}`);
      if (intent.stateTokens && Object.keys(intent.stateTokens).length) {
        console.log("state → token:");
        for (const [state, tok] of Object.entries(intent.stateTokens))
          console.log(`  ${state}: ${tok}`);
      }
      if (intent.antiPatterns?.length) {
        console.log("anti-patterns (avoid):");
        for (const ap of intent.antiPatterns) console.log(`  ✗ ${ap}`);
      }
    }
    // Resolved prop table (#79): own-declared props with optionality, type and
    // TSDoc, plus the `extends` clause. When the docgen pass (ADR 0013) enriched
    // this entry, own-declared props carry resolved defaults/descriptions and a
    // `resolved` map holds the expanded INHERITED prop surface — printed below.
    if (hit.props) {
      if (hit.props.extends?.length) {
        const note = hit.props.resolved
          ? "inherited — expanded below"
          : "inherited props — read source/types";
        console.log(`extends: ${hit.props.extends.join(", ")}  (${note})`);
      }
      if (hit.props.props?.length) {
        console.log("props (own-declared):");
        for (const p of hit.props.props) {
          const req = p.optional ? "?" : "";
          const def = p.defaultValue !== undefined ? `  = ${p.defaultValue}` : "";
          const desc = p.description ? `  — ${p.description}` : "";
          console.log(`  ${p.name}${req}: ${p.type}${def}${desc}`);
        }
      }
      // Resolved inherited props (react-docgen-typescript). Only present after
      // `pnpm manifest` ran with the devDep installed; absent → this is skipped.
      const resolved = hit.props.resolved;
      if (resolved && Object.keys(resolved).length) {
        console.log("props (inherited, resolved):");
        for (const name of Object.keys(resolved).sort((a, b) => a.localeCompare(b))) {
          const r = resolved[name];
          const req = r.optional === false ? "" : "?";
          const type = r.type ? `: ${r.type}` : "";
          const def = r.defaultValue !== undefined ? `  = ${r.defaultValue}` : "";
          const desc = r.description ? `  — ${r.description}` : "";
          console.log(`  ${name}${req}${type}${def}${desc}`);
        }
      }
    }
    const props = extractProps(hit.module, hit.name);
    if (props?.snippets?.length) {
      console.log("```ts");
      console.log(props.snippets.join("\n\n"));
      console.log("```");
    } else if (!hit.props) {
      console.log(`(read ${hit.module} for the full API — never guess props.)`);
    }
    if (hit.variants?.variants) {
      console.log("variants (expanded from cva — these are the real values):");
      for (const [group, values] of Object.entries(hit.variants.variants)) {
        const def = hit.variants.defaultVariants?.[group];
        const rendered = values.map((v) => (v === def ? `${v} (default)` : v)).join(" | ");
        console.log(`  ${group}: ${rendered}`);
      }
    }
    console.log("");
  }
  // A single query prints its record directly; multiple queries print an array
  // (one record per queried name, in the order given) — same convention as the
  // markdown loop, one entry per name.
  if (json) console.log(JSON.stringify(records.length === 1 ? records[0] : records, null, 2));
}

// ---- static audit (token/style/anti-slop lint; the rendered + contrast pass lives in the skill) ----
// The rule set + per-line scanner live in lib/audit.mjs (extracted so they're
// unit-tested AND shared with the WP-15 anti-slop CI gate without duplicating the
// patterns). The rendered passes (real WCAG contrast via screenshot-diff, layout
// overflow, clipped overlays, the register-gated perceptual tells) need a browser
// and live in the brand-ui-audit skill.

function walk(dir, acc) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".git" || e === "dist" || e === "storybook-static") continue;
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (/\.(tsx|jsx|css|html)$/.test(e)) acc.push(p);
  }
  return acc;
}

function cmdAudit() {
  const target = args[0];
  if (!target)
    return console.error(
      "usage: brand-ui audit <path> [--json] [--strict] [--register=product|brand]",
    );
  const abs = resolve(target);
  if (!existsSync(abs)) return console.error(`audit: not found: ${target}`);
  const files = statSync(abs).isDirectory() ? walk(abs, []) : [abs];
  // Judge against the ACTIVE taste profile, not a hardcoded "product" (#108).
  // Resolved from the TARGET first, so the `brand-ui.config.json` the scaffold
  // wrote beside a generated app wins over the cwd/monorepo root.
  const taste = activeTaste(loadManifest(root), abs);
  const findings = [];
  for (const f of files) {
    // themes.css is the ONE place raw colors are allowed
    const isThemeFile = /themes\.css$/.test(f) || /registry\/themes\//.test(f);
    const isCss = /\.css$/.test(f);
    const text = readFileSync(f, "utf8");
    for (const finding of scanText(text, { isCss, isThemeFile, register: taste.register })) {
      findings.push({ ...finding, file: f.replace(root ? root + "/" : "", "") });
    }
  }
  // Three buckets, because the headline used to lie: content slop was counted as
  // "advisory" while the skills called it blocking. It is its own bucket now, and
  // `--strict` turns "blocks done" into an EXIT CODE instead of a paragraph.
  const slop = findings.filter((f) => f.category === "content-slop");
  const contentSlop = slop.length;
  const blocking = findings.filter((f) => !f.advisory && f.category !== "content-slop");
  const advisory = findings.filter((f) => f.advisory && f.category !== "content-slop");
  const strict = flags.has("--strict");
  const failed = blocking.length > 0 || contentSlop > 0;
  const fail = () => {
    if (strict && failed) process.exit(1);
  };
  if (json) {
    out({
      files: files.length,
      taste,
      strict,
      failed,
      blocking: blocking.length,
      contentSlop,
      advisory: advisory.length,
      findings,
    });
    return fail();
  }
  console.log(
    `brand-ui audit — scanned ${files.length} file(s): ${blocking.length} style issue(s), ` +
      `${contentSlop} content-slop (blocking), ${advisory.length} advisory.`,
  );
  console.log(
    `judged against: register ${taste.register} · density ${taste.density} · motion ${taste.motion} · expressiveness ${taste.expressiveness}  [${taste.source}]`,
  );
  warnProjectMotionFull(taste);
  for (const f of blocking.slice(0, 100))
    console.log(`  ${f.file}:${f.line}  [${f.rule}] ${f.msg}`);
  for (const f of slop.slice(0, 100))
    console.log(`  ${f.file}:${f.line}  [${f.rule}] (content slop) ${f.msg}`);
  for (const f of advisory.slice(0, 40))
    console.log(`  ${f.file}:${f.line}  [${f.rule}] (advisory) ${f.msg}`);
  if (contentSlop) {
    console.log(
      `\n${contentSlop} content-slop occurrence(s) — placeholder names / fake-perfect numbers / slop brand`,
    );
    console.log(
      `names. In GENERATED app output these block "done": replace them with real domain content from the spec.`,
    );
  }
  if (strict) {
    console.log(
      `\n--strict: exiting ${failed ? 1 : 0} (${blocking.length} blocking style + ${contentSlop} content-slop).`,
    );
  } else if (failed) {
    console.log(`\nRe-run with --strict to make this a non-zero exit (the "blocks done" gate).`);
  }
  console.log(
    `\nNote: this is the static pass (token/style + content & visual anti-slop). For rendered WCAG`,
  );
  console.log(
    `contrast, cross-theme visual review, and the register-gated/perceptual tells (anti-card,`,
  );
  console.log(
    `3-equal-cards, motion intensity), use the brand-ui-audit skill (drives a browser, all themes).`,
  );
  return fail();
}

// ---- experience engine (scaffold/scan/map/codemod) — VP-01 #121 ------------
// The deterministic backend the vibe-coder-plugin flows call. Skeletons +
// stable contracts here; full behavior lands in VP-02 (scaffold) / VP-03
// (scan/map/codemod). Each prints its `--json` shape, or a short human summary;
// a `status: "error"` result exits 1 so callers/CI can branch on it.

function engineEmit(result, lines) {
  if (json) console.log(JSON.stringify(result, null, 2));
  else for (const l of lines) console.log(l);
  // `partial` (scaffold: some files already existed, so what landed is an
  // incomplete app) is a failure the caller must see — never a silent exit 0.
  if (result.status === "error" || result.status === "partial") process.exit(1);
}

/** `--write <dir>` / `--out <dir>`: the flag parser keeps flags out of `args`. */
function flagValue(...names) {
  for (const name of names) {
    const i = rest.indexOf(name);
    if (i !== -1 && rest[i + 1] && !rest[i + 1].startsWith("--")) return rest[i + 1];
    const inline = rest.find((a) => a.startsWith(`${name}=`));
    if (inline) return inline.slice(name.length + 1);
  }
  return null;
}

/** The "make it runnable" block a STANDALONE scaffold ends with (#263). */
function installLines(install) {
  if (!install?.standalone) return [];
  // The registry step only exists for a PRIVATE or mirrored scope. On public
  // npm `install.npmrc` is empty, and printing an "authenticate" heading over
  // nothing would send the reader hunting for a token that does not exist — so
  // the step is dropped and the remaining ones renumber.
  const steps = [
    ...(install.npmrc ? [["registry (.npmrc)", install.npmrc.split("\n")]] : []),
    ["install", [install.addCommand, install.peerCommand]],
    [
      "CSS entry (skip the @source lines and it renders UNSTYLED)",
      [install.css.import, ...install.css.sources],
    ],
    ...(install.extras.length ? [["one-time side-effect imports", install.extras]] : []),
  ];
  return [
    "",
    "  Make it runnable (standalone)",
    ...steps.flatMap(([title, lines], i) => [
      `  ── ${i + 1}. ${title} ──`,
      ...lines.map((l) => `     ${l}`),
    ]),
    `  Full recipe: ${install.docs}`,
  ];
}

function cmdScaffold() {
  const target = flagValue("--write", "--out");
  const dryRun = flags.has("--dry-run");
  // `--write <dir>`'s VALUE is a positional-looking token — drop it so the spec is
  // found regardless of flag order.
  const specArg = args.find((a) => a !== target);

  // Emission is explicit: no --write/--dry-run ⇒ read-only plan, exactly as before.
  if (target || dryRun) {
    const r = emitScaffold(specArg, {
      root,
      target: target ?? ".",
      dryRun,
      force: flags.has("--force"),
    });
    if (r.status === "error") return engineEmit(r, [`scaffold: ${r.error}`]);
    return engineEmit(r, [
      `brand-ui scaffold — ${r.status}${r.dryRun ? " (dry run)" : ""}`,
      `  archetype: ${r.plan.spec.archetype} · theme: ${r.plan.theme} · title: ${r.plan.spec.title}`,
      `  target: ${r.target}`,
      ...r.written.map((f) => `  ${r.dryRun ? "would write" : "wrote"}: ${f}`),
      ...r.skipped.map(
        (f) =>
          `  skipped (exists): ${f}${r.missingCritical?.includes(f) ? "  ← app incomplete" : ""}`,
      ),
      ...(r.todos.length ? ["  TODO(spec) — the spec did not answer these:"] : []),
      ...r.todos.map((t) => `    · ${t}`),
      `  audit: ${r.audit.issues} issue(s), ${r.audit.advisory} advisory (static token/anti-slop pass)`,
      ...r.audit.findings.map((f) => `    ${f}`),
      ...installLines(r.plan.install),
      ...r.notes.map((n) => `  · ${n}`),
    ]);
  }

  const r = planScaffold(specArg, { root });
  if (r.status === "error") return engineEmit(r, [`scaffold: ${r.error}`]);
  const t = r.template;
  engineEmit(r, [
    `brand-ui scaffold — ${r.status}`,
    `  archetype: ${r.spec.archetype} · theme: ${r.theme} · title: ${r.spec.title}`,
    `  template: ${t.name} (manifest: ${t.inManifest ? "yes" : "no"}, ${r.files.length} file(s) to write)`,
    `  playbook: ${r.playbook.path} (${r.playbook.exists ? "found" : "missing"})`,
    ...installLines(r.install),
    ...r.notes.map((n) => `  · ${n}`),
  ]);
}

/**
 * Write the rendered migration markdown into `--out <dir>`. This is the ONLY
 * place the brownfield path touches the filesystem, and it only ever creates the
 * three files `renderMigrationDocs` produces — it never reads, moves or rewrites
 * a source file (VP-03 #124: migration analysis stays read-only).
 *
 * @param {Record<string,string>} docs - filename → markdown.
 * @param {string[]} only - which of those filenames to write.
 * @returns {string[]} the paths written (absolute).
 */
function writeMigrationDocs(docs, only) {
  const dir = resolve(outDir);
  mkdirSync(dir, { recursive: true });
  const written = [];
  for (const name of only) {
    if (!docs[name]) continue;
    const file = join(dir, name);
    writeFileSync(file, docs[name]);
    written.push(file);
  }
  return written;
}

function cmdScan() {
  const r = scanRepo(args[0]);
  if (r.status === "error") return engineEmit(r, [`scan: ${r.error}`]);
  const c = r.components;
  const top = c.top
    .slice(0, 8)
    .map((x) => `${x.name}(${x.count})`)
    .join(", ");
  const written = outDir ? writeMigrationDocs(renderMigrationDocs(r), ["repo-profile.md"]) : [];
  if (written.length) r.written = written;
  engineEmit(r, [
    `brand-ui scan — ${r.project ?? r.path}`,
    `  framework: ${r.framework} · ui: ${r.uiLibrary.primary} · styling: ${r.styling.primary}`,
    `  components: ${c.filesScanned} file(s), ${c.distinct} distinct, ${c.usages} usage(s)${top ? `; top: ${top}` : ""}`,
    `  imports: ${r.imports.distinct} module(s) · raw values: ${r.tokens.hardcodedColors} colour, ${r.tokens.hardcodedSpacing} spacing, ${r.tokens.fontSizes} font-size`,
    ...written.map((f) => `  wrote ${f}`),
    ...r.notes.map((n) => `  · ${n}`),
  ]);
}

function cmdMap() {
  const r = mapComponents(args[0], { root });
  if (r.status === "error") return engineEmit(r, [`map: ${r.error}`]);
  const s = r.summary;
  // `--out` needs the scan too (repo-profile context) — re-resolve the same input.
  let written = [];
  if (outDir) {
    const scan = readScanInput(args[0]);
    written = writeMigrationDocs(renderMigrationDocs(scan, r), ["analysis.md", "plan.md"]);
    r.written = written;
  }
  engineEmit(r, [
    `brand-ui map — ${r.status}`,
    `  ${MAP_SUMMARY_ORDER.map((k) => `${k}: ${s[k]}`).join(" · ")} · coverage: ${s.coveragePct}%`,
    ...r.mappings
      .slice(0, 20)
      .map(
        (m) =>
          `  ${m.source} → ${m.target ? `${m.target} (${m.pkg})` : "—"} [${m.class}] risk:${m.risk} effort:${m.effort}`,
      ),
    ...written.map((f) => `  wrote ${f}`),
    ...r.notes.map((n) => `  · ${n}`),
  ]);
}

/** Re-read the scan JSON `map` was given, so `--out` can render repo context. */
function readScanInput(input) {
  if (!input) return { project: null };
  try {
    return JSON.parse(readFileSync(resolve(input), "utf8"));
  } catch {
    return { project: null };
  }
}

function cmdCodemod() {
  const mode = flags.has("--apply") ? "apply" : flags.has("--dry-run") ? "dry-run" : "generate";
  const r = planCodemod(args[0], { mode });
  if (r.status === "error") return engineEmit(r, [`codemod: ${r.error}`]);
  engineEmit(r, [
    `brand-ui codemod — ${r.mode} (${r.status})`,
    `  tool: ${r.tool}`,
    ...r.phases.map((p) => `  phase ${p.name}: ${p.transforms.length} transform(s)`),
    ...r.notes.map((n) => `  · ${n}`),
  ]);
}

// Stable display order for the `map` class summary (matches MAP_CLASSES).
const MAP_SUMMARY_ORDER = ["direct", "props", "compose", "gap", "drop"];

/**
 * `brand-ui mcp` (WP-03 #81): a persistent, dependency-free MCP server over the
 * CLI engine, so agents get always-on ground truth WITHOUT booting Storybook.
 * stdio transport — stdout carries the JSON-RPC stream, so the ready banner goes
 * to STDERR (writing it to stdout would corrupt the protocol). Lazily imported so
 * the read commands stay free of the MCP code in consuming projects.
 */
async function cmdMcp() {
  const { runMcpServer } = await import("../lib/mcp.mjs");
  process.stderr.write(
    "brand-ui MCP server ready (stdio). Tools: info, search, docs, tokens, audit.\n",
  );
  await runMcpServer({ root });
}

const commands = {
  info: cmdInfo,
  manifest: cmdManifest,
  context: cmdContext,
  gen: cmdGen,
  mcp: cmdMcp,
  search: cmdSearch,
  docs: cmdDocs,
  audit: cmdAudit,
  scaffold: cmdScaffold,
  scan: cmdScan,
  map: cmdMap,
  codemod: cmdCodemod,
};

const GENERAL_HELP = `brand-ui <command>

  info [--json]          Project context: packages, themes, tokens, registry, rules
  manifest [--write]     Generate the component manifest (ground truth for the skill)
  context [--check]      Generate portable agent context files (docs context)
  gen [--check]          Generate doc regions (package tables, decision summary) in the hand docs
  mcp                    Persistent MCP server (stdio) over the engine — works with Storybook down
  search <query>         Find components / hooks / registry items / archetype playbooks
                         (a whole-screen intent like "dashboard" routes to its playbook)
  docs <Component...>    Locate a component and print its real props from source
      [--json]           …or emit the same data as structured JSON
  audit <path> [--json]  Static token/style + content & visual anti-slop lint
                         [--strict] exit 1 on any blocking style finding or content
                         slop (the "blocks done" gate for generated output)
                         [--register=product|brand] overrides the active taste profile

  scaffold <app-spec.md> Plan a born-compliant app from an app-spec (greenfield)
      [--write <dir>]    …and EMIT a RUNNABLE app: index.html, src/{App,main}.tsx,
      [--dry-run]        src/styles.css, vite.config.ts, tsconfig.json, app-spec.md,
      [--force]          CLAUDE.md, AGENTS.md, brand-ui-context.md, eslint.config.js,
                         a CI workflow and package.json. Without --write nothing is
                         written; a target that already has some of these is
                         reported "partial" (exit 1), never a silent success.
  scan [path]            Read-only repo profile: framework, UI lib, styling, components (VP-03)
  map <scan.json>        Map existing components → brand-ui via the manifest (VP-03)
  codemod <map.json>     Plan AST codemods [--dry-run|--apply] — read-only until VP-03

--json (agent-consumable) is supported by info, search, scan, map, audit and
docs. The brand-ui skill + vibe-coder-plugin flows call these so behavior is
deterministic, never guessed.

--help / -h on ANY subcommand (e.g. \`brand-ui context --help\`) prints that
subcommand's usage and exits 0 WITHOUT running it — help never has side effects.

--out <dir> (scan, map) writes the migration deliverables:
  scan . --out migration/          → migration/repo-profile.md
  map scan.json --out migration/   → migration/analysis.md + migration/plan.md
It is the ONLY write in the brownfield path — no source file is ever touched.`;

/**
 * Per-subcommand usage text for the terminal `--help`/`-h` check below (#323).
 * Mirrors the one-liner each subcommand already documents in `GENERAL_HELP` /
 * its own usage-on-error message, so there is one place per command to update.
 */
const SUBCOMMAND_HELP = {
  info: "usage: brand-ui info [--json]\n  Project context: packages, themes, tokens, registry, rules",
  manifest:
    "usage: brand-ui manifest [--write]\n  Generate the component manifest (ground truth for the skill)",
  context:
    "usage: brand-ui context [--check]\n  Generate portable agent context files (docs context)",
  gen: "usage: brand-ui gen [--check]\n  Generate doc regions (package tables, decision summary) in the hand docs",
  mcp: "usage: brand-ui mcp\n  Persistent MCP server (stdio) over the engine — works with Storybook down",
  search:
    "usage: brand-ui search <query>\n  Find components / hooks / registry items / archetype playbooks",
  docs: "usage: brand-ui docs <Component...> [--json]\n  Locate a component and print its real props from source (or structured JSON with --json)",
  audit:
    "usage: brand-ui audit <path> [--json] [--strict] [--register=product|brand]\n  Static token/style + content & visual anti-slop lint",
  scaffold:
    "usage: brand-ui scaffold <app-spec.md> [--write <dir>] [--dry-run] [--force]\n  Plan / emit a born-compliant app from an app-spec",
  scan: "usage: brand-ui scan [path] [--out <dir>]\n  Read-only repo profile: framework, UI lib, styling, components",
  map: "usage: brand-ui map <scan.json> [--out <dir>]\n  Map existing components → brand-ui via the manifest",
  codemod:
    "usage: brand-ui codemod <map.json> [--dry-run|--apply]\n  Plan AST codemods — read-only until VP-03",
};

// ---- terminal --help/-h (#323) ----------------------------------------------
// Runs BEFORE any command handler. `context`/`gen`/`manifest` (and friends)
// otherwise write generated artifacts as their normal behavior — a `--help`/`-h`
// flag on a subcommand must never reach that code, no matter what the
// subcommand is or whether it's even a known one.
if (
  cmd &&
  cmd !== "help" &&
  cmd !== "--help" &&
  cmd !== "-h" &&
  (flags.has("--help") || rest.includes("-h"))
) {
  console.log(SUBCOMMAND_HELP[cmd] ?? GENERAL_HELP);
  process.exit(0);
}

if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
  console.log(GENERAL_HELP);
} else if (commands[cmd]) {
  commands[cmd]();
} else {
  console.error(`Unknown command: ${cmd}. Run 'brand-ui help'.`);
  process.exit(1);
}
