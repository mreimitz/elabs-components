"use client";

/**
 * React node-views for the brand `:::` directives.
 *
 * Upgrades the Milkdown (ProseMirror) WYSIWYG surface from token-styled `toDOM`
 * chrome (see directive-nodes.ts) to the ACTUAL @brand React components, rendered
 * live INSIDE the editor via @prosemirror-adapter/react:
 *
 *   :::card      → real <Card>      (title editable inline; body = editable content)
 *   :::callout   → real <Alert>     (title editable inline; body = editable content)
 *   ::metric     → real <MetricBlock> (label + value editable inline; atomic)
 *   :::timeline  → branded frame around the editable list (kept editable, not a
 *                  derived <Timeline>, so steps round-trip as real markdown list items)
 *
 * Inline edits write through `setAttrs` to the directive node's `attributes`, which
 * the existing `toMarkdown` runner serializes back to `:::name{key="value"}` — so the
 * round-trip stays lossless (the editor and the Streamdown preview share one dialect).
 *
 * The `toDOM` definitions in directive-nodes.ts remain as the schema's serialization
 * fallback (clipboard / no-adapter); when these node-views are registered, ProseMirror
 * renders them instead.
 */
import {
  Alert,
  AlertDescription,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { editorViewCtx, parserCtx, serializerCtx } from "@milkdown/kit/core";
import type { MilkdownPlugin } from "@milkdown/kit/ctx";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { $view } from "@milkdown/kit/utils";
import { useNodeViewContext, type useNodeViewFactory } from "@prosemirror-adapter/react";
import {
  ArrowLeftRight,
  FileText,
  Grid3x3,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Repeat2,
} from "lucide-react";
import { useContext, useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

import { IterationEditContext } from "../markdown-iteration/edit-context";
import type { IterationLayout } from "../markdown-iteration/iteration";
import {
  builderValueFromParts,
  directivePartsFromValue,
  evaluateEmbedded,
  ITERATION_LAYOUTS,
  staticMarkdownFromValue,
  transposeIterationValue,
} from "../markdown-iteration/iteration-builder";
import { MetricBlock } from "../metric-block";
import { containerDirectiveSchema, leafDirectiveSchema } from "./directive-nodes";
import { useInstance } from "./milkdown-react";

type Attrs = Record<string, string>;

/** Map a callout `type` to an @elabs-ai/components-ui Alert variant (mirrors the preview). */
const CALLOUT_VARIANT: Record<string, "default" | "info" | "success" | "warning" | "destructive"> =
  {
    info: "info",
    note: "info",
    tip: "success",
    success: "success",
    warning: "warning",
    caution: "warning",
    danger: "destructive",
    error: "destructive",
    destructive: "destructive",
  };

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Read the directive node's `name` + `attributes`, with a writer that round-trips. */
function useDirectiveAttrs() {
  const { node, setAttrs } = useNodeViewContext();
  const name = String(node.attrs.name);
  const attributes = (node.attrs.attributes ?? {}) as Attrs;
  const update = (key: string, value: string) => {
    const next: Attrs = { ...attributes };
    if (value === "") delete next[key];
    else next[key] = value;
    setAttrs({ attributes: next });
  };
  return { name, attributes, update };
}

interface InlineEditProps {
  value: string;
  onCommit: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}

/**
 * A seamless inline editor for a single directive attribute.
 *
 * Uncontrolled `contentEditable` (so the caret never jumps mid-type), syncing the
 * DOM text from `value` only while NOT focused, and committing on blur / Enter
 * (Escape reverts). Marked `data-directive-chrome` so the node-view's `stopEvent`
 * routes its keystrokes to the browser, not ProseMirror.
 */
function InlineEdit({ value, onCommit, ariaLabel, placeholder, className }: InlineEditProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Don't clobber the user's text while they're editing this field.
    if (el === el.ownerDocument.activeElement) return;
    if (el.textContent !== value) el.textContent = value;
  }, [value]);

  const commit = () => {
    const next = (ref.current?.textContent ?? "").trim();
    if (next !== value) onCommit(next);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (ref.current) ref.current.textContent = value;
      e.currentTarget.blur();
    }
  };

  return (
    <span
      ref={ref}
      role="textbox"
      aria-label={ariaLabel}
      // Single-line field: Enter commits (it never inserts a newline).
      aria-multiline={false}
      data-directive-chrome=""
      data-placeholder={placeholder}
      contentEditable
      suppressContentEditableWarning
      tabIndex={0}
      spellCheck={false}
      onBlur={commit}
      onKeyDown={onKeyDown}
      className={cn("brand-inline-edit rounded-sm focus-ring", className)}
    />
  );
}

