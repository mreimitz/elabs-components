"use client";

import type { ReactNode } from "react";
import { LogoStrip } from "@elabs-ai/components-marketing";
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
  /** `grid` wraps the marks; `marquee` scrolls them, with a pause button and a pause on hover. */
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

/**
 * A logo cloud of text wordmarks — muted until hovered, each in its own typographic voice —
 * on the marketing `LogoStrip`: a wrapping grid, or a looping marquee with a real pause
 * button that also pauses on hover and stands still under reduced motion.
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
      <LogoStrip
        caption={caption}
        layout={layout}
        logos={logos.map((logo) => (
          <Wordmark key={logo.name} logo={logo} />
        ))}
        marqueeSeconds={marqueeSeconds}
        muted={false}
      />
      {stat ? (
        <p className="text-center text-body text-muted-foreground" data-slot="marketing-logos-stat">
          {stat}
        </p>
      ) : null}
    </section>
  );
}
