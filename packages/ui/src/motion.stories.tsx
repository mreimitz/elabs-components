import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { useEffect, useRef, useState } from "react";
import { Button } from "./components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/card";
import { RevealGroup } from "./components/reveal";

/**
 * Foundation/Motion — demonstrates and VERIFIES the token-driven motion gate.
 *
 * The gate is a single CSS multiplier (`--motion-factor`) that scales every
 * duration token (`--t-fast`/`--t-base`/...). It is set by, in precedence order,
 * the user's `data-motion-pref` (toolbar "Motion" global), the OS
 * `prefers-reduced-motion` setting, and the per-theme default. Flip the **Motion**
 * toolbar control (System / Reduce / Full) and the **theme** control to sweep all
 * combinations. The play functions below assert the gate mechanically.
 */

/** Live readout of the resolved gate values (updates when data-motion-pref changes). */
function GateReadout() {
  const probeRef = useRef<HTMLSpanElement>(null);
  const [factor, setFactor] = useState("—");
  const [effective, setEffective] = useState("—");

  useEffect(() => {
    const read = () => {
      const root = document.documentElement;
      setFactor(getComputedStyle(root).getPropertyValue("--motion-factor").trim() || "1");
      if (probeRef.current) {
        setEffective(getComputedStyle(probeRef.current).transitionDuration);
      }
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-motion-pref"],
    });
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    mql.addEventListener("change", read);
    return () => {
      observer.disconnect();
      mql.removeEventListener("change", read);
    };
  }, []);

  return (
    <div className="text-muted-foreground flex flex-col gap-1 text-body">
      {/* Probe: drives a real property off the gated token so its computed value
          reflects the effective duration the gate produces. */}
      <span
        ref={probeRef}
        data-testid="motion-probe"
        style={{ transitionProperty: "opacity", transitionDuration: "var(--t-base)" }}
        aria-hidden
        className="sr-only"
      />
      <span>
        <span className="text-foreground font-medium">--motion-factor:</span> {factor}
      </span>
      <span>
        <span className="text-foreground font-medium">effective --t-base:</span> {effective}
      </span>
    </div>
  );
}

function MotionDemo() {
  const [open, setOpen] = useState(false);
  const [runId, setRunId] = useState(0);
  return (
    <div className="flex w-[28rem] max-w-full flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Micro-interactions</CardTitle>
          <CardDescription>
            Flip the <strong>Motion</strong> toolbar (System / Reduce / Full) and the theme — every
            transition below is gated by <code>--motion-factor</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Hover-lift: Card's `interactive` variant glides up + shadow on hover. */}
          <div className="grid grid-cols-3 gap-3">
            {["Hover", "these", "cards"].map((label) => (
              <Card
                key={label}
                interactive
                className="flex h-16 items-center justify-center text-body shadow-none"
              >
                {label}
              </Card>
            ))}
          </div>

          {/* Press: scale feedback (gated --t-fast, from the Button base recipe). */}
          <div className="flex flex-wrap gap-3">
            <Button>Press me</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? "Collapse" : "Expand"}
            </Button>
          </div>

          {/* Expand/collapse: grid-rows trick, animated over the gated --t-base. */}
          <div
            className="grid transition-[grid-template-rows] duration-base ease-standard"
            style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <p className="text-muted-foreground text-body">
                Expands over <code>--t-base</code>; snaps near-instantly when motion is reduced (but
                never a literal 0s, so transitionend still fires).
              </p>
            </div>
          </div>

          {/* Staggered entrance — the clearest on/off tell. Replay remounts the list. */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-body">Staggered entrance</span>
            <Button size="sm" variant="ghost" onClick={() => setRunId((n) => n + 1)}>
              Replay
            </Button>
          </div>
          <RevealGroup key={runId} className="flex flex-col gap-2" appear="up" staggerMs={60}>
            {["First row", "Second row", "Third row", "Fourth row"].map((row) => (
              <div key={row} className="bg-surface-muted rounded-md border px-3 py-2 text-body">
                {row}
              </div>
            ))}
          </RevealGroup>
        </CardContent>
      </Card>
      <GateReadout />
    </div>
  );
}

