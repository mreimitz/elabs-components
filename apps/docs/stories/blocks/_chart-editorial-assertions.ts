import { expect, userEvent, waitFor } from "storybook/test";

/** Any CSS colour string → sRGBA bytes, through a 1×1 canvas (colour-space-proof). */
export function toSrgb(colour: string): number[] {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, 1, 1);
  return Array.from(ctx.getImageData(0, 0, 1, 1).data);
}

/** Resolve a CSS colour expression (e.g. `var(--ring)`) inside `scope` to sRGBA bytes. */
export function resolveColour(scope: HTMLElement, expression: string): number[] {
  const probe = document.createElement("span");
  probe.style.color = expression;
  scope.appendChild(probe);
  const bytes = toSrgb(getComputedStyle(probe).color);
  probe.remove();
  return bytes;
}

/** WCAG relative luminance of opaque sRGB bytes. */
function luminance([r = 0, g = 0, b = 0]: number[]): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two opaque sRGB colours. */
export function contrastRatio(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * #307 — tab to the figure and assert the house focus ring painted: a box-shadow
 * layer whose colour is the governing theme's `--ring`, not the UA default
 * outline. Polled, because the ring's shadow may still be settling the instant
 * focus lands.
 */
export async function expectHouseFocusRing(figure: HTMLElement) {
  await userEvent.tab();
  await expect(document.activeElement).toBe(figure);
  await expect(figure.matches(":focus-visible")).toBe(true);
  const ring = resolveColour(figure, "var(--ring)");
  await waitFor(() => {
    const layers = getComputedStyle(figure).boxShadow.match(/\w+\([^)]*\)/g) ?? [];
    const painted = layers
      .map(toSrgb)
      .some((c) => (c[3] ?? 0) > 0 && c.every((v, i) => Math.abs(v - (ring[i] ?? 0)) <= 2));
    expect(painted).toBe(true);
  });
}
