/**
 * WYSIWYG support for the brand `:::` directives inside the Milkdown editor.
 *
 * Adds remark-directive to Milkdown's pipeline (so `:::card` / `:::callout` /
 * `:::timeline` / `::metric` PARSE and SERIALIZE — lossless round-trip), plus two
 * generic ProseMirror node schemas:
 *   - a CONTAINER node (editable body) for `:::` block directives
 *   - a LEAF node (atomic) for `::` directives like `::metric`
 *
 * Rendering is ProseMirror-native `toDOM` chrome styled from semantic tokens
 * (see markdown-editor.css) — deliberately NOT a React node-view adapter, so the
 * editor has zero extra runtime deps and the chrome stays token-driven. The
 * branded PREVIEW still renders the real @brand React components; this gives the
 * WYSIWYG surface a matching, editable representation.
 */
import type { MilkdownPlugin } from "@milkdown/kit/ctx";
import { $nodeSchema, $remark } from "@milkdown/kit/utils";
import { directiveFromMarkdown, directiveToMarkdown } from "mdast-util-directive";
import { directive } from "micromark-extension-directive";
import type { Processor } from "unified";

interface DirectiveMdast {
  type: string;
  name?: string;
  attributes?: Record<string, string> | null;
  children?: unknown[];
}

/**
 * remark-directive, BLOCK forms only (`::leaf`, `:::container`).
 *
 * The stock plugin also parses every inline `:word` as a TEXT directive — a
 * `${{msr:id:Title}}` placeholder, `ratio :a`, an emoji shortcode — which the brand has
 * no vocabulary for and which crashed the editor ("Cannot match target parser"); its
 * serializer then escaped every `word:Word` as `word\:Word`. This variant drops the
 * inline tokenizer and the matching escape rule, so inline colons stay ordinary text
 * both ways.
 */
function remarkBlockDirectives(this: Processor): void {
  const data = this.data() as Record<string, unknown[] | undefined>;
  const micromark = (data.micromarkExtensions ??= []);
  const from = (data.fromMarkdownExtensions ??= []);
  const to = (data.toMarkdownExtensions ??= []);
  const { flow } = directive();
  micromark.push({ flow });
  from.push(directiveFromMarkdown());
  const serializer = directiveToMarkdown();
  serializer.unsafe = (serializer.unsafe ?? []).filter(
    (rule) => !(rule.character === ":" && rule.inConstruct !== undefined && !rule.atBreak),
  );
  to.push(serializer);
}

/** Add block directives to Milkdown's unified processor (parse + stringify). */
export const directiveRemark = $remark("brandDirective", () => remarkBlockDirectives);

/** `:::name` block directives → an editable container node with branded chrome. */
export const containerDirectiveSchema = $nodeSchema("brand_container_directive", () => ({
  content: "block+",
  group: "block",
  defining: true,
  attrs: {
    name: { default: "card" },
    attributes: { default: {} as Record<string, string> },
  },
  parseDOM: [
    {
      tag: "div[data-brand-directive]",
      getAttrs: (dom: HTMLElement | string) => {
        if (typeof dom === "string") return false;
        return {
          name: dom.getAttribute("data-brand-directive") ?? "card",
          attributes: JSON.parse(dom.getAttribute("data-brand-attrs") ?? "{}"),
        };
      },
    },
  ],
  toDOM: (node) => {
    const name = String(node.attrs.name);
    const attrs = (node.attrs.attributes ?? {}) as Record<string, string>;
    const heading = attrs.title || (name === "callout" ? (attrs.type ?? "note") : "");
    const chrome: unknown[] = [
      "div",
      {
        "data-brand-directive": name,
        "data-brand-attrs": JSON.stringify(attrs),
        class: `brand-directive brand-directive--${name}`,
        "data-callout-type": name === "callout" ? (attrs.type ?? "note") : null,
      },
    ];
    if (heading)
      chrome.push(["div", { class: "brand-directive__title", contenteditable: "false" }, heading]);
    chrome.push(["div", { class: "brand-directive__body" }, 0]);
    return chrome as never;
  },
  parseMarkdown: {
    match: (node) => (node as DirectiveMdast).type === "containerDirective",
    runner: (state, node, type) => {
      const d = node as DirectiveMdast;
      state.openNode(type, { name: d.name ?? "card", attributes: d.attributes ?? {} });
      state.next((d.children ?? []) as never);
      state.closeNode();
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "brand_container_directive",
    runner: (state, node) => {
      state.openNode("containerDirective", undefined, {
        name: node.attrs.name,
        attributes: node.attrs.attributes,
      });
      state.next(node.content);
      state.closeNode();
    },
  },
}));

/** `::name` leaf directives (e.g. `::metric`) → an atomic node with branded chrome. */
export const leafDirectiveSchema = $nodeSchema("brand_leaf_directive", () => ({
  group: "block",
  atom: true,
  isolating: true,
  attrs: {
    name: { default: "metric" },
    attributes: { default: {} as Record<string, string> },
  },
  parseDOM: [
    {
      tag: "div[data-brand-leaf]",
      getAttrs: (dom: HTMLElement | string) => {
        if (typeof dom === "string") return false;
        return {
          name: dom.getAttribute("data-brand-leaf") ?? "metric",
          attributes: JSON.parse(dom.getAttribute("data-brand-attrs") ?? "{}"),
        };
      },
    },
  ],
  toDOM: (node) => {
    const name = String(node.attrs.name);
    const a = (node.attrs.attributes ?? {}) as Record<string, string>;
    return [
      "div",
      {
        "data-brand-leaf": name,
        "data-brand-attrs": JSON.stringify(a),
        class: `brand-directive brand-directive--leaf brand-directive--${name}`,
        contenteditable: "false",
      },
      ["div", { class: "brand-metric__label" }, a.label ?? name],
      ["div", { class: "brand-metric__value" }, a.value ?? ""],
      ...(a.description ? [["div", { class: "brand-metric__desc" }, a.description]] : []),
    ] as never;
  },
  parseMarkdown: {
    match: (node) => (node as DirectiveMdast).type === "leafDirective",
    runner: (state, node, type) => {
      const d = node as DirectiveMdast;
      state.addNode(type, { name: d.name ?? "metric", attributes: d.attributes ?? {} });
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === "brand_leaf_directive",
    runner: (state, node) => {
      state.addNode("leafDirective", undefined, undefined, {
        name: node.attrs.name,
        attributes: node.attrs.attributes,
      });
    },
  },
}));

/** All plugins needed to parse, render and serialize brand directives in the editor. */
export const directivePlugins: MilkdownPlugin[] = [
  directiveRemark,
  containerDirectiveSchema,
  leafDirectiveSchema,
].flat() as MilkdownPlugin[];
