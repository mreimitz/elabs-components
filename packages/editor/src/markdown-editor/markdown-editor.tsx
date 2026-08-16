"use client";

/**
 * MarkdownEditor — a headless Milkdown (ProseMirror) WYSIWYG markdown surface,
 * vendored onto brand-ui. Companion to the Monaco-based CodeEditor: same package,
 * different engine (Monaco = source/diff; Milkdown = direct-manipulation markdown).
 *
 * - Engine dep: only `@milkdown/kit` (headless). React glue is vendored under
 *   ./milkdown-react so we never pull `@milkdown/react` → `@milkdown/crepe` → Vue.
 * - Theming: token-driven via markdown-editor.css (all three themes, no raw color).
 * - Controlled (`value` + `onChange`) or uncontrolled (`defaultValue`). Mirrors the
 *   platform: `isControlled = value !== undefined`; never flips between modes.
 * - StrictMode-safe (see markdown-editor.strictmode.test.tsx).
 * - The brand `:::` directives render as live @brand React components inside the
 *   editor (real <Card>/<Alert>/<MetricBlock>, with inline-editable titles +
 *   metric label/value) via @prosemirror-adapter/react — see directive-views.tsx.
 *   The shared remark pipeline keeps the editor and the Streamdown preview on one
 *   markdown dialect.
 */
import "@milkdown/kit/prose/view/style/prosemirror.css";
import "./markdown-editor.css";

import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  editorViewOptionsCtx,
  parserCtx,
  rootCtx,
  serializerCtx,
} from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { history } from "@milkdown/kit/plugin/history";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { getMarkdown, replaceAll } from "@milkdown/kit/utils";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import {
  ProsemirrorAdapterProvider,
  useNodeViewFactory,
  usePluginViewFactory,
  useWidgetViewFactory,
} from "@prosemirror-adapter/react";
import {
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
} from "react";

import { calcProsePlugins } from "../calc-block/calc-editor-prose";
import type { CalcEditorHooks } from "../calc-block/types";
import { completionsViewPlugins } from "./completions";
import type { EditorCompletionProvider } from "../lib/editor-completions";
import type { EditorContentAccess, EditorSelection } from "../lib/editor-content-access";
import { proseMirrorContentAccess, selectionWatchPlugin } from "../lib/editor-content-access-prose";
import { markdownScaleVars } from "../lib/markdown/markdown-scale";
import { plainText, slugifyHeading, uniqueSlug } from "../lib/markdown/slugify";
import {
  IterationEditContext,
  type IterationEditHandler,
} from "../markdown-iteration/edit-context";
import { parseMarkdownOutline } from "../markdown-outline";
import { directivePlugins } from "./directive-nodes";
import { directiveViewPlugins } from "./directive-views";
import { exitKeymapPlugins } from "./exit-keymap";
import { Milkdown, MilkdownProvider, useEditor, useInstance } from "./milkdown-react";
import { pasteEmbedPlugin, type EmbedAssetFn } from "./paste-embed";
import { brandSlashViewPlugins, type SlashCommand } from "./slash";
import { tableViewPlugins } from "./table-view";

/**
 * Imperative handle exposed via `ref`.
 *
 * Extends {@link EditorContentAccess} so any consumer of a `MarkdownEditor`
 * ref can drive AI editing operations (insert, replace, subscribe to selection)
 * through the engine-agnostic interface, alongside the markdown-specific helpers.
 *
 * `getText()` is an alias for `getMarkdown()` (same output; both return the full
 * document serialized to markdown). The duplication is intentional: `getText`
 * satisfies the `EditorContentAccess` interface contract; `getMarkdown` is the
 * historically-named markdown-specific method. JSDoc notes the equivalence.
 */