/** `:::name` block directives → live @brand component with an editable body. */
function ContainerDirectiveView() {
  const { contentRef } = useNodeViewContext();
  const { name, attributes, update } = useDirectiveAttrs();

  // The editable ProseMirror content (the directive body) mounts here.
  const body = <div className="brand-directive__body" ref={contentRef} />;

  if (name === "card") {
    return (
      <Card className="brand-directive brand-directive--card" data-brand-directive="card">
        <CardHeader className="pb-3">
          <CardTitle>
            <InlineEdit
              ariaLabel="Card title"
              placeholder="Card title"
              value={attributes.title ?? ""}
              onCommit={(v) => update("title", v)}
            />
          </CardTitle>
        </CardHeader>
        <CardContent>{body}</CardContent>
      </Card>
    );
  }

  if (name === "callout") {
    const variant = CALLOUT_VARIANT[attributes.type ?? ""] ?? "default";
    return (
      <Alert
        variant={variant}
        className="brand-directive brand-directive--callout"
        data-brand-directive="callout"
      >
        {/* Non-heading title (matches the preview): a callout sits inside content
            flow, so its label must not join the document heading outline (see #21). */}
        <div className="mb-1 font-medium leading-none tracking-tight">
          <InlineEdit
            ariaLabel="Callout title"
            placeholder={capitalize(attributes.type ?? "note")}
            value={attributes.title ?? ""}
            onCommit={(v) => update("title", v)}
          />
        </div>
        <AlertDescription>{body}</AlertDescription>
      </Alert>
    );
  }

  if (name === "timeline") {
    // Kept as an editable list inside a branded frame — a derived <Timeline> can't
    // be edited in place, and the steps must serialize back as markdown list items.
    return (
      <div className="brand-directive brand-directive--timeline" data-brand-directive="timeline">
        {body}
      </div>
    );
  }

  if (name === "iterate" || name === "pivot") {
    // Owns hooks (dialog state + editor instance) → its own component.
    return <IterationDirectiveView />;
  }

  // Unknown container directive — surface it, but never drop the body content.
  // `role="note"` (not Alert's default assertive `role="alert"`): this is a
  // PERSISTENT block that re-renders on every re-parse, so an assertive live region
  // would re-announce on each keystroke (#37). The title is a label, not a heading.
  return (
    <Alert
      role="note"
      variant="destructive"
      className="brand-directive brand-directive--unknown"
      data-brand-directive={name}
    >
      <div className="mb-1 font-medium leading-none tracking-tight">Unknown block: {name}</div>
      <AlertDescription>{body}</AlertDescription>
    </Alert>
  );
}

/* ------------------------------------------------------------------ */
/* Iteration node-view (`:::iterate` / `:::pivot`) + the ⋯ re-edit modal */
/* ------------------------------------------------------------------ */

type GetEditor = () =>
  | { ctx: { get: (token: unknown) => unknown }; action: <T>(fn: (ctx: unknown) => T) => T }
  | undefined;

/** Serialize a directive node's BODY content back to markdown (the template). */
function readBodyMarkdown(getInstance: GetEditor, node: ProseNode): string {
  try {
    const editor = getInstance();
    if (!editor) return node.textContent;
    return editor
      .action((ctx) => {
        const serialize = (ctx as { get: (t: unknown) => (n: ProseNode) => string }).get(
          serializerCtx,
        );
        const doc = node.type.schema.topNodeType.create(null, node.content);
        return serialize(doc);
      })
      .trim();
  } catch {
    // Serializer unavailable (e.g. SSR/edge) — fall back to the plain text body.
    return node.textContent;
  }
}

/** Replace a directive node's BODY with markdown parsed back into PM content. */
function writeBodyMarkdown(
  getInstance: GetEditor,
  getPos: () => number | undefined,
  template: string,
): void {
  try {
    const editor = getInstance();
    const pos = getPos();
    if (!editor || pos == null) return;
    editor.action((ctx) => {
      const parse = (ctx as { get: (t: unknown) => (md: string) => ProseNode | null }).get(
        parserCtx,
      );
      const parsed = parse(template);
      if (!parsed) return;
      const view = (
        ctx as {
          get: (t: unknown) => {
            state: { doc: ProseNode; tr: unknown };
            dispatch: (tr: unknown) => void;
          };
        }
      ).get(editorViewCtx);
      const node = view.state.doc.nodeAt(pos);
      if (!node) return;
      const start = pos + 1;
      const end = start + node.content.size;
      const tr = (
        view.state.tr as { replaceWith: (from: number, to: number, content: unknown) => unknown }
      ).replaceWith(start, end, parsed.content);
      view.dispatch(tr);
    });
  } catch {
    // Parser unavailable / position stale — leave the inline body as the source.
  }
}

