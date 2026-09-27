import {
  ArrowDown,
  ArrowRight,
  EllipsisVertical,
  PanelRightClose,
  PanelRightOpen,
  RectangleHorizontal,
  Shapes,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Kbd,
  SidebarTrigger,
  StatusBadge,
  ThemeSwitcher,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  TooltipProvider,
  useIsMobile,
} from "@elabs-ai/components-ui";
import { SEVERITY_STATUS } from "../panes/issues-panel";
import { useRoute, type Route } from "../routes/use-hash";
import { diagramActions, editActions, useDiagram } from "../state/diagram-store";
import { folderOf, useWorkspace } from "../workspace/workspace-store";
import { fileTitle, modeActions, useDocMode } from "./mode-store";
import { WithTooltip } from "./with-tooltip";
// Wave 3: one import line per item under its marker; blank lines keep parallel merges clean.

import { LayoutControls, LayoutMenuItems } from "../layout/layout-controls"; // DG-15

import { DocumentControls, DocumentMenuItems } from "../io/document-controls"; // DG-16

import { ExportMenu, ExportMenuItems } from "../io/export-menu"; // DG-17

import { InteractionControls, InteractionMenuItems } from "../interaction/interaction-controls"; // DG-18

/** The top bar's strings, in one place (`conventions/i18n-strings`). */
const TOP_BAR_LABELS = {
  untitled: "Untitled diagram",
  home: "Home",
  catalog: "Catalog",
  settings: "Settings",
  location: "Location",
  direction: "Direction",
  leftToRight: "LR, left to right",
  leftToRightTip: "Left to right (LR)",
  topToBottom: "TB, top to bottom",
  topToBottomTip: "Top to bottom (TB)",
  nodeStyle: "Node style",
  icons: "Icons",
  iconsTip: "Icon nodes",
  cards: "Cards",
  cardsTip: "Card nodes",
  inspector: "Inspector",
  options: "Diagram options",
  theme: "Theme",
  edit: "Edit",
  done: "Done",
  saving: "Saving…",
  saved: "Saved",
  savedAt: (time: string) => `Saved · ${time}`,
  notSaved: "Not saved",
  errors: (count: number) => (count === 1 ? "1 error" : `${count} errors`),
  warnings: (count: number) => (count === 1 ? "1 warning" : `${count} warnings`),
} as const;

/**
 * Below this width the diagram controls fold into one "Diagram options" menu (wave-2 review
 * m7; plan §3.4 says 1,100 px). The controls never shrink (the header's `shrink-0` children):
 * only the breadcrumb truncates.
 */
const COMPACT_BELOW = 1100;

const TIME = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

/**
 * The Atlas top bar (plan §3.3–3.4). Left: the sidebar trigger and the breadcrumb (folder ›
 * title, the title the page's `h1`). Centre: in view mode the story bar's slot (DG-31), in edit
 * mode direction, node style and layout. Right: the save state, Edit/Done, the zone folds and
 * Present, Export, the theme. Undo/Redo, the inspector switch and the problem counts show in
 * edit mode only. Below `COMPACT_BELOW` the controls move into one menu. Off a document (Home,
 * Catalog, Settings) the bar is the breadcrumb and the theme.
 */
export function TopBar() {
  const route = useRoute();
  const onDoc = route.kind === "doc";
  const edit = useDocMode() === "edit" && onDoc;
  // The drawn diagram's title: while the text does not compile, the canvas keeps the last
  // valid diagram, and so does the heading (wave-2 review m4).
  const direction = useDiagram((s) => s.compiled.ast?.direction);
  const nodeStyle = useDiagram((s) => s.compiled.ast?.nodeStyle);
  const errors = useDiagram((s) => s.compiled.issues.filter((i) => i.severity === "error").length);
  const warnings = useDiagram(
    (s) => s.compiled.issues.filter((i) => i.severity === "warning").length,
  );
  // No AST (the text is not a diagram): the toggles have nothing to rewrite.
  const disabled = direction === undefined;
  const compact = useIsMobile(COMPACT_BELOW);
  const inspectorOpen = useDiagram((s) => s.inspectorOpen); // DG-14

  const counts = edit ? (
    <>
      {errors > 0 ? (
        <StatusBadge status={SEVERITY_STATUS.error}>{TOP_BAR_LABELS.errors(errors)}</StatusBadge>
      ) : null}
      {warnings > 0 ? (
        <StatusBadge status={SEVERITY_STATUS.warning}>
          {TOP_BAR_LABELS.warnings(warnings)}
        </StatusBadge>
      ) : null}
    </>
  ) : null;

  return (
    // One provider for every tooltip in the bar (`WithTooltip`); `IconButton` brings its own.
    <TooltipProvider>
      <header className="flex h-header items-center gap-2 border-b px-4 [&>*:not(nav)]:shrink-0">
        <SidebarTrigger />
        <TitleCrumbs route={route} />
        {/* Always mounted (it owns the file input, a dialog and the share-link listener);
            off a document it shows nothing. */}
        <DocumentControls compact={compact || !onDoc} showHistory={edit} />

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          {/* View mode: DG-31's story bar goes here. */}
          {edit && !compact ? (
            <>
              <DiagramToggles direction={direction} nodeStyle={nodeStyle} disabled={disabled} />
              <LayoutControls disabled={disabled} compact={false} />
            </>
          ) : null}
        </div>
        {/* Wave 3: LayoutControls owns the layout dialogs, so it stays mounted when its
            controls are not shown (view mode, the compact bar). */}
        {edit && !compact ? null : <LayoutControls disabled={disabled} compact />}

        {compact ? null : counts}
        {edit && !compact ? <InspectorToggle open={inspectorOpen} /> : null}
        {onDoc ? <SaveState /> : null}
        {onDoc ? <EditToggle edit={edit} /> : null}
        {onDoc ? <InteractionControls compact={compact} /> : null}
        {onDoc ? <ExportMenu compact={compact} /> : null}
        {compact && onDoc ? (
          <>
            {counts}
            <DiagramOptionsMenu
              direction={direction}
              nodeStyle={nodeStyle}
              disabled={disabled}
              edit={edit}
            />
          </>
        ) : null}
        {/* The library's family layout, as the website shows it: pick the brand, then light,
          dark or system (maintainer ruling 2026-09-27). */}
        <WithTooltip label={TOP_BAR_LABELS.theme}>
          <ThemeSwitcher variant="ghost" size="sm" />
        </WithTooltip>
      </header>
    </TooltipProvider>
  );
}

