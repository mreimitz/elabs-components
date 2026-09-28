import { useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  ArrowDown,
  ArrowRight,
  EllipsisVertical,
  LayoutGrid,
  Network,
  PanelRightClose,
  PanelRightOpen,
  RectangleHorizontal,
  RotateCcw,
  Shapes,
} from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
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
  Kbd,
  SidebarTrigger,
  StatusBadge,
  ThemeSwitcher,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  TooltipProvider,
} from "@elabs-ai/components-ui";
import { SEVERITY_STATUS } from "../panes/issues-panel";
import { toHash, useRoute, type Route } from "../routes/use-hash"; // catalog crumbs (maintainer 2026-09-27)
import { diagramActions, editActions, useDiagram } from "../state/diagram-store";
import { overrideDocKey } from "../state/override-key";
import { folderOf, useWorkspace } from "../workspace/workspace-store";
import { lensActions, useLens, type Lens } from "./lens-store"; // maintainer 2026-09-27 (lens switch)
import { modeActions, useDocMode, useMode } from "./mode-store";
import { WithTooltip } from "./with-tooltip";
// view mode overrides (maintainer 2026-09-27)
import {
  effectiveViewValue,
  useViewOverrides,
  viewOverrideActions,
  type ViewOverrides,
} from "./view-overrides-store";
import type { DiagramDirection } from "../layout/run-elk";
import type { NodeStyle } from "../spec/dialect";
// Wave 3: one import line per item under its marker; blank lines keep parallel merges clean.

import { LayoutControls, LayoutMenuItems } from "../layout/layout-controls"; // DG-15

import { DocumentControls, DocumentMenuItems } from "../io/document-controls"; // DG-16

import { ExportMenu, ExportMenuItems } from "../io/export-menu"; // DG-17

import { InteractionControls, InteractionMenuItems } from "../interaction/interaction-controls"; // DG-18

/** The top bar's strings, in one place (`conventions/i18n-strings`). */
const TOP_BAR_LABELS = {
  // DG-68 (review F1, fix-r1): the breadcrumb's location labels for a path-less doc — it
  // never shows the diagram's own title (that reads once, in the title block).
  sharedLink: "Shared link",
  notInWorkspace: "Not in the workspace",
  home: "Home",
  catalog: "Catalog",
  settings: "Settings",
  location: "Location",
  direction: "Direction",
  leftToRight: "LR, left to right",
  leftToRightTip: "Left to right (LR)",
  topToBottom: "TB, top to bottom",
  topToBottomTip: "Top to bottom (TB)",
  // view mode overrides (maintainer 2026-09-27): each control's own copy says its scope, since
  // changing it here never touches the file. Never "view" (the word) in any of this — it reads
  // as the app's View/Edit mode name, not "your own copy of this setting", which is what these
  // controls actually mean. The scope note is one shared string, never in an item's own
  // accessible name; it is tied instead via `aria-describedby` on the group (`ViewToggleGroup`
  // below), and short enough to wrap instead of overflowing the compact menu at 390 px.
  directionViewLabel: "Direction (only for you)",
  nodeStyleViewLabel: "Node style (only for you)",
  viewScopeHint: "Direction and node style are only for you, not saved, and forgotten on reload.",
  // A viewer's own direction/node-style choice otherwise has no visible sign beyond the
  // pressed toggle itself, which looks the same whether it is the file's own value or a
  // personal override. `viewOverrideBadge` is a short, textual marker (never colour alone)
  // next to the controls while either is overridden — never itself the reset control's name,
  // which needs its own verb (`viewOverrideReset`) so it reads as an action, not a state.
  viewOverrideBadge: "Your view",
  viewOverrideReset: "Reset to the diagram’s own setting",
  viewOverrideResetHint: "Not saved, forgotten on reload.",
  viewOverrideUnavailable: "No valid diagram is loaded.",
  // Neither control draws anything different while the visual lens shows (`VisualCanvasPane`
  // never reads either) — disabled there, with why, rather than doing nothing when touched.
  lensDisabledReason: "Direction and node style apply to the technical diagram.",
  nodeStyle: "Node style",
  icons: "Icons",
  iconsTip: "Icon nodes",
  cards: "Cards",
  cardsTip: "Card nodes",
  // lens switch (maintainer 2026-09-27): technical (today's diagram) vs. the derived,
  // coarser-grained visual lens (`src/visual/`) — the shortcut is `L` either way, since it
  // toggles between the two.
  lens: "Lens",
  technical: "Technical",
  technicalTip: "Technical view (L)",
  visual: "Visual",
  visualTip: "Visual view (L)",
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
 * Below this header width the diagram controls fold into one "Diagram options" menu (wave-2
 * review m7; plan §3.4 says 1,100 px of window, which is 1,052 px of header beside the 48 px
 * rail). The header is measured, not the window: an open sidebar takes 256 px of it. The
 * controls never shrink (the header's `shrink-0` children): only the breadcrumb truncates.
 */
const COMPACT_BELOW = 1052;

/** True while the element is narrower than `threshold` (measured before the first paint). */
function useNarrowerThan(ref: RefObject<HTMLElement | null>, threshold: number): boolean {
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setNarrow(element.getBoundingClientRect().width < threshold);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, threshold]);
  return narrow;
}

