import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { DecorationProvider, type DecorationLevel } from "@elabs-ai/components-tokens";
import { Button } from "./components/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/card";
import { Badge } from "./components/badge";
import { Input } from "./components/input";

/**
 * Foundation/Decoration — the decoration DIAL (`--decoration`, 0–10), orthogonal
 * to color. The SAME real `@elabs-ai/components-ui` components are rendered across the ramp.
 *
 * WHAT THE DIAL TOUCHES: backgrounds, and nothing else. It fades a drafting
 * sheet in behind the page (faded, never flat — see `Fade` below) and, at 8–10,
 * squares the large radii and goes shadowless. Charts additionally swap flat
 * series fills for patterns at 8–10.
 *
 * WHAT IT NEVER TOUCHES: the inside of a control. The buttons, inputs and badges
 * below render identically at decoration 10 and at 0 — no hatch, no
 * drawn-not-filled plates. Texture inside an input is noise where someone is
 * reading their own typing, and re-inking the six role fills collapsed them to
 * one appearance, which used to force a whole compensating non-colour channel.
 *
 * It is hue-INDEPENDENT — flip the **theme** toolbar to see the dial on green,
 * navy, light paper, etc. Any story can be swept via the **Decoration** toolbar
 * global (or `globals=decoration:<0..10>`).
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
 * the SAME `--deco-grid` on a decorative `::before` layer and masks THAT, so the ink
 * still rides the dial (inert at decoration 0) and the region's own content is
 * never masked — the text in each panel stays at full opacity.
 *
 * The fade OWNS its region's ground. Opaque surfaces are never ruled themselves —
 * the ambient sheet is painted once, behind the page — so a nested surface can't
 * punch a crisp, full-strength rectangle into the field that was just faded out
 * (the third panel below nests a `bg-card`).
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

/**
 * The AMBIENT GROUND, as an executable lock. The sheet is painted exactly once —
 * on a fixed, masked layer behind the page — so this asserts the three properties
 * a static reading of the CSS cannot: the layer exists and carries the dial-driven
 * grid, it is MASKED (never flat), and no opaque surface re-rules it on top.
 *
 * The dial is set from the toolbar global, which writes `data-decoration` on the
 * preview root exactly as `ThemeProvider` does — a `DecorationProvider` wrapper
 * would NOT reach `body`, which is why `Dial` above cannot stand in for this.
 */
export const AmbientGround: Story = {
  globals: { decoration: "10" },
  render: () => (
    <Card className="w-64" data-testid="ground-card">
      <CardHeader>
        <CardTitle>On the sheet</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-caption text-muted-foreground">
          An opaque panel covers the ground; it never re-rules it.
        </p>
      </CardContent>
    </Card>
  ),
  play: async () => {
    const ground = getComputedStyle(document.body, "::before");

    // The sheet exists and carries the dial-driven grid…
    await expect(ground.content).not.toBe("none");
    await expect(ground.backgroundImage).toContain("gradient");
    await expect(ground.position).toBe("fixed");
    await expect(ground.pointerEvents).toBe("none");

    // …and it is never flat: the layer itself is masked.
    await expect(ground.maskImage).not.toBe("none");

    // The host is unmasked, so the page's own content is never faded with it.
    await expect(getComputedStyle(document.body).maskImage).toBe("none");
  },
};

/**
 * The control invariant, as an executable lock: at FULL decoration the dial must
 * not have painted anything into a control. A `Button` keeps its solid role fill
 * (no `background-image`), an `Input` keeps a clean ground, and a `Badge` keeps
 * its own tone rather than collapsing to a drawn outline.
 *
 * This is the story to run when someone reintroduces a "drawn-not-filled" rule:
 * it fails on the hatch, not on a screenshot review three weeks later.
 */
export const ControlsAreUntouched: Story = {
  globals: { decoration: "10" },
  render: () => (
    <div data-testid="controls" className="flex flex-wrap items-center gap-3">
      <Button data-testid="deco-button">Save</Button>
      <Button variant="outline">Cancel</Button>
      <Badge variant="warning">degraded</Badge>
      <Input data-testid="deco-input" placeholder="Filter services…" className="w-48" />
    </div>
  ),
  play: async ({ canvas }) => {
    const button = canvas.getByTestId("deco-button");
    const input = canvas.getByTestId("deco-input");

    // No hatch, no texture: the dial paints backgrounds, never controls.
    await expect(getComputedStyle(button).backgroundImage).toBe("none");
    await expect(getComputedStyle(input).backgroundImage).toBe("none");

    // And the role fill is still a real, opaque plate — not the old
    // "transparent ground + hairline" drawn control.
    await expect(getComputedStyle(button).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    await expect(getComputedStyle(button).backgroundColor).not.toBe("transparent");
  },
};