/**
 * Merge `next` into `attrs`, OMITTING any key whose value is an empty string
 * rather than writing it. `directivePartsFromValue` always computes `rows`/
 * `cols`/`values` as a joined string — `""` when the list is empty — and an
 * empty-string attribute value serializes as a BARE flag (`rows` with no
 * `="…"`) via mdast-util-directive, which a consumer's `evaluate` then sees as
 * `attributes.rows === ""` instead of `undefined` (a real behaviour-flip risk
 * for any consumer that branches on attribute presence). Every writer that
 * rewrites the builder-known keys (`as`/`layout`/`values`/`rows`/`cols`) with a
 * possibly-empty computed value routes through this instead of a raw spread —
 * that's also what keeps a consumer's OWN attributes (e.g. `source`/`region`,
 * unknown to the builder model) intact: only the keys `next` actually names
 * are touched, everything else in `attrs` passes through untouched.
 */
function mergeAttrsOmittingEmpty(
  attrs: Record<string, string>,
  next: Record<string, string>,
): Record<string, string> {
  const merged: Record<string, string> = { ...attrs };
  for (const [key, value] of Object.entries(next)) {
    if (value === "") delete merged[key];
    else merged[key] = value;
  }
  return merged;
}

/**
 * Replace the ENTIRE directive node (not just its body) with parsed markdown —
 * the "Convert to static" node-menu action's writer. A no-op on blank markdown
 * (nothing resolved yet — e.g. no values entered) so the block is never
 * clobbered with empty content.
 */
function replaceNodeWithMarkdown(
  getInstance: GetEditor,
  getPos: () => number | undefined,
  markdown: string,
): void {
  if (!markdown.trim()) return;
  try {
    const editor = getInstance();
    const pos = getPos();
    if (!editor || pos == null) return;
    editor.action((ctx) => {
      const parse = (ctx as { get: (t: unknown) => (md: string) => ProseNode | null }).get(
        parserCtx,
      );
      const parsed = parse(markdown);
      if (!parsed) return;
      const view = (
        ctx as {
          get: (t: unknown) => {
            state: { doc: ProseNode; tr: unknown };
            dispatch: (tr: unknown) => void;
          };
        }
      ).get(editorViewCtx);
      const node = view.state.doc.nodeAt(pos);
      if (!node) return;
      const tr = (
        view.state.tr as { replaceWith: (from: number, to: number, content: unknown) => unknown }
      ).replaceWith(pos, pos + node.nodeSize, parsed.content);
      view.dispatch(tr);
    });
  } catch {
    // Parser/position unavailable — leave the node as a live directive.
  }
}

/* -------------------------------------------------------------------- */
/* The iteration node MENU (⋯ dropdown AND right-click context menu)      */
/* -------------------------------------------------------------------- */

interface IterationMenuAction {
  type: "item";
  id: string;
  label: string;
  icon: ReactNode;
  onSelect: () => void;
  /**
   * Disable the item (e.g. "Transpose"/"Convert to static" with no resolvable
   * data yet). The WHY must be folded into `label` itself — a disabled Radix
   * menu item is `pointer-events-none` (a `title` tooltip can never fire) and
   * skipped by keyboard roving-focus, so `title` is not a viable explanation
   * channel for any input modality.
   */
  disabled?: boolean;
}

interface IterationMenuLayoutGroup {
  type: "layout";
  id: "layout";
  label: string;
  icon: ReactNode;
  value: IterationLayout;
  options: IterationLayout[];
  onChange: (layout: IterationLayout) => void;
}

type IterationMenuEntry = IterationMenuAction | IterationMenuLayoutGroup;

/**
 * Render one shared item list into EITHER the `⋯` dropdown or the right-click
 * context menu — the two surfaces the AC requires to expose the SAME actions
 * (#223). Taking `entries` as data (rather than duplicating JSX per menu type)
 * means the two menus can never diverge: a new action is added once, here.
 */
