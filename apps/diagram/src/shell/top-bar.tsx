import {
  Badge,
  Button,
  SidebarTrigger,
  StatusBadge,
  ThemeSwitcher,
  ToggleGroup,
  ToggleGroupItem,
} from "@elabs-ai/components-ui";
import { SEVERITY_STATUS } from "../panes/issues-panel";
import { diagramActions, useDiagram } from "../state/diagram-store";

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
  chars: (count: number) => `${count} chars`,
  errors: (count: number) => (count === 1 ? "1 error" : `${count} errors`),
  warnings: (count: number) => (count === 1 ? "1 warning" : `${count} warnings`),
} as const;

/**
 * The dashboard shell's top bar (plan §6). DG-12 wires direction, node style and "Auto
 * layout" to the store; the toggles rewrite the text (plan D2). "Export" stays disabled
 * until DG-17.
 */
export function TopBar() {
  const title = useDiagram((s) => s.compiled.ast?.title);
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

  return (
    <header className="flex h-header items-center gap-2 border-b px-4">
      <SidebarTrigger />
      <h1 className="min-w-0 truncate text-body font-medium">{title ?? TOP_BAR_LABELS.untitled}</h1>
      <div className="flex-1" />
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
      {errors > 0 ? (
        <StatusBadge status={SEVERITY_STATUS.error}>{TOP_BAR_LABELS.errors(errors)}</StatusBadge>
      ) : null}
      {warnings > 0 ? (
        <StatusBadge status={SEVERITY_STATUS.warning}>
          {TOP_BAR_LABELS.warnings(warnings)}
        </StatusBadge>
      ) : null}
      {/* A character count carries no status meaning: an outline Badge, not StatusBadge (DG-02 ruling). */}
      <Badge variant="outline" className="tabular-nums">
        {TOP_BAR_LABELS.chars(length)}
      </Badge>
      <ThemeSwitcher mode="dropdown" variant="ghost" size="sm" />
    </header>
  );
}
