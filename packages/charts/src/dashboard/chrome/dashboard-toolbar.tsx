"use client";

/**
 * `DashboardToolbar` (RM-079, analysis §2.0/§4 R17, §2.3) — the edit toolbar the maintainer
 * tenant ships: mode switch (View/Edit), undo/redo, Add (opens RM-080's asset panel), Grid
 * settings, a dirty indicator, Save/Discard and a "?" keyboard-shortcuts trigger. Drives
 * everything through RM-071's store (`useDashboard`/`useDashboardActions`) — it owns no
 * state of its own beyond the two dialogs' open flags.
 *
 * Edit is disabled below the narrow-viewport breakpoint (R8: small screens read `flow`/
 * stacked, never edited in place) — the toggle stays visible with a tooltip explaining why,
 * never hidden (a control that vanishes reads as a bug, not a limit).
 *
 * Leaving edit mode while dirty reuses the SAME "Discard changes?" confirmation as the
 * Discard button — but only when `onSave` is set. Without it there is nothing to persist,
 * so the edits are simply kept and the sheet drops back to view.
 */
import {
  forwardRef,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type HTMLAttributes,
} from "react";
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  IconButton,
  KeyboardShortcuts,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ToolbarButton,
  ToolbarSeparator,
  ToolbarSlot,
  ToolbarToggleGroup,
  ToolbarToggleItem,
  Toolbar,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  cn,
  useLocale,
  type ShortcutGroup,
} from "@elabs-ai/components-ui";
import { Eye, HelpCircle, LayoutGrid, PenLine, Plus, Redo2, Save, Undo2 } from "lucide-react";

import type { GridSpec } from "../core/spec";
import { useDashboard, useDashboardActions } from "../dashboard-sheet";
import type { DashboardSpec } from "../core/spec";
import { DashboardGridSettings } from "./dashboard-grid-settings";
import { dashboardShortcutDescriptors } from "./use-dashboard-shortcuts";

/** Which optional chrome pieces the toolbar renders. Every flag defaults `true`. */
export interface DashboardToolbarFeatures {
  /** The Add button (opens the asset panel). */
  add?: boolean;
  /** The Grid-settings popover. */
  grid?: boolean;
  /** The "?" keyboard-shortcuts trigger. */
  shortcuts?: boolean;
}

export interface DashboardToolbarProps extends Omit<HTMLAttributes<HTMLDivElement>, "dir"> {
  features?: DashboardToolbarFeatures;
  /**
   * Called with the current spec when Save is activated; the toolbar then calls
   * `actions.markSaved()`. Omit to keep edits local only — Save is hidden, and leaving
   * edit mode while dirty is never interrupted (there is nothing to persist).
   */
  onSave?: (spec: DashboardSpec) => void;
  /** Opens RM-080's asset panel. Defaults to `actions.setPanel("assets", true)`. */
  onAdd?: () => void;
  /** Warn with the browser's `beforeunload` prompt while dirty. Default `false`. */
  warnOnUnload?: boolean;
}

const NARROW_QUERY = "(max-width: 640px)";