function IterationMenuItems({
  kind,
  entries,
}: {
  kind: "dropdown" | "context";
  entries: IterationMenuEntry[];
}) {
  const isDropdown = kind === "dropdown";
  const Item = isDropdown ? DropdownMenuItem : ContextMenuItem;
  const Sub = isDropdown ? DropdownMenuSub : ContextMenuSub;
  const SubTrigger = isDropdown ? DropdownMenuSubTrigger : ContextMenuSubTrigger;
  const SubContent = isDropdown ? DropdownMenuSubContent : ContextMenuSubContent;
  const RadioGroup = isDropdown ? DropdownMenuRadioGroup : ContextMenuRadioGroup;
  const RadioItem = isDropdown ? DropdownMenuRadioItem : ContextMenuRadioItem;

  return (
    <>
      {entries.map((entry) => {
        if (entry.type === "layout") {
          return (
            <Sub key={entry.id}>
              <SubTrigger className="gap-2">
                {entry.icon}
                {entry.label}
              </SubTrigger>
              <SubContent>
                <RadioGroup
                  value={entry.value}
                  onValueChange={(next) => entry.onChange(next as IterationLayout)}
                >
                  {entry.options.map((option) => (
                    <RadioItem key={option} value={option} className="capitalize">
                      {option}
                    </RadioItem>
                  ))}
                </RadioGroup>
              </SubContent>
            </Sub>
          );
        }
        return (
          <Item key={entry.id} onSelect={entry.onSelect} disabled={entry.disabled}>
            {entry.icon}
            {entry.label}
          </Item>
        );
      })}
    </>
  );
}

/**
 * `:::iterate` / `:::pivot` node-view: the body IS the per-cell TEMPLATE (with
 * `{{tokens}}`), kept editable inline in a quiet labelled frame (accent rail, no
 * fill). When the consumer provides an {@link IterationEditContext} handler, a
 * `⋯` button AND a right-click both open the SAME node menu (#223):
 *   - "Edit iteration…" — the existing guided re-edit (`requestEdit`).
 *   - "Change layout" — rewrites the `layout` attribute directly (no dialog).
 *   - "Transpose" (pivot only) — swaps the rows/cols value lists.
 *   - "Convert to static" — replaces the directive with its populated markdown.
 * With no handler wired, neither menu renders and the body stays editable
 * inline (today's behaviour, unchanged).
 */
