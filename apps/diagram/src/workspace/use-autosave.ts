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
 *
 * The capture waits for `panes/layout-ready-store.ts`'s signal that ELK's (async) layout for
 * this save has landed, plus two frames for the fit that follows it — a picture taken any
 * earlier shows the canvas mid-relayout. It is also refused outright while a view-mode
 * override or the visual lens could be on screen instead of the file's own technical diagram
 * (below); when the override or lens clears, or the viewer switches to edit mode (which also
 * ends the override block), `retryIfUnblocked` below re-tries the save's own capture rather
 * than waiting for the next edit to trigger a fresh one.
 */
import { useEffect } from "react";
import { toast } from "@elabs-ai/components-ui";
import { resolveThemeIsDark } from "@elabs-ai/components-tokens";
import { pictureOfCanvas, pngBlob, type Picture, type PictureScale } from "../io/export";
import { whenLayoutReady } from "../panes/layout-ready-store";
import { lensStore } from "../shell/lens-store";
import { currentMode, modeStore } from "../shell/mode-store";
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
  // Bumped by every `scheduleThumb`: a `makeThumb` run already past its `clearTimeout`-proof
  // window (waiting on the layout, or the two frames after it) checks this after each `await`
  // and drops itself once a newer run has superseded it, so two captures never race the same
  // `<name>.thumb.png` (the loser's write used to 404 on the exporter's own temp-file name).
  let thumbGeneration = 0;
  let failed = false;
  let { text: lastText, path: lastPath } = diagramStore.get();
  // A save whose thumbnail was refused for a condition that can end on its own (an override,
  // the visual lens) — not for one that can't (a dark theme, an unclean compile). Re-tried by
  // `retryIfUnblocked` once that condition clears, so it does not sit stale until the next edit.
  let pendingRetry: { path: string; text: string } | null = null;

  /** Only a clean compile of exactly the saved text gets a picture. */
  function isFresh(path: string, text: string): boolean {
    const { path: open, text: now, compiled, compiledText } = diagramStore.get();
    return open === path && now === text && compiledText === text && compiled.ok;
  }

  // view mode overrides (maintainer 2026-09-27): never a viewer's own choice. A save can only
  // land while editing, when the canvas already shows the file's own values regardless of any
  // override recorded earlier for this document — gated on mode, not just presence, or an
  // override set once in the session (from an earlier view-mode visit to this doc) would
  // suppress every later edit-mode thumbnail refresh.
  const blockedByOverride = (path: string) =>
    currentMode() !== "edit" && viewOverrideActions.hasOverride(path);

  // Only the settled technical lens is safe to publish. A moving camera or a blend of
  // technical and visual nodes must never become the document's persisted preview.
  const blockedByLens = () =>
    lensStore.get().position !== 0 || lensStore.get().target !== "technical";

  async function makeThumb(path: string, text: string, generation: number) {
    if (generation !== thumbGeneration || !isFresh(path, text)) return;
    // Plan §9.2: thumbnails are light. The exporter paints in the page's theme
    // (io/export.ts has no theme option), so a dark page skips the thumbnail.
    if (resolveThemeIsDark()) return;
    if (blockedByOverride(path) || blockedByLens()) {
      pendingRetry = { path, text };
      return;
    }
    pendingRetry = null;
    // ELK lays the diagram out asynchronously; wait for it (and the fit that follows it, one
    // frame later) to land before reading the canvas, or the picture shows it mid-relayout.
    if (!(await whenLayoutReady(path))) return;
    if (generation !== thumbGeneration || !isFresh(path, text)) return;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    if (generation !== thumbGeneration || !isFresh(path, text)) return;
    if (blockedByOverride(path) || blockedByLens()) {
      pendingRetry = { path, text };
      return;
    }
    const { compiled } = diagramStore.get();
    lastThumbAt = Date.now();
    try {
      const png = await thumbnailPng(await pictureOfCanvas(compiled.ast?.title));
      if (generation !== thumbGeneration || !isFresh(path, text)) return;
      if (blockedByOverride(path) || blockedByLens()) {
        pendingRetry = { path, text };
        return;
      }
      await writeThumb(path, png);
    } catch {
      // No canvas drawn (a dev route, the phone's Editor tab): the next save tries again.
    }
  }

  function scheduleThumb(path: string, text: string) {
    pendingRetry = null;
    clearTimeout(thumbTimer);
    const generation = ++thumbGeneration;
    const wait = Math.max(0, lastThumbAt + THUMB_INTERVAL_MS - Date.now());
    thumbTimer = setTimeout(() => void makeThumb(path, text, generation), wait);
  }

  /** The override or lens condition that skipped a thumbnail just ended: try it again. */
  function retryIfUnblocked() {
    if (!pendingRetry) return;
    const { path, text } = pendingRetry;
    if (!isFresh(path, text)) {
      pendingRetry = null;
      return;
    }
    if (blockedByOverride(path) || blockedByLens()) return;
    scheduleThumb(path, text);
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
  const unsubscribeOverrides = viewOverrideActions.subscribe(retryIfUnblocked);
  const unsubscribeLens = lensStore.subscribe(retryIfUnblocked);
  // Entering edit mode also ends `blockedByOverride` (it is gated on mode, not just an
  // override's presence) — without this, a thumbnail skipped in view mode stayed stale until
  // the next edit, rather than refreshing the moment Edit is pressed.
  const unsubscribeMode = modeStore.subscribe(retryIfUnblocked);

  return () => {
    unsubscribe();
    unsubscribeOverrides();
    unsubscribeLens();
    unsubscribeMode();
    ++thumbGeneration;
    pendingRetry = null;
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
