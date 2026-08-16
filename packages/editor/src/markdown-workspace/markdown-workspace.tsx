"use client";

/**
 * MarkdownWorkspace — the hybrid markdown authoring surface for the Workbench.
 *
 * One markdown value, three modes (a @qlik-coe-emea/qlabs-components-ui ToggleGroup):
 *  - "source"  : Monaco CodeEditor(markdown) + the MarkdownToolbar
 *  - "wysiwyg" : the Milkdown MarkdownEditor (direct manipulation)
 *  - "split"   : source ↔ the branded MarkdownPreview (drag-resizable)
 *
 * The value is shared across modes, so switching is lossless. Controlled
 * (`value`/`onChange`) or uncontrolled (`defaultValue`); same for `mode`.
 */
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@qlik-coe-emea/qlabs-components-ui";
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";
import { Columns2, Eye, Focus, SquareCode } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";

import { attachCalcMonaco } from "../calc-block/calc-editor-monaco";
import type { CalcEditorHooks } from "../calc-block/types";
import { CodeEditor, type EditorAction, type MonacoCodeEditor } from "../code-editor";
import { attachCompletionsMonaco } from "../lib/editor-completions-monaco";
import type { EditorCompletionProvider } from "../lib/editor-completions";
import {
  monacoContentAccess,
  type EditorContentAccess,
  type EditorSelection,
} from "../lib/editor-content-access";
import { parseFrontmatter } from "../lib/markdown/frontmatter";
import { mergeNormalizedEdit } from "../lib/markdown/merge";
import { MarkdownEditor, type MarkdownEditorHandle, type EmbedAssetFn } from "../markdown-editor";
import { parseMarkdownOutline } from "../markdown-outline";
import { BRAND_SLASH_COMMANDS, type SlashCommand } from "../markdown-editor/slash";
// MonacoSlashMenu + parseShortcut are imported from their files (NOT the slash
// barrel), which pull the Monaco runtime — the workspace already does too. Keeps
// the Milkdown-facing slash barrel Monaco-free. The pure `shortcut.ts` holds the
// default; `shortcut-monaco.ts` holds the Monaco-keybinding parser.
import { MonacoSlashMenu } from "../markdown-editor/slash/monaco-slash-menu";
import {
  slashTriggerRange,
  type SlashTriggerRange,
} from "../markdown-editor/slash/source-slash-trigger";
import { DEFAULT_SLASH_SHORTCUT } from "../markdown-editor/slash/shortcut";
import { parseShortcut } from "../markdown-editor/slash/shortcut-monaco";
import { MarkdownPreview } from "../markdown-preview";
import { MarkdownToolbar } from "../markdown-toolbar";
import { topLevelBlockOf, typewriterDelta } from "./focus-writing";

export type MarkdownWorkspaceMode = "source" | "wysiwyg" | "split";

/**
 * Imperative handle exposed via `MarkdownWorkspace`'s `ref` (#273, DECISION A).
 *
 * Migration note: the forwarded ref type changed from `HTMLDivElement` to this
 * handle. Replace any `ref.current` DOM access with `ref.current?.getElement()`.
 *
 * Extends {@link EditorContentAccess} — all AI content-access methods delegate to
 * the active engine: Monaco (source/split) or the Milkdown WYSIWYG handle.
 *
 * **`onSelectionChange` caveat:** the subscription is scoped to the engine active at
 * call time. A mode switch (source ↔ wysiwyg) does NOT auto-rebind the listener —
 * re-subscribe from an effect whose deps include the mode. A self-rebinding v2 is a
 * noted future enhancement, out of v1 scope.
 */
