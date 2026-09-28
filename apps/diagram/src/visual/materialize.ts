/** Change only the visual value; preserve unrelated bytes and alias semantics. */
import { isAlias, isMap, isNode, parseDocument, stringify, visit } from "yaml";
import type { ArchVisualSpec } from "../spec/dialect/types";
import type { VisualLens } from "./visual-model";
export type MaterializeResult =
  | { ok: true; text: string; changed: boolean }
  | { ok: false; reason: string };
const safeJson = (value: unknown) =>
  JSON.stringify(value)
    .replace(/\u0085/g, "\\u0085")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a instanceof Map && b instanceof Map)
    return (
      a.size === b.size &&
      [...a].every(([key, value], i) => {
        const entry = [...b][i];
        return !!entry && same(key, entry[0]) && same(value, entry[1]);
      })
    );
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((value, i) => same(value, b[i]));
  return false;
}
export function authoredVisual(lens: VisualLens): ArchVisualSpec {
  const ids = new Map<string, string>();
  const taken = new Set<string>();
  for (const box of lens.boxes) {
    const base = box.id.replace(/^box:/, "").replace(/[^a-zA-Z0-9_-]/g, "-") || "box";
    let id = base;
    let index = 2;
    while (taken.has(id)) id = `${base}-${index++}`;
    taken.add(id);
    ids.set(box.id, id);
  }
  const flows = new Map<string, NonNullable<ArchVisualSpec["flows"]>[number]>();
  for (const flow of lens.flows)
    if (
      flow.label !== undefined ||
      flow.process !== undefined ||
      flow.id.startsWith("flow:override:")
    ) {
      const from = ids.get(flow.from)!;
      const to = ids.get(flow.to)!;
      flows.set([from, to].sort().join("\0"), {
        from,
        to,
        ...(flow.label !== undefined && { label: flow.label }),
        ...(flow.process !== undefined && { process: flow.process }),
      });
    }
  return {
    lanes: lens.lanes.map(({ id, role, title, of }) => ({ id, role, title, ...(of && { of }) })),
    boxes: lens.boxes.map((box) => ({
      id: ids.get(box.id)!,
      lane: box.lane,
      title: box.title,
      members: box.members.map((member) => member.id),
      ...(box.processes && { processes: box.processes }),
      ...(box.sub && { sub: box.sub }),
      ...(box.aside !== undefined && { aside: box.aside }),
    })),
    ...(lens.boxes.some((box) => box.controlPlane) && {
      controlPlane: lens.boxes
        .filter((box) => box.controlPlane)
        .flatMap((box) => box.members.map((member) => member.id)),
    }),
    ...(lens.hidden?.length && { hide: lens.hidden }),
    ...(flows.size && { flows: [...flows.values()] }),
  };
}
export function materializeVisual(text: string, lens: VisualLens): MaterializeResult {
  try {
    const doc = parseDocument(text, { keepSourceTokens: true });
    if (doc.errors.length || !isMap(doc.contents))
      return { ok: false, reason: "Fix YAML errors before changing the visual layout." };
    const before = doc.toJS({ mapAsMap: true, maxAliasCount: 100 }) as Map<unknown, unknown>;
    const value = authoredVisual(lens);
    const expected = parseDocument(safeJson(value)).toJS({ mapAsMap: true });
    if (same(before.get("visual"), expected)) return { ok: true, text, changed: false };
    const current = doc.contents.get("visual", true);
    const edits: { start: number; end: number; text: string }[] = [];
    // Detach aliases outside the replaced subtree before removing any anchor it supplies.
    if (isNode(current) && current.range) {
      const [start, end] = current.range;
      visit(doc, {
        Alias: (_key, node) => {
          if (!node.range || (node.range[0] >= start && node.range[0] < end)) return;
          const target = node.resolve(doc);
          if (!target?.range || target.range[0] < start || target.range[0] >= end) return;
          const js = node.toJS(doc, { maxAliasCount: 100 });
          edits.push({ start: node.range[0], end: node.range[1], text: safeJson(js) });
        },
      });
      // Flow-form output is safe at every indentation and preserves adjacent comments/keys.
      // Block-form input is rendered as a readable block at its original indentation.
      const lineStart = text.lastIndexOf("\n", start - 1) + 1;
      const prefix = text.slice(lineStart, start);
      const block = !doc.contents.flow && /^\s*$/.test(prefix) && !isAlias(current);
      const comments: string[] = [];
      const collect = (token: unknown): void => {
        if (!token || typeof token !== "object") return;
        const item = token as Record<string, unknown>;
        if (
          item.type === "comment" &&
          typeof item.offset === "number" &&
          item.offset >= start &&
          item.offset < end &&
          typeof item.source === "string"
        )
          comments.push(item.source);
        for (const value of Object.values(item))
          if (typeof value === "object") {
            if (Array.isArray(value)) value.forEach(collect);
            else collect(value);
          }
      };
      collect(current.srcToken);
      const eol = text.includes("\r\n") ? "\r\n" : "\n";
      const replacement = block
        ? (comments.length ? comments.join(`${eol}${prefix}`) + eol + prefix : "") +
          stringify(value, { lineWidth: 0 }).trimEnd().split("\n").join(`${eol}${prefix}`) +
          (/\r?\n$/.test(text.slice(start, end)) ? eol : "")
        : safeJson(value);
      edits.push({ start, end, text: replacement });
      if (!block && comments.length)
        edits.push({
          start: text.length,
          end: text.length,
          text: `${text.endsWith("\n") ? "" : eol}${comments.join(eol)}${eol}`,
        });
    } else if (doc.contents.flow) {
      const at = text.lastIndexOf("}", doc.contents.range?.[1]);
      if (at < 0) return { ok: false, reason: "Could not locate the document mapping." };
      edits.push({
        start: at,
        end: at,
        text: `${doc.contents.items.length ? ", " : ""}visual: ${safeJson(value)}`,
      });
    } else {
      const end = doc.contents.range?.[1] ?? text.length;
      const eol = text.includes("\r\n") ? "\r\n" : "\n";
      const block = stringify({ visual: value }, { lineWidth: 0 }).replace(/\n/g, eol);
      edits.push({
        start: end,
        end,
        text: `${text.slice(0, end).endsWith("\n") ? "" : eol}${block}`,
      });
    }
    let output = text;
    for (const edit of edits.sort((a, b) => b.start - a.start))
      output = output.slice(0, edit.start) + edit.text + output.slice(edit.end);
    const check = parseDocument(output);
    if (check.errors.length)
      return { ok: false, reason: "The visual change could not preserve valid YAML." };
    const after = check.toJS({ mapAsMap: true, maxAliasCount: 100 }) as Map<unknown, unknown>;
    before.delete("visual");
    const actual = after.get("visual");
    after.delete("visual");
    if (!same(before, after) || !same(expected, actual))
      return {
        ok: false,
        reason: "The visual change would alter another YAML value; no changes were made.",
      };
    return { ok: true, text: output, changed: output !== text };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Could not safely update the visual layout.",
    };
  }
}
