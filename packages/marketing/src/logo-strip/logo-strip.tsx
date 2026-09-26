"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { useReducedMotion } from "@elabs-ai/components-tokens";
import { IconButton, RevealGroup } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

export interface LogoStripLabels {
  /** Accessible name of the marquee region. */
  marquee?: string;
  /** Name of the pause control while the marks are moving. */
  pause?: string;
  /** Name of the same control while they stand still. */
  play?: string;
}

export interface LogoStripProps {
  /** Logos as nodes (SVGs/imgs). Rendered muted for a "trusted by" row. */
  logos: ReactNode[];
  caption?: ReactNode;
  /**
   * `grid` wraps the marks (default). `marquee` scrolls them in a loop that
   * pauses on hover and has a real pause button (WCAG 2.2.2); under reduced
   * motion it stands still as a wrapped row.
   */
  layout?: "grid" | "marquee";
  /** Seconds for one full loop of the marquee. */
  marqueeSeconds?: number;
  /** Stagger the logos in on mount (grid only). Motion-gated. Defaults to true. */
  animate?: boolean;
  /**
   * Fade and desaturate the marks so a row of brand colours reads as one strip
   * (default). Turn off for marks that carry their own muted treatment — text
   * wordmarks, say — since a faded text colour can fall below contrast.
   */
  muted?: boolean;
  labels?: LogoStripLabels;
  className?: string;
}

const DEFAULT_LABELS: Required<LogoStripLabels> = {
  marquee: "Customer marks, scrolling",
  pause: "Pause scrolling",
  play: "Resume scrolling",
};

function Marquee({
  items,
  seconds,
  labels,
  className,
}: {
  items: ReactNode[];
  seconds: number;
  labels: Required<LogoStripLabels>;
  className: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const el = track.current;
    if (!el || typeof el.animate !== "function") return;
    // The track holds the list twice; sliding by half its width loops seamlessly.
    const animation = el.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-50%)" }],
      { duration: seconds * 1000, iterations: Infinity, easing: "linear" },
    );
    animationRef.current = animation;
    return () => {
      animation.cancel();
      animationRef.current = null;
    };
  }, [seconds, items.length]);

  useEffect(() => {
    const animation = animationRef.current;
    if (!animation) return;
    if (paused || hovered) animation.pause();
    else animation.play();
  }, [paused, hovered]);

  return (
    <div
      aria-label={labels.marquee}
      className="flex items-center gap-3"
      data-slot="logo-strip-marquee"
      role="group"
    >
      <div
        className="relative min-w-0 flex-1 overflow-hidden mask-x-from-85% mask-x-to-100%"
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <div className={cn(className, "w-max flex-nowrap justify-start pe-10")} ref={track}>
          {items}
          {/* The second copy makes the loop seamless; one hidden wrapper, same keyed children. */}
          <div aria-hidden="true" className="contents">
            {items}
          </div>
        </div>
      </div>
      <IconButton
        aria-pressed={paused}
        className="shrink-0"
        data-slot="logo-strip-pause"
        icon={paused ? <Play /> : <Pause />}
        label={paused ? labels.play : labels.pause}
        onClick={() => setPaused((value) => !value)}
        size="icon-sm"
        variant="ghost"
      />
    </div>
  );
}

/** Muted row of customer/partner logos. Replace with real assets. */
export function LogoStrip({
  logos,
  caption = "Trusted by teams everywhere",
  layout = "grid",
  marqueeSeconds = 40,
  animate = true,
  muted = true,
  labels,
  className,
}: LogoStripProps) {
  const reduced = useReducedMotion();
  const rowClassName = cn(
    "flex flex-wrap items-center justify-center gap-x-10 gap-y-6",
    muted && "opacity-70 grayscale",
  );
  const items = logos.map((logo, i) => (
    <div key={i} className="h-7 [&_svg]:h-7 [&_img]:h-7">
      {logo}
    </div>
  ));
  const marquee = layout === "marquee" && !reduced;

  return (
    <div
      className={cn("space-y-5 text-center", className)}
      data-layout={layout}
      data-slot="logo-strip"
    >
      {caption ? <p className="text-eyebrow uppercase text-muted-foreground">{caption}</p> : null}
      {marquee ? (
        <Marquee
          className={rowClassName}
          items={items}
          labels={{ ...DEFAULT_LABELS, ...labels }}
          seconds={marqueeSeconds}
        />
      ) : animate && layout === "grid" ? (
        <RevealGroup appear="fade" speed="base" staggerMs={40} className={rowClassName}>
          {items}
        </RevealGroup>
      ) : (
        <div className={rowClassName}>{items}</div>
      )}
    </div>
  );
}
