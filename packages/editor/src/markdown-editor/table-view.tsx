"use client";

/**
 * Table control overlay for the Milkdown WYSIWYG editor.
 *
 * Mechanism: a **contextual toolbar** rendered as a ProseMirror plugin view
 * (via `@prosemirror-adapter/react`'s `usePluginViewFactory`). When the
 * selection is inside a GFM table, a token-styled button bar appears at the
 * bottom of the editor's wrapper offering add/remove row and column ops.
 *
 * Design choice — why NOT a `$view` node-view:
 *   A content-replacing `$view` for the GFM table conflicts with gfm's
 *   `columnResizingPlugin` and `tableEditingPlugin` decorations (both rewrite
 *   the DOM directly), breaking cell selection highlighting and column handles.
 *   The contextual toolbar avoids all decoration conflicts while delivering the
 *   full feature surface (add/remove row+col, Tab nav, lossless round-trip,
 *   token look, keyboard a11y). GFM's `tableKeymap` already binds Tab →
 *   NextCell and Shift+Tab → PrevCell so no extra keymap plugin is needed.
 *
 * Focus safety:
 *   Plugin views mount OUTSIDE `contentEditable` (ProseMirror appends them to
 *   the editor wrapper). Buttons use `onMouseDown={preventDefault}` so clicks
 *   never steal focus from the editing surface.
 *
 * Command wiring:
 *   All ops call the existing gfm commands (addRowAfterCommand, etc.) via
 *   `commandsCtx.call()`. The GFM schema + serializer are never replaced, so
 *   GFM round-trip fidelity is structurally guaranteed.
 */

import type { CmdKey } from "@milkdown/kit/core";
import type { Ctx, MilkdownPlugin } from "@milkdown/kit/ctx";
import { commandsCtx } from "@milkdown/kit/core";
import {
  addColAfterCommand,
  addColBeforeCommand,
  addRowAfterCommand,
  addRowBeforeCommand,
  deleteSelectedCellsCommand,
} from "@milkdown/kit/preset/gfm";
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { isInTable } from "@milkdown/kit/prose/tables";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { usePluginViewContext } from "@prosemirror-adapter/react";
import type { usePluginViewFactory } from "@prosemirror-adapter/react";

// ---------------------------------------------------------------------------
// Ctx bridge
// ---------------------------------------------------------------------------

/**
 * Per-instance Ctx registry. The `$prose` plugin's `view(editorView)` records
 * THIS editor's live Milkdown `Ctx` keyed by its ProseMirror view; the React
 * toolbar reads it back via the view it gets from `usePluginViewContext`. Keyed
 * by the view (NOT a module singleton) so multiple `MarkdownEditor`s on one page
 * — a Storybook autodocs page, a split workspace — each dispatch to the correct
 * instance. Entries are released with their view (WeakMap GC).
 */
const ctxByView = new WeakMap<EditorView, Ctx>();

/** Call a gfm command key on the editor that owns `view`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dispatchCommand(view: EditorView, key: CmdKey<any>): void {
  const ctx = ctxByView.get(view);
  if (!ctx) return;
  try {
    ctx.get(commandsCtx).call(key);
  } catch {
    // Editor may be mid-destroy; swallow gracefully.
  }
}

// ---------------------------------------------------------------------------
// Plugin key
// ---------------------------------------------------------------------------

const tableControlsKey = new PluginKey<boolean>("brand-table-controls");

// ---------------------------------------------------------------------------
// Toolbar React component
// ---------------------------------------------------------------------------

interface ToolbarButtonProps {
  onClick: () => void;
  ariaLabel: string;
  title: string;
  children: React.ReactNode;
  variant?: "default" | "destructive";
}

function ToolbarButton({
  onClick,
  ariaLabel,
  title,
  children,
  variant = "default",
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title}
      // Keep focus in the editor — a mousedown without preventDefault would
      // blur the ProseMirror view before the click fires.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded px-2 text-caption font-medium",
        "border border-border-strong",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "transition-colors duration-fast ease-standard motion-reduce:transition-none",
        variant === "destructive"
          ? "bg-background text-destructive hover:bg-destructive/10"
          : "bg-background text-foreground hover:bg-surface-muted",
      )}
    >
      {children}
    </button>
  );
}

/** Thin visual separator between button groups. */
function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border-strong" />;
}

