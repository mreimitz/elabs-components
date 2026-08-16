import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { DecorationProvider, type DecorationLevel } from "@elabs/components-tokens";
import { Button } from "./components/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/card";
import { Badge } from "./components/badge";
import { Input } from "./components/input";

/**
 * Foundation/Decoration — the decoration DIAL (`--decoration`, 0–10), orthogonal
 * to color. The SAME real `@elabs/components-ui` components are rendered across the ramp:
 * 0 = plain themed UI; mid = a gentle graph-paper + hatch texture (fills/shadows
 * stay); 10 = full reprographic drafting (drawn-not-filled, squared, shadowless).
 *
 * It is hue-INDEPENDENT — flip the **theme** toolbar to see the dial on green,
 * navy, light paper, etc. Any story can be swept via the **Decoration** toolbar
 * global (or `globals=decoration:<0..10>`); `blueprint` ships at decoration 10.
 * Set it in code via `<DecorationProvider level={n}>`, a `data-decoration="n"`
 * attribute, or `ThemeProvider`/`useDecoration` (document-level).
 */
const meta = {
  title: "Foundations/Decoration",
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta;
export default meta;

type Story = StoryObj<typeof meta>;

function Sample() {
  return (
    <Card className="w-64">
      <CardHeader>
        <CardTitle>Revenue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-display font-semibold tracking-tight text-foreground">$48.2M</p>
        <div className="flex gap-2">
          <Badge>healthy</Badge>
          <Badge variant="warning">degraded</Badge>
        </div>
        <Input placeholder="Filter services…" />
        <div className="flex gap-2">
          <Button>Save</Button>
          <Button variant="outline">Cancel</Button>
        </div>
      </CardContent>
    </Card>
  );
}

const LEVELS: DecorationLevel[] = [0, 4, 8, 10];

export const Dial: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-8">
      {LEVELS.map((level) => (
        <div key={level} className="space-y-2">
          <p className="font-mono text-meta uppercase tracking-wider text-muted-foreground">
            decoration {level}
          </p>
          <DecorationProvider level={level}>
            <Sample />
          </DecorationProvider>
        </div>
      ))}
    </div>
  ),
};

const FADES = ["top", "bottom", "edges", "center"] as const;

/**
 * The GROUND FADE (`data-decoration-fade`) — an opt-in region gesture that fades
 * the ambient graph paper out instead of ruling a region edge to edge. It paints
 * the SAME `--bp-grid` on a decorative `::before` layer and masks THAT, so the ink
 * still rides the dial (inert at decoration 0) and the region's own content is
 * never masked — the text in each panel stays at full opacity.
 *
 * The fade OWNS its region's ground: the host **and its descendants** are excluded
 * from the plain-grid rule, so a nested surface can't punch a crisp, full-strength
 * rectangle into the field that was just faded out (the third panel below nests a
 * `bg-card`).
 *
 * Budget: it spends the region's one focal drafting gesture. For a one-off fade on
 * a single element, use Tailwind's own `mask-t-from-*` / `mask-radial-*` utilities.
 *
 * Shipped in anger on `Patterns/Templates/Marketing`, whose hero band carries
 * `data-decoration-fade="top"` so the sheet fades in behind the headline instead of
 * starting on a hard ruled edge — that template, not this matrix, is the surface to
 * judge the gesture on.
 *
 * Sweep it with the **Decoration** toolbar (this story pins the dial to 10 so the
 * gesture is visible on every theme; at 0 the mask has nothing to reveal).
 */
export const Fade: Story = {
  globals: { decoration: "10" },
  render: () => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {FADES.map((fade) => (
        <div
          key={fade}
          data-decoration-fade={fade}
          data-testid={`fade-${fade}`}
          className="min-h-40 rounded-lg bg-card p-4 text-card-foreground"
        >
          <p className="text-subtitle font-medium">{fade}</p>
          <p className="text-caption text-muted-foreground">
            Content stays fully opaque — only the ground fades.
          </p>
          {fade === "edges" ? (
            <div
              data-testid="fade-nested-surface"
              className="mt-3 rounded-md bg-card p-2 text-caption text-muted-foreground"
            >
              A nested surface does not re-rule the faded ground.
            </div>
          ) : null}
        </div>
      ))}
    </div>
  ),
  /**
   * Locks the #257 contract that a static reading of the CSS cannot: the mask
   * belongs to a decorative `::before` layer, so the host's CHILDREN are never
   * faded and the layer never swallows a click — and the faded region is ruled
   * exactly once, host and descendants alike.
   */
  play: async ({ canvas }) => {
    const host = canvas.getByTestId("fade-edges");

    // The host itself is unmasked — otherwise its text would fade with the grid.
    await expect(getComputedStyle(host).maskImage).toBe("none");

    // The decorative layer exists, paints the dial-driven grid, and is inert.
    const layer = getComputedStyle(host, "::before");
    await expect(layer.content).not.toBe("none");
    await expect(layer.pointerEvents).toBe("none");
    await expect(layer.backgroundImage).toContain("gradient");

    // Every child renders at full opacity.
    for (const child of Array.from(host.children)) {
      await expect(getComputedStyle(child).opacity).toBe("1");
    }

    // The faded host is not ALSO ruled crisply…
    await expect(getComputedStyle(host).backgroundImage).toBe("none");
    // …and neither is a surface nested inside it (no crisp patch in a faded field).
    const nested = canvas.getByTestId("fade-nested-surface");
    await expect(getComputedStyle(nested).backgroundImage).toBe("none");
  },
};
