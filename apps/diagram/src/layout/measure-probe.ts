/**
 * Wave-2 review M2/M5 — measure a piece of chrome before React Flow draws it. ELK needs an
 * edge label's box and a zone header's minimum width UP FRONT, but neither exists in the
 * DOM at that moment (a label is placed from the layout; a zone header truncates to the
 * width the layout gave it). A probe is the same markup with the same classes, built
 * offscreen at its intrinsic width (`w-max`), so the browser's own fonts, density and
 * letter-spacing decide the size — no per-character estimate.
 *
 * Nothing is cached until the web fonts have loaded (a fallback font measures differently).
 * Returns `undefined` where there is no layout engine (jsdom, SSR): callers keep their
 * defaults.
 */

/** One element of a probe: a tag's class list plus children (text or elements). */
export interface ProbeSpec {
  className: string;
  children?: readonly (ProbeSpec | string)[];
}

export interface ProbeSize {
  width: number;
  height: number;
}

function build(doc: Document, spec: ProbeSpec): HTMLElement {
  const element = doc.createElement("span");
  element.className = spec.className;
  for (const child of spec.children ?? []) {
    element.append(typeof child === "string" ? doc.createTextNode(child) : build(doc, child));
  }
  return element;
}

const cache = new Map<string, ProbeSize | undefined>();

/** Whether a measurement can be kept: web fonts have settled. */
function fontsSettled(doc: Document): boolean {
  return doc.fonts?.status === undefined || doc.fonts.status === "loaded";
}

/**
 * The laid-out size of `spec`, rendered offscreen into `document.body` (so it inherits the
 * theme and density attributes on `<html>`, which are part of the cache key), then removed. The root is `w-max`, so the
 * width is the content's intrinsic width. `key` identifies the content for the cache.
 */
export function measureProbe(key: string, spec: ProbeSpec): ProbeSize | undefined {
  if (typeof document === "undefined" || !document.body) return undefined;
  const root = document.documentElement;
  // A theme may bring its own font; density scales every type role.
  const fullKey = [root.getAttribute("data-theme"), root.getAttribute("data-density"), key].join(
    "|",
  );
  if (cache.has(fullKey)) return cache.get(fullKey);
  const host = build(document, {
    className: "pointer-events-none invisible fixed start-0 top-0 flex w-max",
    children: [spec],
  });
  document.body.append(host);
  const rect = (host.firstElementChild ?? host).getBoundingClientRect();
  host.remove();
  const size = rect.width > 0 ? { width: rect.width, height: rect.height } : undefined;
  if (size && fontsSettled(document)) cache.set(fullKey, size);
  return size;
}
