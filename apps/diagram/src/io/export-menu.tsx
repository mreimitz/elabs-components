/**
 * DG-17 — the top bar's Export menu: PNG at 1×, 2× or 3×, SVG, and Copy as PNG, with an
 * option to leave the canvas colour out. One toast follows each export from "Exporting…"
 * to its result. The compact top bar shows the same items as a submenu of its options
 * menu (`ExportMenuItems`); on a phone, where a submenu fits on neither side of the menu,
 * as a labelled group inside it.
 */
import { useSyncExternalStore } from "react";
import { Copy, FileCode, ImageDown, Share } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  toast,
  useIsMobile,
} from "@elabs-ai/components-ui";
import { useEditorVisibility } from "../shell/editor-visibility";
import { WithTooltip } from "../shell/with-tooltip";
import { createStore } from "../state/create-store";
import { diagramStore, useDiagram } from "../state/diagram-store";
import {
  canvasDrawn,
  pictureFileName,
  pictureOfCanvas,
  pngBlob,
  saveBlob,
  svgBlob,
  type PictureScale,
} from "./export";

/**
 * n9: a `graph` with zero nodes (the "Nothing to draw yet" empty document) is as undrawable
 * as no graph at all — both disable Export the same way `canvas-pane.tsx` disables Edit's
 * neighbour, Present (`interaction-controls.tsx`).
 */
function useHasGraph(): boolean {
  return useDiagram((s) => (s.drawn.graph?.nodes.length ?? 0) > 0);
}

/** The menu's strings, in one place (`conventions/i18n-strings`). */
const EXPORT_LABELS = {
  export: "Export",
  png: (scale: PictureScale) => `PNG ${scale}×`,
  svg: "SVG",
  copyPng: "Copy as PNG",
  publish: "Interactive HTML",
  offline: "One offline, read-only file. Notes and metrics are excluded.",
  privacy: "Notes and metrics are excluded.",
  transparent: "Transparent background",
  exporting: "Exporting…",
  saved: (name: string) => `Saved ${name}`,
  copied: "Picture copied",
  pixels: (width: number, height: number) => `${width} × ${height} px`,
  svgDetail: "Opens in any browser; slide tools draw it blank, so use PNG for slides.",
  failed: "Could not export the diagram",
} as const;

const SCALES: readonly PictureScale[] = [1, 2, 3];

/** Copy as PNG draws at this scale: sharp on a slide, small enough to paste anywhere. */
const COPY_SCALE: PictureScale = 2;

/** One toast per export: "Exporting…" until `work` settles, then its result. */
async function reported<T>(
  work: Promise<T>,
  success: (result: T) => { message: string; description?: string },
) {
  const id = toast.loading(EXPORT_LABELS.exporting);
  try {
    const { message, description } = success(await work);
    toast.success(message, { id, description });
  } catch (error) {
    toast.error(EXPORT_LABELS.failed, {
      id,
      description: error instanceof Error ? error.message : undefined,
    });
  }
}

/** "Transparent background": one choice for both bars, kept until the page reloads. */
const exportOptions = createStore({ transparent: false });

function useTransparent(): boolean {
  return useSyncExternalStore(exportOptions.subscribe, () => exportOptions.get().transparent);
}

function title() {
  return diagramStore.get().compiled.ast?.title;
}

function picture() {
  return canvasDrawn().then(() =>
    pictureOfCanvas(title(), { transparent: exportOptions.get().transparent }),
  );
}

function savePng(scale: PictureScale) {
  const name = pictureFileName(title(), "png");
  const png = picture().then((p) => pngBlob(p, scale));
  void reported(
    png.then((r) => {
      saveBlob(r.blob, name);
      return r;
    }),
    (r) => ({
      message: EXPORT_LABELS.saved(name),
      description: EXPORT_LABELS.pixels(r.width, r.height),
    }),
  );
}

function saveSvg() {
  const name = pictureFileName(title(), "svg");
  void reported(
    picture().then((p) => saveBlob(svgBlob(p), name)),
    () => ({ message: EXPORT_LABELS.saved(name), description: EXPORT_LABELS.svgDetail }),
  );
}

function publishHtml() {
  void reported(
    import("./publish").then(({ publishDiagram }) => publishDiagram()),
    (result) => ({ message: EXPORT_LABELS.saved(result.name), description: EXPORT_LABELS.offline }),
  );
}

