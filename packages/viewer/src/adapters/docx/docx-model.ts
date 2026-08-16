/**
 * Word markup → a block model.
 *
 * ## Why this exists at all
 *
 * mammoth converts a `.docx` into an HTML **string**. Rendering that string
 * would mean `dangerouslySetInnerHTML`, which is three separate problems: it
 * puts third-party markup past the token layer, it needs a sanitizer to be safe
 * at all, and it makes the surface unusable under a Trusted-Types policy (a raw
 * `innerHTML` write throws during commit and takes the React root down with it —
 * see `docs/CSP-AND-NETWORK.md`).
 *
 * So the HTML is parsed and thrown away, and what survives is a small model of
 * blocks and inline runs that React renders as real elements. **The parse IS the
 * allowlist**: a tag this file does not name contributes nothing but its text,
 * so there is no denylist to keep up to date, no `<script>` to strip, and no
 * sanitizer dependency. It is also why the viewer adds no CSP sink.
 */

import { createTextIndexBuilder, type TextIndex } from "../../core/text-index";

/** A styled span of text inside a block. */
export interface DocxRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Present only for a link whose scheme survived {@link safeHref}. */
  href?: string;
}

export type DocxBlock =
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; runs: DocxRun[] }
  | { type: "paragraph"; runs: DocxRun[] }
  | { type: "list"; ordered: boolean; items: DocxRun[][] }
  | { type: "table"; head?: string[]; rows: string[][] }
  | { type: "image"; src: string; alt?: string };

/** Schemes a link may keep. Anything else (notably `javascript:`) becomes plain text. */
const SAFE_SCHEMES = ["http:", "https:", "mailto:", "tel:"];

/**
 * The href, or `undefined` when it is not a scheme we will hand to the browser.
 * Relative hrefs are dropped too — a Word document's internal bookmarks point at
 * anchors that do not exist on the host page.
 */
export function safeHref(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, "https://viewer.invalid");
    return SAFE_SCHEMES.includes(url.protocol) && !value.startsWith("#") ? url.href : undefined;
  } catch {
    return undefined;
  }
}

interface RunStyle {
  bold?: boolean;
  italic?: boolean;
  href?: string;
}

/** Collect the inline runs under a node, carrying style down the tree. */
function collectRuns(node: Node, style: RunStyle = {}, out: DocxRun[] = []): DocxRun[] {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3 /* TEXT_NODE */) {
      const text = child.nodeValue ?? "";
      if (text) out.push({ text, ...style });
      continue;
    }
    if (child.nodeType !== 1 /* ELEMENT_NODE */) continue;

    const element = child as Element;
    const tag = element.tagName.toLowerCase();
    if (tag === "br") {
      out.push({ text: "\n", ...style });
      continue;
    }
    const next: RunStyle = { ...style };
    if (tag === "strong" || tag === "b") next.bold = true;
    if (tag === "em" || tag === "i") next.italic = true;
    if (tag === "a") {
      const href = safeHref(element.getAttribute("href"));
      if (href) next.href = href;
    }
    collectRuns(element, next, out);
  }
  return out;
}

