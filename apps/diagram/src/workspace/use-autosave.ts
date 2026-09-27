/**
 * DG-21 — autosave (plan V6: the file is the truth). 800 ms after the last change to the
 * editor text, the open file is written through `PUT /api/workspace/file`, whether or not the
 * text compiles; only the thumbnail waits for a clean compile. A write is refused (409) when
 * the file changed on disk since this tab read it; then the person picks Reload or Keep. A
 * failed write toasts once, until a write succeeds again. Success shows nothing here; DG-22
 * puts a quiet "Saved" in the top bar from `workspaceStore` (`save`, `savedAt`).
 *
 * Thumbnail (step 8, plan §9.2): after a successful save with a clean compile, the canvas is
 * rendered through DG-17's exporter, fitted into 480×270, rasterised, and saved beside the
 * diagram as `<name>.thumb.png`, at most once every 10 s (a later save waits for the slot).
 * A PNG, not the exporter's SVG: the SVG inlines fonts and icons (180–280 KB a file), and
 * thumbnails are committed with the diagrams (maintainer, 2026-09-27: "make them small").
 */
import { useEffect } from "react";
import { toast } from "@elabs-ai/components-ui";
import { resolveThemeIsDark } from "@elabs-ai/components-tokens";
import { pictureOfCanvas, pngBlob, type Picture, type PictureScale } from "../io/export";
import { diagramStore } from "../state/diagram-store";
import { viewOverrideActions } from "../shell/view-overrides-store"; // view mode overrides (maintainer 2026-09-27)
import { writeThumb } from "./client";
import { askAboutDiskChange, tellFileGone } from "./live-reload";
import { workspaceActions, workspaceStore } from "./workspace-store";

/** Plan V6: debounced. */
export const AUTOSAVE_DELAY_MS = 800;
/** At most one thumbnail per this interval. */
export const THUMB_INTERVAL_MS = 10_000;
/** Plan §3.2: Home's recents cards. */
export const THUMB_WIDTH = 480;
export const THUMB_HEIGHT = 270;
/** PNG pixels per CSS pixel of the thumbnail. */
export const THUMB_SCALE: PictureScale = 1;

/** The strings, in one place (`conventions/i18n-strings`). */
const AUTOSAVE_LABELS = {
  failed: (path: string) => `Could not save “${path}”`,
  failedDetail: (reason: string) => `${reason} Your text is still here; the next edit tries again.`,
} as const;

/**
 * The picture, scaled to fit `THUMB_WIDTH`×`THUMB_HEIGHT` (its `viewBox` keeps the ratio).
 * The embedded fonts stay: they cost nothing once rasterised, and the text keeps its face.
 */
export function thumbnailPicture(picture: Picture): Picture {
  const end = picture.svg.indexOf(">");
  const open = picture.svg
    .slice(0, end)
    .replace(/\swidth="[^"]*"/, ` width="${THUMB_WIDTH}"`)
    .replace(/\sheight="[^"]*"/, ` height="${THUMB_HEIGHT}"`);
  return {
    svg: `${open} preserveAspectRatio="xMidYMid meet"${picture.svg.slice(end)}`,
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
  };
}

/** The thumbnail as a `data:image/png;base64,…` URL (the body `POST /thumb` takes). */
export async function thumbnailPng(picture: Picture): Promise<string> {
  const { blob } = await pngBlob(thumbnailPicture(picture), THUMB_SCALE);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("The thumbnail could not be read."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Subscribe to the diagram store; returns the cleanup (a pending save is flushed, not lost).
 * Also keeps `workspaceStore.dirty` and `current` in step with the document.
 */
export function installAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let thumbTimer: ReturnType<typeof setTimeout> | undefined;
  let lastThumbAt = 0;
  let failed = false;
  let { text: lastText, path: lastPath } = diagramStore.get();

  async function makeThumb(path: string, text: string) {
    const { path: open, text: now, compiled, compiledText } = diagramStore.get();
    // Only a clean compile of exactly the saved text gets a picture.
    if (open !== path || now !== text || compiledText !== text || !compiled.ok) return;
    // Plan §9.2: thumbnails are light. The exporter paints in the page's theme
    // (io/export.ts has no theme option), so a dark page skips the thumbnail.
    if (resolveThemeIsDark()) return;
    // view mode overrides (maintainer 2026-09-27): never a viewer's own choice (review-r0's
    // race — an in-view drag used to write while an override was showing). Read-only view mode
    // means a save can only land while editing, when the canvas already shows the file's own
    // values regardless — this is defence in depth, not a path this app can currently reach.
    if (viewOverrideActions.hasOverride(path)) return;
    lastThumbAt = Date.now();
    try {
      await writeThumb(path, await thumbnailPng(await pictureOfCanvas(compiled.ast?.title)));
    } catch {
      // No canvas drawn (a dev route, the phone's Editor tab): the next save tries again.
    }
  }

  function scheduleThumb(path: string, text: string) {
    clearTimeout(thumbTimer);
    const wait = Math.max(0, lastThumbAt + THUMB_INTERVAL_MS - Date.now());
    thumbTimer = setTimeout(() => void makeThumb(path, text), wait);
  }

  async function save() {
    timer = undefined;
    const path = diagramStore.get().path;
    const outcome = await workspaceActions.saveNow();
    if (outcome.kind === "saved") {
      failed = false;
      scheduleThumb(outcome.path, outcome.text);
    } else if (outcome.kind === "changed-on-disk" && path) {
      askAboutDiskChange(path);
    } else if (outcome.kind === "gone" && path) {
      tellFileGone(path);
    } else if (outcome.kind === "failed" && path && !failed) {
      failed = true;
      const reason = outcome.error instanceof Error ? outcome.error.message : String(outcome.error);
      toast.error(AUTOSAVE_LABELS.failed(path), {
        description: AUTOSAVE_LABELS.failedDetail(reason),
      });
    }
  }

  // The seed (`diagram-store.ts`) starts with a path but no mtime: read the file once.
  void workspaceActions.attach().catch(() => {});

  const unsubscribe = diagramStore.subscribe(() => {
    const { text, path, loadedText } = diagramStore.get();
    if (path !== lastPath) {
      lastPath = path;
      if (path === null) {
        workspaceStore.set({ current: null, conflict: false, versions: null, save: "idle" });
      } else if (workspaceStore.get().current?.path !== path) {
        void workspaceActions.attach().catch(() => {});
      }
    }
    const dirty = path !== null && text !== loadedText;
    if (workspaceStore.get().dirty !== dirty) workspaceStore.set({ dirty });
    if (text === lastText) return;
    lastText = text;
    clearTimeout(timer);
    timer = dirty ? setTimeout(() => void save(), AUTOSAVE_DELAY_MS) : undefined;
  });

  return () => {
    unsubscribe();
    clearTimeout(thumbTimer);
    if (timer !== undefined) {
      clearTimeout(timer);
      void save();
    }
  };
}

/** Mount once, in an always-rendered part of the shell. */
export function useAutosave(): void {
  useEffect(() => installAutosave(), []);
}
