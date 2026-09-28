import { useSyncExternalStore } from "react";
import { LayoutTemplate } from "lucide-react";
import { DiffEditor } from "@elabs-ai/components-editor";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenuItem,
  Text,
  useIsMobile,
} from "@elabs-ai/components-ui";
import { historyActions } from "../state/history";
import { createStore } from "../state/create-store";
import { diagramStore, editActions, useDiagram } from "../state/diagram-store";
import { currentMode, useDocMode } from "../shell/mode-store";
import { lensStore, useLens } from "../shell/lens-store";
import { currentComponentFiles } from "../state/component-files";
import { catalogVersion } from "../catalog/catalog-bundle";
import { WithTooltip } from "../shell/with-tooltip";
import { useResolvedStyle } from "../style/react-style";
import type { ResolvedStyle } from "../style/types";
import { visualSnapshot } from "./snapshot";
import { materializeVisual } from "./materialize";

const LABELS = {
  action: "Visual layout",
  title: "Save a visual layout",
  reset: "Rebuild the visual layout",
  description:
    "Review the layout before saving. You can then customize its boxes, lanes and processes in YAML.",
  resetDescription:
    "This replaces the hand-tuned visual layout with a fresh layout from the technical diagram. Review the changes before applying.",
  stale: "The diagram changed. Close this preview and open it again to review the latest layout.",
  unchanged: "The visual layout already matches the diagram.",
  cancel: "Cancel",
  apply: "Apply layout",
  preview: "Visual layout changes",
} as const;
interface Preview {
  original: string;
  modified: string;
  path: string | null;
  load: number;
  files: ReturnType<typeof currentComponentFiles>;
  catalog: number;
  replace: boolean;
  styleKey: string;
  error?: string;
}
const previewStore = createStore<{ preview: Preview | null }>({ preview: null });
const close = () => previewStore.set({ preview: null });
function editable() {
  const lens = lensStore.get();
  return currentMode() === "edit" && lens.position === 0 && lens.target === "technical";
}
function requestPreview(style: ResolvedStyle) {
  const current = diagramStore.get();
  if (
    !editable() ||
    !current.compiled.ok ||
    current.compiledText !== current.text ||
    !current.compiled.ast
  )
    return;
  const ast = current.compiled.ast;
  const derived = visualSnapshot({ ...ast, visual: undefined }, style.hero, style.visual);
  const problem = derived.issues.find((issue) => issue.severity === "error");
  const result = problem
    ? { ok: false as const, reason: problem.message }
    : materializeVisual(current.text, derived.lens);
  previewStore.set({
    preview: {
      original: current.text,
      modified: result.ok ? result.text : current.text,
      path: current.path,
      load: current.loadCount,
      files: currentComponentFiles(),
      catalog: catalogVersion(),
      replace: ast.visual !== undefined,
      styleKey: JSON.stringify([style.hero, style.visual]),
      ...(!result.ok ? { error: result.reason } : {}),
    },
  });
}
export function VisualLayoutMenuItem({ disabled = false }: { disabled?: boolean }) {
  const style = useResolvedStyle(useDiagram((s) => s.drawn.ast));
  const ready = useDiagram((s) => s.compiled.ok && s.compiledText === s.text);
  return (
    <DropdownMenuItem disabled={disabled || !ready} onSelect={() => requestPreview(style)}>
      <LayoutTemplate aria-hidden="true" />
      {LABELS.action}
    </DropdownMenuItem>
  );
}
export function VisualLayoutControls({
  compact = false,
  disabled = false,
}: {
  compact?: boolean;
  disabled?: boolean;
}) {
  const { preview } = useSyncExternalStore(previewStore.subscribe, previewStore.get);
  const state = useDiagram((s) => s);
  const style = useResolvedStyle(state.drawn.ast);
  const mode = useDocMode();
  const position = useLens((s) => s.position);
  const mobile = useIsMobile();
  const stale =
    preview !== null &&
    (preview.styleKey !== JSON.stringify([style.hero, style.visual]) ||
      state.text !== preview.original ||
      state.path !== preview.path ||
      state.loadCount !== preview.load ||
      currentComponentFiles() !== preview.files ||
      catalogVersion() !== preview.catalog ||
      mode !== "edit" ||
      position !== 0);
  const changed = preview && preview.original !== preview.modified;
  const apply = () => {
    if (!preview || stale || !editable()) return;
    const applied = historyActions.transaction(() =>
      editActions.applyEdit((text) => (text === preview.original ? preview.modified : null)),
    );
    if (applied) close();
  };
  return (
    <>
      {!compact ? (
        <WithTooltip label={LABELS.action}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={LABELS.action}
            disabled={disabled || !state.compiled.ok || state.compiledText !== state.text}
            onClick={() => requestPreview(style)}
          >
            <LayoutTemplate aria-hidden="true" />
          </Button>
        </WithTooltip>
      ) : null}
      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{preview?.replace ? LABELS.reset : LABELS.title}</DialogTitle>
            <DialogDescription>
              {preview?.replace ? LABELS.resetDescription : LABELS.description}
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <DiffEditor
              original={preview.original}
              modified={preview.modified}
              language="yaml"
              readOnly
              renderSideBySide={!mobile}
              height="min(55dvh, 32rem)"
              ariaLabel={LABELS.preview}
            />
          ) : null}
          {stale || preview?.error || !changed ? (
            <Text role="status" variant="meta">
              {stale ? LABELS.stale : (preview?.error ?? LABELS.unchanged)}
            </Text>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              {LABELS.cancel}
            </Button>
            <Button disabled={stale || !!preview?.error || !changed} onClick={apply}>
              {LABELS.apply}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
