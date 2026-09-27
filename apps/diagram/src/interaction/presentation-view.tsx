import { useEffect } from "react";
import { layoutBridge } from "../layout/layout-bridge";
import { CanvasPane } from "../panes/canvas-pane";
import { WORKSPACE_ID } from "../shell/diagram-shell";
import { exitPresentation, markPresented } from "./presentation-mode";

/** The view's strings, in one place (`conventions/i18n-strings`). */
const PRESENTATION_LABELS = {
  region: "Diagram presentation",
} as const;

/**
 * DG-18 — the canvas alone, full viewport: no sidebar, top bar, editor, issues or inspector.
 * A fresh canvas mount, so the diagram is laid out and fitted to the whole screen; the title
 * block and legend come with the canvas. Esc leaves (unless a card or menu takes it first:
 * Radix marks the event handled). View-only (review-wave3 M3): the canvas takes no edit, and a
 * DG-15 layout prompt left open by the editor's canvas is dropped on the way in and out.
 */
export function PresentationView() {
  useEffect(() => {
    markPresented();
    layoutBridge.dismiss();
    document.getElementById(WORKSPACE_ID)?.focus();
    let frame = 0;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!event.defaultPrevented) {
        exitPresentation();
        return;
      }
      // A card or menu took this Escape. A node or flow React Flow blurred on it gets focus
      // back from the canvas (`use-canvas-interaction.ts`, review-wave3 M3), a frame earlier
      // than this; anything else that left focus on <body> lands on the presentation region.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active === null || active === document.body) {
          document.getElementById(WORKSPACE_ID)?.focus();
        }
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      cancelAnimationFrame(frame);
      layoutBridge.dismiss();
    };
  }, []);

  return (
    <main
      id={WORKSPACE_ID}
      tabIndex={-1}
      aria-label={PRESENTATION_LABELS.region}
      className="h-svh w-full bg-background focus-ring-inset"
    >
      <CanvasPane presenting />
    </main>
  );
}
