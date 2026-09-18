"use client";

import * as React from "react";
import { isMotionAtFloor, readMotionFactor } from "../../lib/use-scroll-progress";
import "./reveal-on-enter.css";

/** Elements RevealOnEnter may render as. */
export type RevealOnEnterElement =
  | "div"
  | "section"
  | "article"
  | "aside"
  | "header"
  | "footer"
  | "ul"
  | "ol"
  | "li";

export interface RevealOnEnterProps extends React.HTMLAttributes<HTMLElement> {
  /** The element to render. Default `div`. */
  as?: RevealOnEnterElement;
  /** Reveal each direct child in turn (60 ms × `--motion-factor` apart) instead of the whole. */
  stagger?: boolean;
}

type RevealPhase = "idle" | "hidden" | "shown";

/**
 * Fades and lifts its content in the first time it scrolls into view — once, never re-hiding.
 * Content is never hidden from a reader or a crawler: the server HTML is fully visible, and the
 * hidden state is applied only after hydration, only when the motion gate is open, only when
 * `IntersectionObserver` exists, and only for content that is not already on screen.
 */
export const RevealOnEnter = React.forwardRef<HTMLElement, RevealOnEnterProps>(
  ({ as: Comp = "div", stagger = false, ...props }, ref) => {
    const innerRef = React.useRef<HTMLElement>(null);
    React.useImperativeHandle(ref, () => innerRef.current as HTMLElement, []);
    const [phase, setPhase] = React.useState<RevealPhase>("idle");

    React.useEffect(() => {
      const el = innerRef.current;
      if (!el || typeof IntersectionObserver === "undefined") return;
      if (isMotionAtFloor(readMotionFactor(el))) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) return; // already seen: leave it be
      if (stagger) {
        Array.from(el.children).forEach((child, index) => {
          (child as HTMLElement).style.setProperty("--reveal-index", String(index));
        });
      }
      setPhase("hidden");
      const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setPhase("shown");
        observer.disconnect();
      });
      observer.observe(el);
      return () => observer.disconnect();
    }, [stagger]);

    return React.createElement(Comp, {
      ref: innerRef,
      "data-slot": "reveal-on-enter",
      "data-reveal": phase === "idle" ? undefined : phase,
      "data-stagger": stagger ? "" : undefined,
      ...props,
    });
  },
);
RevealOnEnter.displayName = "RevealOnEnter";