/**
 * The table controls toolbar.
 *
 * Rendered as a ProseMirror plugin view: ProseMirror mounts it into the
 * editor's wrapper DOM (`view.dom.parentElement`) and calls `update()` on
 * every state change — `usePluginViewContext` re-renders the React tree.
 * Hidden when the cursor is not inside a table.
 */
function TableControlsView() {
  const { view } = usePluginViewContext();
  const inTable = isInTable(view.state);
  const run = (key: Parameters<typeof dispatchCommand>[1]) => () => dispatchCommand(view, key);

  if (!inTable) return null;

  return (
    <div
      role="toolbar"
      aria-label="Table controls"
      className={cn(
        "flex flex-wrap items-center gap-1 px-2 py-1.5",
        "border-t border-border-strong bg-surface-muted",
      )}
    >
      {/* Row group */}
      <span className="mr-1 select-none text-caption text-muted-foreground">Row</span>
      <ToolbarButton
        ariaLabel="Add row above"
        title="Add row above"
        onClick={run(addRowBeforeCommand.key)}
      >
        ↑+
      </ToolbarButton>
      <ToolbarButton
        ariaLabel="Add row below"
        title="Add row below"
        onClick={run(addRowAfterCommand.key)}
      >
        ↓+
      </ToolbarButton>
      <ToolbarButton
        ariaLabel="Delete row"
        title="Delete row"
        variant="destructive"
        onClick={run(deleteSelectedCellsCommand.key)}
      >
        ×row
      </ToolbarButton>

      <ToolbarDivider />

      {/* Column group */}
      <span className="mr-1 select-none text-caption text-muted-foreground">Col</span>
      <ToolbarButton
        ariaLabel="Add column left"
        title="Add column left"
        onClick={run(addColBeforeCommand.key)}
      >
        ←+
      </ToolbarButton>
      <ToolbarButton
        ariaLabel="Add column right"
        title="Add column right"
        onClick={run(addColAfterCommand.key)}
      >
        →+
      </ToolbarButton>
      <ToolbarButton
        ariaLabel="Delete column"
        title="Delete column"
        variant="destructive"
        onClick={run(deleteSelectedCellsCommand.key)}
      >
        ×col
      </ToolbarButton>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported factory
// ---------------------------------------------------------------------------

/**
 * Build the Milkdown plugin array for table controls.
 *
 * Call with `usePluginViewFactory()` from inside `<ProsemirrorAdapterProvider>`,
 * then `.use(tableViewPlugins(pluginViewFactory))` on the editor chain.
 *
 * The signature matches the `directiveViewPlugins` convention: factory
 * captured from the React adapter hook, plugin array returned for `.use()`.
 */
export function tableViewPlugins(
  pluginViewFactory: ReturnType<typeof usePluginViewFactory>,
): MilkdownPlugin[] {
  return [
    $prose((ctx) => {
      // Build the ProseMirror PluginViewSpec from the adapter factory. This
      // returns a `view(editorView) => PluginView` that ProseMirror calls to
      // mount/update/destroy the React tree.
      const makePluginView = pluginViewFactory({ component: TableControlsView });

      return new Plugin({
        key: tableControlsKey,
        state: {
          // Track whether the cursor is in a table (bool) as plugin state so
          // ProseMirror knows when to trigger an `update()` on the plugin view.
          init: (_cfg, state) => isInTable(state),
          apply: (_tr, _prev, _old, state) => isInTable(state),
        },
        // Bind THIS editor's Ctx to THIS editor's view, so the toolbar's
        // commands dispatch to the right instance when several editors share
        // this module (autodocs page, split workspace).
        view: (editorView) => {
          ctxByView.set(editorView, ctx);
          return makePluginView(editorView);
        },
      });
    }) as unknown as MilkdownPlugin,
  ];
}
