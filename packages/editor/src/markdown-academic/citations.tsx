"use client";

/**
 * Citations — Pandoc / Better-BibTeX keys (`[@smith2020]`) resolved through a
 * consumer hook (`resolveCitation(key) => CitationData | null`).
 *
 * The library NEVER owns the bibliography database or CSL formatting — that lives
 * in the app (pass `formatted` for a citeproc-rendered reference, or the lightweight
 * `author`/`year`/`title` bits for the built-in assembler). The library renders:
 * inline cites (numeric `[1]` or author-year `(Smith 2020)`) and a generated
 * bibliography, with consistent numbering shared between them.
 *
 * `[@key]` stays a plain text node in mdast (it is NOT markdown link syntax), so a
 * text-node transform (`remarkBrandCitations`) rewrites the spans — the same shape
 * as the wikilink resolver. Numbering is owned by `collectCitations` (a single
 * pre-pass over the source) so an inline `[1]` and bibliography entry 1 always agree.
 */
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { Separator } from "@elabs-ai/components-ui";
import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { visit } from "unist-util-visit";

/* ------------------------------------------------------------------ */
/* Public contract                                                      */
/* ------------------------------------------------------------------ */

/**
 * Resolved citation data, returned by the consumer's `resolveCitation` hook.
 * Provide `formatted` (your CSL/citeproc output) for a verbatim bibliography
 * entry; otherwise the built-in assembler uses `author` / `year` / `title` /
 * `container`. The library does NOT format CSL.
 */
export interface CitationData {
  /** The citation key (echoed back; optional). */
  key?: string;
  /** Inline author label for author-year + bibliography lead (e.g. `"Smith et al."`). */
  author?: string;
  /** Publication year. */
  year?: string | number;
  /** Work title. */
  title?: string;
  /** Container — journal, book, publisher, or site. */
  container?: string;
  /** Canonical URL (the bibliography link). */
  url?: string;
  /** DOI — linked as `https://doi.org/<doi>` when no `url` is given. */
  doi?: string;
  /** Fully-formatted reference (app's CSL output) — rendered verbatim when set. */
  formatted?: string;
}

/** Consumer hook: citation key → data, or `null` when unknown (renders `[?]`). */
export type ResolveCitation = (key: string) => CitationData | null;

/** Inline citation rendering style. */
export type CitationStyle = "numeric" | "author-year";

/** One resolved citation with its assigned number (numbers skip unresolved keys). */
export interface ResolvedCitation {
  key: string;
  /** 1-based number (numeric style + bibliography); `undefined` when unresolved. */
  n?: number;
  data: CitationData | null;
}

/** A single `@key` reference inside a citation bracket. */
export interface CiteItem {
  key: string;
  /** Locator text after the key, e.g. `"p. 5"`. */
  locator?: string;
  /** `-@key` → suppress the author in author-year style. */
  suppressAuthor?: boolean;
  /** Prose before the key, e.g. `"see"`. */
  prefix?: string;
}

/* ------------------------------------------------------------------ */
/* Parsing (shared by the transform AND the numbering pre-pass)         */
/* ------------------------------------------------------------------ */

