#!/usr/bin/env node
/**
 * Sanitizer-passthrough gate (#36).
 *
 * WHY. `MarkdownView`/`MessageResponse` wrap Streamdown, which installs its
 * sanitiser chain (`rehype-raw` → `rehype-sanitize` → `rehype-harden`) as the
 * DEFAULT VALUE of its `rehypePlugins` prop — a plain JS default parameter, not
 * a merge. A wrapper that re-exports `ComponentProps<typeof Streamdown>` (or
 * `Omit`s everything EXCEPT `rehypePlugins`) hands every consumer a full XSS
 * bypass: pass that prop and Streamdown's sanitiser is gone, letting
 * model-authored markdown execute script in the host page.
 *
 * SCOPE (narrowed by the PR #74 review, round 1). `dangerousProps` lists only
 * props that REPLACE the sanitiser itself. `remarkPlugins` is deliberately NOT
 * one: the remark stage runs upstream of the rehype chain, Streamdown derives
 * that chain without reading `remarkPlugins`, and everything a remark plugin
 * injects is still sanitised downstream (measured — see
 * `packages/ai/src/_streamdown-safety.ts`). Listing it here would gate a
 * capability, not a hazard.
 * Every repo gate (`typecheck`, `lint`, `test`, `build`) was green over this —
 * a type surface is not a security control, and nothing else in the battery
 * looks for it. This gate does.
 *
 * WHAT IT CHECKS. For every source module in a distributable package that
 * imports one of the SAFE_RENDERERS below:
 *   1. TYPE LEVEL — every `ComponentProps<typeof <Renderer>>` usage that is not
 *      a single-property indexed access (`…>["components"]`) must sit inside an
 *      `Omit<…, …>` whose key list names every one of the renderer's
 *      `dangerousProps`. A bare `ComponentProps<typeof Streamdown> & {...}` (no
 *      Omit at all) or an `Omit` that forgets a dangerous key both fail — this
 *      is exactly the shape `MessageResponseProps` shipped in before #36.
 *   2. RUNTIME LEVEL — a module that renders `<Renderer … {...props}>` must
 *      call `stripSanitizerOverrides(props)` (or delete every dangerous prop
 *      key off `props` inline) BEFORE that spread. `Omit` alone is erased at
 *      compile time; a JS consumer, an `any`, or a wider spread object still
 *      reaches the renderer unless the runtime strip is there too — see
 *      `packages/ai/src/_streamdown-safety.ts`.
 *
 * ADDING A FUTURE SAFE-BY-DEFAULT RENDERER: add a row to SAFE_RENDERERS. No
 * other change is needed — both checks are generic over the renderer's name
 * and its dangerous prop list.
 *
 * HONEST LIMIT. This is a text scan, not a type checker or an AST: it can be
 * fooled by a prop spread under a different local name (only literal `props`
 * is recognised — see `_streamdown-i18n.ts`'s convention, which every wrapper
 * in this repo already follows) or a renderer re-exported under an alias. It
 * proves the two shipped wrappers (and any future one following the same
 * `props` convention) close both halves of the passthrough; it does not prove
 * every conceivable indirection is caught.
 *
 * Usage: node scripts/check-sanitizer-passthrough.mjs
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { distributablePackages, REPO_ROOT } from "./lib/distributables.mjs";

/**
 * Renderers this repo wraps that ship a sanitiser as a DELETABLE prop
 * default. Add a row here for any future safe-by-default markdown/HTML
 * renderer — nothing else in this script needs to change.
 */
export const SAFE_RENDERERS = [
  {
    module: "streamdown",
    component: "Streamdown",
    dangerousProps: ["rehypePlugins"],
  },
];

const isOurSource = (p) =>
  /\.(tsx?|jsx?)$/.test(p) && !/\.(test|stories)\.[jt]sx?$/.test(p) && !p.endsWith(".d.ts");

function walk(dir, test, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".turbo" || entry.name === "dist")
        continue;
      walk(p, test, out);
    } else if (test(p)) out.push(p);
  }
  return out;
}

/** Does this file import `component` (named import) from `moduleName`? */
export function importsComponent(text, moduleName, component) {
  const re = new RegExp(
    `import\\s*(?:type\\s*)?\\{[^}]*\\b${component}\\b[^}]*\\}\\s*from\\s*["']${moduleName}["']`,
  );
  return re.test(text);
}

/**
 * TYPE-LEVEL check. Every `ComponentProps<typeof <component>>` usage that is
 * NOT a single-property indexed access (`…>["foo"]` — safe, extracts one
 * member's type only) must sit inside an `Omit<…, keys>` naming every
 * dangerous prop.
 */
