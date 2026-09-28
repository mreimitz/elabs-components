import { isMap, isScalar, isSeq, parseDocument } from "yaml";

export type YamlPath = (string | number)[];
export interface YamlContext {
  kind: "key" | "value" | "endpoint";
  path: YamlPath;
  key: string;
  prefix: string;
  from: number;
  to: number;
  quote: "" | "'" | '"';
  flow: boolean;
  siblings: string[];
}
const MARKER = "__atlas_completion_cursor__";

/** Structural lookup stays useful while the edited scalar or key is incomplete. */
function markerPath(text: string): { path: YamlPath; siblings: string[] } | null {
  const doc = parseDocument(text);
  let found: { path: YamlPath; siblings: string[] } | null = null;
  const walk = (node: unknown, path: YamlPath, siblings: string[]) => {
    if (isScalar(node) && node.value === MARKER) found = { path, siblings };
    if (isMap(node)) {
      const keys = node.items.flatMap((pair) =>
        isScalar(pair.key) ? [String(pair.key.value)] : [],
      );
      for (const pair of node.items) {
        if (isScalar(pair.key)) walk(pair.value, [...path, String(pair.key.value)], keys);
      }
    } else if (isSeq(node)) node.items.forEach((item, index) => walk(item, [...path, index], []));
  };
  walk(doc.contents, [], []);
  return found;
}

