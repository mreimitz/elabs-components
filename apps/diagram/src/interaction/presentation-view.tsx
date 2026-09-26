import { useEffect } from "react";
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
 * Radix marks the event handled).
 */
export function PresentationView() {
  useEffect(() => {
    markPresented();
    document.getElementById(WORKSPACE_ID)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) exitPresentation();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main
      id={WORKSPACE_ID}
      tabIndex={-1}
      aria-label={PRESENTATION_LABELS.region}
      className="h-svh w-full bg-background focus-ring-inset"
    >
      <CanvasPane />
    </main>
  );
}
