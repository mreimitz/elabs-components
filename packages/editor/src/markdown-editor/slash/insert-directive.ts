/**
 * Pure ProseMirror insertion commands for the slash menu.
 *
 * The load-bearing logic of the slash menu lives here, deliberately decoupled
 * from Milkdown's context and from React: an `insertBrandDirective` factory that
 * builds the right `brand_container_directive` / `brand_leaf_directive` node (from
 * the schemas in `directive-nodes.ts`) with sensible default attrs + a placeholder
 * body, replaces the active slash range (or inserts at the cursor), and drops the
 * caret into the first editable field. Because it takes the NodeTypes/Schema as
 * arguments (not a Milkdown `Ctx`), it is unit-testable against a hand-built
 * ProseMirror state and its output round-trips losslessly through the editor's
 * existing `toMarkdown` runners (asserted in insert-directive.test.ts).
 *
 * `resolveBrandInsert` is the thin Milkdown-aware adapter: it reads the NodeTypes
 * from the editor `Ctx` and returns the same pure command — so the slash plugin
 * and any direct caller share one implementation.
 */
import type { Ctx } from "@milkdown/kit/ctx";
import { editorViewCtx, parserCtx } from "@milkdown/kit/core";
import type { Node as ProseNode, NodeType, Schema } from "@milkdown/kit/prose/model";
import { Fragment } from "@milkdown/kit/prose/model";
import type { Command, Transaction } from "@milkdown/kit/prose/state";
import { TextSelection } from "@milkdown/kit/prose/state";

import type { IterationEditHandler } from "../../markdown-iteration/edit-context";
import {
  builderValueFromParts,
  emptyBuilderValue,
  serializeIterationDirective,
} from "../../markdown-iteration/iteration-builder";
import { containerDirectiveSchema, leafDirectiveSchema } from "../directive-nodes";
import type { BasicBlockId } from "./brand-slash-commands";

/** A `[from, to)` document range to replace (the typed `/query`), or `null`. */
export interface SlashRange {
  from: number;
  to: number;
}

/** Default attributes per brand directive — mirror the toolbar snippet shapes. */
const DIRECTIVE_DEFAULTS: Record<string, Record<string, string>> = {
  card: { title: "Title" },
  callout: { type: "info", title: "Note" },
  timeline: {},
  metric: { label: "Label", value: "0", description: "detail" },
  iterate: { as: "item", layout: "stacked" },
  pivot: { layout: "matrix" },
};

/** Per-directive seed body text (the editable template for iterate/pivot). */
const DIRECTIVE_BODY_SEED: Record<string, string> = {
  iterate: "{{item.name}}",
  pivot: "{{cell}}",
};

/** Brand container directives (`:::name`, editable body). */
const CONTAINER_DIRECTIVES = new Set(["card", "callout", "timeline", "iterate", "pivot"]);
/** Brand leaf directives (`::name`, atomic). */
const LEAF_DIRECTIVES = new Set(["metric"]);

/** The directive names the slash menu can insert as brand blocks. */
export type InsertableDirective = "card" | "callout" | "timeline" | "metric" | "iterate" | "pivot";

/**
 * Build the default body content for a container directive: a single paragraph
 * (the `content: "block+"` schema requires at least one block) carrying a short
 * placeholder so the inserted block is never empty. Timeline seeds a 3-step
 * bullet list (matching the toolbar snippet) when the schema has `bullet_list`.
 */
function containerBody(schema: Schema, name: string): Fragment {
  const paragraph = schema.nodes.paragraph;
  if (name === "timeline") {
    const bulletList = schema.nodes.bullet_list;
    const listItem = schema.nodes.list_item;
    if (bulletList && listItem && paragraph) {
      const steps = ["(done) Step one", "(active) Step two", "(pending) Step three"];
      const items = steps.map((text) =>
        listItem.create(null, paragraph.create(null, schema.text(text))),
      );
      return Fragment.from(bulletList.create(null, items));
    }
  }
  // iterate / pivot: seed the editable TEMPLATE body with a token placeholder so
  // the inserted block renders something the moment data is wired.
  const seed = DIRECTIVE_BODY_SEED[name];
  if (seed && paragraph) return Fragment.from(paragraph.create(null, schema.text(seed)));

  // card / callout (and timeline fallback): one empty placeholder paragraph
  // (the `content: "block+"` schema requires at least one block; the user types
  // the body). If the schema somehow lacks a paragraph, return an empty fragment
  // and let the schema fill its required content.
  if (!paragraph) return Fragment.empty;
  return Fragment.from(paragraph.create());
}

/**
 * The pure insertion command. Builds the directive node from the given
 * NodeTypes + schema and replaces `range` (or the current selection when
 * `range` is null), then positions the caret in the first editable field
 * (the body's start for containers; just after the atomic leaf for metric).
 *
 * Returns a ProseMirror `Command` `(state, dispatch?) => boolean`.
 */