/**
 * Folder › title. The folders are plain text (the tree in the sidebar is where they are
 * opened); the last crumb is the page's `h1`. Off a document it is the page name alone.
 */
function TitleCrumbs({ route }: { route: Route }) {
  const title = useDiagram((s) => s.drawn.ast?.title?.trim());
  const shownPath = useDiagram((s) => s.path);
  let folders: string[] = [];
  let heading: string;
  if (route.kind === "doc") {
    const path = route.path ?? shownPath;
    folders = path ? folderOf(path).split("/").filter(Boolean) : [];
    heading = title || (path ? fileTitle(path) : TOP_BAR_LABELS.untitled);
  } else if (route.kind === "home") heading = TOP_BAR_LABELS.home;
  else if (route.kind === "catalog") heading = TOP_BAR_LABELS.catalog;
  else if (route.kind === "settings") heading = TOP_BAR_LABELS.settings;
  else heading = route.name;
  return (
    <Breadcrumb aria-label={TOP_BAR_LABELS.location} className="min-w-0">
      <BreadcrumbList className="min-w-0 flex-nowrap">
        {folders.map((folder, index) => (
          <FolderCrumb key={`${index}-${folder}`} folder={folder} />
        ))}
        <BreadcrumbItem className="min-w-0">
          <h1 className="min-w-0 truncate text-body font-medium">
            <BreadcrumbPage>{heading}</BreadcrumbPage>
          </h1>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function FolderCrumb({ folder }: { folder: string }) {
  return (
    <>
      <BreadcrumbItem className="shrink-0">{folder}</BreadcrumbItem>
      <BreadcrumbSeparator />
    </>
  );
}

/**
 * The autosave's state (DG-21), as text: "Saving…" while an edit waits for or is in its write,
 * "Saved · 14:03" after one, "Saved" for a file opened and not changed, "Not saved" when the
 * write failed, a disk conflict holds it, or the document is no workspace file (a share link).
 */
function SaveState() {
  const save = useWorkspace((s) => s.save);
  const savedAt = useWorkspace((s) => s.savedAt);
  const dirty = useWorkspace((s) => s.dirty);
  const conflict = useWorkspace((s) => s.conflict);
  const isFile = useWorkspace((s) => s.current !== null);
  const text =
    !isFile || save === "error" || conflict
      ? TOP_BAR_LABELS.notSaved
      : save === "saving" || dirty
        ? TOP_BAR_LABELS.saving
        : savedAt !== null
          ? TOP_BAR_LABELS.savedAt(TIME.format(savedAt))
          : TOP_BAR_LABELS.saved;
  return (
    <span role="status" className="text-meta text-nowrap text-muted-foreground tabular-nums">
      {text}
    </span>
  );
}

/**
 * Edit / Done (plan §3.4): slides the editor and inspector in or out. The `Kbd` inside would
 * join the accessible name, so the button names itself and hides its visible label and key.
 */
function EditToggle({ edit }: { edit: boolean }) {
  const label = edit ? TOP_BAR_LABELS.done : TOP_BAR_LABELS.edit;
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={label}
      aria-keyshortcuts="E"
      onClick={modeActions.toggleMode}
    >
      <span aria-hidden="true">{label}</span>
      <Kbd aria-hidden="true">E</Kbd>
    </Button>
  );
}

interface DiagramTogglesProps {
  direction: string | undefined;
  nodeStyle: string | undefined;
  disabled: boolean;
}

/** Direction and node style (DG-12): each rewrites one top-level key in the text (plan D2). */
function DiagramToggles({ direction, nodeStyle, disabled }: DiagramTogglesProps) {
  return (
    <>
      <ToggleGroup
        type="single"
        variant="segmented"
        size="sm"
        aria-label={TOP_BAR_LABELS.direction}
        value={direction ?? ""}
        disabled={disabled}
        onValueChange={(value) => value && diagramActions.setTopLevel("direction", value)}
      >
        <WithTooltip label={TOP_BAR_LABELS.leftToRightTip}>
          <ToggleGroupItem value="LR">
            <ArrowRight aria-hidden="true" />
          </ToggleGroupItem>
        </WithTooltip>
        <WithTooltip label={TOP_BAR_LABELS.topToBottomTip}>
          <ToggleGroupItem value="TB">
            <ArrowDown aria-hidden="true" />
          </ToggleGroupItem>
        </WithTooltip>
      </ToggleGroup>
      <ToggleGroup
        type="single"
        variant="segmented"
        size="sm"
        aria-label={TOP_BAR_LABELS.nodeStyle}
        value={nodeStyle ?? ""}
        disabled={disabled}
        onValueChange={(value) => value && diagramActions.setTopLevel("nodeStyle", value)}
      >
        <WithTooltip label={TOP_BAR_LABELS.iconsTip}>
          <ToggleGroupItem value="icon">
            <Shapes aria-hidden="true" />
          </ToggleGroupItem>
        </WithTooltip>
        <WithTooltip label={TOP_BAR_LABELS.cardsTip}>
          <ToggleGroupItem value="card">
            <RectangleHorizontal aria-hidden="true" />
          </ToggleGroupItem>
        </WithTooltip>
      </ToggleGroup>
    </>
  );
}

/**
 * DG-14's inspector switch: a pressed toggle, icon-only with the name as its tooltip. The glyph
 * flips as a second, non-colour cue (wave-3 review F3).
 * P4: library gap — `IconButton` has no pressed look (docs/findings/DG-14-inspector-write-back.md).
 */
function InspectorToggle({ open }: { open: boolean }) {
  return (
    <WithTooltip label={TOP_BAR_LABELS.inspector}>
      <Toggle
        variant="outline"
        size="sm"
        pressed={open}
        onPressedChange={editActions.setInspectorOpen}
      >
        {open ? <PanelRightClose aria-hidden="true" /> : <PanelRightOpen aria-hidden="true" />}
      </Toggle>
    </WithTooltip>
  );
}

interface DiagramOptionsMenuProps extends DiagramTogglesProps {
  /** Edit mode: the editing entries (direction, node style, inspector, layout) show too. */
  edit: boolean;
}

/**
 * The compact top bar's controls, behind one icon button (wave-2 review m7): the same
 * actions as the wide bar (each wave-3 item adds its own entries in its slot).
 * P4: library gap — ui has no responsive toolbar that folds its overflow into a menu.
 */
function DiagramOptionsMenu({ direction, nodeStyle, disabled, edit }: DiagramOptionsMenuProps) {
  const inspectorOpen = useDiagram((s) => s.inspectorOpen); // DG-14
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={TOP_BAR_LABELS.options}>
          <EllipsisVertical aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      {/* Taller than a short window: it scrolls within the room Radix measures. P4: library
          gap — ui's DropdownMenuContent clips (`overflow-hidden`, no max height);
          docs/findings/DG-14-inspector-write-back.md. `collisionPadding` keeps it 8 px off the
          window's edges (wave-3 review m3). */}
      <DropdownMenuContent
        align="end"
        collisionPadding={8}
        className="max-h-(--radix-dropdown-menu-content-available-height) overflow-y-auto"
      >
        <DocumentMenuItems />

        {edit ? (
          <>
            <DropdownMenuLabel>{TOP_BAR_LABELS.direction}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              aria-label={TOP_BAR_LABELS.direction}
              value={direction ?? ""}
              onValueChange={(value) => diagramActions.setTopLevel("direction", value)}
            >
              <DropdownMenuRadioItem value="LR" disabled={disabled}>
                {TOP_BAR_LABELS.leftToRight}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="TB" disabled={disabled}>
                {TOP_BAR_LABELS.topToBottom}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{TOP_BAR_LABELS.nodeStyle}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              aria-label={TOP_BAR_LABELS.nodeStyle}
              value={nodeStyle ?? ""}
              onValueChange={(value) => diagramActions.setTopLevel("nodeStyle", value)}
            >
              <DropdownMenuRadioItem value="icon" disabled={disabled}>
                {TOP_BAR_LABELS.icons}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="card" disabled={disabled}>
                {TOP_BAR_LABELS.cards}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            {/* DG-14 */}
            <DropdownMenuCheckboxItem
              checked={inspectorOpen}
              onCheckedChange={editActions.setInspectorOpen}
            >
              {TOP_BAR_LABELS.inspector}
            </DropdownMenuCheckboxItem>

            <LayoutMenuItems disabled={disabled} />
          </>
        ) : null}

        <ExportMenuItems />

        <InteractionMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