function subscribeNarrow(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => undefined;
  const mql = window.matchMedia(NARROW_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getNarrowSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(NARROW_QUERY).matches;
}

/** `true` at or below the toolbar's edit-disabled breakpoint (640 px — R8). */
function useNarrowViewport(): boolean {
  return useSyncExternalStore(subscribeNarrow, getNarrowSnapshot, () => false);
}

/**
 * The dashboard sheet's edit toolbar: mode switch, undo/redo, Add, Grid settings, dirty
 * indicator, Save/Discard, keyboard shortcuts.
 */
export const DashboardToolbar = forwardRef<HTMLDivElement, DashboardToolbarProps>(
  function DashboardToolbar(
    { features, onSave, onAdd, warnOnUnload = false, className, ...props },
    ref,
  ) {
    const { add = true, grid = true, shortcuts = true } = features ?? {};
    const { t } = useLocale();
    const actions = useDashboardActions();
    const mode = useDashboard((s) => s.mode);
    const history = useDashboard((s) => s.history);
    const dirty = useDashboard((s) => s.dirty);
    const spec = useDashboard((s) => s.spec);
    const isNarrow = useNarrowViewport();

    const [discardOpen, setDiscardOpen] = useState(false);
    const [shortcutsOpen, setShortcutsOpen] = useState(false);
    // Distinguishes the Discard button (stay in edit, only revert content) from the
    // mode-toggle's reuse of the same dialog (revert content AND drop to view).
    const [leaveOnDiscard, setLeaveOnDiscard] = useState(false);

    useEffect(() => {
      if (!warnOnUnload) return undefined;
      function handleBeforeUnload(event: BeforeUnloadEvent) {
        if (!dirty) return;
        event.preventDefault();
        event.returnValue = "";
      }
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [warnOnUnload, dirty]);

    function handleModeChange(next: string) {
      if (!next) return; // Radix single-select ToggleGroup: re-clicking the active item.
      if (next === "view" && mode === "edit" && dirty && onSave) {
        setLeaveOnDiscard(true);
        setDiscardOpen(true);
        return;
      }
      actions.setMode(next as "view" | "edit");
    }

    function handleDiscardClick() {
      setLeaveOnDiscard(false);
      setDiscardOpen(true);
    }

    function handleConfirmDiscard() {
      actions.discard();
      if (leaveOnDiscard) actions.setMode("view");
      setDiscardOpen(false);
    }

    function handleSave() {
      onSave?.(spec);
      actions.markSaved();
    }

    function handleAdd() {
      if (onAdd) onAdd();
      else actions.setPanel("assets", true);
    }

    function handleGridChange(patch: Partial<GridSpec>) {
      actions.setGrid(patch);
    }

    const shortcutLabels: Record<string, string> = {
      undo: t("charts.dashboard.toolbar.shortcutUndo"),
      redo: t("charts.dashboard.toolbar.shortcutRedo"),
      toggleEdit: t("charts.dashboard.toolbar.shortcutToggleEdit"),
      delete: t("charts.dashboard.toolbar.shortcutDelete"),
      duplicate: t("charts.dashboard.toolbar.shortcutDuplicate"),
      // tile operations — RM-081 follow-up 1
      copy: t("charts.dashboard.toolbar.shortcutCopy"),
      cut: t("charts.dashboard.toolbar.shortcutCut"),
      paste: t("charts.dashboard.toolbar.shortcutPaste"),
      selectAll: t("charts.dashboard.toolbar.shortcutSelectAll"),
      contextMenu: t("charts.dashboard.toolbar.shortcutContextMenu"),
      clearFocus: t("charts.dashboard.toolbar.shortcutClearFocus"),
      save: t("charts.dashboard.toolbar.shortcutSave"),
    };
    const shortcutGroups: ShortcutGroup[] = useMemo(
      () => [
        {
          id: "dashboard",
          label: t("charts.dashboard.toolbar.shortcutsGroup"),
          defaultOpen: true,
          items: dashboardShortcutDescriptors().map((d) => ({
            action: shortcutLabels[d.action] ?? d.action,
            keys: d.keys,
          })),
        },
      ],
      // eslint-disable-next-line react-hooks/exhaustive-deps -- shortcutLabels is a fresh object every render
      [t],
    );

    return (
      <>
        <Toolbar
          ref={ref}
          aria-label={t("charts.dashboard.toolbar.ariaLabel")}
          data-slot="dashboard-toolbar"
          className={cn(
            "flex-wrap gap-1.5 rounded-lg border border-border-strong bg-card px-2 py-1.5",
            className,
          )}
          {...props}
        >
          <TooltipProvider>
            <ToolbarToggleGroup type="single" value={mode} onValueChange={handleModeChange}>
              <ToolbarToggleItem value="view" aria-label={t("charts.dashboard.toolbar.viewMode")}>
                <Eye aria-hidden="true" />
                {t("charts.dashboard.toolbar.viewMode")}
              </ToolbarToggleItem>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    data-slot="dashboard-toolbar-edit-toggle-wrap"
                    tabIndex={isNarrow ? 0 : undefined}
                    className={cn("inline-flex", isNarrow && "cursor-not-allowed")}
                  >
                    <ToolbarToggleItem
                      value="edit"
                      disabled={isNarrow}
                      aria-label={t("charts.dashboard.toolbar.editMode")}
                    >
                      <PenLine aria-hidden="true" />
                      {t("charts.dashboard.toolbar.editMode")}
                    </ToolbarToggleItem>
                  </span>
                </TooltipTrigger>
                {isNarrow ? (
                  <TooltipContent>
                    {t("charts.dashboard.toolbar.editDisabledNarrow")}
                  </TooltipContent>
                ) : null}
              </Tooltip>
            </ToolbarToggleGroup>
          </TooltipProvider>

          <ToolbarSeparator />

          <IconButton
            label={t("charts.dashboard.toolbar.undo")}
            icon={<Undo2 aria-hidden="true" />}
            size="icon-sm"
            disabled={!history.canUndo}
            onClick={() => actions.undo()}
          />
          <IconButton
            label={t("charts.dashboard.toolbar.redo")}
            icon={<Redo2 aria-hidden="true" />}
            size="icon-sm"
            disabled={!history.canRedo}
            onClick={() => actions.redo()}
          />

          {add ? (
            <ToolbarButton variant="ghost" size="sm" onClick={handleAdd}>
              <Plus aria-hidden="true" />
              {t("charts.dashboard.toolbar.add")}
            </ToolbarButton>
          ) : null}

          {grid ? (
            <Popover>
              <PopoverTrigger asChild>
                <ToolbarSlot asChild>
                  <Button variant="ghost" size="sm">
                    <LayoutGrid aria-hidden="true" />
                    {t("charts.dashboard.toolbar.grid")}
                  </Button>
                </ToolbarSlot>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-80"
                aria-label={t("charts.dashboard.toolbar.gridSettings")}
              >
                <DashboardGridSettings grid={spec.grid} onChange={handleGridChange} />
              </PopoverContent>
            </Popover>
          ) : null}

          <ToolbarSeparator />

          {dirty ? (
            <Badge
              variant="secondary"
              role="status"
              data-slot="dashboard-toolbar-dirty"
              className="gap-1"
            >
              {t("charts.dashboard.toolbar.unsavedChanges")}
            </Badge>
          ) : null}

          {onSave ? (
            <ToolbarButton variant="ghost" size="sm" disabled={!dirty} onClick={handleSave}>
              <Save aria-hidden="true" />
              {t("charts.dashboard.toolbar.save")}
            </ToolbarButton>
          ) : null}
          <ToolbarButton variant="ghost" size="sm" disabled={!dirty} onClick={handleDiscardClick}>
            {t("charts.dashboard.toolbar.discard")}
          </ToolbarButton>

          {shortcuts ? (
            <>
              <ToolbarSeparator />
              <IconButton
                label={t("charts.dashboard.toolbar.shortcuts")}
                icon={<HelpCircle aria-hidden="true" />}
                size="icon-sm"
                onClick={() => setShortcutsOpen(true)}
              />
            </>
          ) : null}
        </Toolbar>

        <ConfirmDialog
          open={discardOpen}
          onOpenChange={setDiscardOpen}
          tone="destructive"
          title={t("charts.dashboard.toolbar.discardTitle")}
          description={t("charts.dashboard.toolbar.discardDescription")}
          confirmLabel={t("charts.dashboard.toolbar.discardConfirm")}
          onConfirm={handleConfirmDiscard}
        />

        <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
          <DialogContent data-slot="dashboard-toolbar-shortcuts">
            <DialogHeader>
              <DialogTitle>{t("charts.dashboard.toolbar.shortcuts")}</DialogTitle>
              <DialogDescription>
                {t("charts.dashboard.toolbar.shortcutsDescription")}
              </DialogDescription>
            </DialogHeader>
            <KeyboardShortcuts groups={shortcutGroups} searchable={false} />
          </DialogContent>
        </Dialog>
      </>
    );
  },
);
