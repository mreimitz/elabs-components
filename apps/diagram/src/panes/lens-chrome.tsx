import { useDiagramStyle } from "../style/react-style";
import { profileVariables } from "../style/profile-paint";
import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLens, type Lens } from "../shell/lens-store";

export const LensChromeTarget = createContext<HTMLElement | null>(null);

/** React context follows the portal, so each control still operates its own flow canvas. */
export function LensChrome({ lens, children }: { lens: Lens; children: ReactNode }) {
  const profile = useDiagramStyle()[lens];
  const target = useContext(LensChromeTarget);
  const visual = useLens((state) => state.position === 1);
  const moving = useLens((state) => state.animating);
  if (!target) return null;
  return createPortal(
    <div
      data-lens-chrome={lens}
      className="react-flow pointer-events-none absolute inset-0 [&_.react-flow\_\_panel:not(.pointer-events-none)]:pointer-events-auto"
      style={{
        ...profileVariables(profile),
        visibility: visual === (lens === "visual") ? "visible" : "hidden",
      }}
      inert={moving || visual !== (lens === "visual") || undefined}
    >
      {children}
    </div>,
    target,
  );
}
