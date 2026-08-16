"use client";

/**
 * MonacoSlashMenu — a caret-anchored slash command popup for the Monaco source
 * pane (#271).
 *
 * The workspace owns the open/closed state (via a `CodeEditor` action keybinding
 * registered through `CodeEditor.actions`). This component is the POSITIONING
 * CONTROLLER + KEYBOARD HANDLER that wraps the shared `SlashMenu` body — it does
 * NOT re-implement the listbox (no duplication, tokens only, same look as the
 * WYSIWYG widget).
 *
 * a11y: the `SlashMenu` already provides `role="listbox"` / `role="option"` /
 * `aria-selected`; this wrapper wires `aria-activedescendant` on the editor's
 * textarea so AT can follow the active row. Esc closes and refocuses the editor.
 */
import { cn } from "@elabs/components-ui/lib/cn";
import type { IRange } from "monaco-editor";
import { useEffect, useRef, useState } from "react";

import type { MonacoCodeEditor } from "../../code-editor";
import { monacoContentAccess } from "../../lib/editor-content-access";
import { insertDirective } from "../../markdown-toolbar/markdown-commands";
import { filterSlashCommands, type SlashCommand } from "./brand-slash-commands";
import { SlashMenu, slashOptionId } from "./slash-menu";

export interface MonacoSlashMenuProps {
  /** The live Monaco editor instance (source pane). */
  editor: MonacoCodeEditor;
  /**
   * Commands to show in the source pane — filtered by the workspace to
   * `snippet != null || typeof runInSource === "function"` (#299): a command
   * needs a text snippet, a source-pane handler, or both to appear here (a
   * run-only WYSIWYG command with neither is Milkdown-only and stays excluded).
   */
  commands: SlashCommand[];
  /** Controlled open state — the workspace toggles it via the Layer-1 action. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Insert the selected snippet at the Monaco caret + refocus.
   * Defaults to `insertDirective` from `markdown-commands.ts`.
   */
  onInsert?: (editor: MonacoCodeEditor, snippet: string) => void;
  /**
   * When the menu was opened by typing `/` (not the hotkey), the model range of
   * that `/`. On select the `/` is REPLACED by the inserted block; on cancel
   * (Escape / Backspace past the trigger) it is removed. `null`/omitted = the
   * hotkey path, which inserts via `onInsert`/`insertDirective` and leaves the
   * document otherwise untouched.
   */
  triggerRange?: IRange | null;
  /** Merged onto the positioned popup container (the inline `position:fixed` anchor stays). */
  className?: string;
}

const ID_PREFIX = "brand-monaco-slash";
const LISTBOX_ID = `${ID_PREFIX}-listbox`;

/** Fixed/absolute coords of the popup anchor. */
interface Coords {
  top: number;
  left: number;
}

function getCaretCoords(editor: MonacoCodeEditor): Coords | null {
  const pos = editor.getPosition();
  if (!pos) return null;
  const scrolled = editor.getScrolledVisiblePosition(pos);
  if (!scrolled) return null;
  const domNode = editor.getDomNode();
  if (!domNode) return null;
  const rect = domNode.getBoundingClientRect();
  return {
    top: rect.top + scrolled.top + (scrolled.height ?? 20),
    left: rect.left + scrolled.left,
  };
}