function copyPng() {
  const png = picture().then((p) => pngBlob(p, COPY_SCALE));
  // The item is built now, inside the click, with a promise for its data: Safari
  // accepts a clipboard write only while the gesture is still running.
  const item = new ClipboardItem({ "image/png": png.then((r) => r.blob) });
  void reported(
    navigator.clipboard.write([item]).then(() => png),
    (r) => ({
      message: EXPORT_LABELS.copied,
      description: EXPORT_LABELS.pixels(r.width, r.height),
    }),
  );
}

/** Nothing to do before an export: the canvas is on screen. */
const NOTHING = () => {};

/**
 * The export items, in the wide bar's menu, the compact bar's submenu or the phone's group.
 * `disabled`: nothing is drawn (the group has no trigger that could carry it).
 * `showCanvas`: runs first, inside the click — the phone's Editor tab opens the Canvas tab,
 * and the export waits for it to draw (`canvasDrawn`).
 */
function ExportItems({
  disabled = false,
  showCanvas = NOTHING,
}: {
  disabled?: boolean;
  showCanvas?: () => void;
}) {
  const transparent = useTransparent();
  const canCopy = typeof ClipboardItem !== "undefined" && Boolean(navigator.clipboard?.write);
  const withCanvas = (run: () => void) => () => {
    showCanvas();
    run();
  };
  return (
    <>
      {SCALES.map((scale) => (
        <DropdownMenuItem
          key={scale}
          disabled={disabled}
          onSelect={withCanvas(() => savePng(scale))}
        >
          <ImageDown aria-hidden="true" />
          {EXPORT_LABELS.png(scale)}
        </DropdownMenuItem>
      ))}
      <DropdownMenuItem disabled={disabled} onSelect={withCanvas(saveSvg)}>
        <FileCode aria-hidden="true" />
        {EXPORT_LABELS.svg}
      </DropdownMenuItem>
      <DropdownMenuItem disabled={disabled} onSelect={publishHtml}>
        <FileCode aria-hidden="true" />
        {EXPORT_LABELS.publish}
      </DropdownMenuItem>
      <DropdownMenuLabel className="max-w-64 whitespace-normal text-muted-foreground">
        {EXPORT_LABELS.privacy}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={disabled || !canCopy} onSelect={withCanvas(copyPng)}>
        <Copy aria-hidden="true" />
        {EXPORT_LABELS.copyPng}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem
        checked={transparent}
        onCheckedChange={(checked) => exportOptions.set({ transparent: checked === true })}
        // An option, not an action: the menu stays open.
        onSelect={(event) => event.preventDefault()}
      >
        {EXPORT_LABELS.transparent}
      </DropdownMenuCheckboxItem>
    </>
  );
}

export interface ExportMenuProps {
  /** The compact top bar: nothing here; the items are in its options menu. */
  compact: boolean;
}

export function ExportMenu({ compact }: ExportMenuProps) {
  const drawn = useHasGraph();
  if (compact) return null;
  return (
    <DropdownMenu>
      <WithTooltip label={EXPORT_LABELS.export}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" disabled={!drawn}>
            <Share aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
      </WithTooltip>
      <DropdownMenuContent align="end">
        <ExportItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The compact top bar's Export entries, inside its options menu (top-bar.tsx): a submenu,
 * or on a phone a labelled group, since a submenu there fits on neither side of the menu
 * and was cut at the screen edge (wave-3 review F10).
 * P4: library gap — ui's sub-menu cannot open inline (docs/findings/DG-17-export.md §11).
 */
export function ExportMenuItems() {
  const drawn = useHasGraph();
  const phone = useIsMobile();
  const visibility = useEditorVisibility();
  if (phone) {
    return (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{EXPORT_LABELS.export}</DropdownMenuLabel>
        <DropdownMenuGroup aria-label={EXPORT_LABELS.export}>
          <ExportItems
            disabled={!drawn}
            // The Editor tab does not mount the canvas (app.tsx `PhoneWorkspace`).
            showCanvas={() => visibility?.setCanvasOnly(true)}
          />
        </DropdownMenuGroup>
      </>
    );
  }
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        {/* P4: library gap — no icon: ui's sub-trigger does not size one
            (docs/findings/DG-17-export.md §9). `inset` lines its text up with the
            icon, radio and checkbox items' (wave-3 review m3). */}
        <DropdownMenuSubTrigger inset disabled={!drawn}>
          {EXPORT_LABELS.export}
        </DropdownMenuSubTrigger>
        {/* The same 8 px margin from the window's edges as the options menu. */}
        <DropdownMenuSubContent collisionPadding={8}>
          <ExportItems />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
}
