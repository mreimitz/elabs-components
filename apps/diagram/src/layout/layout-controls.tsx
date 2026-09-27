/**
 * DG-15 — the top bar's layout controls: Auto | Manual (the YAML `layout` key), one
 * layout button ("Auto layout" re-runs ELK; under manual, "Re-layout" runs it once and
 * writes the positions) and the two confirmations. Every change is a text edit. The
 * compact top bar shows the same actions in its options menu (`LayoutMenuItems`).
 */
import {
  Button,
  ConfirmDialog,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  ToggleGroup,
  ToggleGroupItem,
} from "@elabs-ai/components-ui";
import { diagramActions, editActions, useDiagram } from "../state/diagram-store";
import { layoutBridge, useLayoutPrompt } from "./layout-bridge";
import { autoEdit } from "./layout-edits";

/** The controls' strings, in one place (`conventions/i18n-strings`). */
const LAYOUT_LABELS = {
  layout: "Layout",
  auto: "Auto",
  manual: "Manual",
  autoLayout: "Auto layout",
  relayout: "Re-layout",
  firstDragTitle: "Switch to manual layout?",
  firstDragBody:
    "Under auto layout the diagram is laid out for you and a drag is not kept. Manual layout writes every position into the YAML, so the diagram stays where you put it.",
  firstDragConfirm: "Switch to manual",
  firstDragCancel: "Put it back",
  toAutoTitle: "Switch to auto layout?",
  toAutoBody: "Every position is removed from the YAML and the diagram is laid out again.",
  toAutoConfirm: "Remove positions",
} as const;

/** Auto | Manual. To manual writes every position now; back to auto asks first. */
function chooseLayout(value: string, manual: boolean) {
  if (value === "manual" && !manual) layoutBridge.toManual();
  if (value === "auto" && manual) layoutBridge.ask("to-auto");
}

function useManual(): boolean {
  return useDiagram((s) => s.compiled.ast?.layout === "manual");
}

export interface LayoutControlsProps {
  /** The text is not a diagram: nothing to lay out. */
  disabled: boolean;
  /** The compact top bar: only the dialogs render; the actions are in its options menu. */
  compact: boolean;
}

/**
 * Always mounted: the first-drag prompt comes from the canvas, whichever bar is showing.
 */
export function LayoutControls({ disabled, compact }: LayoutControlsProps) {
  const manual = useManual();
  const prompt = useLayoutPrompt();

  return (
    <>
      {compact ? null : (
        <>
          <ToggleGroup
            type="single"
            variant="segmented"
            size="sm"
            aria-label={LAYOUT_LABELS.layout}
            value={disabled ? "" : manual ? "manual" : "auto"}
            disabled={disabled}
            onValueChange={(value) => chooseLayout(value, manual)}
          >
            <ToggleGroupItem value="auto">{LAYOUT_LABELS.auto}</ToggleGroupItem>
            <ToggleGroupItem value="manual">{LAYOUT_LABELS.manual}</ToggleGroupItem>
          </ToggleGroup>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={manual ? layoutBridge.relayout : diagramActions.requestLayout}
          >
            {manual ? LAYOUT_LABELS.relayout : LAYOUT_LABELS.autoLayout}
          </Button>
        </>
      )}
      <ConfirmDialog
        open={prompt === "first-drag"}
        onOpenChange={(open) => {
          if (!open) layoutBridge.answerFirstDrag(false);
        }}
        title={LAYOUT_LABELS.firstDragTitle}
        description={LAYOUT_LABELS.firstDragBody}
        confirmLabel={LAYOUT_LABELS.firstDragConfirm}
        cancelLabel={LAYOUT_LABELS.firstDragCancel}
        onConfirm={() => layoutBridge.answerFirstDrag(true)}
      />
      <ConfirmDialog
        open={prompt === "to-auto"}
        onOpenChange={(open) => {
          if (!open) layoutBridge.ask(null);
        }}
        tone="destructive"
        title={LAYOUT_LABELS.toAutoTitle}
        description={LAYOUT_LABELS.toAutoBody}
        confirmLabel={LAYOUT_LABELS.toAutoConfirm}
        onConfirm={() => {
          layoutBridge.ask(null);
          editActions.applyEdit(autoEdit);
        }}
      />
    </>
  );
}

/** The compact top bar's layout entries, inside its options menu (top-bar.tsx). */
export function LayoutMenuItems({ disabled }: { disabled: boolean }) {
  const manual = useManual();
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>{LAYOUT_LABELS.layout}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        aria-label={LAYOUT_LABELS.layout}
        value={disabled ? "" : manual ? "manual" : "auto"}
        onValueChange={(value) => chooseLayout(value, manual)}
      >
        <DropdownMenuRadioItem value="auto" disabled={disabled}>
          {LAYOUT_LABELS.auto}
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="manual" disabled={disabled}>
          {LAYOUT_LABELS.manual}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      {/* `inset`: its text starts where the radio items' does (wave-3 review m3). */}
      <DropdownMenuItem
        inset
        disabled={disabled}
        onSelect={manual ? layoutBridge.relayout : diagramActions.requestLayout}
      >
        {manual ? LAYOUT_LABELS.relayout : LAYOUT_LABELS.autoLayout}
      </DropdownMenuItem>
    </>
  );
}