export interface MarkdownWorkspaceHandle extends EditorContentAccess {
  /**
   * Scroll the active editor so FULL-SOURCE 1-based `line` is visible (Monaco
   * coordinates). No-op (never throws) while the engine is booting or `line` is
   * out of range. In WYSIWYG it is best-effort: resolves the nearest preceding
   * heading via `parseMarkdownOutline` + `fmOffset`, then delegates to
   * `scrollToHeading`. No-op if no preceding heading found.
   */
  revealLine(line: number, opts?: { center?: boolean }): void;
  /**
   * Scroll to a heading by its outline slug (same slugs as `DocumentOutline` /
   * `useMarkdownOutline` / `parseMarkdownOutline`). In Source/Split mode
   * resolves the line via `parseMarkdownOutline` then calls `revealLine`. In
   * WYSIWYG delegates to the `MarkdownEditorHandle.scrollToHeading`.
   */
  scrollToHeading(slug: string): void;
  /**
   * The live Monaco source editor instance, or `null` when not mounted or when
   * the active mode is `"wysiwyg"` (source pane not rendered).
   */
  getEditor(): MonacoCodeEditor | null;
  /**
   * The workspace root DOM element. Preserves the old `HTMLDivElement` ref
   * access that existed before DECISION A (ref type change in #273).
   */
  getElement(): HTMLDivElement | null;
}

export interface MarkdownWorkspaceProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange" | "defaultValue"
> {
  value?: string;
  defaultValue?: string;
  onChange?: (markdown: string) => void;
  mode?: MarkdownWorkspaceMode;
  defaultMode?: MarkdownWorkspaceMode;
  onModeChange?: (mode: MarkdownWorkspaceMode) => void;
  /**
   * Start with FOCUS WRITING on (wysiwyg mode): typewriter scrolling keeps
   * the caret vertically centered and inactive paragraphs dim. Toggleable in
   * the editor's mode row.
   */
  defaultFocusWriting?: boolean;
  /**
   * The `/` command menu in the WYSIWYG (preview-edit) pane AND the Monaco source
   * pane. `true` (default) uses the built-in brand commands; pass a config to
   * extend/replace them, or `false` to disable. Forwarded to {@link MarkdownEditor}.
   *
   * `shortcut` (default `"Mod-Shift-O"`) opens the menu at the caret in BOTH panes —
   * in the WYSIWYG pane via the ProseMirror plugin's `handleKeyDown`, and in the
   * source/split pane via a `CodeEditor` action (no `/` is inserted into the
   * doc). (#271)
   */
  slashMenu?: boolean | { commands?: SlashCommand[]; trigger?: string; shortcut?: string };
  /**
   * Customize the source / split toolbar's **Insert** menu (A4). Defaults to the
   * same commands as the WYSIWYG slash menu (so `/calc`, `/iterate`, `/pivot` and
   * any consumer commands are insertable in source mode too). Only commands with
   * a `snippet` appear; pass your own list to override.
   */
  insertCommands?: SlashCommand[];
  /**
   * Opt-in calc authoring inside ```calc fences (off by default). Wired to BOTH
   * surfaces: the Monaco source pane (highlight + autocomplete + result inlays)
   * and the WYSIWYG pane (highlight + result inlays). Supply the consumer's
   * `tokenize` / `evaluate` / `complete` hooks; the library bundles no calc engine.
   */
  calc?: CalcEditorHooks;
  /**
   * Declarative completion providers (#283) — e.g. `[[wikilink]]` autocomplete.
   * Off by default; mirrors the `slashMenu`/`calc` opt-in pattern. The library
   * owns the Monaco `registerCompletionItemProvider` registration lifecycle
   * (registered once, refcounted across mounted workspaces, disposed with the
   * last one — see `lib/editor-completions-monaco.ts`) for the Source/Split
   * panes, and mirrors providers into the WYSIWYG pane via `MarkdownEditor`'s
   * `completions` prop (a deliberately minimal mirror — see
   * `markdown-editor/completions/completions-prose.ts` for the exact gaps).
   * Zero `monaco-editor` imports needed in consumer code.
   */
  completions?: EditorCompletionProvider[];
  /**
   * Host-provided callback for image paste/drop embedding in the WYSIWYG pane.
   * Forwarded to {@link MarkdownEditor}. See `MarkdownEditorProps.onEmbedAsset`
   * for the full contract.
   */
  onEmbedAsset?: EmbedAssetFn;
  /**
   * Show the built-in "Focus writing" toggle in the WYSIWYG (preview-edit)
   * toolbar row. `false` HIDES and DISABLES it (no keyboard path) and forces
   * focus-writing OFF. `undefined`/`true` keep current behavior. The INITIAL
   * on/off state still comes from `defaultFocusWriting`. (#270)
   */
  focusWriting?: boolean;
  /**
   * Show the built-in Source / Split / Preview-edit mode switch. `false` hides
   * it in both toolbar branches so the host owns the view switch (controlled
   * `mode`/`onModeChange` still drive the panes). Default `true`. (#272)
   */
  modeSwitch?: boolean;
  /**
   * Host-supplied controls rendered in the toolbar's trailing slot (where the
   * built-in mode switch sits). Use with `modeSwitch={false}` to supply your
   * own switch / actions. (#272)
   */
  toolbarActions?: ReactNode;
}

