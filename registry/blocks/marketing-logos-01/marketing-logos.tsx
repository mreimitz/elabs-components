"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "@elabs-ai/components-tokens";
import { cn } from "@elabs-ai/components-ui";

export interface LogoWordmark {
  name: string;
  /**
   * Typographic voice of the wordmark — a different weight or case per brand so the cloud
   * reads as many companies, not one font sample.
   */
  voice?: "serif" | "mono" | "wide" | "heavy" | "light" | "caps";
}

export interface MarketingLogosProps {
  caption?: ReactNode;
  logos?: LogoWordmark[];
  /** `grid` wraps the marks; `marquee` scrolls them, pausing on hover and focus. */
  layout?: "grid" | "marquee";
  /** One line under the marks — a number that backs the caption up. */
  stat?: ReactNode;
  /** Seconds for one full loop of the marquee. */
  marqueeSeconds?: number;
  className?: string;
}

const DEFAULT_LOGOS: LogoWordmark[] = [
  { name: "Northwind", voice: "heavy" },
  { name: "Halden", voice: "serif" },
  { name: "kestrel", voice: "mono" },
  { name: "ORBIT", voice: "caps" },
  { name: "Lumen", voice: "light" },
  { name: "Pelican Lines", voice: "wide" },
  { name: "Bluewater", voice: "serif" },
  { name: "Fjordline", voice: "heavy" },
  { name: "tessera", voice: "mono" },
  { name: "Meridian", voice: "light" },
];

const VOICE: Record<NonNullable<LogoWordmark["voice"]>, string> = {
  serif: "font-serif font-semibold italic",
  mono: "font-mono font-medium",
  wide: "font-semibold tracking-widest uppercase text-body",
  heavy: "font-extrabold tracking-tight",
  light: "font-light tracking-wide",
  caps: "font-bold tracking-wider",
};

function Wordmark({ logo }: { logo: LogoWordmark }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap text-subtitle text-muted-foreground transition-colors duration-base ease-standard select-none hover:text-foreground",
        VOICE[logo.voice ?? "heavy"],
      )}
      data-slot="marketing-logos-mark"
    >
      {logo.name}
    </span>
  );
}

function Marquee({ logos, seconds }: { logos: LogoWordmark[]; seconds: number }) {
  const track = useRef<HTMLUListElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = track.current;
    if (!el || reduced || typeof el.animate !== "function") return;
    // The track holds the list twice; sliding by half its width loops seamlessly.
    const animation = el.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-50%)" }],
      { duration: seconds * 1000, iterations: Infinity, easing: "linear" },
    );
    const pause = () => animation.pause();
    const play = () => animation.play();
    const host = el.parentElement ?? el;
    host.addEventListener("pointerenter", pause);
    host.addEventListener("pointerleave", play);
    host.addEventListener("focusin", pause);
    host.addEventListener("focusout", play);
    return () => {
      host.removeEventListener("pointerenter", pause);
      host.removeEventListener("pointerleave", play);
      host.removeEventListener("focusin", pause);
      host.removeEventListener("focusout", play);
      animation.cancel();
    };
  }, [reduced, seconds, logos]);

  return (
    <div
      aria-label={reduced ? undefined : "Customer marks, scrolling. Hover or focus to pause."}
      className={cn(
        "relative overflow-hidden rounded-md focus-ring",
        !reduced && "mask-x-from-85% mask-x-to-100%",
      )}
      data-slot="marketing-logos-marquee"
      role={reduced ? undefined : "group"}
      tabIndex={reduced ? undefined : 0}
    >
      <ul
        className={cn(
          "flex w-max items-center gap-12 pe-12",
          reduced && "flex-wrap justify-center",
        )}
        ref={track}
      >
        {logos.map((logo) => (
          <li key={logo.name}>
            <Wordmark logo={logo} />
          </li>
        ))}
        {reduced
          ? null
          : logos.map((logo) => (
              <li aria-hidden="true" key={`${logo.name}-copy`}>
                <Wordmark logo={logo} />
              </li>
            ))}
      </ul>
    </div>
  );
}

/**
 * A logo cloud of text wordmarks — muted until hovered, each in its own typographic voice —
 * as a wrapping grid or a looping marquee that pauses on hover and focus and stands still
 * under reduced motion.
 */
export function MarketingLogos({
  caption = "Trusted by operations teams at",
  logos = DEFAULT_LOGOS,
  layout = "grid",
  stat,
  marqueeSeconds = 40,
  className,
}: MarketingLogosProps) {
  return (
    <section
      className={cn(
        "@container mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-12",
        className,
      )}
      data-layout={layout}
      data-slot="marketing-logos"
    >
      {caption ? (
        <p className="text-center text-meta font-medium tracking-wide text-muted-foreground uppercase">
          {caption}
        </p>
      ) : null}
      {layout === "marquee" ? (
        <Marquee logos={logos} seconds={marqueeSeconds} />
      ) : (
        <ul
          className="grid grid-cols-2 items-center justify-items-center gap-x-8 gap-y-6 @md:grid-cols-3 @2xl:grid-cols-5"
          data-slot="marketing-logos-grid"
        >
          {logos.map((logo) => (
            <li key={logo.name}>
              <Wordmark logo={logo} />
            </li>
          ))}
        </ul>
      )}
      {stat ? (
        <p className="text-center text-body text-muted-foreground" data-slot="marketing-logos-stat">
          {stat}
        </p>
      ) : null}
    </section>
  );
}
