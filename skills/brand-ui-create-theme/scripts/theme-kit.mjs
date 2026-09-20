#!/usr/bin/env node
/**
 * theme-kit — the measuring half of the brand-ui-create-theme / brand-ui-update-theme skills.
 * Zero dependencies, Node >= 18. The agent researches and decides; this script does the maths
 * it must never do by hand: colour conversion, contrast, token coverage, encoding an SVG for
 * the app-level logo override, and the proposal page.
 *
 *   node theme-kit.mjs oklch <colour>...                       hex / rgb() / hsl() / named → oklch()
 *   node theme-kit.mjs contrast <fg> <bg>                      WCAG ratio + AA verdict
 *   node theme-kit.mjs svg <file.svg>                          logo override value + aspect (APP-level, never a theme)
 *   node theme-kit.mjs contract [--from <css>]                 token contract (installed tokens package)
 *   node theme-kit.mjs apply --base <css|builtin:light|builtin:dark> --name <family-scheme>
 *                            --scheme <light|dark> --proposal <p.json> --out <css> [--header <text>]
 *   node theme-kit.mjs audit <css>... [--contract <css>]       coverage, color-scheme, AA ink pairs
 *   node theme-kit.mjs proposal <p.json> --draft light=<css> [--draft dark=<css>] --out <html>
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// ── colour ───────────────────────────────────────────────────────────────────

const NAMED = { white: [255, 255, 255], black: [0, 0, 0] };

/** Round to `d` decimals and print without trailing zeros (`150.0` → `150`). */
const fmt = (n, d) => String(Number(n.toFixed(d)) + 0);

const num = (s, scale = 1) =>
  s.endsWith("%") ? (Number(s.slice(0, -1)) / 100) * scale : Number(s);

/** Split `a, b, c / d` or `a b c / d` into channel strings and an optional alpha string. */
function channels(inner) {
  const [main, slashAlpha] = inner.split("/");
  const parts = main.split(/[\s,]+/).filter(Boolean);
  const alpha = slashAlpha?.trim() ?? (parts.length === 4 ? parts.pop() : undefined);
  return { parts, alpha };
}

/** Any supported colour → `{ rgb: [r,g,b] in 0..1 (sRGB, gamma-encoded), alpha }`, or null. */
function parseColor(input) {
  const s = String(input).trim().toLowerCase();
  if (NAMED[s]) return { rgb: NAMED[s].map((v) => v / 255), alpha: 1 };
  let m = s.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const v = h.match(/../g).map((x) => parseInt(x, 16) / 255);
    return { rgb: v.slice(0, 3), alpha: v[3] ?? 1 };
  }
  m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const { parts, alpha } = channels(m[1]);
    if (parts.length !== 3) return null;
    const rgb = parts.map((p) => num(p, 255) / 255);
    return valid(rgb, alpha);
  }
  m = s.match(/^hsla?\(([^)]+)\)$/);
  if (m) {
    const { parts, alpha } = channels(m[1]);
    if (parts.length !== 3) return null;
    const h = (((Number(parts[0].replace(/deg$/, "")) % 360) + 360) % 360) / 60;
    const sat = num(parts[1]);
    const light = num(parts[2]);
    const c = (1 - Math.abs(2 * light - 1)) * sat;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const [r, g, b] = [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ][Math.floor(h) % 6];
    const o = light - c / 2;
    return valid([r + o, g + o, b + o], alpha);
  }
  m = s.match(/^oklch\(([^)]+)\)$/);
  if (m) {
    const { parts, alpha } = channels(m[1]);
    if (parts.length !== 3) return null;
    const [l, c, h] = [num(parts[0]), Number(parts[1]), Number(parts[2])];
    if (![l, c, h].every(Number.isFinite)) return null;
    return valid(oklchToSrgb(l, c, h), alpha);
  }
  return null;
}

function valid(rgb, alphaRaw) {
  const alpha = alphaRaw === undefined ? 1 : num(alphaRaw);
  return [...rgb, alpha].every(Number.isFinite) ? { rgb, alpha } : null;
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);

function oklchToSrgb(l, c, h) {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].map((x) => Math.min(1, Math.max(0, toGamma(x))));
}

