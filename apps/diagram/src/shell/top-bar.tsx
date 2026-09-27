import {
  ArrowDown,
  ArrowRight,
  EllipsisVertical,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  RectangleHorizontal,
  Shapes,
} from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Heading,
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
import { diagramActions, editActions, useDiagram } from "../state/diagram-store";
import { useEditorVisibility, type EditorVisibility } from "./editor-visibility";
import { WithTooltip } from "./with-tooltip";
// Wave 3: one import line per item under its marker; blank lines keep parallel merges clean.

import { LayoutControls, LayoutMenuItems } from "../layout/layout-controls"; // DG-15

import { DocumentControls, DocumentMenuItems } from "../io/document-controls"; // DG-16

import { ExportMenu, ExportMenuItems } from "../io/export-menu"; // DG-17

import { InteractionControls, InteractionMenuItems } from "../interaction/interaction-controls"; // DG-18

/** The top bar's strings, in one place (`conventions/i18n-strings`). */
const TOP_BAR_LABELS = {
  untitled: "Untitled diagram",
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
  canvasOnly: "Canvas only",
  options: "Diagram options",
  theme: "Theme",
  errors: (count: number) => (count === 1 ? "1 error" : `${count} errors`),
  warnings: (count: number) => (count === 1 ? "1 warning" : `${count} warnings`),
} as const;

/**
 * Below this width the diagram controls fold into one "Diagram options" menu (wave-2 review
 * m7). With every control an icon (maintainer ruling 2026-09-27) the row's controls, gaps
 * and padding measured 760 px (light theme, lakehouse example), so from 1,280 px the
 * heading keeps at least 12rem even beside the open 256 px sidebar. The controls never
 * shrink (the header's `shrink-0` children): only the heading truncates.
 */
const COMPACT_BELOW = 1280;

/**
 * The dashboard shell's top bar (plan §6). DG-12 wires direction, node style and "Auto
 * layout" to the store; the toggles rewrite the text (plan D2). "Canvas only" hides the
 * editor (wave-2 review M1). Wave 3 adds its controls in the slots below: DG-14 the
 * inspector, DG-15 the layout mode, DG-16 undo and the File menu, DG-17 Export, DG-18 the
 * zone folds and Present. Below `COMPACT_BELOW` the controls move into a menu; the heading,
 * Undo and Redo, the issue counts and the theme stay in the bar.
 */
export function TopBar() {
  // The drawn diagram's title: while the text does not compile, the canvas keeps the last
  // valid diagram, and so does the heading (wave-2 review m4).
  const title = useDiagram((s) => s.drawn.ast?.title);
  const direction = useDiagram((s) => s.compiled.ast?.direction);
  const nodeStyle = useDiagram((s) => s.compiled.ast?.nodeStyle);
  const errors = useDiagram((s) => s.compiled.issues.filter((i) => i.severity === "error").length);
  const warnings = useDiagram(
    (s) => s.compiled.issues.filter((i) => i.severity === "warning").length,
  );
  // No AST (the text is not a diagram): the toggles have nothing to rewrite.
  const disabled = direction === undefined;
  const visibility = useEditorVisibility();
  const compact = useIsMobile(COMPACT_BELOW);
  // Phones show one pane behind the workspace's Editor/Canvas tabs: no separate switch.
  const phone = useIsMobile();
  const inspectorOpen = useDiagram((s) => s.inspectorOpen); // DG-14

  const counts = (
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
  );

  return (
    // One provider for every tooltip in the bar (`WithTooltip`); `IconButton` brings its own.
    <TooltipProvider>
      <header className="flex h-header items-center gap-2 border-b px-4 [&>*:not(h1)]:shrink-0">
        <SidebarTrigger />
        {/* `size="subtitle"`: level 1 would default to the display face. `text-nowrap`: the
          Heading's `text-balance` otherwise beats `truncate` and wraps the title to two lines
          (P4: library gap — docs/findings/DG-02-shell-a11y.md, wave-2 additions). */}
        <Heading
          level={1}
          size="subtitle"
          className="min-w-0 truncate text-nowrap text-body font-medium"
        >
          {title ?? TOP_BAR_LABELS.untitled}
        </Heading>
        <DocumentControls compact={compact} />

        <div className="flex-1" />
        {compact ? (
          <>
            {counts}
            <DiagramOptionsMenu
              direction={direction}
              nodeStyle={nodeStyle}
              disabled={disabled}
              visibility={phone ? null : visibility}
            />
          </>
        ) : (
          <>
            {visibility ? <CanvasOnlyToggle visibility={visibility} /> : null}
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
        )}
        {/* Wave 3: every item's top-bar component is always mounted (it may own dialogs and
          listeners) and takes `compact`: it shows its controls only in the wide bar, and its
          entries in the compact bar come from its own menu-items part in DiagramOptionsMenu. */}

        <LayoutControls disabled={disabled} compact={compact} />

        <ExportMenu compact={compact} />

        <InteractionControls compact={compact} />

        {compact ? null : <InspectorToggle open={inspectorOpen} />}
        {compact ? null : counts}
        {/* The library's family layout, as the website shows it: pick the brand, then light,
          dark or system. The character count that sat here is gone (maintainer ruling
          2026-09-27: it told the reader nothing). */}
        <WithTooltip label={TOP_BAR_LABELS.theme}>
          <ThemeSwitcher variant="ghost" size="sm" />
        </WithTooltip>
      </header>
    </TooltipProvider>
  );
}