export function insertBrandDirective(
  name: InsertableDirective,
  containerType: NodeType,
  leafType: NodeType,
  schema: Schema,
  range: SlashRange | null,
): Command {
  return (state, dispatch) => {
    const isContainer = CONTAINER_DIRECTIVES.has(name);
    const isLeaf = LEAF_DIRECTIVES.has(name);
    if (!isContainer && !isLeaf) return false;

    const attributes = { ...(DIRECTIVE_DEFAULTS[name] ?? {}) };
    const node = isContainer
      ? containerType.create({ name, attributes }, containerBody(schema, name))
      : leafType.create({ name, attributes });
    if (!node) return false;

    if (!dispatch) return true;

    const { from, to } = range ?? { from: state.selection.from, to: state.selection.to };
    const tr: Transaction = state.tr.replaceRangeWith(from, to, node);

    // Place the caret: containers → first text position inside the body
    // (from + 1 enters the node, +1 more enters its first child block);
    // leaf (atomic) → just after the inserted node.
    const caret = isContainer
      ? Math.min(from + 2, tr.doc.content.size)
      : Math.min(from + node.nodeSize, tr.doc.content.size);
    const sel = TextSelection.near(tr.doc.resolve(caret), 1);
    tr.setSelection(sel).scrollIntoView();

    dispatch(tr);
    return true;
  };
}

/** Map a basic-block id to a ProseMirror command that inserts the native node. */
export function insertBasicBlock(
  id: BasicBlockId,
  schema: Schema,
  range: SlashRange | null,
): Command {
  return (state, dispatch) => {
    const n = schema.nodes;
    const { from, to } = range ?? { from: state.selection.from, to: state.selection.to };
    const tr = state.tr;

    const replaceWith = (node: ReturnType<NodeType["create"]> | null, caretOffset: number) => {
      if (!node) return false;
      if (!dispatch) return true;
      tr.replaceRangeWith(from, to, node);
      const caret = Math.min(from + caretOffset, tr.doc.content.size);
      tr.setSelection(TextSelection.near(tr.doc.resolve(caret), 1)).scrollIntoView();
      dispatch(tr);
      return true;
    };

    switch (id) {
      case "heading":
        return replaceWith(n.heading?.create({ level: 2 }) ?? null, 1);
      case "bullet-list": {
        const li = n.list_item?.create(null, n.paragraph?.create());
        return replaceWith(li ? (n.bullet_list?.create(null, li) ?? null) : null, 2);
      }
      case "ordered-list": {
        const li = n.list_item?.create(null, n.paragraph?.create());
        return replaceWith(li ? (n.ordered_list?.create(null, li) ?? null) : null, 2);
      }
      case "quote":
        return replaceWith(n.blockquote?.create(null, n.paragraph?.create()) ?? null, 2);
      case "code":
        return replaceWith(n.code_block?.create() ?? null, 1);
      case "divider": {
        const hr = n.hr ?? n.horizontal_rule;
        if (!hr) return false;
        if (!dispatch) return true;
        // A divider is atomic: insert it, then add a trailing empty paragraph so
        // the caret has somewhere to land below the rule.
        const node = hr.create();
        tr.replaceRangeWith(from, to, node);
        const para = n.paragraph?.create();
        if (para) tr.insert(from + node.nodeSize, para);
        const caret = Math.min(from + node.nodeSize + 1, tr.doc.content.size);
        tr.setSelection(TextSelection.near(tr.doc.resolve(caret), 1)).scrollIntoView();
        dispatch(tr);
        return true;
      }
      default:
        return false;
    }
  };
}

/** Seed body for a fresh ```calc fence — a tiny ledger so highlight + inlays show at once. */
export const CALC_FENCE_SEED = ["items = 3", "price = 4.50", "total = items * price"].join("\n");

/**
 * Insert a ```calc fence (a `code_block` with `language: "calc"`) seeded with a
 * short example, then drop the caret into the body. The editor's calc layer
 * (`calc-editor-prose`) highlights + adds result inlays once `calc` hooks are wired;
 * with none it is just a fenced code block (and renders as a `CalcBlock` in preview
 * when `evaluate` is supplied) — so inserting one is always safe.
 */
export function insertCalcFence(
  schema: Schema,
  range: SlashRange | null,
  seed: string = CALC_FENCE_SEED,
): Command {
  return (state, dispatch) => {
    const codeBlock = schema.nodes.code_block;
    if (!codeBlock) return false;
    const node = seed
      ? codeBlock.create({ language: "calc" }, schema.text(seed))
      : codeBlock.create({ language: "calc" });
    if (!node) return false;
    if (!dispatch) return true;

    const { from, to } = range ?? { from: state.selection.from, to: state.selection.to };
    const tr = state.tr.replaceRangeWith(from, to, node);
    // Caret at the body start (from + 1 enters the code block's text).
    const caret = Math.min(from + 1, tr.doc.content.size);
    tr.setSelection(TextSelection.near(tr.doc.resolve(caret), 1)).scrollIntoView();
    dispatch(tr);
    return true;
  };
}

