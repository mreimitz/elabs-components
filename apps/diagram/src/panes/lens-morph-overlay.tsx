import { useLayoutEffect, type RefObject } from "react";
import { registerLensPreparation } from "../shell/lens-store";
import { diagramStore } from "../state/diagram-store";
import { isLayoutReady } from "./layout-ready-store";

/** Symmetric easing keeps a rapid reversal continuous and both real drawings present. */
export function lensOpacity(position: number): number {
  const t = Math.min(1, Math.max(0, position));
  return t * t * (3 - 2 * t);
}

/** Many technical entities become one visual capability. There is no honest geometric
 * interpolation for that topology change. Prepare both real drawings, then let CanvasPane
 * crossfade them with their own cameras. Never synthesize routes or move zone boundaries. */
export function LensTransitionPreparation({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
}) {
  useLayoutEffect(() => {
    let mounted = true;
    const unregister = registerLensPreparation(
      (signal) =>
        new Promise<boolean>((resolve) => {
          let previous = "";
          let stableFrames = 0;
          let attempts = 0;
          let frame = 0;
          const finish = (ready: boolean) => {
            cancelAnimationFrame(frame);
            signal.removeEventListener("abort", abort);
            resolve(ready);
          };
          const abort = () => finish(false);
          signal.addEventListener("abort", abort, { once: true });
          const prepare = () => {
            const container = containerRef.current;
            if (!mounted || signal.aborted || !container) return finish(false);
            const panes = container.querySelectorAll<HTMLElement>(
              "[data-lens-pane] .react-flow__viewport",
            );
            const signature = [...panes].map((pane) => pane.style.transform).join("|");
            stableFrames = signature === previous ? stableFrames + 1 : 0;
            previous = signature;
            const ready =
              panes.length === 2 &&
              isLayoutReady(diagramStore.get().path) &&
              container.querySelector('[data-lens-pane="visual"] [data-visual-ready="true"]');
            if (ready && stableFrames >= 2) return finish(true);
            if (++attempts >= 120) return finish(false);
            frame = requestAnimationFrame(prepare);
          };
          frame = requestAnimationFrame(prepare);
        }),
    );
    return () => {
      mounted = false;
      unregister();
    };
  }, [containerRef]);
  return null;
}