/** True while the element is narrower than `COMPACT_BELOW`. */
function useCompact(ref: RefObject<HTMLElement | null>): boolean {
  return useNarrowerThan(ref, COMPACT_BELOW);
}

const TIME = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

/**
 * Shared by `TopBar`'s two view-mode change handlers (direction, node style): a no-op while
 * the field has no file value yet (no AST), otherwise `viewOverrideActions.setOverride`.
 */
function setViewOverride<K extends "direction" | "nodeStyle">(
  key: string,
  field: K,
  value: NonNullable<ViewOverrides[K]>,
  fileValue: ViewOverrides[K],
) {
  if (fileValue !== undefined) viewOverrideActions.setOverride(key, field, value, fileValue);
}

/**
 * The document toolbar sits below the tabs. Left: the breadcrumb (folder ›
 * file name, the page's `h1` — a location, never the diagram's title; DG-68). Centre: in view
 * mode the story bar's slot (DG-31), in edit mode direction, node style and layout. Right: the
 * save state, Edit/Done, the zone folds and Present, Export. Undo/Redo, the
 * inspector switch and the problem counts show in edit mode only. Below `COMPACT_BELOW` the
 * controls move into one menu. Off a document (Home, Catalog, Settings) the bar is the
 * breadcrumb. When there are no open tabs, this row also hosts the sidebar and theme controls.
 */