/** Milkdown-aware adapter for {@link insertCalcFence}. */
export function resolveCalcInsert(ctx: Ctx, range: SlashRange | null): boolean {
  const view = ctx.get(editorViewCtx);
  const command = insertCalcFence(view.state.schema, range);
  return command(view.state, view.dispatch.bind(view));
}

/**
 * Milkdown-aware adapter: resolve the directive NodeTypes from the editor `Ctx`
 * and run {@link insertBrandDirective} against the live view. Used by the slash
 * plugin's command runners.
 */
export function resolveBrandInsert(
  ctx: Ctx,
  name: InsertableDirective,
  range: SlashRange | null,
): boolean {
  const view = ctx.get(editorViewCtx);
  const containerType = containerDirectiveSchema.type(ctx);
  const leafType = leafDirectiveSchema.type(ctx);
  const schema = view.state.schema;
  const command = insertBrandDirective(name, containerType, leafType, schema, range);
  return command(view.state, view.dispatch.bind(view));
}

/** Milkdown-aware adapter for the basic native blocks. */
export function resolveBasicInsert(ctx: Ctx, id: BasicBlockId, range: SlashRange | null): boolean {
  const view = ctx.get(editorViewCtx);
  const command = insertBasicBlock(id, view.state.schema, range);
  return command(view.state, view.dispatch.bind(view));
}

/**
 * Parse a FULLY-BOUND directive markdown string (e.g. from
 * `serializeIterationDirective`) and insert it at `range` (or the caret when
 * `range` is null) — the insertion counterpart to the node-view's
 * `writeBodyMarkdown` edit-in-place. Used by {@link resolveGuidedIterationInsert}
 * (#223). Never throws; returns `false` when the markdown fails to parse.
 */
export function insertParsedMarkdown(
  ctx: Ctx,
  markdown: string,
  range: SlashRange | null,
): boolean {
  try {
    const view = ctx.get(editorViewCtx);
    const parse = (ctx as { get: (t: unknown) => (md: string) => ProseNode | null }).get(parserCtx);
    const parsed = parse(markdown);
    if (!parsed) return false;

    const { from, to } = range ?? { from: view.state.selection.from, to: view.state.selection.to };
    const tr = view.state.tr.replaceWith(from, to, parsed.content);
    const caret = Math.min(from + 2, tr.doc.content.size);
    tr.setSelection(TextSelection.near(tr.doc.resolve(caret), 1)).scrollIntoView();
    view.dispatch(tr);
    return true;
  } catch {
    // Parser unavailable / stale range — leave the document untouched.
    return false;
  }
}

/**
 * The GUIDED `/iterate` `/pivot` insert path (#223): instead of inserting a
 * bare directive immediately, emit an edit REQUEST — seeded blank
 * (`emptyBuilderValue`) — through the consumer's `IterationEditContext`
 * handler, opening whichever modal it wires up (the node-view `⋯` re-edit's
 * exact mechanism, reused for a fresh insert). BOTH writers are supplied so
 * this works with either provider:
 *   - `onSaveData` (the guided `IterationBuilderProvider`) — inserts the
 *     fully-bound directive (value lists + layout + template).
 *   - `onSave` (the template-only `IterationTemplateProvider`) — inserts a
 *     directive built from DEFAULT (empty) attributes + the edited template.
 * Nothing is INSERTED until the modal actually saves, so Cancel leaves no
 * directive behind — unlike the direct-insert fallback, which always drops a
 * placeholder template immediately. The typed `/query` trigger text itself is
 * consumed up front by the caller (`runSlashCommand` in `brand-slash-plugin.ts`,
 * BEFORE this resolver runs) — that's why `range` arrives as `null` here: by
 * the time this fires, the range has already been deleted and the caret sits
 * where the query used to start, so a save inserts there and a Cancel leaves a
 * clean caret rather than the literal `/query` text.
 */
export function resolveGuidedIterationInsert(
  ctx: Ctx,
  kind: "iterate" | "pivot",
  range: SlashRange | null,
  handler: IterationEditHandler,
): void {
  const seed = emptyBuilderValue(kind);
  handler({
    kind,
    template: seed.template,
    attributes: {},
    onSave: (template) => {
      const value = builderValueFromParts(kind, {}, template);
      insertParsedMarkdown(ctx, serializeIterationDirective(value), range);
    },
    onSaveData: ({ attributes, template }) => {
      const value = builderValueFromParts(kind, attributes, template);
      insertParsedMarkdown(ctx, serializeIterationDirective(value), range);
    },
  });
}

/** Exported for the unit test: the per-directive default attributes. */
export const __DIRECTIVE_DEFAULTS = DIRECTIVE_DEFAULTS;

/** Re-export for callers that need to know which names are containers vs leaves. */
export function isContainerDirective(name: string): boolean {
  return CONTAINER_DIRECTIVES.has(name);
}
export function isLeafDirective(name: string): boolean {
  return LEAF_DIRECTIVES.has(name);
}
