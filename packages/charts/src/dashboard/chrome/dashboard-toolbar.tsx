"use client";

/**
 * `DashboardToolbar` (RM-079, analysis §2.0/§4 R17, §2.3) — the sheet's one toolbar, in
 * the grammar every major BI authoring surface converges on:
 *
 *   [ View | Edit ] │ ↶ ↷ │ + Add · Grid ▾ · Layout ▾ │ ……… │ ● Unsaved  Discard  [Save] │ Assets Properties · Export ▾ · ?
 *
 * View mode keeps only what a reader needs (mode switch, export, shortcuts; Save/Discard
 * appear when the store is dirty, e.g. a host edited the spec through the API). Edit mode
 * adds the authoring cluster and the panel toggles. Drives everything through RM-071's store
 * (`useDashboard`/`useDashboardActions`) — it owns no state of its own beyond the two
 * dialogs' open flags.
 *
 * Edit is disabled below the sheet's own `"sm"` container breakpoint (RM-084's `useBreakpoint`,
 * R8: small screens read `flow`/stacked, never edited in place) — the toggle stays visible
 * with a tooltip explaining why, never hidden (a control that vanishes reads as a bug, not a
 * limit). Measured on the TOOLBAR's own width, not the window.
 *
 * Leaving edit mode while dirty reuses the SAME "Discard changes?" confirmation as the
 * Discard button — but only when `onSave` is set. Without it there is nothing to persist,
 * so the edits are simply kept and the sheet drops back to view.
 *
 * "Export sheet…" (RM-084) opens a menu of SVG/PNG, disabled while editing (an export exports
 * the SAVED picture, not a mid-drag one) and while a previous export is still running.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  KeyboardShortcuts,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Spinner,
  Switch,
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
import {
  Check,
  CopyPlus,
  Download,
  Eye,
  HelpCircle,
  LayoutGrid,
  LayoutTemplate,
  PanelLeft,
  PanelRight,
  PenLine,
  Plus,
  Redo2,
  Save,
  SquareDashedMousePointer,
  Trash2,
  Undo2,
  Wand2,
} from "lucide-react";

import { autoLayout } from "../core/auto-layout";
import type { DashboardSpec, GridSpec } from "../core/spec";
import { useBreakpoint, useDashboard, useDashboardActions } from "../dashboard-sheet";
import { useDashboardContext } from "../dashboard-sheet/use-dashboard";
import { useExportSheet, type ExportSheetFormat } from "../export";
import { DashboardGridSettings } from "./dashboard-grid-settings";
import { dashboardShortcutDescriptors } from "./use-dashboard-shortcuts";

/**
 * The View/Edit items as a segmented control: the active segment is the raised fill, never a
 * coloured border (the toggle default's `border-primary` would read as a focus ring here).
 */
const MODE_ITEM_CLASS =
  "h-7 rounded-sm border-0 px-2.5 text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:border-transparent data-[state=on]:bg-surface-elevated data-[state=on]:font-medium data-[state=on]:text-foreground data-[state=on]:shadow-sm aria-checked:border-transparent aria-checked:bg-surface-elevated aria-checked:font-medium aria-checked:text-foreground aria-checked:shadow-sm";