export interface MarkdownEditorHandle extends EditorContentAccess {
  /**
   * Serialize the current document to a markdown string.
   * Equivalent to `getText()` — both return the full document as markdown.
   */
  getMarkdown: () => string;
  /**
   * Serialize the current document, or `null` while the engine is still
   * booting. Used to capture the pre-edit normalization BASELINE for the
   * lossless-edit merge (WI-1) — unlike `getMarkdown` it never falls back to
   * the raw input, so a non-null result is always the editor's own output.
   */
  serialized: () => string | null;
  /**
   * Best-effort: scroll the heading whose outline slug matches into view (#273).
   * Walks the ProseMirror doc for `heading` nodes, slugifies their text with the
   * same algorithm as `parseMarkdownOutline`, and scrolls the first match into
   * view. No-op (never throws) while the engine is booting or if no match.
   */
  scrollToHeading: (slug: string) => void;
  /**
   * Best-effort: scroll toward FULL-SOURCE 1-based `line` by resolving the
   * nearest preceding heading in the ProseMirror doc (no exact source map in
   * WYSIWYG — Milkdown keeps no `data-sourcepos`). No-op when no preceding
   * heading is found or while booting. (#273)
   *
   * For precise navigation, prefer `scrollToHeading(slug)` — the workspace
   * resolves the slug from the line via `parseMarkdownOutline` + `fmOffset`
   * before forwarding here.
   */
  revealLine: (line: number, opts?: { center?: boolean }) => void;
}

export interface MarkdownEditorProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue"
> {
  /** Controlled markdown value. Pair with `onChange`. */
  value?: string;
  /** Initial markdown for uncontrolled use. */
  defaultValue?: string;
  /** Fires on every edit with the full markdown document. */
  onChange?: (markdown: string) => void;
  /** Render the editor read-only (still selectable, not editable). */
  readOnly?: boolean;
  /**
   * Accessible name for the editable surface. Milkdown/ProseMirror renders an ARIA
   * `textbox` (`contenteditable`); without a name, screen readers announce an
   * unlabeled field. Set onto the ProseMirror view's `attributes`. Default
   * `"Markdown editor"`.
   */
  ariaLabel?: string;
  /**
   * Enable the `/` command menu (insert brand `:::` directives + basic blocks
   * live at the caret). `true` (default) uses the built-in
   * {@link BRAND_SLASH_COMMANDS}; pass a `commands` array to extend/replace them,
   * or `false` to disable. The `trigger` defaults to `"/"`.
   *
   * Pass `shortcut` (default `"Mod-Shift-O"`) to control the keyboard shortcut that
   * opens the menu at the caret without typing the trigger character — works in
   * BOTH the WYSIWYG pane and the Monaco source pane (#271).
   */
  slashMenu?: boolean | { commands?: SlashCommand[]; trigger?: string; shortcut?: string };
  /**
   * Opt-in calc authoring inside ```calc fences (off by default). Supply the
   * consumer's hooks — `tokenize` (highlight), `evaluate` (result inlays), and/or
   * `complete` (autocomplete; Monaco surface). The library DECORATES, the consumer
   * COMPUTES — no calc engine is bundled. Mirrors `MarkdownPreview`'s `evaluate`.
   */
  calc?: CalcEditorHooks;
  /**
   * Declarative completion providers (#283) — e.g. `[[wikilink]]` autocomplete.
   * Off by default; mirrors the `slashMenu`/`calc` opt-in pattern. Each provider
   * registers a `triggerCharacters` set + a `provide(ctx)` that returns
   * candidates; the library owns detecting the trigger and rendering/inserting.
   *
   * This is a DELIBERATELY MINIMAL, best-effort mirror of the Monaco source-pane
   * behavior (see `markdown-editor/completions/completions-prose.ts` for the
   * exact gaps — no real cross-block line/column, a plain listbox instead of a
   * native suggest widget). Forwarded from `MarkdownWorkspace`'s `completions`
   * prop, which also wires the FULL Monaco/source-pane path.
   */
  completions?: EditorCompletionProvider[];
  /**
   * Host-provided callback for image paste/drop embedding.
   *
   * When set, the editor intercepts paste and drop events that contain image
   * files, shows an inline "uploading…" placeholder, calls this function with
   * the `File`, and on resolve inserts `![filename](returnedPath)` in the
   * document. On reject the placeholder is removed and an inline error chip
   * (+ toast) is shown — the document never contains a broken image.
   *
   * If not set, the editor's default paste/drop behavior is unchanged.
   *
   * The library NEVER stores assets — all persistence is the host's responsibility.
   */
  onEmbedAsset?: EmbedAssetFn;
}

export type { EmbedAssetFn };

interface ViewProps {
  initialValue: string;
  value?: string;
  onChange?: (markdown: string) => void;
  readOnly: boolean;
  ariaLabel: string;
  slashMenu: boolean | { commands?: SlashCommand[]; trigger?: string; shortcut?: string };
  calc?: CalcEditorHooks;
  completions?: EditorCompletionProvider[];
  onEmbedAsset?: EmbedAssetFn;
}