/** Replacement covers one YAML scalar, including quotes, never its comment or neighbours. */
export function yamlContext(text: string, offset: number): YamlContext | null {
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  const nextLine = text.indexOf("\n", offset);
  const lineEnd = nextLine < 0 ? text.length : nextLine;
  const line = text.slice(lineStart, lineEnd).replace(/\r$/, "");
  const cursor = offset - lineStart;
  // Block scalar contents are prose, even if one line happens to resemble a mapping.
  let block = false;
  let enclosingFlow = false;
  let originalSiblings: string[] = [];
  const scanBlocks = (node: unknown) => {
    if (isMap(node) && node.range && offset >= node.range[0] && offset <= node.range[1])
      originalSiblings = node.items.flatMap((pair) =>
        isScalar(pair.key) ? [String(pair.key.value)] : [],
      );
    if (
      (isMap(node) || isSeq(node)) &&
      node.flow &&
      node.range &&
      offset >= node.range[0] &&
      offset <= node.range[1]
    )
      enclosingFlow = true;
    if (
      isScalar(node) &&
      (node.type === "BLOCK_LITERAL" || node.type === "BLOCK_FOLDED") &&
      node.range &&
      offset > node.range[0] + text.slice(node.range[0]).indexOf("\n") &&
      offset <= node.range[1] &&
      lineStart < node.range[1]
    )
      block = true;
    if (isMap(node)) for (const pair of node.items) scanBlocks(pair.value);
    if (isSeq(node)) node.items.forEach(scanBlocks);
  };
  scanBlocks(parseDocument(text).contents);
  if (block) return null;
  let quote = "",
    comment = line.length,
    segment = 0,
    flow = enclosingFlow;
  const colons: number[] = [];
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (quote === '"' && ch === "\\") {
        i++;
        continue;
      }
      if (ch === quote) {
        if (quote === "'" && line[i + 1] === "'") {
          i++;
          continue;
        }
        quote = "";
      }
      continue;
    }
    if ((ch === '"' || ch === "'") && /(?:^|[:,{[])\s*(?:-\s*)?$/.test(line.slice(0, i))) {
      quote = ch;
      continue;
    }
    if (ch === "#" && (i === 0 || /\s/.test(line[i - 1]!))) {
      comment = i;
      break;
    }
    if (i < cursor && (ch === "{" || ch === "[" || (flow && ch === ","))) {
      segment = i + 1;
      flow = true;
      colons.length = 0;
    }
    if (ch === ":" && (i + 1 === line.length || /[\s\]}]/.test(line[i + 1]!))) colons.push(i);
  }
  if (cursor > comment || /^\s*#/.test(line)) return null;
  const colon = colons.find((at) => at >= segment);
  const prefixStart = segment + (line.slice(segment).match(/^\s*(?:-\s+)?/)?.[0].length ?? 0);
  const rawKey = line.slice(prefixStart, colon ?? comment).trim();
  // Shorthand flows: never offer endpoint ids inside a label after the colon.
  const arrow = /(<->|->|<-)/.exec(line.slice(prefixStart, colon ?? comment));
  if (arrow && (colon === undefined || cursor <= colon)) {
    const arrowAt = prefixStart + arrow.index;
    const start = cursor <= arrowAt ? prefixStart : arrowAt + arrow[0].length;
    const from = start + (line.slice(start).match(/^\s*/)?.[0].length ?? 0);
    const to = from + (line.slice(from).match(/[\w.-]*/)?.[0].length ?? 0);
    if (cursor < from || cursor > to) return null;
    const replaced =
      text.slice(0, lineStart + prefixStart) + MARKER + text.slice(lineStart + comment);
    const structural = markerPath(replaced);
    if (!structural?.path.includes("flows")) return null;
    return {
      kind: "endpoint",
      key: "",
      path: structural.path,
      prefix: line.slice(from, cursor),
      from: lineStart + from,
      to: lineStart + to,
      quote: "",
      flow,
      siblings: [],
    };
  }
  if (colon !== undefined && cursor > colon) {
    const from = colon + 1 + (line.slice(colon + 1).match(/^\s*/)?.[0].length ?? 0);
    if (cursor < from) return null;
    const scalarQuote = line[from] === "'" || line[from] === '"' ? (line[from] as "'" | '"') : "";
    let to = comment;
    if (scalarQuote) {
      let i = from + 1;
      for (; i < comment; i++) {
        if (scalarQuote === '"' && line[i] === "\\") {
          i++;
          continue;
        }
        if (line[i] === scalarQuote) {
          if (scalarQuote === "'" && line[i + 1] === "'") {
            i++;
            continue;
          }
          to = i + 1;
          break;
        }
      }
    } else {
      if (flow) {
        const end = line.slice(from, comment).search(/[,}\]]/);
        if (end >= 0) to = from + end;
      }
      while (to > from && /\s/.test(line[to - 1]!)) to--;
    }
    if (cursor > to && line.slice(to, cursor).trim()) return null;
    const structural = markerPath(
      text.slice(0, lineStart + from) + MARKER + text.slice(lineStart + to),
    );
    if (!structural) return null;
    const key = String(structural.path.at(-1) ?? rawKey);
    return {
      kind: "value",
      path: structural.path,
      key,
      prefix: line.slice(from + (scalarQuote ? 1 : 0), cursor).replace(/["']$/, ""),
      from: lineStart + from,
      to: lineStart + to,
      quote: scalarQuote,
      flow,
      siblings: structural.siblings,
    };
  }
  if (cursor < prefixStart || !/^[\w-]*$/.test(line.slice(prefixStart, cursor))) return null;
  const to = prefixStart + (line.slice(prefixStart).match(/[\w-]*/)?.[0].length ?? 0);
  const inserted = `${MARKER}: ${MARKER}`;
  const structural = markerPath(
    text.slice(0, lineStart + prefixStart) +
      inserted +
      text.slice(lineStart + (colon === undefined ? to : comment)),
  );
  if (!structural) return null;
  return {
    kind: "key",
    path: structural.path.slice(0, -1),
    key: "",
    prefix: line.slice(prefixStart, cursor),
    from: lineStart + prefixStart,
    to: lineStart + to,
    quote: "",
    flow,
    siblings: [...new Set([...structural.siblings, ...originalSiblings])].filter(
      (k) => k !== MARKER && k !== rawKey,
    ),
  };
}
