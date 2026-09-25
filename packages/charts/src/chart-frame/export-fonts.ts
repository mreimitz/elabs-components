/**
 * ChartFrame — web fonts for the PNG export.
 *
 * The PNG is the built SVG drawn as an image, and an SVG image is sandboxed:
 * it cannot load anything the page loaded, the page's `@font-face` web fonts
 * included. Every label then falls back to a system face that runs wider or
 * narrower than the one the layout was measured in — tick labels collide,
 * a legend overruns its keys. This module finds the faces the picture
 * actually uses (by family, style and `unicode-range` against the characters
 * it draws), fetches each once, and embeds them as `data:` URLs in a
 * `<style>` inside the SVG, so the image lays out in the page's font.
 *
 * The SVG FILE export does not call this: it stays small and names the font
 * stack, like any web page (see `export-svg.ts`).
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/** One fetch per font file per page — a second export reuses the first's bytes. */
const fontCache = new Map<string, Promise<string | undefined>>();

/** How long one font file may take before the export goes without it. */
const FONT_FETCH_TIMEOUT_MS = 4000;

const unquote = (family: string) =>
  family
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2")
    .toLowerCase();

/** Splits a `font-family` list on its top-level commas. */
function families(value: string): string[] {
  const out: string[] = [];
  let quote: string | undefined;
  let current = "";
  for (const ch of value) {
    if (quote) {
      if (ch === quote) quote = undefined;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ",") {
      out.push(unquote(current));
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(unquote(current));
  return out.filter(Boolean);
}

/** What the picture draws: the families it names, the characters it draws, whether any of it is italic. */
function collectUsage(svg: SVGSVGElement) {
  const used = new Set<string>();
  let italic = false;
  for (const el of [svg, ...svg.querySelectorAll("*")]) {
    const style = (el as SVGElement).style;
    const family = style?.getPropertyValue("font-family") || el.getAttribute("font-family");
    if (family) for (const name of families(family)) used.add(name);
    const fontStyle = style?.getPropertyValue("font-style") || el.getAttribute("font-style");
    if (fontStyle && fontStyle !== "normal") italic = true;
  }
  const codePoints = new Set<number>();
  for (const text of svg.querySelectorAll("text")) {
    for (const char of text.textContent ?? "") codePoints.add(char.codePointAt(0)!);
  }
  return { used, italic, codePoints };
}

/** True when a `unicode-range` descriptor covers any of `codePoints` (no descriptor covers all). */
function coversAny(unicodeRange: string, codePoints: Set<number>): boolean {
  if (!unicodeRange.trim()) return true;
  const ranges: [number, number][] = [];
  for (const part of unicodeRange.split(",")) {
    const m = /^\s*u\+([0-9a-f?]{1,6})(?:-([0-9a-f]{1,6}))?\s*$/i.exec(part);
    if (!m) continue;
    const [, first, last] = m;
    if (first!.includes("?")) {
      ranges.push([
        Number.parseInt(first!.replaceAll("?", "0"), 16),
        Number.parseInt(first!.replaceAll("?", "f"), 16),
      ]);
    } else {
      const from = Number.parseInt(first!, 16);
      ranges.push([from, last ? Number.parseInt(last, 16) : from]);
    }
  }
  if (ranges.length === 0) return true;
  for (const cp of codePoints) {
    if (ranges.some(([from, to]) => cp >= from && cp <= to)) return true;
  }
  return false;
}

/** Every `@font-face` rule the page can read, with the URL its `url()`s resolve against. */
function* fontFaceRules(): Generator<{ rule: CSSFontFaceRule; base: string }> {
  const visit = function* (
    rules: CSSRuleList,
    base: string,
  ): Generator<{ rule: CSSFontFaceRule; base: string }> {
    for (const rule of rules) {
      if (typeof CSSFontFaceRule !== "undefined" && rule instanceof CSSFontFaceRule) {
        yield { rule, base };
      } else if (typeof CSSImportRule !== "undefined" && rule instanceof CSSImportRule) {
        const sheet = rule.styleSheet;
        if (!sheet) continue;
        let inner: CSSRuleList | undefined;
        try {
          inner = sheet.cssRules;
        } catch {
          continue;
        }
        yield* visit(inner, sheet.href ?? base);
      } else if ("cssRules" in rule && (rule as CSSGroupingRule).cssRules) {
        // @media / @supports / @layer blocks.
        yield* visit((rule as CSSGroupingRule).cssRules, base);
      }
    }
  };
  for (const sheet of document.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      // A cross-origin stylesheet hides its rules; its fonts stay out.
      continue;
    }
    yield* visit(rules, sheet.href ?? document.baseURI);
  }
}

/** The first `url(…)` of a `src` descriptor, resolved to an absolute URL. */
function firstFontUrl(src: string, base: string): string | undefined {
  const m = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/.exec(src);
  const raw = m ? (m[1] ?? m[2] ?? m[3] ?? "").trim() : "";
  if (!raw) return undefined;
  try {
    return new URL(raw, base).href;
  } catch {
    return undefined;
  }
}

function fetchAsDataUrl(url: string): Promise<string | undefined> {
  if (url.startsWith("data:")) return Promise.resolve(url);
  let pending = fontCache.get(url);
  if (!pending) {
    pending = (async () => {
      const controller = typeof AbortController === "undefined" ? undefined : new AbortController();
      const timer = setTimeout(() => controller?.abort(), FONT_FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(url, { signal: controller?.signal });
        if (!response.ok) return undefined;
        const blob = await response.blob();
        return await new Promise<string | undefined>((resolve) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(typeof reader.result === "string" ? reader.result : undefined);
          reader.onerror = () => resolve(undefined);
          reader.readAsDataURL(blob);
        });
      } catch {
        return undefined;
      } finally {
        clearTimeout(timer);
      }
    })();
    fontCache.set(url, pending);
    // A failed fetch may succeed next time (offline, a dev server restarting).
    void pending.then((value) => {
      if (value === undefined) fontCache.delete(url);
    });
  }
  return pending;
}

