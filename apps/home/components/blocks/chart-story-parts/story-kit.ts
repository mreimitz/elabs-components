// registry: chart-story-parts — copied 2026-09-19
/**
 * Shared by every `chart-story-*` block: the byline and source every figure signs with, and a
 * seeded random so a figure's fictional data is the same on the server and in the browser.
 *
 * Every `chart-story-*` figure is a whole card, the way a newsroom publishes one: a title that
 * states the finding, a description that tells the reader how to read it, the plot with its
 * notes drawn ON it, then method notes, byline, source and "Get the data".
 */
import type { ChartFrameByline, ChartFrameSourceLink } from "@elabs-ai/components-charts";

export const STORY_BYLINE: ChartFrameByline = { author: "brand-ui data desk" };

/** Every number in these figures is invented; the source line says so. */
export const FICTIONAL_SOURCE: ChartFrameSourceLink = {
  name: "Acme Logistics (fictional data)",
  href: "https://elabs-ai.com/storybook/",
};

/** A deterministic 32-bit PRNG (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
