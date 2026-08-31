import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { SidebarProvider } from "@elabs-ai/components-ui";
import { AppSidebar } from "./app-sidebar";

/**
 * WCAG contrast ratio between two CSS color strings, computed by rasterizing
 * each through a 1×1 canvas (normalizes any color function — oklch(), rgb(),
 * etc. — to concrete sRGB the way the browser actually paints it) and applying
 * the WCAG 2.x relative-luminance + contrast formulas. Used by the #50 locking
 * test below to assert the REAL rendered ratio, not just the class name.
 */
function cssColorToRgb(color: string): [number, number, number] {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function wcagContrast(fg: string, bg: string): number {
  const lf = relativeLuminance(cssColorToRgb(fg));
  const lb = relativeLuminance(cssColorToRgb(bg));
  const [hi, lo] = lf >= lb ? [lf, lb] : [lb, lf];
  return (hi + 0.05) / (lo + 0.05);
}
/** Walk up from `el` to the nearest ancestor (inclusive) with a painted background. */
function resolvedBackgroundColor(el: Element): string {
  let node: Element | null = el;
  while (node) {
    const bg = getComputedStyle(node).backgroundColor;
    if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
    node = node.parentElement;
  }
  return getComputedStyle(document.body).backgroundColor;
}

const meta = {
  title: "Layout/App Shell/Double-Sided",
  parameters: { layout: "fullscreen" },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <SidebarProvider>
      <AppSidebar />
    </SidebarProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // #50 — "Overview" is expanded by default, so its sub-item description
    // text ("Project overview and activity") renders on mount, on the
    // `bg-sidebar` chrome ground. It must reach for
    // `text-sidebar-muted-foreground`, not the canvas `text-muted-foreground`
    // (~2.29:1 there).
    const description = await canvas.findByText("Project overview and activity");
    const ratio = wcagContrast(
      getComputedStyle(description).color,
      resolvedBackgroundColor(description),
    );
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  },
};
