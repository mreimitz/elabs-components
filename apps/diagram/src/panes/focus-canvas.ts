/**
 * DG-14 — put keyboard focus on a canvas node or edge by id. After an edit the element may
 * render a few frames later (a compile, a staged re-layout), so this retries once per frame;
 * when the element never appears, focus goes to the workspace, never to `<body>`.
 * P4: library gap — flow has no focus restore after a delete or a text-driven change.
 * docs/findings/DG-14-inspector-write-back.md.
 */
import { WORKSPACE_ID } from "../shell/diagram-shell";

/** Up to about half a second at 60 fps: a re-layout lands well inside it. */
const MAX_FRAMES = 30;

function canvasElement(id: string): HTMLElement | null {
  const key = CSS.escape(id);
  return document.querySelector<HTMLElement>(
    `.react-flow__node[data-id="${key}"], .react-flow__edge[data-id="${key}"]`,
  );
}

export function focusCanvasElement(id: string | null): void {
  let frames = MAX_FRAMES;
  const attempt = () => {
    const element = id === null ? null : canvasElement(id);
    if (element) {
      element.focus();
    } else if (id !== null && --frames > 0) {
      requestAnimationFrame(attempt);
    } else {
      document.getElementById(WORKSPACE_ID)?.focus();
    }
  };
  attempt();
}