export function findTypePassthroughs(text, component, dangerousProps) {
  const problems = [];
  const omitRe = new RegExp(
    `Omit<\\s*ComponentProps<\\s*typeof\\s+${component}\\s*>\\s*,\\s*((?:"[^"]*"|'[^']*'|\\s|\\|)+)>`,
    "g",
  );
  const coveredRanges = [];
  let om;
  while ((om = omitRe.exec(text))) {
    const keyList = om[1];
    const cpIndex = text.indexOf("ComponentProps<", om.index);
    const cpEnd = text.indexOf(">", text.indexOf(`typeof ${component}`, cpIndex)) + 1;
    coveredRanges.push([cpIndex, cpEnd]);
    const missing = dangerousProps.filter((p) => !new RegExp(`["']${p}["']`).test(keyList));
    if (missing.length) {
      problems.push({
        kind: "incomplete-omit",
        index: om.index,
        detail: `Omit<> exists but does not exclude: ${missing.join(", ")}`,
      });
    }
  }

  const cpRe = new RegExp(`ComponentProps<\\s*typeof\\s+${component}\\s*>`, "g");
  let cm;
  while ((cm = cpRe.exec(text))) {
    if (coveredRanges.some(([s, e]) => cm.index >= s && cm.index < e)) continue;
    // A single-property indexed access (`ComponentProps<typeof X>["components"]`)
    // extracts one member's type only — it cannot leak the dangerous props.
    const after = text.slice(cm.index + cm[0].length).trimStart();
    if (after.startsWith("[")) continue;
    problems.push({
      kind: "raw-passthrough",
      index: cm.index,
      detail: `\`ComponentProps<typeof ${component}>\` used without an Omit<> excluding ${dangerousProps.join(", ")}`,
    });
  }
  return problems;
}

/**
 * RUNTIME-LEVEL check. A `<component … {...props}>` JSX element must be
 * preceded (textually) by a `stripSanitizerOverrides(props)` call, or an
 * inline `delete props.<key>` for every dangerous prop.
 */
export function findUnstrippedSpreads(text, component, dangerousProps) {
  const problems = [];
  const tagRe = new RegExp(`<${component}\\b`, "g");
  let tm;
  while ((tm = tagRe.exec(text))) {
    // Walk the opening tag tracking `{}` depth so a `>` inside an attribute
    // expression (e.g. `onClick={() => {}}`) doesn't end the tag early.
    let i = tm.index;
    let depth = 0;
    let tagEnd = text.length;
    for (; i < text.length; i++) {
      const c = text[i];
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) {
        tagEnd = i + 1;
        break;
      }
    }
    const body = text.slice(tm.index, tagEnd);
    if (!/\{\.\.\.props\}/.test(body)) continue; // this element doesn't spread `props`

    const before = text.slice(0, tm.index);
    const hasHelperCall = /stripSanitizerOverrides\s*\(\s*props\s*\)/.test(before);
    const hasInlineDeletes = dangerousProps.every((p) =>
      new RegExp(`delete\\s+props(?:\\.${p}\\b|\\[["']${p}["']\\])`).test(before),
    );
    if (!hasHelperCall && !hasInlineDeletes) {
      problems.push({
        kind: "unstripped-spread",
        index: tm.index,
        detail:
          `<${component}> spreads {...props} without a preceding stripSanitizerOverrides(props) ` +
          `call (or an inline delete of every dangerous prop)`,
      });
    }
  }
  return problems;
}

/** Scan every distributable package's `src/` for a passthrough of a safe renderer. */
export function scanPackages(root = REPO_ROOT) {
  const findings = [];
  for (const pkg of distributablePackages(root)) {
    for (const file of walk(join(pkg.dir, "src"), isOurSource)) {
      const text = readFileSync(file, "utf8");
      for (const renderer of SAFE_RENDERERS) {
        if (!importsComponent(text, renderer.module, renderer.component)) continue;
        const problems = [
          ...findTypePassthroughs(text, renderer.component, renderer.dangerousProps),
          ...findUnstrippedSpreads(text, renderer.component, renderer.dangerousProps),
        ];
        for (const problem of problems)
          findings.push({ file, renderer: renderer.component, ...problem });
      }
    }
  }
  return findings;
}

// ───────────────────────── CLI ─────────────────────────
function main() {
  const findings = scanPackages(REPO_ROOT);
  if (findings.length) {
    console.error(`\n✖ sanitizer-passthrough: ${findings.length} finding(s):\n`);
    for (const f of findings) {
      const rel = f.file.startsWith(REPO_ROOT) ? relative(REPO_ROOT, f.file) : f.file;
      console.error(`  - ${rel} (${f.renderer}, ${f.kind}): ${f.detail}`);
    }
    console.error(
      "\nA wrapper around a safe-by-default renderer (Streamdown today) must both:\n" +
        "  1. Omit<> every dangerous prop (rehypePlugins for Streamdown) at\n" +
        "     the type level, AND\n" +
        "  2. call stripSanitizerOverrides(props) before spreading {...props} onto the\n" +
        "     renderer, so a JS consumer / `any` / wider spread can't reach it either.\n" +
        "See packages/ai/src/_streamdown-safety.ts and issue #36.\n",
    );
    process.exit(1);
  }
  console.log(
    "✔ sanitizer-passthrough: every safe-renderer wrapper closes both halves (type + runtime).",
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