/** Merge adjacent runs that carry identical styling — fewer, longer spans. */
function compact(runs: DocxRun[]): DocxRun[] {
  const merged: DocxRun[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && last.bold === run.bold && last.italic === run.italic && last.href === run.href) {
      last.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  return merged.filter((run) => run.text.trim() !== "" || run.text.includes("\n"));
}

function textOf(node: Node): string {
  return compact(collectRuns(node))
    .map((run) => run.text)
    .join("")
    .trim();
}

function listItems(element: Element): DocxRun[][] {
  const items: DocxRun[][] = [];
  for (const child of Array.from(element.children)) {
    if (child.tagName.toLowerCase() !== "li") continue;
    // A nested list inside an `<li>` is flattened into its own items rather than
    // being rendered as a sub-list: the depth is not worth a recursive component
    // in a preview, and losing it never loses the WORDS.
    const runs = compact(collectRuns(child));
    if (runs.length > 0) items.push(runs);
    for (const nested of Array.from(child.children)) {
      const tag = nested.tagName.toLowerCase();
      if (tag === "ul" || tag === "ol") items.push(...listItems(nested));
    }
  }
  return items;
}

function tableBlock(element: Element): DocxBlock | undefined {
  const rows = Array.from(element.querySelectorAll("tr"));
  if (rows.length === 0) return undefined;

  const cellsOf = (row: Element) =>
    Array.from(row.children)
      .filter((cell) => ["td", "th"].includes(cell.tagName.toLowerCase()))
      .map(textOf);

  const [firstRow, ...restRows] = rows;
  if (!firstRow) return undefined;

  // Word only emits `<th>` when the author marked a header row. Without it the
  // first row is ordinary data, and promoting it would invent a header.
  const isHeader = firstRow.querySelector("th") !== null;
  return isHeader
    ? { type: "table", head: cellsOf(firstRow), rows: restRows.map(cellsOf) }
    : { type: "table", rows: rows.map(cellsOf) };
}

const HEADING_LEVELS: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

/**
 * Parse mammoth's HTML into blocks.
 *
 * Takes a `DOMParser` factory so the caller decides where the parser comes from
 * — the browser's own in an app, jsdom's in a test — instead of this module
 * reaching for a global that may not exist on a server.
 */
export function htmlToBlocks(html: string, parse: (markup: string) => Document): DocxBlock[] {
  const document = parse(`<body>${html}</body>`);
  const blocks: DocxBlock[] = [];

  const walk = (parent: Element) => {
    for (const element of Array.from(parent.children)) {
      const tag = element.tagName.toLowerCase();
      const level = HEADING_LEVELS[tag];

      if (level) {
        const runs = compact(collectRuns(element));
        if (runs.length > 0) blocks.push({ type: "heading", level, runs });
        continue;
      }
      if (tag === "p") {
        // A `<p>` holding only an image is the image, not an empty paragraph.
        const image = element.querySelector("img");
        const runs = compact(collectRuns(element));
        if (image && runs.length === 0) {
          blocks.push(imageBlock(image));
          continue;
        }
        if (runs.length > 0) blocks.push({ type: "paragraph", runs });
        continue;
      }
      if (tag === "ul" || tag === "ol") {
        const items = listItems(element);
        if (items.length > 0) blocks.push({ type: "list", ordered: tag === "ol", items });
        continue;
      }
      if (tag === "table") {
        const table = tableBlock(element);
        if (table) blocks.push(table);
        continue;
      }
      if (tag === "img") {
        blocks.push(imageBlock(element));
        continue;
      }
      // Anything else — a `div`, a `section`, a tag mammoth grew in a later
      // version — contributes its CHILDREN, never itself. That is what makes
      // this an allowlist that cannot silently let markup through.
      walk(element);
    }
  };

  walk(document.body);
  return blocks;
}

function imageBlock(element: Element): DocxBlock {
  const alt = element.getAttribute("alt")?.trim();
  return {
    type: "image",
    // mammoth inlines images as `data:` URIs by default, so there is no remote
    // origin here — and no `src` at all is better than a URL we did not vet.
    src: element.getAttribute("src") ?? "",
    ...(alt ? { alt } : {}),
  };
}

/** Written before a list item's own text in the projection. */
export const DOCX_LIST_BULLET = "• ";

/** Written between two cells of the same row. */
export const DOCX_CELL_SEPARATOR = "\t";

/** The header row's `row`, so one field can name every row of a table. */
export const DOCX_HEAD_ROW = -1;

/**
 * Where a stretch of the projection came from in the block model.
 *
 * Deliberately one shape with optional fields rather than a union: the renderer
 * looks a span up by "this block, that item" in three places, and a union would
 * make each of those a type narrowing exercise for no gain.
 */
export interface DocxRef {
  /** Index into the `blocks` array. */
  block: number;
  /** Which item, for a `list` block. */
  item?: number;
  /** Which row, for a `table` block. {@link DOCX_HEAD_ROW} is the header. */
  row?: number;
}

/**
 * Plain-text projection of a parsed document, plus the map back into the blocks.
 *
 * Rows rather than cells are the finest ref: one builder has one separator, and
 * a row's cells are joined by a tab while the rows themselves are joined by a
 * newline. The renderer walks a row's cells the same way it walks a paragraph's
 * runs — accumulating lengths — so the granularity of the MARK is still the
 * character, even though the granularity of the REF is the row.
 */
export function blocksToTextWithMap(blocks: DocxBlock[]): TextIndex<DocxRef> {
  const builder = createTextIndexBuilder<DocxRef>();
  blocks.forEach((block, index) => {
    if (block.type === "heading" || block.type === "paragraph") {
      builder.push(block.runs.map((run) => run.text).join(""), { block: index });
      return;
    }
    if (block.type === "list") {
      block.items.forEach((item, item_) => {
        builder.push(`${DOCX_LIST_BULLET}${item.map((run) => run.text).join("")}`, {
          block: index,
          item: item_,
        });
      });
      return;
    }
    if (block.type === "table") {
      if (block.head) {
        builder.push(block.head.join(DOCX_CELL_SEPARATOR), { block: index, row: DOCX_HEAD_ROW });
      }
      block.rows.forEach((row, rowIndex) => {
        builder.push(row.join(DOCX_CELL_SEPARATOR), { block: index, row: rowIndex });
      });
    }
  });
  return builder.build();
}

/**
 * Plain-text projection of a parsed document — powers search, copy and the raw
 * view. A thin wrapper so the projection has exactly one definition: it is the
 * index's own text, never a second assembly that could drift from it.
 */
export function blocksToText(blocks: DocxBlock[]): string {
  return blocksToTextWithMap(blocks).text;
}
