import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { NODE_STYLE, Timeline, TimelineItem, TimelineRoot } from "./timeline";
import { STATUS_ROLE, STATUSES, statusBadgeVariants, type Status } from "../status-badge";

afterEach(cleanup);

// #392 — one vocabulary, one colour. `NODE_STYLE` (the rail dot) is a literal
// duplicate of the status→role mapping `STATUS_ROLE`/`statusBadgeVariants` own;
// this block is what stops the duplicate from silently drifting again (it did,
// for `running`: the dot rendered `--primary` while the badge rendered `--info`).
// Only the four CHROMATIC statuses are asserted — `pending`/`skipped`/`denied`
// are a deliberate, documented neutral divergence (a hollow dot vs a filled
// pill), not a bug: `NODE_STYLE.pending` uses `bg-background` (hollow, "not yet")
// where `statusBadgeVariants({status:"pending"})` uses a filled `bg-secondary`
// pill — a legitimate design choice a dot and a pill make differently.
describe("Timeline NODE_STYLE — one vocabulary, one colour (#392)", () => {
  const CHROMATIC: Status[] = ["running", "complete", "awaiting-approval", "failed"];
  const role = (classes: string) => classes.match(/\bbg-([a-z-]+?)(?:\/\d+)?\b/)?.[1];

  it.each(CHROMATIC)(
    "%s renders the same semantic role on the rail node and the badge",
    (status) => {
      expect(role(NODE_STYLE[status])).toBe(role(statusBadgeVariants({ status })));
      expect(role(NODE_STYLE[status])).toBe(STATUS_ROLE[status]);
    },
  );

  it("keeps the running ring halo on the same role as its fill", () => {
    expect(NODE_STYLE.running).toMatch(/\bring-info\/25\b/);
    expect(role(NODE_STYLE.running)).toBe("info");
  });
});

// #387 — colour is never the only channel (WCAG 1.4.1). `NODE_STYLE` used to
// encode status in fill hue alone: `denied`/`skipped` were byte-identical, and
// `complete`/`awaiting-approval`/`failed` were shape-identical filled dots
// differing only by hue. An earlier version of this fix reached for
// `border-style` (dashed/dotted) on the vivid quartet too — a RENDERED check
// caught that it is invisible there (border colour == fill colour, so a dash
// gap reveals nothing) even though it read as "clearly different" in the
// class string. The vivid quartet (`running`/`complete`/`awaiting-approval`/
// `failed`) is differentiated by `ring-*` WIDTH instead (0/1/2/4 — a ring
// contrasts against the PAGE, not the fill, which is why it actually paints).
// `denied`/`skipped` keep `border-style` because THEIR border and fill
// genuinely differ in colour, where it does paint. See the class-map comment
// in `timeline.tsx` and the #387 rendered-proof zoomed/greyscale screenshots.
describe("Timeline NODE_STYLE — colour is never the only channel (#387)", () => {
  const signature = (status: Status) => {
    const classes = NODE_STYLE[status];
    const fill = classes.match(/\bbg-[a-z-]+\b/)?.[0];
    const style = classes.match(/\bborder-(dashed|dotted|double)\b/)?.[1] ?? "solid";
    const ringWidth = classes.match(/\bring-(\d+)\b/)?.[1] ?? "0";
    return `${fill}|${style}|ring-${ringWidth}`;
  };

  it("gives every status a unique non-colour (fill + border-style + ring-width) signature", () => {
    const signatures = STATUSES.map(signature);
    expect(new Set(signatures).size).toBe(STATUSES.length);
  });

  it("distinguishes denied, skipped and pending from one another (previously denied ≡ skipped)", () => {
    expect(NODE_STYLE.denied).not.toBe(NODE_STYLE.skipped);
    expect(signature("denied")).not.toBe(signature("skipped"));
    expect(signature("pending")).not.toBe(signature("denied"));
    expect(signature("pending")).not.toBe(signature("skipped"));
  });

  it("distinguishes complete, awaiting-approval and failed from one another (previously hue-only)", () => {
    expect(signature("complete")).not.toBe(signature("awaiting-approval"));
    expect(signature("complete")).not.toBe(signature("failed"));
    expect(signature("awaiting-approval")).not.toBe(signature("failed"));
  });

  it("gives the vivid quartet (running/complete/awaiting-approval/failed) four distinct ring widths", () => {
    const widths = ["running", "complete", "awaiting-approval", "failed"].map(
      (s) => NODE_STYLE[s as Status].match(/\bring-(\d+)\b/)?.[1] ?? "0",
    );
    expect(new Set(widths).size).toBe(widths.length);
  });

  it("names the status for assistive tech — data-status alone isn't AT-visible", () => {
    render(
      <TimelineRoot>
        <TimelineItem status="running">Computing QoQ deltas</TimelineItem>
        <TimelineItem status="failed">Queried finance.revenue</TimelineItem>
        <TimelineItem status="skipped">Draft the board note</TimelineItem>
      </TimelineRoot>,
    );
    const [running, failed, skipped] = screen.getAllByRole("listitem");
    expect(running).toHaveTextContent("Running: Computing QoQ deltas");
    expect(failed).toHaveTextContent("Failed: Queried finance.revenue");
    expect(skipped).toHaveTextContent("Skipped: Draft the board note");
  });
});