/** A colour string → the `oklch(L C H[ / A])` literal the theme engine reads, or null. */
export function toOklch(input) {
  const s = String(input).trim();
  if (/^oklch\(/i.test(s)) return parseColor(s) ? s.replace(/\s+/g, " ") : null;
  const p = parseColor(s);
  if (!p) return null;
  const [r, g, b] = p.rgb.map(toLinear);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.hypot(A, B);
  const achromatic = Number(C.toFixed(3)) === 0;
  const H = achromatic ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  const alpha = p.alpha < 1 ? ` / ${fmt(p.alpha, 3)}` : "";
  return `oklch(${fmt(L, 3)} ${achromatic ? "0" : fmt(C, 3)} ${fmt(H, 1)}${alpha})`;
}

/** WCAG 2 contrast ratio between two opaque colours in any supported syntax (null if unreadable). */
export function contrast(fg, bg) {
  const lum = (v) => {
    const p = parseColor(v);
    if (!p) return null;
    const [r, g, b] = p.rgb.map((c) => toLinear(Math.min(1, Math.max(0, c))));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = lum(fg);
  const b = lum(bg);
  if (a == null || b == null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const isTranslucent = (v) => (parseColor(v)?.alpha ?? 1) < 1;

/** Any supported colour → OKLab [L, a, b], or null. */
function toOklab(v) {
  const p = parseColor(v);
  if (!p) return null;
  const [r, g, b] = p.rgb.map(toLinear);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

/** Minimum OKLab distance between adjacent categorical chart series (same bar as the repo's role-distinctness rule). */
export const MIN_SERIES_DELTA_E = 0.05;
/** Chrome sits at least this much OKLab lightness below the canvas (the repo's surface-elevation rule). */
export const MIN_CHROME_RECESS = 0.02;

// ── logo ─────────────────────────────────────────────────────────────────────

/**
 * An SVG document → `{ token: 'url("data:image/svg+xml,…")', aspect }` for the
 * `--brand-logo-*` tokens. Those belong in an APP's own CSS, never in a theme file: a theme
 * carrying logo art ships someone else's trademark to everyone who installs the family, and
 * `pnpm check --rule community-themes` refuses it.
 */
export function svgToToken(svgText) {
  const svg = String(svgText)
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .trim();
  if (!/^<svg[\s>]/i.test(svg)) throw new Error("not an SVG document (must start with <svg)");
  if (/<script/i.test(svg)) throw new Error("SVG contains a script element — refuse it");
  if (/\son[a-z]+\s*=/i.test(svg))
    throw new Error("SVG contains an event handler attribute — refuse it");
  if (/<foreignObject/i.test(svg)) throw new Error("SVG contains foreignObject — refuse it");
  if (
    /(?:href|src)\s*=\s*["']\s*(?:https?:|\/\/)/i.test(svg) ||
    /url\(\s*["']?\s*(?:https?:|\/\/)/i.test(svg)
  )
    throw new Error("SVG references an external resource — inline or remove it");
  const root = svg.match(/^<svg[^>]*>/i)[0];
  const vb = root.match(
    /viewBox\s*=\s*["']\s*([-\d.e]+)[\s,]+([-\d.e]+)[\s,]+([\d.e]+)[\s,]+([\d.e]+)/i,
  );
  if (!vb) throw new Error("SVG has no viewBox — add one (the logo must scale)");
  const aspect = Number((Number(vb[3]) / Number(vb[4])).toFixed(4));
  const body = svg
    .replace(/"/g, "'")
    .replace(
      /[%#<>{};]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
    );
  return { token: `url("data:image/svg+xml,${body}")`, aspect };
}

// ── theme CSS ────────────────────────────────────────────────────────────────

/** Theme-overridable engine properties that are NOT contract tokens (same set as the repo gate). */
export const isOverridable = (name) =>
  name.startsWith("--font-") ||
  name === "--radius-base" ||
  /^--type-(size|leading|weight|tracking)-[\w-]+$/.test(name);

/** Declarations of a block body, splitting on `;` outside quotes and parentheses. */
function declarations(body) {
  const decls = new Map();
  let depth = 0;
  let quote = null;
  let start = 0;
  const flush = (end) => {
    const stmt = body.slice(start, end).trim();
    const i = stmt.indexOf(":");
    if (i > 0)
      decls.set(
        stmt.slice(0, i).trim(),
        stmt
          .slice(i + 1)
          .trim()
          .replace(/\s+/g, " "),
      );
    start = end + 1;
  };
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quote) {
      if (ch === quote && body[i - 1] !== "\\") quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === ";" && depth === 0) flush(i);
  }
  flush(body.length);
  return decls;
}

/** Every `[data-theme="…"] { … }` block: `{ name, decls: Map }`. */
export function themeBlocks(cssText) {
  const css = String(cssText).replace(/\/\*[\s\S]*?\*\//g, "");
  return [...css.matchAll(/\[data-theme="([^"]+)"\]\s*\{([\s\S]*?)\n\}/g)].map((m) => ({
    name: m[1],
    decls: declarations(m[2]),
  }));
}

/** Contract token names from a reference theme stylesheet (its first block). */
export function contractFromCss(cssText) {
  const [block] = themeBlocks(cssText);
  if (!block) throw new Error("reference stylesheet has no [data-theme] block");
  return [...block.decls.keys()].filter((k) => k.startsWith("--") && !isOverridable(k));
}

/** A token value as written into the stylesheet: colours become oklch(), everything else verbatim. */
function tokenValue(value) {
  const v = String(value).trim();
  if (/^(var|url|calc|color-mix)\(/i.test(v)) return v;
  return toOklch(v) ?? v;
}

/**
 * The base theme block, renamed to `name`, with `tokens` ({ "--token": value }) applied.
 * A token that is neither in the base nor theme-overridable throws: it would be outside the
 * contract and silently do nothing.
 *
 * When the base already IS the `name` block (updating a family), values are replaced in
 * place so the file's header and inline comments survive; otherwise (a new family from a
 * reference theme) the block is rebuilt under `header`.
 */
export function applyTokens(baseCss, { name, scheme, header, tokens = {} }) {
  const [block] = themeBlocks(baseCss);
  if (!block) throw new Error("base stylesheet has no [data-theme] block");
  for (const token of Object.keys(tokens))
    if (!block.decls.has(token) && !isOverridable(token))
      throw new Error(`${token} is outside the token contract — check the name`);

  if (block.name === name) {
    let css = String(baseCss);
    const appended = [];
    for (const [token, value] of Object.entries(tokens)) {
      const re = new RegExp(`(^\\s*${token.replace(/[-]/g, "\\-")}\\s*:)[^;]*;`, "m");
      if (block.decls.has(token))
        css = css.replace(re, (_m, head) => `${head} ${tokenValue(value)};`);
      else appended.push(`  ${token}: ${tokenValue(value)};`);
    }
    if (scheme) css = css.replace(/(^\s*color-scheme\s*:)[^;]*;/m, `$1 ${scheme};`);
    if (appended.length) {
      const open = css.indexOf(`[data-theme="${name}"]`);
      const close = css.indexOf("\n}", open);
      css = `${css.slice(0, close)}\n${appended.join("\n")}${css.slice(close)}`;
    }
    return css;
  }

  const decls = new Map(block.decls);
  if (scheme) decls.set("color-scheme", scheme);
  for (const [token, value] of Object.entries(tokens)) decls.set(token, tokenValue(value));
  const lines = [...decls].map(([k, v]) => `  ${k}: ${v};`);
  const comment = header ? `/* ${String(header).replace(/\*\//g, "* /")} */\n` : "";
  return `${comment}[data-theme="${name}"] {\n${lines.join("\n")}\n}\n`;
}

/** Ink pairs checked at WCAG AA — the same set the repo's community-themes gate enforces. */
export const INK_PAIRS = [
  ["--foreground", "--background"],
  ["--card-foreground", "--card"],
  ["--popover-foreground", "--popover"],
  ["--muted-foreground", "--background"],
  ["--muted-foreground", "--card"],
  ["--primary-foreground", "--primary"],
  ["--secondary-foreground", "--secondary"],
  ["--accent-foreground", "--accent"],
];
export const AA = 4.5;

function resolveVar(name, decls, seen = new Set()) {
  if (seen.has(name)) return null;
  seen.add(name);
  const raw = decls.get(name);
  if (raw == null) return null;
  const alias = raw.match(/^var\(\s*(--[\w-]+)\s*\)$/);
  return alias ? resolveVar(alias[1], decls, seen) : raw;
}

/**
 * Advisory checks the community-themes gate does not run on theme families: adjacent chart
 * series that read as one, chrome that is not recessed below the canvas, a card below the canvas.
 */
function designWarnings({ name, decls }) {
  const warnings = [];
  const lab = (t) => {
    const v = resolveVar(t, decls);
    return v == null ? null : toOklab(v);
  };
  for (let i = 1; i < 12; i++) {
    const a = lab(`--chart-${i}`);
    const b = lab(`--chart-${i + 1}`);
    if (!a || !b) continue;
    const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    if (d < MIN_SERIES_DELTA_E)
      warnings.push(
        `${name}: --chart-${i} and --chart-${i + 1} are only ΔE ${d.toFixed(3)} apart (keep ≥ ${MIN_SERIES_DELTA_E})`,
      );
  }
  const bg = lab("--background");
  const sidebar = lab("--sidebar");
  const card = lab("--card");
  if (bg && sidebar && bg[0] - sidebar[0] < MIN_CHROME_RECESS)
    warnings.push(
      `${name}: --sidebar is not recessed below --background (lightness gap ${(bg[0] - sidebar[0]).toFixed(3)}, keep ≥ ${MIN_CHROME_RECESS})`,
    );
  if (bg && card && card[0] < bg[0] - 0.0005)
    warnings.push(
      `${name}: --card is darker than --background (cards should sit on or above the canvas)`,
    );
  return warnings;
}

/** Audit one stylesheet: `{ blocks, errors, pairs: [{ theme, fg, bg, ratio, pass }] }`. */
export function auditTheme(cssText, contract) {
  const errors = [];
  const pairs = [];
  const blocks = themeBlocks(cssText);
  if (blocks.length !== 1)
    errors.push(`expected exactly one [data-theme] block, found ${blocks.length}`);
  const known = new Set(contract);
  for (const { name, decls } of blocks) {
    const scheme = decls.get("color-scheme");
    if (scheme !== "light" && scheme !== "dark")
      errors.push(`${name}: color-scheme must be light or dark (found ${scheme ?? "none"})`);
    const missing = contract.filter((t) => !decls.has(t));
    if (missing.length)
      errors.push(`${name}: missing ${missing.length} contract token(s): ${missing.join(", ")}`);
    const unknown = [...decls.keys()].filter(
      (k) => k.startsWith("--") && !known.has(k) && !isOverridable(k),
    );
    if (unknown.length)
      errors.push(`${name}: token(s) outside the contract: ${unknown.join(", ")}`);
    for (const [fg, bg] of INK_PAIRS) {
      const f = resolveVar(fg, decls);
      const b = resolveVar(bg, decls);
      if (f == null || b == null) continue;
      if (isTranslucent(f) || isTranslucent(b)) {
        errors.push(`${name}: ${fg} on ${bg} must be opaque to be checked (drop the alpha)`);
        continue;
      }
      const ratio = contrast(f, b);
      const pass = ratio != null && ratio >= AA;
      pairs.push({ theme: name, fg, bg, ratio, pass });
      if (!pass)
        errors.push(
          `${name}: ${fg} on ${bg} is ${ratio?.toFixed(2) ?? "unreadable"}:1 (needs ${AA}:1)`,
        );
    }
  }
  return { blocks: blocks.length, errors, warnings: blocks.flatMap(designWarnings), pairs };
}

// ── proposal page ────────────────────────────────────────────────────────────

export const escapeHtml = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const SWATCHES = [
  [
    "Surfaces",
    [
      "--background",
      "--card",
      "--popover",
      "--muted",
      "--accent",
      "--sidebar",
      "--border",
      "--border-strong",
    ],
  ],
  ["Ink", ["--foreground", "--muted-foreground", "--primary-foreground", "--link"]],
  ["Brand", ["--primary", "--primary-hover", "--secondary", "--ring", "--sidebar-primary"]],
  ["Status", ["--destructive", "--success", "--warning", "--info"]],
  ["Chart", Array.from({ length: 12 }, (_, i) => `--chart-${i + 1}`)],
];

function schemePanel(name, css) {
  const [block] = themeBlocks(css);
  const decls = block?.decls ?? new Map();
  // Coverage is audited on the command line against the real contract; here the block's own
  // names stand in, so the panel shows only readability, colour-scheme and design warnings.
  const own = [...decls.keys()].filter((k) => k.startsWith("--"));
  const { pairs, errors, warnings } = auditTheme(css, own);
  const swatches = SWATCHES.map(
    ([group, tokens]) =>
      `<h4>${group}</h4><div class="sw">${tokens
        .filter((t) => decls.has(t))
        .map(
          (t) =>
            `<figure><span style="background:var(${t})"></span><figcaption><code>${escapeHtml(t)}</code><small>${escapeHtml(resolveVar(t, decls))}</small></figcaption></figure>`,
        )
        .join("")}</div>`,
  ).join("");
  const rows = pairs
    .map(
      (p) =>
        `<tr><td><code>${p.fg}</code> on <code>${p.bg}</code></td><td>${p.ratio.toFixed(2)}:1</td><td class="${p.pass ? "ok" : "bad"}">${p.pass ? "passes" : "fails"} ${AA}:1</td></tr>`,
    )
    .join("");
  const extra = [...errors.filter((e) => !e.includes(" on --")), ...warnings]
    .map((e) => `<li>${escapeHtml(e)}</li>`)
    .join("");
  return `<section class="scheme" data-theme="${escapeHtml(name)}"><h3>${escapeHtml(name)}</h3>
<div class="pv">
  <header><span class="logo">Your logo</span><nav><a href="#">Link</a></nav></header>
  <div class="cardp"><strong>Card title</strong><p>Body text on a card. <span class="mut">Muted supporting text.</span></p>
    <p><button type="button" class="b1">Primary</button> <button type="button" class="b2">Secondary</button></p>
    <p><input aria-label="Sample input" value="Input"></p>
    <p class="tones"><span style="background:var(--destructive)">Error</span><span style="background:var(--success)">Success</span><span style="background:var(--warning)">Warning</span><span style="background:var(--info)">Info</span></p>
    <div class="bars">${Array.from({ length: 12 }, (_, i) => `<i style="background:var(--chart-${i + 1});height:${30 + ((i * 37) % 60)}%"></i>`).join("")}</div>
  </div>
</div>
${swatches}
<h4>Readability (WCAG AA)</h4><table>${rows}</table>${extra ? `<ul class="bad">${extra}</ul>` : ""}
</section>`;
}

/** The proposal as a self-contained HTML page. `drafts` = { light?: css, dark?: css }. */
export function renderProposal(proposal, drafts = {}) {
  for (const [scheme, css] of Object.entries(drafts))
    if (String(css).includes("<"))
      throw new Error(`draft ${scheme} contains "<" — refuse to embed it`);
  const p = proposal ?? {};
  const sources = new Map((p.sources ?? []).map((s) => [s.id, s]));
  const link = (s) =>
    /^https?:\/\//i.test(s?.url ?? "")
      ? `<a href="${escapeHtml(s.url)}" rel="noreferrer noopener">${escapeHtml(s.title || s.url)}</a>`
      : escapeHtml(s?.title || s?.url || "");
  const tokenRows = Object.entries(p.schemes ?? {})
    .flatMap(([scheme, { tokens = {} } = {}]) =>
      Object.entries(tokens).map(([token, t]) => {
        const value = typeof t === "object" ? t : { value: t };
        const shown = String(value.value ?? "").startsWith("url(") ? "(logo image)" : value.value;
        const src = sources.get(value.source);
        return `<tr><td>${escapeHtml(scheme)}</td><td><code>${escapeHtml(token)}</code></td>${p.mode === "update" ? `<td>${escapeHtml(value.current ?? "—")}</td>` : ""}<td>${escapeHtml(shown)}</td><td>${escapeHtml(value.confidence ?? "")}</td><td>${src ? link(src) : escapeHtml(value.source ?? "")}</td><td>${escapeHtml(value.note ?? "")}</td></tr>`;
      }),
    )
    .join("");
  const list = (items, render) =>
    items?.length
      ? `<ul>${items.map((i) => `<li>${render(i)}</li>`).join("")}</ul>`
      : "<p>None.</p>";
  const styles = Object.values(drafts).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(p.label)} theme proposal</title>
<style>
:root{--pg:#fbfbfa;--pg-ink:#1d1d1f;--pg-mut:#5f6368;--pg-line:#d9d9de;--ok:#1b7a3d;--bad:#b3261e;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--pg:#161618;--pg-ink:#ececf0;--pg-mut:#a4a4ab;--pg-line:#3a3a40;--ok:#6fcf8f;--bad:#ff8a80;color-scheme:dark}}
body{margin:0;background:var(--pg);color:var(--pg-ink);font:15px/1.5 system-ui,sans-serif}
main{max-width:1180px;margin:0 auto;padding:24px 16px}
h1{font-size:1.6rem;margin:0 0 4px}h2{margin-top:32px;border-bottom:1px solid var(--pg-line);padding-bottom:4px}
.meta{color:var(--pg-mut)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}
table{border-collapse:collapse;width:100%;font-size:.85rem}td,th{border-bottom:1px solid var(--pg-line);padding:4px 6px;text-align:start;vertical-align:top}
.tablewrap{overflow-x:auto}.ok{color:var(--ok)}.bad{color:var(--bad)}code{font-size:.8rem}
.sw{display:flex;flex-wrap:wrap;gap:8px}.sw figure{margin:0;width:104px}.sw span{display:block;height:40px;border-radius:6px;border:1px solid var(--pg-line)}
.sw figcaption{font-size:.7rem;overflow-wrap:anywhere}.sw small{display:block;color:var(--pg-mut)}
.pv{background:var(--background);color:var(--foreground);font-family:var(--font-sans);border:1px solid var(--pg-line);border-radius:10px;overflow:hidden}
.pv header{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--sidebar,var(--background));border-bottom:1px solid var(--border)}
.pv .logo{display:flex;align-items:center;height:28px;padding:0 8px;border:1px dashed var(--border);border-radius:4px;font-family:var(--font-display);font-size:.8rem;color:var(--muted-foreground)}
.pv a{color:var(--link,var(--primary))}.cardp{margin:14px;padding:14px;background:var(--card);color:var(--card-foreground);border:1px solid var(--border);border-radius:var(--radius-base,8px)}
.cardp strong{font-family:var(--font-display)}.mut{color:var(--muted-foreground)}
.b1,.b2{font:inherit;padding:6px 12px;border-radius:var(--radius-base,8px);border:1px solid transparent}
.b1{background:var(--primary);color:var(--primary-foreground)}.b2{background:var(--secondary);color:var(--secondary-foreground);border-color:var(--border)}
.cardp input{font:inherit;padding:6px 8px;border:1px solid var(--input);border-radius:var(--radius-base,8px);background:var(--card);color:var(--foreground)}
.tones{display:flex;gap:6px;flex-wrap:wrap}.tones span{width:64px;height:20px;border-radius:4px;font-size:0;display:inline-block}
.bars{display:flex;align-items:flex-end;gap:4px;height:64px}.bars i{flex:1;border-radius:2px 2px 0 0}
${styles}
</style></head><body><main>
<h1>${escapeHtml(p.label)} — theme ${p.mode === "update" ? "update" : "proposal"}</h1>
<p class="meta">Family <code>${escapeHtml(p.family)}</code>. Nothing has been written to your project yet.</p>
<p>${escapeHtml(p.summary)}</p>
<h2>Preview</h2><div class="grid">${Object.entries(drafts)
    .map(([scheme, css]) => schemePanel(themeBlocks(css)[0]?.name ?? scheme, css))
    .join("")}</div>
<h2>Fonts</h2>${p.fonts ? `<p>Sans: ${escapeHtml(p.fonts.sans)}<br>Display: ${escapeHtml(p.fonts.display)}<br>Mono: ${escapeHtml(p.fonts.mono)}<br>${escapeHtml(p.fonts.note)}</p>` : "<p>Unchanged.</p>"}
<h2>Researched values</h2><div class="tablewrap"><table><thead><tr><th>Mode</th><th>Token</th>${p.mode === "update" ? "<th>Current</th>" : ""}<th>Proposed</th><th>Confidence</th><th>Source</th><th>Note</th></tr></thead><tbody>${tokenRows}</tbody></table></div>
<h2>Adjusted from the source</h2>${list(p.deviations, (d) => `<code>${escapeHtml(d.token)}</code> (${escapeHtml(d.scheme)}): ${escapeHtml(d.from)} → ${escapeHtml(d.to)} — ${escapeHtml(d.why)}`)}
<h2>Open questions</h2>${list(p.questions, escapeHtml)}
<h2>Sources</h2>${list(p.sources, (s) => `[${escapeHtml(s.id)}] ${link(s)} <span class="meta">(${escapeHtml(s.kind)})</span>`)}
</main></body></html>
`;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

/** The installed tokens package's built-in stylesheet (`light` | `dark`), resolved from cwd. */
function builtinCss(scheme) {
  const req = createRequire(join(process.cwd(), "noop.js"));
  try {
    return req.resolve(`@elabs-ai/components-tokens/themes/${scheme}.css`);
  } catch {
    let dir = process.cwd();
    for (;;) {
      const p = join(
        dir,
        "node_modules",
        "@elabs-ai",
        "components-tokens",
        "dist",
        "themes",
        `${scheme}.css`,
      );
      if (existsSync(p)) return p;
      // Inside the brand-ui source repository itself, the tokens package is a workspace folder.
      const source = join(dir, "packages", "tokens", "src", "themes", `${scheme}.css`);
      if (existsSync(source)) return source;
      if (dirname(dir) === dir) break;
      dir = dirname(dir);
    }
  }
  throw new Error(
    `cannot find the installed @elabs-ai/components-tokens ${scheme}.css — pass a path`,
  );
}

const readCss = (spec) =>
  readFileSync(spec.startsWith("builtin:") ? builtinCss(spec.slice(8)) : resolve(spec), "utf8");

function flags(argv) {
  const out = { _: [], draft: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) out._.push(a);
    else if (a === "--draft") out.draft.push(argv[++i]);
    else out[a.slice(2)] = argv[++i];
  }
  return out;
}

function main([cmd, ...rest]) {
  const f = flags(rest);
  switch (cmd) {
    case "oklch":
      for (const c of f._) console.log(`${c} → ${toOklch(c) ?? "unsupported colour"}`);
      return f._.every((c) => toOklch(c)) ? 0 : 1;
    case "contrast": {
      const r = contrast(f._[0], f._[1]);
      if (r == null) return (console.error("unsupported colour"), 1);
      console.log(
        `${r.toFixed(2)}:1 — ${r >= AA ? "passes" : "fails"} AA text (${AA}:1), ${r >= 3 ? "passes" : "fails"} AA UI/large (3:1)`,
      );
      return 0;
    }
    case "svg": {
      const { token, aspect } = svgToToken(readFileSync(resolve(f._[0]), "utf8"));
      console.log(
        `aspect (width ÷ height): ${aspect}\n${token}\n\n` +
          "Set --brand-logo-mark / --brand-logo-lockup / --brand-logo-lockup-aspect together in the\n" +
          "app's own CSS — a theme ships no logo art.",
      );
      return 0;
    }
    case "contract": {
      const names = contractFromCss(readCss(f.from ?? "builtin:light"));
      console.log(`${names.length} contract tokens\n${names.join("\n")}`);
      return 0;
    }
    case "apply": {
      const proposal = JSON.parse(readFileSync(resolve(f.proposal), "utf8"));
      const raw = proposal.schemes?.[f.scheme]?.tokens ?? {};
      const tokens = Object.fromEntries(
        Object.entries(raw).map(([k, v]) => [k, typeof v === "object" ? v.value : v]),
      );
      const css = applyTokens(readCss(f.base), {
        name: f.name,
        scheme: f.scheme,
        header: f.header,
        tokens,
      });
      writeFileSync(resolve(f.out), css);
      console.log(
        `wrote ${f.out}: [data-theme="${f.name}"], ${Object.keys(tokens).length} researched token(s) applied`,
      );
      return 0;
    }
    case "audit": {
      const contract = contractFromCss(readCss(f.contract ?? "builtin:light"));
      let failed = 0;
      for (const file of f._) {
        const { blocks, errors, warnings, pairs } = auditTheme(
          readFileSync(resolve(file), "utf8"),
          contract,
        );
        console.log(
          `${file}: ${blocks} block(s), ${contract.length} contract tokens, ${pairs.length} ink pairs checked`,
        );
        for (const e of errors) console.log(`  ✗ ${e}`);
        for (const w of warnings) console.log(`  ⚠ ${w}`);
        if (errors.length) failed++;
      }
      console.log(
        failed ? `${failed} of ${f._.length} file(s) failed` : `${f._.length} file(s) passed`,
      );
      return failed ? 1 : 0;
    }
    case "proposal": {
      const proposal = JSON.parse(readFileSync(resolve(f._[0]), "utf8"));
      const drafts = Object.fromEntries(
        f.draft.map((d) => {
          const [scheme, path] = d.split("=");
          return [scheme, readFileSync(resolve(path), "utf8")];
        }),
      );
      writeFileSync(resolve(f.out), renderProposal(proposal, drafts));
      console.log(`wrote ${f.out}`);
      return 0;
    }
    default:
      console.log(
        readFileSync(new URL(import.meta.url), "utf8")
          .match(/\/\*\*([\s\S]*?)\*\//)[1]
          .replace(/^ \* ?/gm, ""),
      );
      return cmd ? 1 : 0;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (err) {
    console.error(`theme-kit: ${err.message}`);
    process.exitCode = 1;
  }
}
