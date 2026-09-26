/**
 * DG-17 — the top bar's Export menu: PNG at 1×, 2× or 3×, SVG, and Copy as PNG, with an
 * option to leave the canvas colour out. One toast follows each export from "Exporting…"
 * to its result. The compact top bar shows the same items as a submenu of its options
 * menu (`ExportMenuItems`).
 */
import { useSyncExternalStore } from "react";
import { ChevronDown, Copy, FileCode, ImageDown } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  toast,
} from "@elabs-ai/components-ui";
import { createStore } from "../state/create-store";
import { diagramStore, useDiagram } from "../state/diagram-store";
import {
  pictureFileName,
  pictureOfCanvas,
  pngBlob,
  saveBlob,
  svgBlob,
  type PictureScale,
} from "./export";

/** The menu's strings, in one place (`conventions/i18n-strings`). */
const EXPORT_LABELS = {
  export: "Export",
  png: (scale: PictureScale) => `PNG ${scale}×`,
  svg: "SVG",
  copyPng: "Copy as PNG",
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
  return pictureOfCanvas(title(), { transparent: exportOptions.get().transparent });
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

/** The export items, in the wide bar's menu or the compact bar's submenu. */
function ExportItems() {
  const transparent = useTransparent();
  const canCopy = typeof ClipboardItem !== "undefined" && Boolean(navigator.clipboard?.write);
  return (
    <>
      {SCALES.map((scale) => (
        <DropdownMenuItem key={scale} onSelect={() => savePng(scale)}>
          <ImageDown aria-hidden="true" />
          {EXPORT_LABELS.png(scale)}
        </DropdownMenuItem>
      ))}
      <DropdownMenuItem onSelect={saveSvg}>
        <FileCode aria-hidden="true" />
        {EXPORT_LABELS.svg}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={!canCopy} onSelect={copyPng}>
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
  const drawn = useDiagram((s) => Boolean(s.drawn.graph));
  if (compact) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={!drawn}>
          {EXPORT_LABELS.export}
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <ExportItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The compact top bar's Export submenu, inside its options menu (top-bar.tsx). */
export function ExportMenuItems() {
  const drawn = useDiagram((s) => Boolean(s.drawn.graph));
  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        {/* P4: library gap — no icon: ui's sub-trigger does not size one
            (docs/findings/DG-17-export.md §9). */}
        <DropdownMenuSubTrigger disabled={!drawn}>{EXPORT_LABELS.export}</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <ExportItems />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
}