describe("Timeline (array API — the editor-facing surface, #190)", () => {
  it("renders one list item per timeline step", () => {
    render(
      <Timeline
        items={[
          { title: "Draft", status: "done" },
          { title: "Review", status: "active", description: "in progress" },
          { title: "Publish", status: "pending" },
        ]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("in progress")).toBeInTheDocument();
  });

  it("maps the editor 3-state vocabulary onto the canonical Status", () => {
    render(
      <Timeline
        items={[
          { title: "Draft", status: "done" },
          { title: "Review", status: "active" },
          { title: "Publish" }, // status omitted → pending
        ]}
      />,
    );
    const [done, active, pending] = screen.getAllByRole("listitem");
    expect(done).toHaveAttribute("data-status", "complete");
    expect(active).toHaveAttribute("data-status", "running");
    expect(pending).toHaveAttribute("data-status", "pending");
  });
});

describe("TimelineRoot/TimelineItem (compound API)", () => {
  it("composes items with canonical statuses and rich children", () => {
    render(
      <TimelineRoot data-testid="rail">
        <TimelineItem status="complete" timestamp="Jun 4">
          Searched filings
        </TimelineItem>
        <TimelineItem status="failed" description={<em>quota exceeded</em>}>
          Queried finance.revenue
        </TimelineItem>
      </TimelineRoot>,
    );
    expect(screen.getByTestId("rail").tagName).toBe("OL");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute("data-status", "complete");
    expect(items[1]).toHaveAttribute("data-status", "failed");
    expect(screen.getByText("Jun 4")).toBeInTheDocument();
    expect(screen.getByText("quota exceeded")).toBeInTheDocument();
  });

  it("renders the block detail slot under the node (#192 AgentStep host)", () => {
    render(
      <TimelineRoot>
        <TimelineItem
          status="complete"
          detail={<div data-testid="detail">8 rows · 0 variances</div>}
        >
          Queried finance.revenue
        </TimelineItem>
      </TimelineRoot>,
    );
    expect(screen.getByTestId("detail")).toBeInTheDocument();
  });

  // #381 — the `awaiting-approval` node is a colour-ONLY mark (a ~10px dot whose
  // border is the same tone, so there is no rescuing hairline). It must keep
  // reaching for the status FILL rung, which is the rung the token contract
  // guarantees ≥3:1 on every content surface (themes-contrast.test.ts). A future
  // edit that swaps it for a wash (`bg-warning/10`) or the plate-ink rung
  // (`text-warning-foreground`) would silently drop it back under 1.4.11.
  it("draws the awaiting-approval node with the warning MARK rung (1.4.11)", () => {
    render(
      <TimelineRoot>
        <TimelineItem status="awaiting-approval">Awaiting sign-off</TimelineItem>
      </TimelineRoot>,
    );
    const node = screen.getByRole("listitem").querySelector(".bg-warning");
    expect(node).not.toBeNull();
    expect(node).toHaveClass("border-warning");
    expect(node?.className).not.toMatch(/bg-warning\//);
  });

  it("merges className and spreads props on the li", () => {
    render(
      <TimelineRoot>
        <TimelineItem className="custom-item" aria-label="step">
          Step
        </TimelineItem>
      </TimelineRoot>,
    );
    const li = screen.getByRole("listitem");
    expect(li).toHaveClass("custom-item");
    expect(li).toHaveAttribute("aria-label", "step");
  });
});