export function TopBar() {
  const hasTabs = useMode((s) => s.openPaths.length > 0);
  const route = useRoute();
  const onDoc = route.kind === "doc";
  const edit = useDocMode() === "edit" && onDoc;
  const viewing = onDoc && !edit; // view-mode direction (maintainer 2026-09-27)
  const direction = useDiagram((s) => s.compiled.ast?.direction);
  const nodeStyle = useDiagram((s) => s.compiled.ast?.nodeStyle);
  const errors = useDiagram((s) => s.compiled.issues.filter((i) => i.severity === "error").length);
  const warnings = useDiagram(
    (s) => s.compiled.issues.filter((i) => i.severity === "warning").length,
  );
  // Direction, node style and layout all rewrite the TEXT — while the visual lens is showing
  // (or on its way in/out, `target`, so the controls grey out the instant the user clicks
  // Visual, not once the tween settles) that text is off screen, so these stay disabled exactly
  // like "no AST to rewrite" already does below.
  const lensTarget = useLens((s) => s.target);
  const lensMoving = useLens((s) => s.position !== 0);
  // No AST (the text is not a diagram), or the visual lens is showing: the toggles have
  // nothing visible to rewrite.
  const disabled = direction === undefined || lensTarget !== "technical" || lensMoving;
  const headerRef = useRef<HTMLElement>(null);
  const compact = useCompact(headerRef);
  const inspectorOpen = useDiagram((s) => s.inspectorOpen); // DG-14

  // view mode overrides (maintainer 2026-09-27): this viewer's own choices for the shown
  // document, kept only for this tab — `viewOverrideActions.setOverride` never touches the
  // file. `effectiveViewValue` is the one place both this bar and the canvas
  // (`canvas-pane.tsx`) derive what view mode shows, so the two can never disagree.
  const docPath = useDiagram((s) => s.path);
  const overrideKey = overrideDocKey(docPath, route.kind === "doc" ? route.share : undefined);
  const overrides = useViewOverrides(overrideKey);
  const viewDirection = effectiveViewValue(viewing, overrides.direction, direction);
  const viewNodeStyle = effectiveViewValue(viewing, overrides.nodeStyle, nodeStyle);
  const hasOverride = overrides.direction !== undefined || overrides.nodeStyle !== undefined;
  const resetOverride = () => viewOverrideActions.clear(overrideKey);
  // Shared by the wide bar's `ViewControls` and the compact `DiagramOptionsMenu` below — both
  // set the same override, on the same key, for the same reason (a matching choice reads as
  // "no override" rather than a redundant one).
  const onViewDirectionChange = (value: DiagramDirection) =>
    setViewOverride(overrideKey, "direction", value, direction);
  const onViewNodeStyleChange = (value: NodeStyle) =>
    setViewOverride(overrideKey, "nodeStyle", value, nodeStyle);
  // The visual lens draws neither the direction nor the card/icon choice (`VisualCanvasPane`
  // never reads either) — both controls are disabled while it shows, technical or not.
  const lensDisabled = useLens((s) => s.target) === "visual";

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
      <header
        ref={headerRef}
        data-slot="diagram-toolbar"
        className="flex h-header items-center gap-2 border-b px-4 [&>*:not(nav)]:shrink-0"
      >
        {hasTabs ? null : <SidebarTrigger />}
        <TitleCrumbs route={route} />
        {/* Always mounted (it owns the file input, a dialog and the share-link listener);
            off a document it shows nothing. */}
        <DocumentControls
          compact={compact || !onDoc}
          showHistory={edit}
          historyDisabled={lensTarget !== "technical" || lensMoving}
        />

        {/* No `min-w-0`: the centre keeps its controls' width, so the breadcrumb truncates
            instead of the controls running over their neighbours. */}
        <div className="flex flex-1 items-center justify-center gap-2">
          {/* View mode: the view-only direction and node-style controls (maintainer
              2026-09-27) sit here; DG-31's story bar will share this slot once it exists.
              Lens switch (maintainer 2026-09-27): works in both view and edit mode, so it
              sits outside the `edit`/`viewing` gates below. */}
          {onDoc && !compact ? <LensToggle /> : null}
          {edit && !compact ? (
            <>
              <DiagramToggles direction={direction} nodeStyle={nodeStyle} disabled={disabled} />
              <LayoutControls disabled={disabled} compact={false} />
            </>
          ) : viewing && !compact ? (
            <ViewControls
              direction={viewDirection}
              nodeStyle={viewNodeStyle}
              disabled={disabled}
              lensDisabled={lensDisabled}
              hasOverride={hasOverride}
              onDirectionChange={onViewDirectionChange}
              onNodeStyleChange={onViewNodeStyleChange}
              onReset={resetOverride}
            />
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
              lensDisabled={lensDisabled}
              hasOverride={hasOverride}
              viewDirection={viewDirection}
              viewNodeStyle={viewNodeStyle}
              onViewDirectionChange={onViewDirectionChange}
              onViewNodeStyleChange={onViewNodeStyleChange}
              onReset={resetOverride}
            />
          </>
        ) : null}
        {/* The library's family layout, as the website shows it: pick the brand, then light,
          dark or system (maintainer ruling 2026-09-27). */}
        {hasTabs ? null : (
          <WithTooltip label={TOP_BAR_LABELS.theme}>
            <ThemeSwitcher variant="ghost" size="sm" />
          </WithTooltip>
        )}
      </header>
    </TooltipProvider>
  );
}

// DG-68
/**
 * Folder › file name (a document) or Catalog › pack › entry id (the catalog, maintainer
 * feedback 2026-09-27) — the page's LOCATION, and the last crumb is the page's `h1`. It
 * answers "where is this", never "what is it called": a document's own title reads once in
 * the title block (chrome/title-block.tsx), a catalog entry's display name once in its own
 * heading (catalog/entry-view.tsx). Off a document/catalog entry it is the page name alone.
 */