/**
 * "Canvas only": a pressed toggle with a stable name (`aria-pressed` carries the state; a
 * name that flips between "Hide editor" and "Show editor" would announce the opposite of
 * the pressed state), icon-only with the name as its tooltip. The glyph flips as a second,
 * non-colour cue.
 */
function CanvasOnlyToggle({ visibility }: { visibility: EditorVisibility }) {
  const { canvasOnly, setCanvasOnly } = visibility;
  return (
    <WithTooltip label={TOP_BAR_LABELS.canvasOnly}>
      <Toggle variant="outline" size="sm" pressed={canvasOnly} onPressedChange={setCanvasOnly}>
        {canvasOnly ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
      </Toggle>
    </WithTooltip>
  );
}

/**
 * DG-14's inspector switch: a pressed toggle like "Canvas only", icon-only with the name as
 * its tooltip. The glyph flips as a second, non-colour cue (wave-3 review F3).
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

interface DiagramOptionsMenuProps {
  direction: string | undefined;
  nodeStyle: string | undefined;
  disabled: boolean;
  /** The "Canvas only" switch, when the split layout shows it (not on phones: tabs there). */
  visibility: EditorVisibility | null;
}

/**
 * The compact top bar's controls, behind one icon button (wave-2 review m7): the same
 * actions as the wide bar (each wave-3 item adds its own entries in its slot).
 * P4: library gap — ui has no responsive toolbar that folds its overflow into a menu.
 */
function DiagramOptionsMenu({
  direction,
  nodeStyle,
  disabled,
  visibility,
}: DiagramOptionsMenuProps) {
  const inspectorOpen = useDiagram((s) => s.inspectorOpen); // DG-14
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={TOP_BAR_LABELS.options}>
          <EllipsisVertical aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      {/* Wave 3 makes the menu taller than a short window: it scrolls within the room Radix
          measures. P4: library gap — ui's DropdownMenuContent clips (`overflow-hidden`, no
          max height); docs/findings/DG-14-inspector-write-back.md. `collisionPadding` keeps
          it 8 px off the window's edges (wave-3 review m3). */}
      <DropdownMenuContent
        align="end"
        collisionPadding={8}
        className="max-h-(--radix-dropdown-menu-content-available-height) overflow-y-auto"
      >
        <DocumentMenuItems />

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
        {visibility ? (
          <DropdownMenuCheckboxItem
            checked={visibility.canvasOnly}
            onCheckedChange={visibility.setCanvasOnly}
          >
            {TOP_BAR_LABELS.canvasOnly}
          </DropdownMenuCheckboxItem>
        ) : null}
        {/* DG-14 */}
        <DropdownMenuCheckboxItem
          checked={inspectorOpen}
          onCheckedChange={editActions.setInspectorOpen}
        >
          {TOP_BAR_LABELS.inspector}
        </DropdownMenuCheckboxItem>

        <LayoutMenuItems disabled={disabled} />

        <ExportMenuItems />

        <InteractionMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
