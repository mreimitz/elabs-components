/**
 * registry.mjs — load and validate check rules (`scripts/check/rules/*.mjs`).
 * The rule contract is documented in scripts/check/README.md.
 */
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const RULES_DIR = join(dirname(fileURLToPath(import.meta.url)), "rules");

export const SCOPES = ["themes", "components", "stories", "packages", "registry", "repo"];
export const BASELINES = ["none", "count", "per-file", "keys"];

const DEFAULT_ESLINT_PATTERNS = ["packages/*/src/**/*.{ts,tsx}"];
const DEFAULT_ESLINT_IGNORE = ["**/*.{test,stories}.{ts,tsx}"];

/** Shape problems for one rule (empty = valid). Does not check id uniqueness. */
export function validateRule(rule, source = "?") {
  const errs = [];
  const at = `${source}${rule?.id ? ` (${rule.id})` : ""}`;
  if (!rule || typeof rule !== "object") return [`${source}: default export is not an object`];
  if (typeof rule.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rule.id))
    errs.push(`${at}: id must be kebab-case`);
  if (!SCOPES.includes(rule.scope))
    errs.push(
      `${at}: scope must be one of ${SCOPES.join(" | ")}, got ${JSON.stringify(rule.scope)}`,
    );
  if (typeof rule.doc !== "string" || !rule.doc.trim() || /\n/.test(rule.doc))
    errs.push(`${at}: doc must be a non-empty one-line string`);
  if (!BASELINES.includes(rule.baseline))
    errs.push(`${at}: baseline must be one of ${BASELINES.join(" | ")}`);
  if (typeof rule.run !== "function" && typeof rule.eslint !== "string")
    errs.push(`${at}: needs run(ctx) or eslint: "<plugin>/<rule>"`);
  if (rule.eslint !== undefined && !/^[\w@-]+(?:\/[\w-]+)+$/.test(String(rule.eslint)))
    errs.push(`${at}: eslint must look like "<plugin>/<rule>"`);
  const fx = rule.fixtures;
  if (!fx || !Array.isArray(fx.pass) || !Array.isArray(fx.fail) || fx.fail.length === 0)
    errs.push(`${at}: fixtures must be { pass: [...], fail: [≥1] }`);
  else
    for (const [kind, list] of [
      ["pass", fx.pass],
      ["fail", fx.fail],
    ])
      list.forEach((f, i) => {
        if (!f || typeof f.files !== "object")
          errs.push(`${at}: fixtures.${kind}[${i}].files missing`);
      });
  return errs;
}

/** Validate a whole rule set: per-rule shape + unique ids. */
export function validateRules(rules) {
  const errs = rules.flatMap((r) => validateRule(r.rule, r.source));
  const seen = new Map();
  for (const { rule, source } of rules) {
    if (seen.has(rule?.id))
      errs.push(`${source}: duplicate id "${rule.id}" (also ${seen.get(rule.id)})`);
    else seen.set(rule?.id, source);
  }
  return errs;
}

/** The effective run function (an `eslint` rule without run() lints package src). */
export function runnerFor(rule) {
  if (typeof rule.run === "function") return rule.run;
  return (ctx) =>
    ctx.eslint({
      rules: { [rule.eslint]: "error" },
      patterns: rule.eslintPatterns ?? DEFAULT_ESLINT_PATTERNS,
      ignore: rule.eslintIgnore ?? DEFAULT_ESLINT_IGNORE,
    });
}

/** Load every `*.mjs` in `dir` (sorted), returning `[{ rule, source }]`. */
export async function loadRules(dir = RULES_DIR) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs"))
    .sort();
  const out = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(join(dir, f)).href);
    out.push({ rule: mod.default, source: `rules/${f}` });
  }
  return out;
}