/**
 * Walk the ProseMirror doc for a `heading` node whose slug (slugified with the
 * SAME algorithm as `parseMarkdownOutline`) matches `slug`, and scroll it into
 * view. Best-effort: a no-op (never throws) when no match / out of range. Shared
 * by `scrollToHeading` and the best-effort `revealLine` (#273).
 */
function scrollHeadingBySlug(editor: Editor, slug: string): void {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const { doc } = view.state;
    const used = new Map<string, number>();
    let targetPos: number | null = null;
    doc.forEach((node, offset) => {
      if (targetPos !== null) return;
      if (node.type.name === "heading") {
        const id = uniqueSlug(slugifyHeading(plainText(node.textContent)), used);
        if (id === slug) targetPos = offset + 1; // +1 steps inside the heading node
      }
    });
    if (targetPos === null) return;
    try {
      const resolved = doc.resolve(targetPos);
      view.dispatch(view.state.tr.setSelection(TextSelection.near(resolved)).scrollIntoView());
    } catch {
      // Guard against out-of-range positions — never throw.
    }
  });
}

const MarkdownEditorView = forwardRef<MarkdownEditorHandle, ViewProps>(function MarkdownEditorView(
  {
    initialValue,
    value,
    onChange,
    readOnly,
    ariaLabel,
    slashMenu,
    calc,
    completions,
    onEmbedAsset,
  },
  ref,
) {
  // Latest onChange via a ref so the create effect can run once per `readOnly`.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  // Tracks the editor's current markdown — both the "preserve across recreate"
  // value and the echo-guard for controlled `value` syncing.
  const lastMarkdown = useRef(initialValue);

  // Renders the brand `:::` directives as live @brand React components inside the
  // editor (must run under <ProsemirrorAdapterProvider>). The factory is stable.
  const nodeViewFactory = useNodeViewFactory();
  // The widget factory backs the `/` command menu (rendered as a ProseMirror
  // widget at the caret). Same adapter, also stable.
  const widgetViewFactory = useWidgetViewFactory();
  // The plugin-view factory mounts the table controls toolbar as a ProseMirror
  // plugin view (outside contentEditable, no focus conflicts).
  const pluginViewFactory = usePluginViewFactory();

  // Resolve the slash config through a ref so a fresh `commands` array identity
  // each render never rebuilds the editor — only enabling/disabling does.
  const slashEnabled = slashMenu !== false;
  const slashConfigRef = useRef<{ commands?: SlashCommand[]; trigger?: string; shortcut?: string }>(
    {},
  );
  slashConfigRef.current = typeof slashMenu === "object" ? slashMenu : {};

  // Calc authoring hooks read through a ref — like the slash config, a fresh
  // `calc` object identity each render must NOT rebuild the editor; only
  // toggling the feature on/off does (the plugin reads the latest hooks lazily).
  const calcEnabled = calc != null;
  const calcRef = useRef<CalcEditorHooks | undefined>(calc);
  calcRef.current = calc;

  // Completion providers (#283) read through a ref — a fresh `completions`
  // array identity each render must NOT rebuild the editor (or re-register the
  // Monaco-side global provider); only enabling/disabling the feature does. The
  // plugin's async `provide()` fetch reads the LATEST list via this getter.
  const completionsEnabled = completions != null;
  const completionsRef = useRef<EditorCompletionProvider[] | undefined>(completions);
  completionsRef.current = completions;

  // Keep onEmbedAsset in a ref so the editor factory captures it by reference —
  // a new function identity each render never causes an editor rebuild.
  const onEmbedAssetRef = useRef(onEmbedAsset);
  onEmbedAssetRef.current = onEmbedAsset;

  // #223: the live `IterationEditContext` handler (set by a consumer's
  // `IterationBuilderProvider` / `IterationTemplateProvider` ABOVE this editor),
  // read through a ref like the other slash/calc hooks — a fresh Provider value
  // each render must NOT rebuild the editor; the plugin resolves it lazily via
  // the getter passed to `brandSlashViewPlugins`.
  const iterationEditHandler = useContext(IterationEditContext);
  const iterationEditHandlerRef = useRef<IterationEditHandler | null>(iterationEditHandler);
  iterationEditHandlerRef.current = iterationEditHandler;

  // Shared selection-change listener set: the selectionWatchPlugin writes to it;
  // proseMirrorContentAccess reads/writes subscriptions. Stable across re-renders
  // (created once) — the plugin reads it via the thunk each transaction.
  const selectionListeners = useRef(new Set<(sel: EditorSelection) => void>()).current;

  // The serializeSlice closure is built lazily in useImperativeHandle (needs
  // getInstance), but the plugin reads the LATEST version via a thunk so it never
  // captures a stale closure. We hold a ref that useImperativeHandle fills in.
  const serializeSliceRef = useRef<(view: EditorView) => string>(() => "");

  useEditor(
    (root) => {
      // Build the paste-embed plugin with an indirection through the ref so the
      // plugin always calls the latest host callback without rebuilding.
      const embedPlugin = pasteEmbedPlugin(
        onEmbedAssetRef.current ? (file: File) => onEmbedAssetRef.current!(file) : undefined,
      );

      let editor = Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, lastMarkdown.current);
          ctx.update(editorViewOptionsCtx, (prev) => ({
            ...prev,
            editable: () => !readOnly,
            // Name the ProseMirror `role="textbox"` surface so AT announces it.
            // Spread prev.attributes so we never clobber Milkdown's own view attrs.
            attributes: { ...prev.attributes, "aria-label": ariaLabel },
          }));
          ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
            lastMarkdown.current = markdown;
            onChangeRef.current?.(markdown);
          });
        })
        .use(commonmark)
        .use(gfm)
        .use(tableViewPlugins(pluginViewFactory))
        .use(exitKeymapPlugins())
        .use(history)
        .use(listener)
        .use(directivePlugins)
        .use(directiveViewPlugins(nodeViewFactory))
        .use(embedPlugin)
        // Always-present selection-watch plugin — notifies selectionListeners when
        // the ProseMirror selection changes. Listeners subscribe/unsubscribe via the
        // proseMirrorContentAccess adapter; the plugin itself is stateless per-sub.
        .use(
          selectionWatchPlugin(
            () => selectionListeners,
            () => serializeSliceRef.current,
          ),
        );
      if (slashEnabled) {
        editor = editor.use(
          brandSlashViewPlugins(widgetViewFactory, {
            ...slashConfigRef.current,
            getIterationEditHandler: () => iterationEditHandlerRef.current,
          }),
        );
      }
      if (calcEnabled) {
        editor = editor.use(calcProsePlugins(() => calcRef.current));
      }
      if (completionsEnabled) {
        editor = editor.use(
          completionsViewPlugins(widgetViewFactory, () => completionsRef.current),
        );
      }
      return editor;
    },
    [readOnly, ariaLabel, slashEnabled, calcEnabled, completionsEnabled],
  );

  const [loading, getInstance] = useInstance();

  // Controlled sync: push external `value` into the editor only when it diverges
  // from what the editor last emitted (avoids clobbering on our own echo).
  useEffect(() => {
    if (loading || value === undefined) return;
    if (value === lastMarkdown.current) return;
    const editor = getInstance();
    if (!editor) return;
    lastMarkdown.current = value;
    editor.action(replaceAll(value));
  }, [loading, value, getInstance]);

  useImperativeHandle(
    ref,
    () => {
      // Build serialize/parse closures via getInstance().action(ctx => ...) —
      // the exact technique used by directive-views.tsx (readBodyMarkdown /
      // writeBodyMarkdown). These are re-built whenever getInstance changes
      // (i.e. when the editor is recreated).

      /** Serialize the current selection slice to markdown ("" when collapsed). */
      const serializeSlice = (view: EditorView): string => {
        const editor = getInstance();
        if (!editor) return "";
        const { selection } = view.state;
        if (selection.empty) return "";
        try {
          return editor
            .action((ctx) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const serialize = (ctx as any).get(serializerCtx) as (node: ProseNode) => string;
              const doc = selection.content().content;
              // Wrap in a top-level doc node so the serializer can emit all block types.
              const wrapper = view.state.doc.type.schema.topNodeType.create(null, doc);
              return serialize(wrapper);
            })
            .trim();
        } catch {
          // Serializer unavailable (e.g. booting) — fall back to plain text.
          return view.state.doc.textBetween(selection.from, selection.to, "\n");
        }
      };

      // Update the ref so the selection-watch plugin always reads the latest closure.
      serializeSliceRef.current = serializeSlice;

      /** Parse `md` as markdown and replace the current selection; plain-text fallback. */
      const parseAndReplace = (view: EditorView, md: string): void => {
        const editor = getInstance();
        if (!editor) return;
        try {
          editor.action((ctx) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const parse = (ctx as any).get(parserCtx) as (md: string) => ProseNode | null;
            const parsed = parse(md);
            if (!parsed) {
              // Null parse result → plain-text insert.
              view.dispatch(view.state.tr.insertText(md));
              return;
            }
            // Replace the current selection with the parsed content.
            const tr = view.state.tr.replaceSelectionWith(parsed);
            view.dispatch(tr);
          });
        } catch {
          // Parse failure → plain-text fallback (never blanks the doc, never throws).
          try {
            view.dispatch(view.state.tr.insertText(md));
          } catch {
            // Guard: if even insertText fails (e.g. read-only), silently no-op.
          }
        }
      };

      const getView = (): EditorView | null => {
        const editor = getInstance();
        if (!editor) return null;
        try {
          return editor.action((ctx) => ctx.get(editorViewCtx));
        } catch {
          return null;
        }
      };

      const access = proseMirrorContentAccess({
        getView,
        getText: () => getInstance()?.action(getMarkdown()) ?? lastMarkdown.current,
        serializeSlice,
        parseAndReplace,
        listeners: selectionListeners,
      });

      return {
        // EditorContentAccess methods (via proseMirrorContentAccess).
        getText: access.getText,
        getSelection: access.getSelection,
        replaceSelection: access.replaceSelection,
        insertAtCursor: access.insertAtCursor,
        focus: access.focus,
        onSelectionChange: access.onSelectionChange,

        // Markdown-specific methods.
        getMarkdown: () => getInstance()?.action(getMarkdown()) ?? lastMarkdown.current,
        serialized: () => getInstance()?.action(getMarkdown()) ?? null,

        scrollToHeading: (slug: string) => {
          const editor = getInstance();
          if (editor) scrollHeadingBySlug(editor, slug);
        },

        revealLine: (line: number, _opts?: { center?: boolean }) => {
          // WYSIWYG has no source map (Milkdown keeps no data-sourcepos), so this is
          // best-effort: serialize the doc, resolve the nearest preceding heading via
          // the shared outline parser, and scroll to it. No-op when none. (#273)
          const editor = getInstance();
          if (!editor) return;
          const md = editor.action(getMarkdown());
          const preceding = parseMarkdownOutline(md)
            .filter((item) => item.line <= line)
            .at(-1);
          if (preceding) scrollHeadingBySlug(editor, preceding.id);
        },
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getInstance],
  );

  return <Milkdown />;
});

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      value,
      defaultValue,
      onChange,
      readOnly = false,
      ariaLabel = "Markdown editor",
      slashMenu = true,
      calc,
      completions,
      onEmbedAsset,
      className,
      style,
      ...props
    },
    ref,
  ) {
    // Capture the initial value once; later `value` changes flow through the
    // controlled-sync effect, not a remount.
    const initialValue = useRef(value ?? defaultValue ?? "").current;

    return (
      <div
        data-testid="markdown-editor"
        className={cn(
          // A 1px hairline focus ring (not a heavy 2px ring) — the editable is a
          // large surface, so a thinner edit-mode ring reads calmer while still
          // meeting the visible-focus requirement (same `ring` token). (A7)
          "milkdown-host overflow-auto rounded-md border border-border bg-background text-foreground focus-within:ring-1 focus-within:ring-ring",
          className,
        )}
        // Publish the shared markdown scale as CSS vars the editor CSS reads, so the
        // WYSIWYG headings/measure match the preview (single source of truth, #18).
        style={{ ...markdownScaleVars(), ...style }}
        {...props}
      >
        <MilkdownProvider>
          <ProsemirrorAdapterProvider>
            <MarkdownEditorView
              ref={ref}
              initialValue={initialValue}
              value={value}
              onChange={onChange}
              readOnly={readOnly}
              ariaLabel={ariaLabel}
              slashMenu={slashMenu}
              calc={calc}
              completions={completions}
              onEmbedAsset={onEmbedAsset}
            />
          </ProsemirrorAdapterProvider>
        </MilkdownProvider>
      </div>
    );
  },
);
