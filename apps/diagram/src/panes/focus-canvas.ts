/**
 * DG-14 — put keyboard focus on a canvas node or edge by id. After an edit the element may
 * render a few frames later (a compile, a staged re-layout), so this retries once per frame;
 * when the element never appears, focus goes to the workspace, never to `<body>`.
 * P4: library gap — flow has no focus restore after a delete or a text-driven change.
 * docs/findings/DG-14-inspector-write-back.md.
 */
import { WORKSPACE_ID } from "../shell/diagram-shell";

/**
 * How long focus is looked after, in frames: about one and a half seconds at 60 fps. An
 * auto re-layout (ELK) lands in about half a second on the largest example; a long render
 * stretches the frames, so the budget stretches with it.
 */
const WATCH_FRAMES = 90;

/** Bumped by every request and by a pointer press: only the latest request acts. */
let generation = 0;

function canvasElement(id: string): HTMLElement | null {
  const key = CSS.escape(id);
  return document.querySelector<HTMLElement>(
    `.react-flow__node[data-id="${key}"], .react-flow__edge[data-id="${key}"]`,
  );
}

/** The canvas node or edge that has focus, if any. */
export function focusedCanvasId(): string | null {
  const active = document.activeElement;
  const element = active?.closest<HTMLElement>(".react-flow__node, .react-flow__edge");
  return element?.dataset.id ?? null;
}

/**
 * Focus the element with this id and keep it there while the edit that caused the call
 * settles. The first focus can land and still be lost a few frames later, when the commit
 * that follows the edit hides the element (a re-parented or restored node is staged
 * invisible until its layout lands, `stageGraph`) or moves it in the DOM (React Flow draws
 * its nodes in the text's order, and a re-parent changes that order). Either drops focus to
 * `<body>`. So focus counts as kept only at the end of the watch: until then, focus that has
 * fallen to `<body>` is taken back. Focus the person moved elsewhere is left alone, and a
 * pointer press ends the watch (the person chose where to go).
 */
export function focusCanvasElement(id: string | null): void {
  const request = ++generation;
  if (id === null) {
    document.getElementById(WORKSPACE_ID)?.focus();
    return;
  }
  const release = () => {
    if (generation === request) generation += 1;
  };
  document.addEventListener("pointerdown", release, { capture: true, once: true });
  let frames = WATCH_FRAMES;
  let held = false;
  const attempt = () => {
    const current = generation === request;
    const element = current ? canvasElement(id) : null;
    const fallen = () =>
      document.activeElement === null || document.activeElement === document.body;
    if (current) {
      if (element && document.activeElement !== element && (!held || fallen())) element.focus();
      // DG-16: an invisible (staged) element takes no focus: the next frame tries again.
      if (element && document.activeElement === element) held = true;
      else if (held && !fallen()) frames = 0; // the person moved on: stop looking after it
      if (--frames > 0) {
        requestAnimationFrame(attempt);
        return;
      }
    }
    document.removeEventListener("pointerdown", release, { capture: true });
    release();
    // Never left on <body>: the workspace takes focus when the element never took it.
    if (current && (!held || fallen())) document.getElementById(WORKSPACE_ID)?.focus();
  };
  attempt();
}
