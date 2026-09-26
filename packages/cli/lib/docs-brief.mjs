/**
 * `brand-ui docs <Component> --brief` / MCP `docs { detail: "brief" }`.
 *
 * The full docs entry is the right answer to "tell me everything" and the wrong
 * first read: `docs DataTable` is ~29 KB (≈7k tokens) because every prop carries
 * its whole design history, the inherited surface is expanded, and the CLI prints
 * the source interface a second time. An agent composing a screen from eight
 * components pays that eight times before writing a line.
 *
 * The brief keeps what decides correct usage — the import line, the purpose, what
 * it pairs with, the anti-patterns, the real cva values, and every own prop with
 * its type, default and the FIRST sentence of its description — and says how to
 * get the rest. Pure over a `flat()` row; no I/O.
 */

/**
 * The brief card when it is actually smaller, otherwise the full one. A small
 * component or a constant has nothing to trim, and the brief's footer would make
 * its card LONGER than the full entry — so `--brief` / `detail: "brief"` never
 * costs more than the full read, and on those entries returns the full card.
 */
export function smallerCard(brief, full) {
  return Buffer.byteLength(brief) < Buffer.byteLength(full) ? brief : full;
}

const MAX_DESC = 140;
const MAX_TYPE = 90;

/** First sentence, trimmed to `max` on a word boundary. */
export function firstSentence(text, max = MAX_DESC) {
  const s = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  const end = s.search(/[.!?](\s|$)/);
  let out = end === -1 ? s : s.slice(0, end + 1);
  if (out.length > max) out = `${out.slice(0, out.lastIndexOf(" ", max - 1) || max - 1)}…`;
  return out;
}

import { apiFallbackPath, deprecationText } from "./core.mjs";

const clip = (s, max) => (String(s).length > max ? `${String(s).slice(0, max - 1)}…` : String(s));

/**
 * @param {object} hit  a `flat(manifest)` row
 * @param {{ storyUrl?: (id: string) => string }} [opts]
 * @returns {string}
 */
export function renderDocsBrief(hit, { storyUrl, repoRoot = null } = {}) {
  const lines = [`# ${hit.name}  (${hit.pkg})`];
  if (hit.kind === "component" || hit.kind === "hook")
    lines.push(`import: import { ${hit.name} } from "${hit.importPath || hit.pkg}";`);
  if (hit.storyId && storyUrl) lines.push(`story: ${storyUrl(hit.storyId)}`);
  const intent = hit.intent;
  if (intent?.purpose)
    lines.push(`purpose: ${intent.purpose}${intent.category ? `  [${intent.category}]` : ""}`);
  const rel = intent?.relationships || {};
  for (const [label, key] of [
    ["used inside", "usedInside"],
    ["contains", "contains"],
    ["pairs with", "pairsWith"],
    ["avoid next to", "avoidNextTo"],
  ])
    if (rel[key]?.length) lines.push(`  ${label}: ${rel[key].join(", ")}`);
  if (intent?.antiPatterns?.length) {
    lines.push("anti-patterns (avoid):");
    for (const ap of intent.antiPatterns) lines.push(`  x ${firstSentence(ap, 200)}`);
  }
  if (hit.variants?.variants) {
    lines.push("variants:");
    for (const [group, values] of Object.entries(hit.variants.variants)) {
      const def = hit.variants.defaultVariants?.[group];
      lines.push(
        `  ${group}: ${values.map((v) => (v === def ? `${v} (default)` : v)).join(" | ")}`,
      );
    }
  }
  // Own-declared props only: the inherited ones (`from`, RM-179) stay on the full card,
  // which the closing line points to.
  const own = (hit.props?.props || []).filter((p) => !p.from);
  if (own.length) {
    lines.push("props:");
    for (const p of own) {
      const def = p.defaultValue !== undefined ? ` = ${clip(p.defaultValue, 40)}` : "";
      const dep = p.deprecated ? `  ${deprecationText(p.deprecated)}` : "";
      const desc = firstSentence(p.description);
      lines.push(
        `  ${p.name}${p.optional ? "?" : ""}: ${clip(p.type, MAX_TYPE)}${def}${dep}${desc ? `  — ${desc}` : ""}`,
      );
    }
  }
  if (hit.props?.extends?.length)
    lines.push(`also accepts: everything from ${clip(hit.props.extends.join(", "), 160)}`);
  if (!hit.props?.props?.length && !hit.variants && !intent)
    lines.push(`(no recorded API — read ${apiFallbackPath(hit, repoRoot)}; never guess props.)`);
  if (hit.alsoExportedFrom?.length)
    lines.push(`also exported from: ${hit.alsoExportedFrom.join(", ")}  (same component)`);
  lines.push(
    "",
    `brief view — full prop history, inherited props and state→token map: docs ${hit.name} (without --brief / detail:"full")`,
  );
  return lines.join("\n");
}