export function MonacoSlashMenu({
  editor,
  commands,
  open,
  onOpenChange,
  onInsert,
  triggerRange,
  className,
}: MonacoSlashMenuProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState<Coords | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Insert the chosen snippet. Typed-`/` mode REPLACES the `/` (triggerRange) with
  // the block; hotkey mode inserts via insertDirective at the caret/line. Always
  // refocus the editor and close.
  const commitSnippet = (snippet: string) => {
    if (triggerRange) {
      editor.executeEdits("brand-slash-typed", [
        { range: triggerRange, text: snippet, forceMoveMarkers: true },
      ]);
    } else {
      (onInsert ?? insertDirective)(editor, snippet);
    }
    onOpenChange(false);
    editor.focus();
  };

  // Run a source-pane handler (#299): strip the typed `/query` trigger FIRST
  // (the same edit `cancel` uses, so the doc is clean whether the handler
  // opens a dialog, schedules async work, or inserts nothing), then call it
  // with the live editor + the (now-stale) trigger range + content access.
  const commitRunInSource = (command: SlashCommand) => {
    if (triggerRange) {
      editor.executeEdits("brand-slash-typed", [{ range: triggerRange, text: "" }]);
    }
    command.runInSource?.({
      editor,
      range: triggerRange ?? null,
      content: monacoContentAccess(editor),
    });
    onOpenChange(false);
    editor.focus();
  };

  // Select a command: `runInSource` (when present) wins over `snippet` — it's
  // the more capable handler and is the ONLY option for a run-only command.
  const selectCommand = (command: SlashCommand) => {
    if (typeof command.runInSource === "function") {
      commitRunInSource(command);
    } else if (command.snippet) {
      commitSnippet(command.snippet);
    }
  };

  // Dismiss without inserting. In typed-`/` mode the stray `/` is removed so the
  // document is left exactly as it was before the trigger.
  const cancel = () => {
    if (triggerRange) {
      editor.executeEdits("brand-slash-cancel", [{ range: triggerRange, text: "" }]);
    }
    onOpenChange(false);
    editor.focus();
  };

  // Latest select/cancel via refs so the capture-phase keydown listener can stay
  // attached across renders (its effect deps don't need these closures).
  const selectRef = useRef(selectCommand);
  selectRef.current = selectCommand;
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;

  // Reset query + active index whenever the menu opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  // Compute and track caret position.
  useEffect(() => {
    if (!open) return;

    const update = () => {
      setCoords(getCaretCoords(editor));
    };

    update();

    const scrollSub = editor.onDidScrollChange(update);
    const cursorSub = editor.onDidChangeCursorPosition(update);

    const onResize = () => update();
    window.addEventListener("resize", onResize);

    return () => {
      scrollSub.dispose();
      cursorSub.dispose();
      window.removeEventListener("resize", onResize);
    };
  }, [open, editor]);

  // Close on editor blur.
  useEffect(() => {
    if (!open) return;
    const blurSub = editor.onDidBlurEditorText(() => {
      // Small delay — if focus moved to the menu itself (mousedown), don't close.
      setTimeout(() => {
        if (!menuRef.current?.contains(document.activeElement)) {
          onOpenChange(false);
        }
      }, 100);
    });
    return () => blurSub.dispose();
  }, [open, editor, onOpenChange]);

  // Wire keyboard navigation into the editor while the menu is open.
  useEffect(() => {
    if (!open) return;

    const keydown = (e: KeyboardEvent) => {
      const filtered = filterSlashCommands(commands, query);

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelRef.current();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => (i + 1) % Math.max(filtered.length, 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex(
          (i) => (i - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1),
        );
        return;
      }
      // Enter AND Tab select the active command (the cmdk / Notion command-menu
      // convention) — kept identical to the WYSIWYG slash menu so the cross-pane
      // shortcut behaves the same in both panes (the goal of #271). Tab does NOT
      // move browser focus here by design; Esc dismisses without inserting.
      if (e.key === "Enter" || e.key === "Tab") {
        // Always swallow while the popup is open — even with no match — so the key
        // never leaks a newline/tab into the document behind the popup.
        e.preventDefault();
        e.stopPropagation();
        const command = filtered[Math.min(activeIndex, filtered.length - 1)];
        if (command) selectRef.current(command);
        return;
      }
      // Printable characters update the query — intercept so they filter the
      // menu instead of being typed into the Monaco document (the menu was
      // opened by shortcut, so there is no `/query` run in the doc to absorb them).
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        setQuery((q) => q + e.key);
        setActiveIndex(0);
        return;
      }
      // Backspace trims the query (and closes when empty) — intercept so it
      // never deletes document text behind the popup.
      if (e.key === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        if (query.length === 0) {
          // Backspacing past the trigger dismisses (and removes the typed `/`).
          cancelRef.current();
          return;
        }
        setQuery((q) => q.slice(0, -1));
        setActiveIndex(0);
      }
    };

    // Capture phase — intercept before Monaco's own key handlers.
    const domNode = editor.getDomNode();
    domNode?.addEventListener("keydown", keydown, true);
    return () => domNode?.removeEventListener("keydown", keydown, true);
  }, [open, editor, commands, query, activeIndex]);

  // Keep the highlighted option scrolled into view as ↑/↓ moves it — the listbox
  // is overflow-y-auto, so without this the active row can move off-screen while
  // the keyboard selection advances (the same fix slash-widget.tsx applies).
  useEffect(() => {
    if (!open) return;
    const filtered = filterSlashCommands(commands, query);
    const active = filtered[Math.min(activeIndex, Math.max(filtered.length - 1, 0))];
    if (!active) return;
    const el = menuRef.current?.querySelector<HTMLElement>(
      `#${CSS.escape(slashOptionId(ID_PREFIX, active.id))}`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [open, commands, query, activeIndex]);

  // Mirror the listbox relationship onto the Monaco textbox while open, so AT is
  // told a popup appeared (aria-expanded), where it is (aria-controls), and which
  // option is active (aria-activedescendant) — the same wiring the WYSIWYG path
  // applies in slash-widget.tsx. All three are cleaned up on close.
  useEffect(() => {
    if (!open) return;
    const filtered = filterSlashCommands(commands, query);
    const activeCommand = filtered[Math.min(activeIndex, Math.max(filtered.length - 1, 0))];
    const textarea = editor.getDomNode()?.querySelector("textarea");
    if (!textarea) return;
    textarea.setAttribute("aria-expanded", "true");
    textarea.setAttribute("aria-controls", LISTBOX_ID);
    if (activeCommand) {
      textarea.setAttribute("aria-activedescendant", slashOptionId(ID_PREFIX, activeCommand.id));
    } else {
      textarea.removeAttribute("aria-activedescendant");
    }
    return () => {
      textarea.removeAttribute("aria-expanded");
      textarea.removeAttribute("aria-controls");
      textarea.removeAttribute("aria-activedescendant");
    };
  }, [open, editor, commands, query, activeIndex]);

  if (!open || !coords) return null;

  const filtered = filterSlashCommands(commands, query);
  const activeCommand = filtered[Math.min(activeIndex, Math.max(filtered.length - 1, 0))];

  const handleSelect = (command: SlashCommand) => {
    selectCommand(command);
  };

  const resultCount = filtered.length;
  const statusText =
    resultCount === 0
      ? "No matching blocks"
      : query
        ? `${resultCount} result${resultCount === 1 ? "" : "s"} for “${query}”`
        : `${resultCount} block${resultCount === 1 ? "" : "s"}`;

  return (
    <div
      ref={menuRef}
      className={cn(className)}
      // Fixed positioning so it overlays the editor regardless of scroll.
      style={{ position: "fixed", top: coords.top, left: coords.left, zIndex: 50 }}
      // Prevent the mousedown from stealing focus from the editor.
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* One polite live region — focus stays in the editor, so AT learns the
          filter result count (and the empty state) only from here. The visual
          chip below is aria-hidden to avoid a double announcement. */}
      <span role="status" aria-live="polite" className="sr-only">
        {statusText}
      </span>
      {query && (
        <div
          aria-hidden="true"
          className="mb-0.5 rounded-sm border border-border bg-popover px-2 py-1 text-caption text-muted-foreground"
        >
          Filter: <span className="font-medium text-foreground">{query}</span>
        </div>
      )}
      <SlashMenu
        id={LISTBOX_ID}
        commands={filtered}
        activeId={activeCommand?.id}
        onSelect={handleSelect}
        idPrefix={ID_PREFIX}
      />
    </div>
  );
}