function TitleCrumbs({ route }: { route: Route }) {
  const shownPath = useDiagram((s) => s.path);
  let folders: string[] = [];
  // catalog crumbs (maintainer 2026-09-27): the catalog's real, keyboard-reachable links
  // (Catalog, then the pack) — unlike `folders`, which stay plain text for a document.
  const links: LinkCrumbInfo[] = [];
  let heading: ReactNode;
  if (route.kind === "doc") {
    const path = route.path ?? shownPath;
    folders = path ? folderOf(path).split("/").filter(Boolean) : [];
    // DG-68 (review F1, fix-r1): a path-less doc (share link, or a file that is no longer a
    // workspace file) has no folder path to show, but the breadcrumb still names a LOCATION,
    // never the diagram's title — that reads once, in the title block on the canvas.
    heading = path ? (
      <FileNameCrumb name={path.split("/").pop() ?? path} />
    ) : route.share !== undefined ? (
      TOP_BAR_LABELS.sharedLink
    ) : (
      TOP_BAR_LABELS.notInWorkspace
    );
  } else if (route.kind === "home") heading = TOP_BAR_LABELS.home;
  else if (route.kind === "catalog") {
    // catalog crumbs (maintainer 2026-09-27): `#catalog` → "Catalog"; `#catalog/<pack>` →
    // "Catalog › <pack>" (pack the `h1`); `#catalog/<pack>/<entry>` → "Catalog › <pack> ›
    // <entry id>" (entry id the `h1`) — the pack/entry id is the route segment as typed, the
    // catalog's equivalent of a file name (no separate display label exists for a pack; the
    // in-page crumb this replaces showed the same raw id, e.g. "azure"). A route built from an
    // unknown pack or entry still names that location; the page body (not this bar) says it
    // was not found.
    if (route.vendor)
      links.push({ label: TOP_BAR_LABELS.catalog, href: toHash({ kind: "catalog" }) });
    if (route.vendor && route.entry) {
      // catalog crumbs (maintainer 2026-09-27, review F2): unlike "Catalog", the pack link can
      // grow long (an unknown, hand-typed pack) — it shrinks and truncates so it never overflows
      // the bar at a narrow width.
      links.push({
        label: route.vendor,
        href: toHash({ kind: "catalog", vendor: route.vendor }),
        truncate: true,
      });
    }
    // catalog crumbs (maintainer 2026-09-27, review F1): the heading follows the same rule
    // `app.tsx` uses to choose the page — an entry only exists with a pack (`route.vendor &&
    // route.entry`); a pack-less entry segment (`#catalog//foo`) is not a real route and must
    // still read "Catalog", matching the grid the page shows for it.
    heading = route.vendor ? (route.entry ?? route.vendor) : TOP_BAR_LABELS.catalog;
  } else if (route.kind === "settings") heading = TOP_BAR_LABELS.settings;
  else heading = route.name;
  return (
    <Breadcrumb aria-label={TOP_BAR_LABELS.location} className="min-w-0">
      <BreadcrumbList className="min-w-0 flex-nowrap">
        {folders.map((folder, index) => (
          <FolderCrumb key={`${index}-${folder}`} folder={folder} />
        ))}
        {links.map((link) => (
          <LinkCrumb key={link.href} {...link} />
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

interface LinkCrumbInfo {
  label: string;
  href: string;
  /**
   * catalog crumbs (maintainer 2026-09-27, review F2): this crumb shrinks and truncates instead
   * of holding its full width — for a pack name, which (unlike "Catalog") has no fixed length.
   */
  truncate?: boolean;
}

/**
 * catalog crumbs (maintainer 2026-09-27): a real, keyboard-reachable crumb (`BreadcrumbLink`
 * carries its own `focus-ring`) — unlike `FolderCrumb`'s plain text, since a document's
 * folders are not their own pages but a catalog pack and "Catalog" itself are. "Catalog" never
 * shrinks; a pack link does (`truncate`), so a long pack name cuts off with an ellipsis instead
 * of overflowing the bar (review F2) — matching how the heading crumb already truncates.
 *
 * catalog crumbs (maintainer 2026-09-27, review F1): a plain `min-w-0` still carries the
 * default `flex-shrink: 1`, so the pack crumb shrinks in proportion to the `h1`'s own (already
 * shrinking) width — a short, real pack name (e.g. "azure") loses a third of its 37px (down to
 * ~25px) even though the longer `h1` is already truncating; the spec is the `h1` shrinks first.
 * `shrink-0` stops the pack crumb from giving up space at all; `max-w-24` still caps it at 96px
 * so a long, unknown pack (review F2) truncates instead of overflowing the bar — the two
 * together mean a normal pack keeps its natural (sub-96px) width and only an oversized one
 * truncates, while the `h1` (kept plain `min-w-0`, no cap) absorbs the rest of the squeeze.
 */
function LinkCrumb({ label, href, truncate }: LinkCrumbInfo) {
  return (
    <>
      <BreadcrumbItem className={truncate ? "min-w-0 max-w-24 shrink-0" : "shrink-0"}>
        <BreadcrumbLink href={href} className={truncate ? "block truncate" : undefined}>
          {label}
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator className="shrink-0" />
    </>
  );
}

/** The extension after the last "." (empty for a file with none), e.g. ".yaml". */
const FILE_EXTENSION = /\.[^./]+$/;

/** DG-68: the breadcrumb's last crumb — the file name, its extension in the meta tone. */
function FileNameCrumb({ name }: { name: string }) {
  const match = name.match(FILE_EXTENSION);
  if (!match) return <>{name}</>;
  return (
    <>
      {name.slice(0, -match[0].length)}
      <span className="text-meta text-muted-foreground">{match[0]}</span>
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
        : // `savedAt` is the last write of any file: only the shown file's own save
          // (`saved`, reset to `idle` when a file opens) carries the time.
          save === "saved" && savedAt !== null
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
  direction: DiagramDirection | undefined;
  nodeStyle: NodeStyle | undefined;
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

/** One `ViewToggleGroup` option: the value it writes, its icon and its (short, plain) tooltip. */
interface ViewToggleOption<T extends string> {
  value: T;
  icon: ReactNode;
  tip: string;
}

interface ViewToggleGroupProps<T extends string> {
  groupLabel: string;
  /** The id of the shared scope note (`ViewControls`' own `useId()`, below). */
  hintId: string;
  value: T | undefined;
  disabled: boolean;
  onChange: (value: T) => void;
  options: readonly [ViewToggleOption<T>, ViewToggleOption<T>];
  /** `ViewControls`' own ref to the direction group, so it can move focus there after a reset
   * (the reset control unmounts the moment the override it named clears). */
  groupRef?: RefObject<HTMLDivElement | null>;
}

/**
 * view mode overrides (maintainer 2026-09-27): the wide bar's view-mode controls (direction,
 * node style), same look as `DiagramToggles`' groups, but each sets this viewer's own choice
 * (`viewOverrideActions.setOverride`) instead of rewriting the file. An item's accessible name
 * is the option alone (`WithTooltip`'s label, reusing the same tip strings edit mode's group
 * uses, so a viewer sees exactly what the option is called); the "only for you" scope, and why
 * it is disabled under the visual lens, are both group-level facts, tied on via
 * `aria-describedby` to the one visible caption below (`ViewControls`) rather than repeated on
 * every item — a disabled `ToggleGroupItem` carries `pointer-events-none`, so a tooltip on the
 * item itself would never open to say why.
 */
function ViewToggleGroup<T extends string>({
  groupLabel,
  hintId,
  value,
  disabled,
  onChange,
  options,
  groupRef,
}: ViewToggleGroupProps<T>) {
  return (
    <ToggleGroup
      ref={groupRef}
      type="single"
      variant="segmented"
      size="sm"
      aria-label={groupLabel}
      aria-describedby={hintId}
      value={value ?? ""}
      disabled={disabled}
      onValueChange={(v) => v && onChange(v as T)}
    >
      {options.map((option) => (
        <WithTooltip key={option.value} label={option.tip}>
          <ToggleGroupItem value={option.value}>{option.icon}</ToggleGroupItem>
        </WithTooltip>
      ))}
    </ToggleGroup>
  );
}

const DIRECTION_OPTIONS = [
  { value: "LR", icon: <ArrowRight aria-hidden="true" />, tip: TOP_BAR_LABELS.leftToRightTip },
  { value: "TB", icon: <ArrowDown aria-hidden="true" />, tip: TOP_BAR_LABELS.topToBottomTip },
] as const satisfies readonly [
  ViewToggleOption<DiagramDirection>,
  ViewToggleOption<DiagramDirection>,
];

const NODE_STYLE_OPTIONS = [
  { value: "icon", icon: <Shapes aria-hidden="true" />, tip: TOP_BAR_LABELS.iconsTip },
  { value: "card", icon: <RectangleHorizontal aria-hidden="true" />, tip: TOP_BAR_LABELS.cardsTip },
] as const satisfies readonly [ViewToggleOption<NodeStyle>, ViewToggleOption<NodeStyle>];

interface ViewControlsProps {
  direction: DiagramDirection | undefined;
  nodeStyle: NodeStyle | undefined;
  disabled: boolean;
  /** The visual lens shows: both controls are disabled, with why (`lensDisabledReason`). */
  lensDisabled: boolean;
  /** This document has an override on record for direction, node style, or both. */
  hasOverride: boolean;
  onDirectionChange: (direction: DiagramDirection) => void;
  onNodeStyleChange: (nodeStyle: NodeStyle) => void;
  /** Back to the diagram's own setting for both fields at once. */
  onReset: () => void;
}

/**
 * The wide bar's view-mode slot: direction and node style, a shared scope note (visible, and
 * `aria-describedby` on both groups), and — while either is overridden — a reset control.
 */
function ViewControls({
  direction,
  nodeStyle,
  disabled,
  lensDisabled,
  hasOverride,
  onDirectionChange,
  onNodeStyleChange,
  onReset,
}: ViewControlsProps) {
  // A real id (not a fixed string): two `ViewControls` could otherwise collide if this slot is
  // ever shown twice on one page.
  const scopeHintId = useId();
  const effectiveDisabled = disabled || lensDisabled;
  const directionGroupRef = useRef<HTMLDivElement>(null);
  // The reset control unmounts the instant `hasOverride` goes false (the render right after
  // `onReset` runs), which would otherwise drop focus to the page body — send it to the first
  // direction option instead, the wide bar's other view-mode control.
  const handleReset = () => {
    onReset();
    requestAnimationFrame(() => {
      const directionButton =
        directionGroupRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)");
      const lensButton = document.querySelector<HTMLButtonElement>(
        '[aria-label="Lens"] button[aria-checked="true"]',
      );
      (directionButton ?? lensButton)?.focus();
    });
  };
  return (
    <div className="flex items-center gap-2">
      <ViewToggleGroup
        groupLabel={TOP_BAR_LABELS.directionViewLabel}
        hintId={scopeHintId}
        value={direction}
        disabled={effectiveDisabled}
        onChange={onDirectionChange}
        options={DIRECTION_OPTIONS}
        groupRef={directionGroupRef}
      />
      <ViewToggleGroup
        groupLabel={TOP_BAR_LABELS.nodeStyleViewLabel}
        hintId={scopeHintId}
        value={nodeStyle}
        disabled={effectiveDisabled}
        onChange={onNodeStyleChange}
        options={NODE_STYLE_OPTIONS}
      />
      {/* A short, textual marker (never colour alone, WCAG 1.4.1) that either control holds
          this viewer's own choice, not the diagram's — separate from the reset control beside
          it, which is named for what it DOES (never disabled by the lens: resetting an
          override it shows regardless is always a harmless, useful action). */}
      {hasOverride ? (
        <div className="flex items-center gap-1">
          <span className="text-caption font-medium text-foreground">
            {TOP_BAR_LABELS.viewOverrideBadge}
          </span>
          <IconButton
            icon={<RotateCcw aria-hidden="true" />}
            label={TOP_BAR_LABELS.viewOverrideReset}
            disabledReason={disabled ? TOP_BAR_LABELS.viewOverrideUnavailable : undefined}
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={handleReset}
          />
        </div>
      ) : null}
      <span id={scopeHintId} className="sr-only">
        {lensDisabled ? TOP_BAR_LABELS.lensDisabledReason : TOP_BAR_LABELS.viewScopeHint}
      </span>
    </div>
  );
}

/**
 * Technical | Visual (maintainer 2026-09-27, "the switch from technical to visual"): a
 * segmented control, the direction/node-style toggles' own pattern, wired to `lens-store.ts`
 * instead of the text (view-only — nothing here reaches `diagram-store`/`workspace-store`).
 * `L` toggles it either way; the tooltip on each item says so (WCAG: the shortcut is not the
 * only route to it — the control is always reachable by click/tap).
 */
function LensToggle() {
  const lens = useLens((s) => s.target);
  return (
    <ToggleGroup
      type="single"
      variant="segmented"
      size="sm"
      aria-label={TOP_BAR_LABELS.lens}
      value={lens}
      onValueChange={(value) => value && lensActions.setLens(value as Lens)}
    >
      <WithTooltip label={TOP_BAR_LABELS.technicalTip}>
        <ToggleGroupItem value={"technical" satisfies Lens} aria-keyshortcuts="L">
          <Network aria-hidden="true" />
        </ToggleGroupItem>
      </WithTooltip>
      <WithTooltip label={TOP_BAR_LABELS.visualTip}>
        <ToggleGroupItem value={"visual" satisfies Lens} aria-keyshortcuts="L">
          <LayoutGrid aria-hidden="true" />
        </ToggleGroupItem>
      </WithTooltip>
    </ToggleGroup>
  );
}

/**
 * The compact bar's lens entry (DG-68-style menu section, always shown — the lens works in
 * both view and edit mode, unlike the direction/node-style section right below it). No
 * trailing separator of its own: the next section, `edit`'s Direction label or (in view mode)
 * `ExportMenuItems`, always owns the leading separator that follows, the same way
 * `LayoutMenuItems`/`ExportMenuItems` do; owning one here too would double up in view mode,
 * where nothing sits between this section and Export's own.
 */
function LensMenuItems() {
  const lens = useLens((s) => s.target);
  return (
    <>
      <DropdownMenuLabel>{TOP_BAR_LABELS.lens}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        aria-label={TOP_BAR_LABELS.lens}
        value={lens}
        onValueChange={(value) => lensActions.setLens(value as Lens)}
      >
        <DropdownMenuRadioItem value={"technical" satisfies Lens}>
          {TOP_BAR_LABELS.technical}
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value={"visual" satisfies Lens}>
          {TOP_BAR_LABELS.visual}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
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
  /** Edit mode: the editing entries (inspector, layout) show too, and both radio groups write
   * the file. View mode: both groups set this viewer's own choice instead (below). */
  edit: boolean;
  /** The visual lens shows: both view-mode radio groups are disabled, with why. */
  lensDisabled: boolean;
  /** This document has an override on record for direction, node style, or both. */
  hasOverride: boolean;
  viewDirection: DiagramDirection | undefined;
  viewNodeStyle: NodeStyle | undefined;
  onViewDirectionChange: (direction: DiagramDirection) => void;
  onViewNodeStyleChange: (nodeStyle: NodeStyle) => void;
  onReset: () => void;
}

interface OptionsRadioOption<T extends string> {
  value: T;
  label: string;
}

interface OptionsRadioSectionProps<T extends string> {
  label: string;
  value: T | undefined;
  disabled: boolean;
  onValueChange: (value: T) => void;
  options: readonly [OptionsRadioOption<T>, OptionsRadioOption<T>];
  /** view mode overrides (maintainer 2026-09-27): the id of the ONE shared scope note both
   * view-mode sections describe themselves with (`DiagramOptionsMenu` renders the text itself,
   * once, after both groups). Unset in edit mode — there is nothing to qualify, the group just
   * rewrites the file. */
  hintId?: string;
}

/** One compact-menu radio section (direction, node style), edit or view-mode flavour. */
function OptionsRadioSection<T extends string>({
  label,
  value,
  disabled,
  onValueChange,
  options,
  hintId,
}: OptionsRadioSectionProps<T>) {
  return (
    <>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        aria-label={label}
        aria-describedby={hintId}
        value={value ?? ""}
        onValueChange={(next) => next && onValueChange(next as T)}
      >
        {options.map((option) => (
          <DropdownMenuRadioItem
            key={option.value}
            value={option.value}
            disabled={disabled}
            className="data-disabled:pointer-events-none data-disabled:opacity-50"
          >
            {option.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}

const DIRECTION_LABEL_OPTIONS = [
  { value: "LR", label: TOP_BAR_LABELS.leftToRight },
  { value: "TB", label: TOP_BAR_LABELS.topToBottom },
] as const satisfies readonly [OptionsRadioOption<string>, OptionsRadioOption<string>];

const NODE_STYLE_LABEL_OPTIONS = [
  { value: "icon", label: TOP_BAR_LABELS.icons },
  { value: "card", label: TOP_BAR_LABELS.cards },
] as const satisfies readonly [OptionsRadioOption<string>, OptionsRadioOption<string>];

/**
 * The compact top bar's controls, behind one icon button (wave-2 review m7): the same
 * actions as the wide bar (each wave-3 item adds its own entries in its slot).
 * P4: library gap — ui has no responsive toolbar that folds its overflow into a menu.
 */
function DiagramOptionsMenu({
  direction,
  nodeStyle,
  disabled,
  edit,
  lensDisabled,
  hasOverride,
  viewDirection,
  viewNodeStyle,
  onViewDirectionChange,
  onViewNodeStyleChange,
  onReset,
}: DiagramOptionsMenuProps) {
  const inspectorOpen = useDiagram((s) => s.inspectorOpen); // DG-14
  // One shared id for both view-mode sections' scope note, rendered once below.
  const viewScopeHintId = useId();
  const viewDisabled = disabled || lensDisabled;
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

        {/* Lens switch (maintainer 2026-09-27): works in both view and edit mode, so it
            shows above the mode-gated sections below, mirroring the wide bar's order. */}
        <LensMenuItems />

        {/* view mode overrides (maintainer 2026-09-27): both groups show in both modes now —
            edit mode rewrites the file's own default, view mode sets this viewer's own choice,
            and the shared hint under both radios says so, once — never only in a tooltip,
            since the compact menu has no hover tooltip on a touch device. */}
        {edit ? (
          <OptionsRadioSection
            label={TOP_BAR_LABELS.direction}
            value={direction}
            disabled={disabled}
            onValueChange={(value: string) => diagramActions.setTopLevel("direction", value)}
            options={DIRECTION_LABEL_OPTIONS}
          />
        ) : (
          <OptionsRadioSection
            label={TOP_BAR_LABELS.directionViewLabel}
            value={viewDirection}
            disabled={viewDisabled}
            onValueChange={onViewDirectionChange}
            options={DIRECTION_LABEL_OPTIONS}
            hintId={viewScopeHintId}
          />
        )}
        <DropdownMenuSeparator />

        {edit ? (
          <>
            <OptionsRadioSection
              label={TOP_BAR_LABELS.nodeStyle}
              value={nodeStyle}
              disabled={disabled}
              onValueChange={(value: string) => diagramActions.setTopLevel("nodeStyle", value)}
              options={NODE_STYLE_LABEL_OPTIONS}
            />
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
        ) : (
          <>
            <OptionsRadioSection
              label={TOP_BAR_LABELS.nodeStyleViewLabel}
              value={viewNodeStyle}
              disabled={viewDisabled}
              onValueChange={onViewNodeStyleChange}
              options={NODE_STYLE_LABEL_OPTIONS}
              hintId={viewScopeHintId}
            />
            {/* `max-w-56`: wraps instead of forcing the menu past the viewport at 390 px.
                Rendered once, after both view-mode groups, not per group. */}
            <DropdownMenuLabel
              id={viewScopeHintId}
              className="max-w-56 pt-0 text-caption font-normal"
            >
              {lensDisabled ? TOP_BAR_LABELS.lensDisabledReason : TOP_BAR_LABELS.viewScopeHint}
            </DropdownMenuLabel>
            {hasOverride ? (
              <DropdownMenuItem onSelect={onReset}>
                <RotateCcw aria-hidden="true" />
                {TOP_BAR_LABELS.viewOverrideReset}
              </DropdownMenuItem>
            ) : null}
          </>
        )}

        {/* ExportMenuItems/InteractionMenuItems each open with their own separator — no
            separator here in view mode (doubled up, right above Export, otherwise). */}
        <ExportMenuItems />

        <InteractionMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