const MODES: { value: MarkdownWorkspaceMode; label: string; icon: typeof Eye }[] = [
  { value: "source", label: "Source", icon: SquareCode },
  { value: "split", label: "Split", icon: Columns2 },
  { value: "wysiwyg", label: "Preview-edit", icon: Eye },
];

export const MarkdownWorkspace = forwardRef<MarkdownWorkspaceHandle, MarkdownWorkspaceProps>(
  function MarkdownWorkspace(
    {
      value,
      defaultValue,
      onChange,
      mode,
      defaultMode = "split",
      onModeChange,
      defaultFocusWriting = false,
      focusWriting,
      modeSwitch = true,
      toolbarActions,
      slashMenu = true,
      insertCommands,
      calc,
      completions,
      onEmbedAsset,
      className,
      ...props
    },
    ref,
  ) {
    // The source/split Insert menu defaults to the SAME commands as the WYSIWYG
    // slash menu, so both surfaces insert the same blocks (A4).
    const slashCommandList =
      typeof slashMenu === "object" && slashMenu.commands
        ? slashMenu.commands
        : BRAND_SLASH_COMMANDS;
    const toolbarInsertCommands = insertCommands ?? slashCommandList;
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState(value ?? defaultValue ?? "");
    const markdown = isControlled ? value : internalValue;

    const [internalMode, setInternalMode] = useState<MarkdownWorkspaceMode>(defaultMode);
    const activeMode = mode ?? internalMode;

    const [monaco, setMonaco] = useState<MonacoCodeEditor | null>(null);
    // Stable set of onSelectionChange listeners (engine-agnostic). The handle adds
    // here; a binding effect forwards the active engine's selection events. (#AI)
    const [selectionListeners] = useState(() => new Set<(sel: EditorSelection) => void>());

    /* ------------------------- calc authoring (#220) ------------------------ */
    // Read the calc hooks through a ref so a fresh `calc` object identity never
    // re-attaches the Monaco layer; only toggling the feature on/off does.
    const calcRef = useRef<CalcEditorHooks | undefined>(calc);
    calcRef.current = calc;
    const calcEnabled = calc != null;

    useEffect(() => {
      if (!monaco || !calcEnabled) return;
      // Let calc completions surface as you type inside the fence (markdown
      // otherwise suppresses quick suggestions outside comments/strings).
      monaco.updateOptions({
        quickSuggestions: { other: true, comments: false, strings: false },
      });
      return attachCalcMonaco(monaco, () => calcRef.current);
    }, [monaco, calcEnabled]);

    /* --------------------- completion providers (#283) ----------------------- */
    // Read through a ref so a fresh `completions` array identity (a re-render)
    // never re-attaches — the Monaco lifecycle (`attachCompletionsMonaco`) reads
    // the LIVE list on every suggestion request; only mount/unmount and
    // enabling/disabling the feature touch the effect.
    const completionsRef = useRef<EditorCompletionProvider[] | undefined>(completions);
    completionsRef.current = completions;
    const completionsEnabled = completions != null;

    useEffect(() => {
      if (!monaco || !completionsEnabled) return;
      return attachCompletionsMonaco(monaco, () => completionsRef.current);
    }, [monaco, completionsEnabled]);

    // The source CodeEditor unmounts when the active mode becomes WYSIWYG, but its
    // `onMount` only fires on (re)mount — nothing clears the held instance. Drop it
    // here so `getEditor()` honors its documented `null` contract in WYSIWYG and
    // `revealLine`/`scrollToHeading` delegate to the WYSIWYG handle instead of
    // acting on a disposed Monaco editor. (#271 review)
    useEffect(() => {
      if (activeMode === "wysiwyg") setMonaco(null);
    }, [activeMode]);

    /* --------- source-pane slash menu (#271) -------------------------------- */
    const slashEnabled = slashMenu !== false;
    // Honor an explicitly disabled shortcut (`shortcut: ""` / `shortcut: undefined`)
    // the SAME way the WYSIWYG plugin does (`"shortcut" in options`), so both panes
    // agree: only fall back to the default when the key is absent entirely. (#271 review)
    const shortcut =
      typeof slashMenu === "object" && "shortcut" in slashMenu
        ? slashMenu.shortcut
        : DEFAULT_SLASH_SHORTCUT;

    const [sourceSlashOpen, setSourceSlashOpen] = useState(false);
    // The model range of a typed `/` when the menu was opened by typing (not the
    // hotkey). null for the hotkey path. Drives MonacoSlashMenu's `triggerRange`:
    // on select the `/` is replaced by the block; on cancel it is removed.
    const [typedTrigger, setTypedTrigger] = useState<SlashTriggerRange | null>(null);

    // Close handler: clear the typed-trigger whenever the menu closes so a later
    // hotkey-open doesn't inherit a stale range.
    const handleSourceSlashOpenChange = (next: boolean) => {
      setSourceSlashOpen(next);
      if (!next) setTypedTrigger(null);
    };

    // Typing `/` at a line start (or after whitespace) opens the menu in the
    // source pane — the conflict-free trigger that mirrors the WYSIWYG `/`. We
    // watch model edits for a lone `/` insertion at a valid spot; our own
    // insert/cancel edits are multi-char or empty, so they never re-trigger.
    useEffect(() => {
      if (!monaco || !slashEnabled) return;
      const sub = monaco.onDidChangeModelContent((e) => {
        if (sourceSlashOpen || e.changes.length !== 1) return;
        const change = e.changes[0];
        if (!change || change.text !== "/") return;
        const model = monaco.getModel();
        if (!model) return;
        const line = change.range.startLineNumber;
        const range = slashTriggerRange(line, model.getLineContent(line), change.range.startColumn);
        if (!range) return;
        setTypedTrigger(range);
        setSourceSlashOpen(true);
      });
      return () => sub.dispose();
    }, [monaco, slashEnabled, sourceSlashOpen]);

    // A command works in the source pane when it has a text snippet OR an
    // explicit source-pane handler (#299) — a run-only command whose ONLY
    // handler is Milkdown's `run` (needs a Ctx unavailable in Monaco) is
    // excluded; `runInSource` is exactly the escape hatch for that case.
    const sourceCommands = useMemo(
      () =>
        slashCommandList.filter((c) => c.snippet != null || typeof c.runInSource === "function"),
      [slashCommandList],
    );

    // A Layer-1 CodeEditor action that opens the source slash popup when fired
    // (via its keybinding or the command palette). All KeyMod/KeyCode references
    // live inside parseShortcut (slash/shortcut.ts) — NEVER reference a bare
    // monaco.KeyMod here, because `monaco` is a state variable (the editor
    // instance), not the namespace.
    const sourceActions = useMemo<EditorAction[]>(
      () =>
        slashEnabled && shortcut
          ? [
              {
                id: "brand.openSlashMenu",
                label: "Insert block…",
                keybindings: [parseShortcut(shortcut)],
                // Hotkey open inserts at the caret (no typed `/` to replace).
                run: () => {
                  setTypedTrigger(null);
                  setSourceSlashOpen(true);
                },
              },
            ]
          : [],
      [slashEnabled, shortcut],
    );

    /* ------------------- split-view scroll synchronization ------------------ */
    // Line-accurate (not percentage) sync: preview blocks carry
    // `data-sourcepos` in frontmatter-STRIPPED coordinates; Monaco lines are
    // full-source — bridge with the stripped-line offset.
    const previewPaneRef = useRef<HTMLDivElement | null>(null);
    const scrollLock = useRef<"editor" | "preview" | null>(null);
    const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fmOffset = useMemo(() => {
      try {
        const body = parseFrontmatter(markdown).content;
        return markdown.split("\n").length - body.split("\n").length;
      } catch {
        return 0;
      }
    }, [markdown]);

    const lock = (owner: "editor" | "preview") => {
      scrollLock.current = owner;
      if (lockTimer.current) clearTimeout(lockTimer.current);
      lockTimer.current = setTimeout(() => {
        scrollLock.current = null;
      }, 150);
    };

    // Editor → preview.
    useEffect(() => {
      if (!monaco || activeMode !== "split") return;
      const disposable = monaco.onDidScrollChange(() => {
        if (scrollLock.current === "preview") return;
        const range = monaco.getVisibleRanges()[0];
        const host = previewPaneRef.current;
        if (!range || !host) return;
        const line = range.startLineNumber - fmOffset;
        let target: HTMLElement | null = null;
        for (const el of host.querySelectorAll<HTMLElement>("[data-sourcepos]")) {
          const end = Number(el.dataset.sourcepos?.split(":")[1]);
          if (end >= line) {
            target = el;
            break;
          }
        }
        if (!target) return;
        lock("editor");
        host.scrollTop =
          target.getBoundingClientRect().top -
          host.getBoundingClientRect().top +
          host.scrollTop -
          12;
      });
      return () => disposable.dispose();
    }, [monaco, activeMode, fmOffset]);

    // Preview → editor.
    const onPreviewScroll = () => {
      if (scrollLock.current === "editor" || !monaco || activeMode !== "split") return;
      const host = previewPaneRef.current;
      if (!host) return;
      const hostTop = host.getBoundingClientRect().top;
      for (const el of host.querySelectorAll<HTMLElement>("[data-sourcepos]")) {
        if (el.getBoundingClientRect().bottom >= hostTop) {
          const start = Number(el.dataset.sourcepos?.split(":")[0]);
          if (!Number.isNaN(start)) {
            lock("preview");
            monaco.setScrollTop(monaco.getTopForLineNumber(Math.max(1, start + fmOffset)));
          }
          return;
        }
      }
    };

    const setMarkdown = (next: string) => {
      if (!isControlled) setInternalValue(next);
      onChange?.(next);
    };

    /* ------------------ lossless WYSIWYG editing (WI-1) ------------------ */
    // Milkdown re-serializes the WHOLE document on every edit, normalizing
    // formatting the user never touched — a one-line edit became a whole-file
    // diff. Capture the editor's pre-edit serialization as a BASELINE and
    // merge each emission back onto the byte-exact original: unedited blocks
    // keep their original bytes.
    const wysiwygRef = useRef<MarkdownEditorHandle | null>(null);
    const wysiwygBase = useRef<{ original: string; baseline: string | null } | null>(null);

    useEffect(() => {
      if (activeMode !== "wysiwyg") {
        wysiwygBase.current = null;
        return;
      }
      // Capture at mode entry; the editor is uncontrolled while in wysiwyg,
      // so the workspace buffer is the only writer.
      const original = markdown;
      wysiwygBase.current = { original, baseline: null };
      const poll = setInterval(() => {
        const base = wysiwygBase.current;
        if (!base || base.baseline !== null) {
          clearInterval(poll);
          return;
        }
        const s = wysiwygRef.current?.serialized();
        if (s != null) {
          base.baseline = s;
          clearInterval(poll);
        }
      }, 50);
      const stop = setTimeout(() => clearInterval(poll), 5000);
      return () => {
        clearInterval(poll);
        clearTimeout(stop);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- capture markdown at ENTRY only
    }, [activeMode]);

    const onWysiwygChange = (emitted: string) => {
      const base = wysiwygBase.current;
      // Baseline captured before the first keystroke → merge; otherwise fall
      // back to the raw emission (rare boot race — old behavior, never worse).
      const next =
        base && base.baseline !== null
          ? mergeNormalizedEdit(base.original, base.baseline, emitted)
          : emitted;
      setMarkdown(next);
    };

    /* ---------------- focus writing (Ulysses Phase A, wysiwyg) ---------------- */
    // Typewriter scrolling + paragraph focus, driven from OUTSIDE the engine:
    // selectionchange marks the active top-level block (CSS dims the rest);
    // right after typing, the pane re-centers the caret into a middle band.
    const focusWritingEnabled = focusWriting !== false;
    const [focusWritingOn, setFocusWritingOn] = useState(
      focusWritingEnabled ? defaultFocusWriting : false,
    );
    const wysiwygPaneRef = useRef<HTMLDivElement | null>(null);
    const lastInputAt = useRef(0);

    useEffect(() => {
      if (!(focusWritingEnabled && focusWritingOn && activeMode === "wysiwyg")) return;
      const pane = wysiwygPaneRef.current;
      if (!pane) return;
      let active: Element | null = null;

      const onSelectionChange = () => {
        const root = pane.querySelector<HTMLElement>(".ProseMirror");
        if (!root) return;
        const sel = document.getSelection();
        const node = sel?.anchorNode ?? null;
        if (!node || !root.contains(node)) return;
        const block = topLevelBlockOf(root, node);
        if (block !== active) {
          active?.classList.remove("wb-fw-active");
          block?.classList.add("wb-fw-active");
          active = block;
        }
        // Re-center only right after typing — a mouse click must not yank
        // the viewport (Ulysses recenters while WRITING, not while aiming).
        if (Date.now() - lastInputAt.current < 200 && sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0).getBoundingClientRect();
          const caret = range.height > 0 ? range : (active?.getBoundingClientRect() ?? range);
          const host = pane.getBoundingClientRect();
          const delta = typewriterDelta(caret.top, caret.height, host.top, host.height);
          if (delta !== 0) pane.scrollTop += delta;
        }
      };
      const onInput = () => {
        lastInputAt.current = Date.now();
      };

      document.addEventListener("selectionchange", onSelectionChange);
      pane.addEventListener("input", onInput, true);
      onSelectionChange();
      return () => {
        document.removeEventListener("selectionchange", onSelectionChange);
        pane.removeEventListener("input", onInput, true);
        active?.classList.remove("wb-fw-active");
      };
    }, [focusWritingEnabled, focusWritingOn, activeMode]);

    /* ------------------- imperative handle (#273, DECISION A) --------------- */
    // The forwarded ref is now a MarkdownWorkspaceHandle (not the div).
    // The root <div> gets rootRef; getElement() returns rootRef.current.
    const rootRef = useRef<HTMLDivElement | null>(null);

    useImperativeHandle(
      ref,
      () => {
        const revealLine = (n: number, opts?: { center?: boolean }) => {
          if (monaco) {
            // Source / Split: Monaco exact-line reveal.
            const max = monaco.getModel()?.getLineCount() ?? 0;
            if (n < 1 || n > max) return;
            if (opts?.center === false) {
              monaco.revealLine(n);
            } else {
              monaco.revealLineInCenter(n);
            }
          } else {
            // WYSIWYG: best-effort — find the nearest preceding heading whose
            // (stripped) line + fmOffset ≤ n, then delegate to scrollToHeading.
            const items = parseMarkdownOutline(markdown);
            // items.line is frontmatter-stripped (1-based); full-source = line + fmOffset
            const preceding = items.filter((item) => item.line + fmOffset <= n).at(-1);
            if (!preceding) return;
            wysiwygRef.current?.scrollToHeading(preceding.id);
          }
        };

        const scrollToHeading = (slug: string) => {
          if (monaco) {
            // Source / Split: resolve stripped line via outline, lift to full-source.
            const item = parseMarkdownOutline(markdown).find((i) => i.id === slug);
            if (!item) return;
            revealLine(item.line + fmOffset, { center: true });
          } else {
            // WYSIWYG: delegate to the Milkdown handle.
            wysiwygRef.current?.scrollToHeading(slug);
          }
        };

        // Content-access delegation: monaco (source/split) → monacoContentAccess;
        // wysiwyg → the MarkdownEditorHandle (which now IS an EditorContentAccess).
        // If both are null (booting), fall back to best-effort no-ops (never throw).
        const getAccess = (): EditorContentAccess | null => {
          if (monaco) return monacoContentAccess(monaco);
          if (wysiwygRef.current) return wysiwygRef.current;
          return null;
        };

        return {
          revealLine,
          scrollToHeading,
          getEditor: () => monaco,
          getElement: () => rootRef.current,

          // EditorContentAccess — read/write delegate to the active engine at call
          // time (the AI acts after mount, so a call-time snapshot is correct here).
          getText: () => getAccess()?.getText() ?? "",
          getSelection: () => getAccess()?.getSelection() ?? { text: "", empty: true },
          replaceSelection: (text: string) => getAccess()?.replaceSelection(text),
          insertAtCursor: (text: string) => getAccess()?.insertAtCursor(text),
          focus: () => getAccess()?.focus(),
          // onSelectionChange uses the STABLE listener set (not getAccess()) so a
          // subscribe-in-mount-effect survives the editor's async mount + mode
          // switches; the binding effect below forwards the active engine's events.
          onSelectionChange: (listener) => {
            selectionListeners.add(listener);
            return () => selectionListeners.delete(listener);
          },
        };
      },
      // Re-create when the things the methods close over change.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [monaco, markdown, fmOffset, activeMode, selectionListeners],
    );

    // Forward the ACTIVE engine's selection changes into the stable listener set,
    // re-binding when the engine (monaco/wysiwyg) or mode changes. This is what
    // makes the handle's onSelectionChange robust to the editor's async mount.
    useEffect(() => {
      let unsub: (() => void) | undefined;
      if (monaco) {
        unsub = monacoContentAccess(monaco).onSelectionChange((sel) =>
          selectionListeners.forEach((l) => l(sel)),
        );
      } else if (activeMode === "wysiwyg" && wysiwygRef.current) {
        unsub = wysiwygRef.current.onSelectionChange((sel) =>
          selectionListeners.forEach((l) => l(sel)),
        );
      }
      return () => unsub?.();
    }, [monaco, activeMode, selectionListeners]);

    const setMode = (next: string) => {
      if (next !== "source" && next !== "split" && next !== "wysiwyg") return;
      if (!mode) setInternalMode(next);
      onModeChange?.(next);
    };

    const modeToggle = (
      <TooltipProvider delayDuration={300}>
        {/* Segmented mode switch — same recessed-track / raised-segment
            grammar as every other mode control (Tabs, Read/Write). */}
        <ToggleGroup
          type="single"
          value={activeMode}
          onValueChange={setMode}
          variant="segmented"
          size="sm"
          className="rounded-md p-0.5"
        >
          {MODES.map(({ value: m, label, icon: Icon }) => (
            <Tooltip key={m}>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value={m}
                  aria-label={label}
                  className="h-6 min-w-7 rounded-[5px] px-2"
                >
                  <Icon className="size-4" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
      </TooltipProvider>
    );

    const trailing = (
      <>
        {modeSwitch ? modeToggle : null}
        {toolbarActions}
      </>
    );

    const sourcePane = (
      <CodeEditor
        language="markdown"
        value={markdown}
        onChange={setMarkdown}
        actions={sourceActions}
        onMount={(editor) => {
          // Markdown is prose: soft-wrap so the source pane lays out like the
          // preview (line-based scroll sync stays accurate either way, but
          // matching layouts keep the two panes visually in step).
          editor.updateOptions({ wordWrap: "on" });
          setMonaco(editor);
        }}
      />
    );

    return (
      <div
        ref={rootRef}
        data-testid="markdown-workspace"
        className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}
        {...props}
      >
        {activeMode === "wysiwyg" ? (
          <div className="flex h-10 shrink-0 items-center justify-end gap-2 border-b border-border bg-surface px-2">
            {focusWritingEnabled ? (
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Toggle
                      size="sm"
                      pressed={focusWritingOn}
                      onPressedChange={setFocusWritingOn}
                      aria-label="Focus writing"
                      className="h-6 gap-1.5 px-2 text-caption"
                    >
                      <Focus className="size-3.5" aria-hidden="true" /> Focus
                    </Toggle>
                  </TooltipTrigger>
                  <TooltipContent>Typewriter scrolling · inactive paragraphs dim</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {trailing}
          </div>
        ) : (
          <MarkdownToolbar
            editor={monaco}
            actions={trailing}
            insertCommands={toolbarInsertCommands}
          />
        )}

        <div className="min-h-0 flex-1">
          {activeMode === "source" ? sourcePane : null}

          {activeMode === "wysiwyg" ? (
            <div
              ref={wysiwygPaneRef}
              data-focus-writing={focusWritingEnabled && focusWritingOn ? "" : undefined}
              className="h-full overflow-auto p-4"
            >
              {/* UNCONTROLLED while in wysiwyg: feeding the merged buffer back
                  would replaceAll on every keystroke (cursor loss + echo
                  loops). The buffer receives merged text via onWysiwygChange;
                  mode switches remount the editor from the buffer. */}
              <MarkdownEditor
                ref={wysiwygRef}
                defaultValue={markdown}
                onChange={onWysiwygChange}
                slashMenu={slashMenu}
                calc={calc}
                completions={completions}
                onEmbedAsset={onEmbedAsset}
                className="border-0"
              />
            </div>
          ) : null}

          {activeMode === "split" ? (
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel defaultSize={50} minSize={25}>
                {sourcePane}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={50} minSize={25}>
                <div
                  ref={previewPaneRef}
                  onScroll={onPreviewScroll}
                  className="h-full overflow-auto p-5"
                >
                  <MarkdownPreview>{markdown}</MarkdownPreview>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : null}
        </div>

        {/* Source-pane slash popup (#271): shown when the Layer-1 action fires
            in source or split mode. Uses fixed positioning anchored to the caret
            via getScrolledVisiblePosition, so it works in both layouts. */}
        {monaco && (activeMode === "source" || activeMode === "split") && slashEnabled ? (
          <MonacoSlashMenu
            editor={monaco}
            commands={sourceCommands}
            open={sourceSlashOpen}
            onOpenChange={handleSourceSlashOpenChange}
            triggerRange={typedTrigger}
          />
        ) : null}
      </div>
    );
  },
);