function IterationDirectiveView() {
  const { contentRef, node, getPos, setAttrs } = useNodeViewContext();
  const { name, attributes } = useDirectiveAttrs();
  const [, getInstance] = useInstance();
  const onEdit = useContext(IterationEditContext);

  const isPivot = name === "pivot";
  const kind: "iterate" | "pivot" = isPivot ? "pivot" : "iterate";
  const Icon = isPivot ? Grid3x3 : Repeat2;

  const requestEdit = () => {
    onEdit?.({
      kind,
      template: readBodyMarkdown(getInstance as GetEditor, node),
      // A5: hand the current attributes (value lists, bind name, layout) to the
      // handler so the GUIDED builder can reopen with its data — and a writer that
      // round-trips BOTH the attributes and the body, not just the template.
      attributes: { ...(attributes as Record<string, string>) },
      onSave: (template) => writeBodyMarkdown(getInstance as GetEditor, getPos, template),
      // MERGE the guided builder's write-back into the EXISTING attributes rather
      // than replacing the whole record — `directivePartsFromValue` only knows
      // about `as`/`layout`/`values`/`rows`/`cols`, so a naive
      // `setAttrs({ attributes: nextAttrs })` would silently drop every other
      // attribute the directive carries (e.g. a consumer's `source`/`region`
      // reference — `containerDirectiveSchema.attrs.attributes` is a free-form
      // record, and those keys are load-bearing for the consumer's `evaluate`).
      // Mirrors the `transpose()` fix below.
      onSaveData: ({ attributes: nextAttrs, template }) => {
        setAttrs({
          attributes: mergeAttrsOmittingEmpty(attributes as Record<string, string>, nextAttrs),
        });
        writeBodyMarkdown(getInstance as GetEditor, getPos, template);
      },
      onSetAttributes: (nextAttrs) => setAttrs({ attributes: nextAttrs }),
      onReplaceWithMarkdown: (markdown) =>
        replaceNodeWithMarkdown(getInstance as GetEditor, getPos, markdown),
    });
  };

  const setLayout = (layout: IterationLayout) => {
    setAttrs({ attributes: { ...(attributes as Record<string, string>), layout } });
  };

  /**
   * Swap a pivot's rows/cols in place — a no-op template read (transpose never
   * touches the body), so it doesn't need the (async-ish) `readBodyMarkdown`.
   *
   * MERGES the transposed `rows`/`cols` into the EXISTING attributes rather than
   * replacing the whole record (via `mergeAttrsOmittingEmpty`) — so a consumer's
   * OTHER attributes (e.g. `source`/`region`) survive, AND an empty transposed
   * axis is OMITTED rather than written as `""` (which mdast-util-directive would
   * serialize as a bare `rows`/`cols` FLAG, not a genuinely-absent attribute). The
   * menu gates this action on `hasEmbeddedData` below, so in practice both axes
   * are always non-empty here — this stays defensive rather than load-bearing.
   */
  const transpose = () => {
    const seed = builderValueFromParts(kind, attributes as Record<string, string>, "");
    const { attributes: transposed } = directivePartsFromValue(transposeIterationValue(seed));
    setAttrs({
      attributes: mergeAttrsOmittingEmpty(attributes as Record<string, string>, {
        rows: transposed.rows ?? "",
        cols: transposed.cols ?? "",
      }),
    });
  };

  // "Transpose" (pivot) and "Convert to static" only have anything to act on
  // when the block's data is EMBEDDED in its own attributes (`values=` /
  // `rows=`×`cols=`) — the built-in `evaluateEmbedded` resolver. A block whose
  // cells come from the consumer's `evaluate` instead (e.g. `source="repos"`)
  // resolves to zero cells here — Transpose would be a pure visual no-op that
  // still DIRTIES the document (writing bare `rows`/`cols` flags), and Convert
  // to static has nothing to flatten — so both are disabled, with the reason
  // folded into the visible LABEL (not `title`): a disabled Radix menu item is
  // both `pointer-events-none` (no hover tooltip can ever fire) and skipped by
  // keyboard roving-focus, so `title` is unreachable by any input modality —
  // the rendered text is the only place a reason can actually be read.
  const hasEmbeddedData =
    evaluateEmbedded({
      kind,
      layout: (attributes.layout as IterationLayout) || ITERATION_LAYOUTS[kind][0]!,
      template: "",
      as: attributes.as || "item",
      attributes: attributes as Record<string, string>,
    }).cells.length > 0;

  const disabledHint = "— needs embedded values";

  const convertToStatic = () => {
    const template = readBodyMarkdown(getInstance as GetEditor, node);
    const value = builderValueFromParts(kind, attributes as Record<string, string>, template);
    replaceNodeWithMarkdown(getInstance as GetEditor, getPos, staticMarkdownFromValue(value));
  };

  const menuEntries: IterationMenuEntry[] = [
    {
      type: "item",
      id: "edit",
      label: "Edit iteration…",
      icon: <Pencil className="size-4" aria-hidden="true" />,
      onSelect: requestEdit,
    },
    {
      type: "layout",
      id: "layout",
      label: "Change layout",
      icon: <LayoutGrid className="size-4" aria-hidden="true" />,
      value: (attributes.layout as IterationLayout) || ITERATION_LAYOUTS[kind][0]!,
      options: ITERATION_LAYOUTS[kind],
      onChange: setLayout,
    },
    ...(isPivot
      ? [
          {
            type: "item",
            id: "transpose",
            label: hasEmbeddedData ? "Transpose" : `Transpose ${disabledHint}`,
            icon: <ArrowLeftRight className="size-4" aria-hidden="true" />,
            onSelect: transpose,
            disabled: !hasEmbeddedData,
          } satisfies IterationMenuAction,
        ]
      : []),
    {
      type: "item",
      id: "convert-to-static",
      label: hasEmbeddedData ? "Convert to static" : `Convert to static ${disabledHint}`,
      icon: <FileText className="size-4" aria-hidden="true" />,
      onSelect: convertToStatic,
      disabled: !hasEmbeddedData,
    },
  ];

  const header = (
    <div className="mb-1.5 flex items-center gap-1.5 text-meta font-medium text-info-text">
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{isPivot ? "Pivot" : "Iterate"}</span>
      {!isPivot && attributes.as ? (
        <span className="font-normal text-muted-foreground">· per {attributes.as}</span>
      ) : null}
      <span className="font-normal text-muted-foreground">— template</span>
      {onEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              // `data-directive-chrome` routes the click to the browser, not ProseMirror.
              data-directive-chrome=""
              aria-label="Iteration actions"
              title="Iteration actions…"
              className="ms-auto inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-ring"
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <IterationMenuItems kind="dropdown" entries={menuEntries} />
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );

  const body = (
    // The editable template body (inline ProseMirror content).
    <div className="brand-directive__body" ref={contentRef} />
  );

  if (!onEdit) {
    // No consumer handler wired — no re-edit / node-menu affordance (today's
    // behaviour); the template stays editable inline only.
    return (
      <div
        className="brand-directive brand-directive--iterate border-s-2 border-s-info ps-3"
        data-brand-directive={name}
      >
        {header}
        {body}
      </div>
    );
  }

  return (
    <ContextMenu>
      <div
        className="brand-directive brand-directive--iterate border-s-2 border-s-info ps-3"
        data-brand-directive={name}
      >
        {/*
         * Scoped to the HEADER chrome only — NOT the editable template body.
         * Radix's ContextMenuTrigger calls `event.preventDefault()` on every
         * `contextmenu` inside its child, so wrapping the whole frame (header +
         * body) hijacked the browser's native context menu (spellcheck
         * suggestions, Paste, Look Up, Emoji) for right-clicks inside the
         * editable template text. Right-click still opens this SAME menu from
         * the header row; the body keeps its native menu.
         */}
        <ContextMenuTrigger asChild>{header}</ContextMenuTrigger>
        {body}
      </div>
      <ContextMenuContent>
        <IterationMenuItems kind="context" entries={menuEntries} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** `::name` leaf directives (e.g. `::metric`) → live, atomic @brand component. */
function LeafDirectiveView() {
  const { name, attributes, update } = useDirectiveAttrs();

  if (name !== "metric") {
    return (
      <div
        className="brand-directive brand-directive--leaf brand-directive--unknown rounded-md border border-destructive/40 bg-surface-muted p-3 text-sm text-muted-foreground"
        data-brand-leaf={name}
      >
        Unknown inline block: <code>::{name}</code>
      </div>
    );
  }

  const delta = attributes.delta;
  return (
    <MetricBlock
      className="brand-directive brand-directive--leaf brand-directive--metric"
      data-brand-leaf="metric"
      label={
        <InlineEdit
          ariaLabel="Metric label"
          placeholder="Label"
          value={attributes.label ?? ""}
          onCommit={(v) => update("label", v)}
        />
      }
      value={
        <InlineEdit
          ariaLabel="Metric value"
          placeholder="0"
          value={attributes.value ?? ""}
          onCommit={(v) => update("value", v)}
          className="min-w-[1ch]"
        />
      }
      description={attributes.description}
      delta={delta}
      deltaDirection={delta?.startsWith("+") ? "up" : delta?.startsWith("-") ? "down" : "neutral"}
    />
  );
}

/**
 * Keep keystrokes inside an editable attribute field out of ProseMirror's hands —
 * but ONLY for chrome that belongs to THIS node-view, not an ancestor's. ProseMirror
 * asks the node-view whose `dom` contains the event, and `@prosemirror-adapter` marks
 * every node-view root with `data-node-view-root`. So we walk up from the event target
 * and stop ONLY if we reach a `[data-directive-chrome]` element WITHOUT first crossing
 * a node-view-root boundary. This bounds the capture to the current node-view — a
 * nested directive can't swallow events meant for its parent's chrome, and vice versa
 * (#37). A shared, unbounded `closest()` could reach an ancestor's chrome.
 */
function directiveStopEvent(event: Event): boolean {
  let node = event.target;
  while (node instanceof HTMLElement) {
    if (node.hasAttribute("data-directive-chrome")) return true;
    // Reached this node-view's own root without finding chrome → any match above
    // belongs to an ancestor node-view; don't capture for it.
    if (node.hasAttribute("data-node-view-root")) return false;
    node = node.parentElement;
  }
  return false;
}

/**
 * Build the `$view` plugins that bind the directive schemas to their React
 * node-views. Call with the factory from `useNodeViewFactory()` (so it must run
 * inside a `<ProsemirrorAdapterProvider>`), then `.use()` the result on the editor.
 */
export function directiveViewPlugins(
  nodeViewFactory: ReturnType<typeof useNodeViewFactory>,
): MilkdownPlugin[] {
  return [
    $view(containerDirectiveSchema.node, () =>
      nodeViewFactory({
        component: ContainerDirectiveView,
        as: "div",
        contentAs: "div",
        stopEvent: directiveStopEvent,
      }),
    ),
    $view(leafDirectiveSchema.node, () =>
      nodeViewFactory({
        component: LeafDirectiveView,
        as: "div",
        stopEvent: directiveStopEvent,
      }),
    ),
  ].flat() as MilkdownPlugin[];
}
