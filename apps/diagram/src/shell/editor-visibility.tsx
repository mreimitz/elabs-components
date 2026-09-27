import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
  type RefObject,
} from "react";
import type { ResizablePanel } from "@elabs-ai/components-ui";

/** `ResizablePanel`'s imperative handle (react-resizable-panels 2.1: `collapse()`, `expand()`, …). */
type EditorPanelHandle = ComponentRef<typeof ResizablePanel>;

export interface EditorVisibility {
  /** The editor is hidden and the canvas has the whole workspace ("Canvas only"). */
  canvasOnly: boolean;
  /** Hide (`true`) or bring back (`false`) the editor. */
  setCanvasOnly: (canvasOnly: boolean) => void;
  /**
   * Spread onto the editor's `ResizablePanel` (split layout). The panel is the source of
   * truth there: `setCanvasOnly` drives its `collapse()`/`expand()`, and `onCollapse`/
   * `onExpand` write `canvasOnly` back — so dragging the handle to 0 (or out again) keeps
   * the top bar's toggle in step too.
   */
  editorPanel: {
    ref: RefObject<EditorPanelHandle | null>;
    onCollapse: () => void;
    onExpand: () => void;
  };
}

const EditorVisibilityContext = createContext<EditorVisibility | null>(null);

/**
 * Whether the editor pane is shown — the top bar's "Canvas only" switch (wave-2 review M1).
 * View state, not document state: it lives here, not in the diagram store. Wraps the
 * editor route only, so the top bar shows the switch only where there is an editor.
 */
export function EditorVisibilityProvider({ children }: { children: ReactNode }) {
  const [canvasOnly, setCanvasOnlyState] = useState(false);
  const panelRef = useRef<EditorPanelHandle | null>(null);

  const setCanvasOnly = useCallback((next: boolean) => {
    const panel = panelRef.current;
    if (!panel) {
      // Phone layout: no split, the editor/canvas tabs read the state directly.
      setCanvasOnlyState(next);
      return;
    }
    if (next) panel.collapse();
    else panel.expand();
  }, []);

  const editorPanel = useMemo<EditorVisibility["editorPanel"]>(
    () => ({
      ref: panelRef,
      onCollapse: () => setCanvasOnlyState(true),
      onExpand: () => setCanvasOnlyState(false),
    }),
    [],
  );

  const value = useMemo<EditorVisibility>(
    () => ({ canvasOnly, setCanvasOnly, editorPanel }),
    [canvasOnly, setCanvasOnly, editorPanel],
  );

  return <EditorVisibilityContext value={value}>{children}</EditorVisibilityContext>;
}

/** The editor-visibility switch, or `null` outside the editor route (dev galleries). */
export function useEditorVisibility(): EditorVisibility | null {
  return useContext(EditorVisibilityContext);
}
