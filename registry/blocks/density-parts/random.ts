/**
 * Shared by the density-scatter chart stories: a seeded gaussian so a
 * 200,000-point figure is the same on the server and in the browser.
 */
import { seeded } from "@/components/chart-story-parts/story-kit";

/** A seeded standard normal (Box–Muller over the story kit's mulberry32). */
export function seededGaussian(seed: number): { random: () => number; gauss: () => number } {
  const random = seeded(seed);
  const gauss = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = random();
    while (v === 0) v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return { random, gauss };
}