// A key char-class wide enough for Better-BibTeX / CSL keys without swallowing
// trailing punctuation: letters, digits, and `_:.#$%&+?<>~/-` (no whitespace).
const ITEM_RE = /^\s*([^@]*?)\s*(-)?@([\p{L}\d][\w:.#$%&+?<>~/-]*)\s*(.*)$/u;

/** Parse one `;`-separated cite item; `null` if it has no `@key`. */
function parseItem(raw: string): CiteItem | null {
  const m = ITEM_RE.exec(raw);
  if (!m) return null;
  const [, prefix, suppress, key, rest] = m;
  if (!key) return null;
  const locator = (rest ?? "").replace(/^\s*,\s*/, "").trim();
  const item: CiteItem = { key };
  if (suppress) item.suppressAuthor = true;
  if (prefix?.trim()) item.prefix = prefix.trim();
  if (locator) item.locator = locator;
  return item;
}

/**
 * Parse a bracket's inner text into cite items, or `null` if it is not a citation
 * (no `@key` token) — so ordinary `[bracketed]` prose is left untouched.
 */
export function parseCitationBracket(inner: string): CiteItem[] | null {
  if (!inner.includes("@")) return null;
  const items: CiteItem[] = [];
  for (const part of inner.split(";")) {
    const item = parseItem(part);
    if (!item) return null; // every `;`-part must be a valid cite, else it's prose
    items.push(item);
  }
  return items.length > 0 ? items : null;
}

// Find candidate citation brackets in a text node. Excludes a preceding `]` or `!`
// (reference-link / image syntax) and a following `(`/`[` (inline / reference link).
const BRACKET_RE = /(?<![\]!])\[([^[\]]+)\](?![([])/g;

/* ------------------------------------------------------------------ */
/* collectCitations — the single numbering authority                    */
/* ------------------------------------------------------------------ */

export interface CollectedCitations {
  /** Resolved citations in first-appearance order (the bibliography list). */
  order: ResolvedCitation[];
  /** Lookup by key — both resolved and unresolved keys. */
  byKey: Map<string, ResolvedCitation>;
}

/**
 * Scan the markdown body once, in document order, resolving each unique citation
 * key and numbering the resolved ones. The inline transform stays numbering-free
 * and reads back from `byKey`, so inline `[1]` and bibliography entry 1 agree.
 */
export function collectCitations(markdown: string, resolve: ResolveCitation): CollectedCitations {
  const byKey = new Map<string, ResolvedCitation>();
  const order: ResolvedCitation[] = [];
  let m: RegExpExecArray | null;
  BRACKET_RE.lastIndex = 0;
  while ((m = BRACKET_RE.exec(markdown)) !== null) {
    const items = parseCitationBracket(m[1]!);
    if (!items) continue;
    for (const { key } of items) {
      if (byKey.has(key)) continue;
      const data = resolve(key);
      const entry: ResolvedCitation = { key, data };
      if (data) {
        entry.n = order.length + 1;
        order.push(entry);
      }
      byKey.set(key, entry);
    }
  }
  return { order, byKey };
}

/* ------------------------------------------------------------------ */
/* remark transform: `[@key]` → <brand-cite>                            */
/* ------------------------------------------------------------------ */

export const CITE_TAG = "brand-cite";
export const CITE_PROP = "dataCite";
const CITE_ATTR = "data-cite";

interface CitePayload {
  items: CiteItem[];
  /** Original bracket text, for the graceful all-unresolved fallback. */
  original: string;
}

interface MdTextNode {
  type: string;
  value?: string;
}

/** Rewrite `[@key]` citation spans in text nodes into `<brand-cite>` elements. */
export function remarkBrandCitations() {
  return (tree: unknown) => {
    visit(tree as never, "text", (node: MdTextNode, index: number | undefined, parent) => {
      const p = parent as { children?: unknown[] } | undefined;
      const text = node.value;
      if (!p?.children || index == null || typeof text !== "string" || !text.includes("@")) return;

      const next: unknown[] = [];
      let last = 0;
      BRACKET_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = BRACKET_RE.exec(text)) !== null) {
        const items = parseCitationBracket(m[1]!);
        if (!items) continue;
        if (m.index > last) next.push({ type: "text", value: text.slice(last, m.index) });
        const payload: CitePayload = { items, original: m[0] };
        next.push({
          type: "brandCite",
          data: { hName: CITE_TAG, hProperties: { [CITE_PROP]: JSON.stringify(payload) } },
        });
        last = m.index + m[0].length;
      }
      if (next.length === 0) return;
      if (last < text.length) next.push({ type: "text", value: text.slice(last) });
      p.children.splice(index, 1, ...next);
      return index + next.length;
    });
  };
}

/* ------------------------------------------------------------------ */
/* Context (numbering shared by inline cites + bibliography)            */
/* ------------------------------------------------------------------ */

interface CitationState {
  byKey: Map<string, ResolvedCitation>;
  order: ResolvedCitation[];
  style: CitationStyle;
}

const CitationContext = createContext<CitationState | null>(null);

export interface CitationProviderProps extends CollectedCitations {
  style: CitationStyle;
  children: ReactNode;
}

export function CitationProvider({ byKey, order, style, children }: CitationProviderProps) {
  return (
    <CitationContext.Provider value={{ byKey, order, style }}>{children}</CitationContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Rendering helpers                                                    */
/* ------------------------------------------------------------------ */

function hoverTitle(data: CitationData): string {
  if (data.formatted) return data.formatted;
  const parts = [
    data.author,
    data.year != null ? `(${data.year})` : undefined,
    data.title,
    data.container,
  ].filter(Boolean);
  return parts.join(". ");
}

function CiteLink({ entry, label }: { entry: ResolvedCitation; label: string }) {
  // For numeric style the visible label is a bare "[1]" — give AT a real name
  // (the `title` tooltip is for mouse users and is not reliably announced).
  const name = entry.data ? hoverTitle(entry.data) : entry.key;
  return (
    <a
      href={`#ref-${cssId(entry.key)}`}
      title={entry.data ? hoverTitle(entry.data) : undefined}
      aria-label={`Citation: ${name}`}
      // #317/#399 — the on-surface `-text` rung, NOT the `--primary` FILL: an
      // inline cite is body text inside a paragraph and owes WCAG 1.4.3 AA
      // (4.5:1), which `--primary` missed at 4.29-4.31:1 in light. The
      // resting `underline` is the separate 1.4.1 non-colour cue (#317's
      // link-in-text-block half) — keep both.
      className="text-primary-text underline hover:underline focus-visible:rounded-sm focus-ring"
    >
      {label}
    </a>
  );
}

/** Make a citation key safe for use in an element id / fragment. */
function cssId(key: string): string {
  return key.replace(/[^\w-]/g, "-");
}

/* ------------------------------------------------------------------ */
/* InlineCite — the <brand-cite> renderer                               */
/* ------------------------------------------------------------------ */

type TagProps = { node?: unknown; children?: ReactNode } & Record<string, unknown>;

function readCite(rest: TagProps): CitePayload | null {
  const raw = (rest[CITE_ATTR] as string | undefined) ?? (rest[CITE_PROP] as string | undefined);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CitePayload;
  } catch {
    return null;
  }
}

/** Renderer for the inline `<brand-cite>` element produced by the transform. */
export function InlineCite({ node: _n, children: _c, ...rest }: TagProps) {
  const ctx = useContext(CitationContext);
  const payload = readCite(rest);
  if (!payload) return null;
  if (!ctx) return <span>{payload.original}</span>;

  const resolved = payload.items.map((it) => ({ it, entry: ctx.byKey.get(it.key) }));
  const anyResolved = resolved.some((r) => r.entry?.data);
  if (!anyResolved) {
    // Graceful: nothing resolved → keep the literal, marked for sighted + AT.
    return (
      <span className="text-muted-foreground" title="Unresolved citation">
        {payload.original}
      </span>
    );
  }

  const numeric = ctx.style === "numeric";
  const open = numeric ? "[" : "(";
  const close = numeric ? "]" : ")";
  const sep = numeric ? ", " : "; ";

  return (
    <span className="whitespace-nowrap text-meta tabular-nums">
      {open}
      {resolved.map(({ it, entry }, i) => {
        const label = numeric ? numericLabel(it, entry) : authorYearLabel(it, entry);
        return (
          <span key={`${it.key}-${i}`}>
            {i > 0 ? sep : null}
            {entry?.data ? (
              <CiteLink entry={entry} label={label} />
            ) : (
              <span className="text-muted-foreground" title={`Unresolved: @${it.key}`}>
                {label}
              </span>
            )}
          </span>
        );
      })}
      {close}
    </span>
  );
}

function numericLabel(it: CiteItem, entry?: ResolvedCitation): string {
  if (!entry?.data || entry.n == null) return "?";
  return it.locator ? `${entry.n}, ${it.locator}` : String(entry.n);
}

function authorYearLabel(it: CiteItem, entry?: ResolvedCitation): string {
  if (!entry?.data) return `@${it.key}?`;
  const d = entry.data;
  const head = it.suppressAuthor ? "" : d.author ? `${d.author} ` : "";
  const year = d.year != null ? String(d.year) : "";
  const core = `${head}${year}`.trim() || d.title || it.key;
  const prefixed = it.prefix ? `${it.prefix} ${core}` : core;
  return it.locator ? `${prefixed}, ${it.locator}` : prefixed;
}

/* ------------------------------------------------------------------ */
/* Bibliography                                                         */
/* ------------------------------------------------------------------ */

function assembledReference(data: CitationData): string {
  if (data.formatted) return data.formatted;
  const parts = [
    data.author,
    data.year != null ? `(${data.year}).` : undefined,
    data.title ? `${data.title}.` : undefined,
    data.container ? `${data.container}.` : undefined,
  ].filter(Boolean);
  return parts.join(" ");
}

function referenceHref(data: CitationData): string | undefined {
  if (data.url) return data.url;
  if (data.doi) return `https://doi.org/${data.doi}`;
  return undefined;
}

export interface BibliographyProps extends Omit<HTMLAttributes<HTMLElement>, "children" | "style"> {
  /** Resolved citations; defaults to the citations collected by `MarkdownPreview`. */
  entries?: ResolvedCitation[];
  /** Numbering style; defaults to the preview's `citationStyle`. */
  style?: CitationStyle;
  /** Section heading label. Default `"References"`. */
  title?: string;
}

/**
 * The generated reference list. Reads the preview's collected citations by default
 * (the `::bibliography` block), or accepts an explicit `entries` array standalone.
 * One focal separation gesture — a top `Separator` — over a quiet label + list.
 */
export const Bibliography = forwardRef<HTMLElement, BibliographyProps>(function Bibliography(
  { entries, style, title = "References", className, ...props },
  ref,
) {
  const ctx = useContext(CitationContext);
  const labelId = useId();
  const list = entries ?? ctx?.order ?? [];
  const resolvedStyle = style ?? ctx?.style ?? "numeric";
  const numeric = resolvedStyle === "numeric";

  if (list.length === 0) return null;

  return (
    <section ref={ref} aria-labelledby={labelId} className={cn("mt-8", className)} {...props}>
      <Separator className="mb-3" />
      <p id={labelId} className="mb-2 text-meta font-medium text-muted-foreground">
        {title}
      </p>
      <ol className="space-y-2">
        {list.map((entry) => {
          const data = entry.data;
          if (!data) return null;
          const href = referenceHref(data);
          return (
            <li
              key={entry.key}
              id={`ref-${cssId(entry.key)}`}
              className="flex gap-2 text-caption text-foreground scroll-mt-4"
            >
              {numeric && entry.n != null ? (
                <span className="shrink-0 tabular-nums text-muted-foreground">[{entry.n}]</span>
              ) : null}
              <span className="min-w-0">
                {assembledReference(data)}{" "}
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    // #317/#399 — bibliography DOI/URL is body text: `-text` rung
                    // + resting underline (the non-colour cue).
                    className="break-words text-primary-text underline underline-offset-2 hover:underline focus-visible:rounded-sm focus-ring"
                  >
                    {data.url ?? `doi:${data.doi}`}
                  </a>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
});