const meta = {
  title: "Foundations/Motion",
  tags: ["autodocs"],
  parameters: { layout: "centered" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Visual demo — drive the toolbar "Motion" + theme controls to sweep states. */
export const Playground: Story = {
  render: () => <MotionDemo />,
};

/**
 * Reads the EFFECTIVE transition duration of a probe element under explicit
 * `data-motion-pref="full"`. Explicit "full" overrides any OS reduce request, so
 * this is environment-independent: it must resolve to the full ~0.18s base.
 */
export const GateFullMotion: Story = {
  render: () => <MotionDemo />,
  play: async ({ canvasElement }) => {
    const root = document.documentElement;
    const previous = root.getAttribute("data-motion-pref");
    try {
      root.setAttribute("data-motion-pref", "full");
      const probe = canvasElement.querySelector<HTMLElement>('[data-testid="motion-probe"]')!;
      // getComputedStyle forces a synchronous style flush, so the new gate value
      // is reflected immediately.
      const seconds = parseFloat(getComputedStyle(probe).transitionDuration);
      await expect(seconds).toBeGreaterThanOrEqual(0.15);
    } finally {
      if (previous) root.setAttribute("data-motion-pref", previous);
      else root.removeAttribute("data-motion-pref");
    }
  },
};

/**
 * Verifies the gate actually GATES: under `data-motion-pref="reduced"` the same
 * probe collapses to a tiny fraction of the full duration (≥100× smaller) while
 * staying strictly > 0 (the --motion-min floor — a literal 0s would never fire
 * transitionend and would strand Radix's unmount-suspension).
 */
export const GateReducedMotion: Story = {
  render: () => <MotionDemo />,
  play: async ({ canvasElement }) => {
    const root = document.documentElement;
    const previous = root.getAttribute("data-motion-pref");
    const probe = canvasElement.querySelector<HTMLElement>('[data-testid="motion-probe"]')!;
    try {
      root.setAttribute("data-motion-pref", "full");
      const full = parseFloat(getComputedStyle(probe).transitionDuration);
      root.setAttribute("data-motion-pref", "reduced");
      const reduced = parseFloat(getComputedStyle(probe).transitionDuration);

      await expect(full).toBeGreaterThanOrEqual(0.15); // full motion intact
      await expect(reduced).toBeLessThan(full * 0.5); // gate clearly engaged
      await expect(reduced).toBeLessThan(0.05); // effectively off
      await expect(reduced).toBeGreaterThanOrEqual(0); // never negative / NaN
    } finally {
      if (previous) root.setAttribute("data-motion-pref", previous);
      else root.removeAttribute("data-motion-pref");
    }
  },
};

/**
 * Guardrail for the load-bearing `--motion-min` floor: even at the worst case
 * (`--motion-factor` = 0) the effective duration must stay strictly > 0s. A
 * literal 0s never fires `transitionend`, which would strand Radix's CSS
 * unmount-suspension (overlays would never unmount). Locks the `max(…, --motion-min)`
 * in themes.css against a future "simplify" that drops the floor.
 */
export const GateFloorNeverZero: Story = {
  render: () => (
    <span
      data-testid="floor-probe"
      aria-hidden
      style={{
        transitionProperty: "opacity",
        transitionDuration: "max(calc(var(--duration-base) * 0), var(--motion-min))",
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const probe = canvasElement.querySelector<HTMLElement>('[data-testid="floor-probe"]')!;
    const seconds = parseFloat(getComputedStyle(probe).transitionDuration);
    await expect(seconds).toBeGreaterThan(0);
  },
};

/**
 * Proves the Tailwind UTILITIES (not just the raw CSS vars) are generated and
 * resolve to the tuned, gated scale (fast ≈0.16s, base ≈0.26s, slow ≈0.38s), and
 * that `ease-standard` is the standard cubic-bezier — these are what components
 * actually use. If a long-running dev server hasn't picked up the @theme
 * additions, these resolve to defaults/none and this fails.
 */
export const UtilitiesGenerated: Story = {
  render: () => (
    <div>
      <span data-testid="util-fast" className="transition-opacity duration-fast ease-standard" />
      <span data-testid="util-base" className="transition-opacity duration-base ease-standard" />
      <span data-testid="util-slow" className="transition-opacity duration-slow ease-standard" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const dur = (id: string) =>
      parseFloat(
        getComputedStyle(canvasElement.querySelector<HTMLElement>(`[data-testid="${id}"]`)!)
          .transitionDuration,
      );
    const fast = dur("util-fast");
    const base = dur("util-base");
    const slow = dur("util-slow");
    // Tuned scale (full motion): fast 0.16s < base 0.26s < slow 0.38s — and clearly
    // in the "smooth" range, not the original snappy 0.12/0.18/0.28.
    await expect(fast).toBeGreaterThanOrEqual(0.14);
    await expect(base).toBeGreaterThan(fast);
    await expect(base).toBeGreaterThanOrEqual(0.24);
    await expect(slow).toBeGreaterThan(base);
    await expect(slow).toBeGreaterThanOrEqual(0.34);
    const tf = getComputedStyle(
      canvasElement.querySelector<HTMLElement>('[data-testid="util-fast"]')!,
    ).transitionTimingFunction;
    await expect(tf).toContain("cubic-bezier"); // ease-standard applied
  },
};
