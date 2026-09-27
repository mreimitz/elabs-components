import { modeActions, useDocMode, useMode } from "./mode-store";

/**
 * DG-22 folded DG-02's "Canvas only" switch into `mode-store.ts`: view mode is the canvas alone,
 * edit mode brings the editor in (and, on a phone, shows the Editor or the Canvas pane). What is
 * left here is the old reading for callers outside the shell (DG-17's phone export menu).
 */
export interface EditorVisibility {
  /** The canvas is what shows: view mode, or the phone's Canvas pane in edit mode. */
  canvasOnly: boolean;
  /** `true` shows the canvas (on a phone, its pane); `false` shows the editor (edit mode). */
  setCanvasOnly: (canvasOnly: boolean) => void;
}

function setCanvasOnly(canvasOnly: boolean) {
  if (canvasOnly) {
    modeActions.setPhonePane("canvas");
    return;
  }
  modeActions.setMode("edit");
  modeActions.setPhonePane("editor");
}

/** Always available now (the shell owns the mode); the `null` stays for the old callers' type. */
export function useEditorVisibility(): EditorVisibility | null {
  const mode = useDocMode();
  const phonePane = useMode((s) => s.phonePane);
  return { canvasOnly: mode === "view" || phonePane === "canvas", setCanvasOnly };
}
