import { EllipsisVertical, PanelLeftClose, PanelLeftOpen, PanelRight } from "lucide-react";
import {
  Badge,
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
  Heading,
  IconButton,
  SidebarTrigger,
  StatusBadge,
  ThemeSwitcher,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  useIsMobile,
} from "@elabs-ai/components-ui";
import { SEVERITY_STATUS } from "../panes/issues-panel";
import { diagramActions, editActions, useDiagram } from "../state/diagram-store";
import { useEditorVisibility, type EditorVisibility } from "./editor-visibility";
// Wave 3: one import line per item under its marker; blank lines keep parallel merges clean.

// DG-15 import slot

// DG-16 import slot

import { ExportMenu, ExportMenuItems } from "../io/export-menu"; // DG-17

// DG-18 import slot

/** The top bar's strings, in one place (`conventions/i18n-strings`). */
const TOP_BAR_LABELS = {
  untitled: "Untitled diagram",
  direction: "Direction",
  lr: "LR",
  leftToRight: "LR, left to right",
  tb: "TB",
  topToBottom: "TB, top to bottom",
  nodeStyle: "Node style",
  icons: "Icons",
  cards: "Cards",
  autoLayout: "Auto layout",
  inspector: "Inspector",
  canvasOnly: "Canvas only",
  options: "Diagram options",
  chars: (count: number) => `${count} chars`,
  errors: (count: number) => (count === 1 ? "1 error" : `${count} errors`),
  warnings: (count: number) => (count === 1 ? "1 warning" : `${count} warnings`),
} as const;

/**
 * Below this width the diagram controls fold into one "Diagram options" menu (wave-2 review
 * m7). With every wave-3 control in (DG-14…DG-18) the row's controls, gaps and padding
 * measured 1,195 px beside the 48 px icon rail (light theme, lakehouse example), so from
 * 1,440 px the heading keeps at least 12rem. The controls never shrink (the header's
 * `shrink-0` children): only the heading truncates.
 */
const COMPACT_BELOW = 1440;

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
  const manual = useDiagram((s) => s.compiled.ast?.layout === "manual");
  const length = useDiagram((s) => s.text.length);
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
      {/* DG-16 slot: undo, redo and the File menu */}

      <div className="flex-1" />
      {compact ? (
        <>
          {counts}
          <DiagramOptionsMenu
            direction={direction}
            nodeStyle={nodeStyle}
            disabled={disabled}
            manual={manual}
            length={length}
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
            <ToggleGroupItem value="LR" aria-label={TOP_BAR_LABELS.leftToRight}>
              {TOP_BAR_LABELS.lr}
            </ToggleGroupItem>
            <ToggleGroupItem value="TB" aria-label={TOP_BAR_LABELS.topToBottom}>
              {TOP_BAR_LABELS.tb}
            </ToggleGroupItem>
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
            <ToggleGroupItem value="icon">{TOP_BAR_LABELS.icons}</ToggleGroupItem>
            <ToggleGroupItem value="card">{TOP_BAR_LABELS.cards}</ToggleGroupItem>
          </ToggleGroup>
        </>
      )}
      {/* Wave 3: every item's top-bar component is always mounted (it may own dialogs and
          listeners) and takes `compact`: it shows its controls only in the wide bar, and its
          entries in the compact bar come from its own menu-items part in DiagramOptionsMenu. */}

      {/* DG-15 replaces the Auto layout button below with its layout controls. */}
      {compact ? null : (
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || manual}
          onClick={diagramActions.requestLayout}
        >
          {TOP_BAR_LABELS.autoLayout}
        </Button>
      )}

      <ExportMenu compact={compact} />

      {/* DG-18 slot: collapse all, expand all, present */}

      {compact ? null : (
        <IconButton
          label={TOP_BAR_LABELS.inspector}
          icon={<PanelRight />}
          variant="ghost"
          size="icon-sm"
          aria-pressed={inspectorOpen}
          onClick={() => editActions.setInspectorOpen(!inspectorOpen)}
        />
      )}
      {compact ? null : (
        <>
          {counts}
          {/* A character count carries no status meaning: an outline Badge, not StatusBadge (DG-02 ruling). */}
          <Badge variant="outline" className="tabular-nums">
            {TOP_BAR_LABELS.chars(length)}
          </Badge>
        </>
      )}
      <ThemeSwitcher mode="dropdown" variant="ghost" size="sm" />
    </header>
  );
}

/**
 * "Canvas only": a pressed toggle with a stable name (`aria-pressed` carries the state; a
 * name that flips between "Hide editor" and "Show editor" would announce the opposite of
 * the pressed state). The glyph flips as a second, non-colour cue.
 */
function CanvasOnlyToggle({ visibility }: { visibility: EditorVisibility }) {
  const { canvasOnly, setCanvasOnly } = visibility;
  return (
    <Toggle variant="outline" size="sm" pressed={canvasOnly} onPressedChange={setCanvasOnly}>
      {canvasOnly ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
      {TOP_BAR_LABELS.canvasOnly}
    </Toggle>
  );
}

interface DiagramOptionsMenuProps {
  direction: string | undefined;
  nodeStyle: string | undefined;
  disabled: boolean;
  manual: boolean;
  length: number;
  /** The "Canvas only" switch, when the split layout shows it (not on phones: tabs there). */
  visibility: EditorVisibility | null;
}

/**
 * The compact top bar's controls, behind one icon button (wave-2 review m7): the same
 * actions as the wide bar (each wave-3 item adds its own entries in its slot) and the
 * character count as a label.
 * P4: library gap — ui has no responsive toolbar that folds its overflow into a menu.
 */
function DiagramOptionsMenu({
  direction,
  nodeStyle,
  disabled,
  manual,
  length,
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
          max height); docs/findings/DG-14-inspector-write-back.md. */}
      <DropdownMenuContent
        align="end"
        className="max-h-(--radix-dropdown-menu-content-available-height) overflow-y-auto"
      >
        {/* DG-16 menu slot: open, save, share */}

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

        {/* DG-15 replaces the Auto layout item below with its layout items. */}
        <DropdownMenuItem disabled={disabled || manual} onSelect={diagramActions.requestLayout}>
          {TOP_BAR_LABELS.autoLayout}
        </DropdownMenuItem>

        <ExportMenuItems />

        {/* DG-18 menu slot: collapse all, expand all, present */}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-normal tabular-nums">
          {TOP_BAR_LABELS.chars(length)}
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