/** Which optional chrome pieces the toolbar renders. Every flag defaults `true`. */
export interface DashboardToolbarFeatures {
  /** The Add button (opens the asset panel). */
  add?: boolean;
  /** The Grid-settings popover. */
  grid?: boolean;
  /** The Layout menu (tidy up, selection actions, breakpoint target). */
  layout?: boolean;
  /** The Assets / Properties panel toggles. */
  panels?: boolean;
  /** The "Export sheet…" menu. */
  export?: boolean;
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

/**
 * The dashboard sheet's toolbar: mode switch, undo/redo, Add, Grid, Layout, dirty state,
 * Save/Discard, panel toggles, export, keyboard shortcuts.
 */
export const DashboardToolbar = forwardRef<HTMLDivElement, DashboardToolbarProps>(
  function DashboardToolbar(
    { features, onSave, onAdd, warnOnUnload = false, className, ...props },
    forwardedRef,
  ) {
    const {
      add = true,
      grid = true,
      layout = true,
      panels = true,
      export: exportFeature = true,
      shortcuts = true,
    } = features ?? {};
    const { t } = useLocale();
    const { registry } = useDashboardContext();
    const actions = useDashboardActions();
    const mode = useDashboard((s) => s.mode);
    const history = useDashboard((s) => s.history);
    const dirty = useDashboard((s) => s.dirty);
    const spec = useDashboard((s) => s.spec);
    const focus = useDashboard((s) => s.focus);
    const ui = useDashboard((s) => s.ui);
    const editing = mode === "edit";

    const rootRef = useRef<HTMLDivElement | null>(null);
    const setRef = useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );
    const breakpoint = useBreakpoint(rootRef);
    const isNarrow = breakpoint === "sm";

    const { busy: exportBusy, exportSvg, exportPng } = useExportSheet();
    async function handleExport(format: ExportSheetFormat) {
      if (format === "svg") await exportSvg();
      else await exportPng();
    }

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

    /** Tidy up: every top-level tile re-placed by `autoLayout` in one undo step. */
    function handleTidyUp() {
      const kinds = registry.kinds.map((kind) => ({
        kind: kind.kind,
        defaultSize: kind.defaultSize,
        minSize: kind.minSize,
      }));
      const stripped = spec.tiles.map((tile) =>
        tile.container ? tile : (({ layout: _layout, ...rest }) => rest)(tile),
      );
      const result = autoLayout(stripped, spec.grid, kinds);
      actions.batch(() => {
        actions.setSpec({ ...spec, tiles: result.tiles });
        if (result.grid !== spec.grid)
          actions.setGrid({
            rows: result.grid.rows,
            extensions: result.grid.extensions,
            density: result.grid.rows !== spec.grid.rows ? "custom" : spec.grid.density,
          });
      });
    }
    function handleSelectAll() {
      actions.setFocus(spec.tiles.filter((tile) => !tile.container).map((tile) => tile.id));
    }
    function handleDuplicateSelection() {
      actions.batch(() => {
        for (const id of focus) actions.duplicateTile(id);
      });
    }
    function handleDeleteSelection() {
      actions.batch(() => {
        for (const id of focus) actions.removeTile(id);
      });
    }

    const shortcutLabels: Record<string, string> = {
      undo: t("charts.dashboard.toolbar.shortcutUndo"),
      redo: t("charts.dashboard.toolbar.shortcutRedo"),
      toggleEdit: t("charts.dashboard.toolbar.shortcutToggleEdit"),
      delete: t("charts.dashboard.toolbar.shortcutDelete"),
      duplicate: t("charts.dashboard.toolbar.shortcutDuplicate"),
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

    const gridSummary =
      spec.grid.mode === "fit"
        ? t("charts.dashboard.toolbar.gridDensityNow", {
            columns: spec.grid.columns,
            rows: spec.grid.rows ?? 12,
          })
        : t("charts.dashboard.toolbar.gridDensityFlow", {
            columns: spec.grid.columns,
            rowHeight: spec.grid.rowHeight ?? 30,
          });

    const iconTip = (label: string, control: React.ReactElement) => (
      <Tooltip>
        <TooltipTrigger asChild>{control}</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );

    return (
      <>
        <Toolbar
          ref={setRef}
          aria-label={t("charts.dashboard.toolbar.ariaLabel")}
          data-slot="dashboard-toolbar"
          data-mode={mode}
          className={cn(
            "flex-wrap gap-1 border-b border-border bg-background px-2 py-1.5",
            className,
          )}
          {...props}
        >
          <TooltipProvider delayDuration={400}>
            {/* 1 — mode */}
            <ToolbarToggleGroup
              type="single"
              value={mode}
              onValueChange={handleModeChange}
              className="rounded-md bg-muted p-0.5"
            >
              <ToolbarToggleItem
                value="view"
                size="sm"
                aria-label={t("charts.dashboard.toolbar.viewMode")}
                className={MODE_ITEM_CLASS}
              >
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
                      size="sm"
                      disabled={isNarrow}
                      aria-label={t("charts.dashboard.toolbar.editMode")}
                      className={MODE_ITEM_CLASS}
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

            {/* 2 — history */}
            <ToolbarSeparator />
            {iconTip(
              t("charts.dashboard.toolbar.undo"),
              <IconButton
                label={t("charts.dashboard.toolbar.undo")}
                icon={<Undo2 aria-hidden="true" />}
                size="icon-sm"
                disabled={!history.canUndo}
                onClick={() => actions.undo()}
              />,
            )}
            {iconTip(
              t("charts.dashboard.toolbar.redo"),
              <IconButton
                label={t("charts.dashboard.toolbar.redo")}
                icon={<Redo2 aria-hidden="true" />}
                size="icon-sm"
                disabled={!history.canRedo}
                onClick={() => actions.redo()}
              />,
            )}

            {/* 3 — authoring (edit mode) */}
            {editing && (add || grid || layout) ? <ToolbarSeparator /> : null}
            {editing && add ? (
              <ToolbarButton variant="secondary" size="sm" onClick={handleAdd}>
                <Plus aria-hidden="true" />
                {t("charts.dashboard.toolbar.add")}
              </ToolbarButton>
            ) : null}
            {editing && grid ? (
              <Popover>
                <PopoverTrigger asChild>
                  <ToolbarSlot asChild>
                    <Button variant="ghost" size="sm">
                      <LayoutGrid aria-hidden="true" />
                      {t("charts.dashboard.toolbar.grid")}
                      <span
                        aria-hidden="true"
                        className="hidden text-meta text-muted-foreground tabular-nums lg:inline"
                      >
                        {gridSummary}
                      </span>
                    </Button>
                  </ToolbarSlot>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-80 space-y-3"
                  aria-label={t("charts.dashboard.toolbar.gridSettings")}
                >
                  <label className="flex items-center justify-between gap-3 text-body">
                    <span>{t("charts.dashboard.toolbar.showGrid")}</span>
                    <Switch
                      checked={ui.showGrid}
                      onCheckedChange={(checked) => actions.setPanel("showGrid", checked)}
                    />
                  </label>
                  <DashboardGridSettings grid={spec.grid} onChange={handleGridChange} />
                </PopoverContent>
              </Popover>
            ) : null}
            {editing && layout ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <ToolbarSlot asChild>
                    <Button variant="ghost" size="sm">
                      <LayoutTemplate aria-hidden="true" />
                      {t("charts.dashboard.toolbar.layout")}
                    </Button>
                  </ToolbarSlot>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuItem onSelect={handleTidyUp} disabled={spec.tiles.length === 0}>
                    <Wand2 aria-hidden="true" />
                    <span className="flex flex-col">
                      {t("charts.dashboard.toolbar.tidyUp")}
                      <span className="text-meta text-muted-foreground">
                        {t("charts.dashboard.toolbar.tidyUpDescription")}
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleSelectAll} disabled={spec.tiles.length === 0}>
                    <SquareDashedMousePointer aria-hidden="true" />
                    {t("charts.dashboard.toolbar.selectAll")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={handleDuplicateSelection}
                    disabled={focus.length === 0}
                  >
                    <CopyPlus aria-hidden="true" />
                    {t("charts.dashboard.toolbar.duplicateSelection")}
                    {focus.length > 0 ? (
                      <Badge variant="secondary" className="ms-auto tabular-nums">
                        {focus.length}
                      </Badge>
                    ) : null}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={handleDeleteSelection}
                    disabled={focus.length === 0}
                    className="text-destructive-text"
                  >
                    <Trash2 aria-hidden="true" />
                    {t("charts.dashboard.toolbar.deleteSelection")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t("charts.dashboard.toolbar.layoutFor")}</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={ui.layoutTarget}
                    onValueChange={(value) =>
                      actions.setLayoutTarget(value as "base" | "md" | "sm")
                    }
                  >
                    <DropdownMenuRadioItem value="base">
                      {t("charts.dashboard.toolbar.layoutBase")}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="md">
                      {t("charts.dashboard.toolbar.layoutMd")}
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="sm">
                      {t("charts.dashboard.toolbar.layoutSm")}
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={ui.showGrid}
                    onCheckedChange={(checked) => actions.setPanel("showGrid", checked)}
                  >
                    {t("charts.dashboard.toolbar.showGrid")}
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            {/* 4 — the gap */}
            <span aria-hidden="true" className="flex-1" />

            {/* 5 — save state */}
            {dirty ? (
              <Badge
                variant="secondary"
                role="status"
                data-slot="dashboard-toolbar-dirty"
                className="gap-1.5"
              >
                <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
                {t("charts.dashboard.toolbar.unsavedChanges")}
              </Badge>
            ) : editing && onSave ? (
              <span
                data-slot="dashboard-toolbar-saved"
                className="inline-flex items-center gap-1 px-1 text-meta text-muted-foreground"
              >
                <Check aria-hidden="true" className="size-3.5" />
                {t("charts.dashboard.toolbar.saved")}
              </span>
            ) : null}
            {editing || dirty ? (
              <ToolbarButton
                variant="ghost"
                size="sm"
                disabled={!dirty}
                onClick={handleDiscardClick}
              >
                {t("charts.dashboard.toolbar.discard")}
              </ToolbarButton>
            ) : null}
            {onSave && (editing || dirty) ? (
              <ToolbarButton variant="default" size="sm" disabled={!dirty} onClick={handleSave}>
                <Save aria-hidden="true" />
                {t("charts.dashboard.toolbar.save")}
              </ToolbarButton>
            ) : null}

            {/* 6 — panels, export, help */}
            {(editing && panels) || exportFeature || shortcuts ? <ToolbarSeparator /> : null}
            {editing && panels
              ? iconTip(
                  t("charts.dashboard.toolbar.assets"),
                  <IconButton
                    label={t("charts.dashboard.toolbar.assets")}
                    icon={<PanelLeft aria-hidden="true" />}
                    size="icon-sm"
                    variant={ui.assets ? "secondary" : "ghost"}
                    aria-pressed={ui.assets}
                    onClick={() => actions.setPanel("assets", !ui.assets)}
                  />,
                )
              : null}
            {editing && panels
              ? iconTip(
                  t("charts.dashboard.toolbar.properties"),
                  <IconButton
                    label={t("charts.dashboard.toolbar.properties")}
                    icon={<PanelRight aria-hidden="true" />}
                    size="icon-sm"
                    variant={ui.properties ? "secondary" : "ghost"}
                    aria-pressed={ui.properties}
                    onClick={() => actions.setPanel("properties", !ui.properties)}
                  />,
                )
              : null}
            {exportFeature ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <ToolbarSlot asChild>
                    <Button variant="ghost" size="sm" disabled={editing || exportBusy}>
                      {exportBusy ? (
                        <Spinner className="size-4" />
                      ) : (
                        <Download aria-hidden="true" />
                      )}
                      <span className={cn(editing && "sr-only")}>
                        {t("charts.dashboard.toolbar.export")}
                      </span>
                    </Button>
                  </ToolbarSlot>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem disabled={exportBusy} onSelect={() => void handleExport("svg")}>
                    {t("charts.dashboard.toolbar.exportSvg")}
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={exportBusy} onSelect={() => void handleExport("png")}>
                    {t("charts.dashboard.toolbar.exportPng")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {shortcuts
              ? iconTip(
                  t("charts.dashboard.toolbar.shortcuts"),
                  <IconButton
                    label={t("charts.dashboard.toolbar.shortcuts")}
                    icon={<HelpCircle aria-hidden="true" />}
                    size="icon-sm"
                    onClick={() => setShortcutsOpen(true)}
                  />,
                )
              : null}
          </TooltipProvider>
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
