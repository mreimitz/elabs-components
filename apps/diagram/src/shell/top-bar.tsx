import { EllipsisVertical, PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
  SidebarTrigger,
  StatusBadge,
  ThemeSwitcher,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  useIsMobile,
} from "@elabs-ai/components-ui";
import { SEVERITY_STATUS } from "../panes/issues-panel";
import { diagramActions, useDiagram } from "../state/diagram-store";
import { useEditorVisibility, type EditorVisibility } from "./editor-visibility";

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
  export: "Export",
  canvasOnly: "Canvas only",
  options: "Diagram options",
  chars: (count: number) => `${count} chars`,
  errors: (count: number) => (count === 1 ? "1 error" : `${count} errors`),
  warnings: (count: number) => (count === 1 ? "1 warning" : `${count} warnings`),
} as const;

/**
 * Below this width the diagram controls fold into one "Diagram options" menu (wave-2 review
 * m7). Wider than `md` on purpose: the full row needs about 900 px beside the icon rail.
 */
const COMPACT_BELOW = 1024;

/**
 * The dashboard shell's top bar (plan §6). DG-12 wires direction, node style and "Auto
 * layout" to the store; the toggles rewrite the text (plan D2). "Export" stays disabled
 * until DG-17. "Canvas only" hides the editor (wave-2 review M1). Below `COMPACT_BELOW` the
 * controls move into a menu; the heading, the issue counts and the theme stay in the bar.
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
    <header className="flex h-header items-center gap-2 border-b px-4">
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
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || manual}
            onClick={diagramActions.requestLayout}
          >
            {TOP_BAR_LABELS.autoLayout}
          </Button>
          <Button variant="outline" size="sm" disabled>
            {TOP_BAR_LABELS.export}
          </Button>
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
 * The compact top bar's controls, behind one icon button (wave-2 review m7). The same
 * actions as the wide bar: radio groups for direction and node style, the Canvas-only
 * checkbox, Auto layout, Export (disabled until DG-17), and the character count as a label.
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={TOP_BAR_LABELS.options}>
          <EllipsisVertical aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
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
        <DropdownMenuItem disabled={disabled || manual} onSelect={diagramActions.requestLayout}>
          {TOP_BAR_LABELS.autoLayout}
        </DropdownMenuItem>
        <DropdownMenuItem disabled>{TOP_BAR_LABELS.export}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-normal tabular-nums">
          {TOP_BAR_LABELS.chars(length)}
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