/**
 * Embeds, as a `<style>` of `data:`-URL `@font-face` rules, every page web
 * font `svg` draws with. Never throws: a face that cannot be read or fetched
 * is left out, and the image falls back within its font stack as before.
 */
export async function embedExportFonts(svg: SVGSVGElement): Promise<void> {
  if (typeof document === "undefined" || typeof fetch !== "function") return;
  const { used, italic, codePoints } = collectUsage(svg);
  if (used.size === 0 || codePoints.size === 0) return;

  const faces: Promise<string | undefined>[] = [];
  for (const { rule, base } of fontFaceRules()) {
    const style = rule.style;
    if (!used.has(unquote(style.getPropertyValue("font-family")))) continue;
    const fontStyle = style.getPropertyValue("font-style").trim();
    if (!italic && (fontStyle.startsWith("italic") || fontStyle.startsWith("oblique"))) continue;
    if (!coversAny(style.getPropertyValue("unicode-range"), codePoints)) continue;
    const url = firstFontUrl(style.getPropertyValue("src"), base);
    if (!url) continue;
    const descriptors: string[] = [];
    for (let i = 0; i < style.length; i++) {
      const name = style.item(i);
      if (name === "src") continue;
      descriptors.push(`${name}:${style.getPropertyValue(name)}`);
    }
    faces.push(
      fetchAsDataUrl(url).then((dataUrl) =>
        dataUrl ? `@font-face{${descriptors.join(";")};src:url("${dataUrl}")}` : undefined,
      ),
    );
  }
  const css = (await Promise.all(faces)).filter(Boolean).join("\n");
  if (!css) return;

  const defs = document.createElementNS(SVG_NS, "defs");
  defs.setAttribute("data-slot", "chart-export-fonts");
  const styleEl = document.createElementNS(SVG_NS, "style");
  styleEl.textContent = css;
  defs.append(styleEl);
  // A root <title> must stay the first child — it names the picture.
  const first = svg.firstElementChild;
  if (first?.localName === "title") first.after(defs);
  else svg.prepend(defs);
}
