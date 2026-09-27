import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { ArchDiagram } from "../spec/dialect";
import { useDiagram } from "../state/diagram-store";
import { deriveVisualLens } from "../visual/derive-visual";
import { LANE_TITLE, type LaneRole, type VisualBox, type VisualLens } from "../visual/visual-model";

/**
 * The lens transition's real morph (maintainer 2026-09-27, orchestrator correction: the plain
 * cross-fade in `canvas-pane.tsx` does not meet S10 — "a smooth animated transition, never a
 * swap"). `docs/2026-09-27-style-system-concept.md` §7's choreography, scoped down (see
 * `docs/findings/lens-switch-slice.md` for the exact list of simplifications): while a
 * non-reduced-motion transition is in flight, `canvas-pane.tsx` hides BOTH real panes
 * (`opacity: 0`) and this overlay draws ghost rectangles that fly from each technical
 * element's on-screen rect to its visual counterpart's — transform + opacity only, one
 * `position` value (0 = technical .. 1 = visual, `shell/lens-store.ts`) driving every ghost, so
 * a reversal mid-flight is the same continuous read, never a jump or a recompute.
 */

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function rectFrom(el: Element, container: DOMRect): Rect {
  const r = el.getBoundingClientRect();
  return {
    left: r.left - container.left,
    top: r.top - container.top,
    width: r.width,
    height: r.height,
  };
}

function unionRect(rects: readonly Rect[]): Rect {
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.left + r.width));
  const bottom = Math.max(...rects.map((r) => r.top + r.height));
  return { left, top, width: right - left, height: bottom - top };
}

function center(r: Rect): { x: number; y: number } {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** A local copy of `derive-visual.ts`'s own descendant walk — that file does not export it,
 * and this needs only the node-id list, not the owner-resolution `derive-visual.ts` also
 * carries. Top-level zones only (`zone.parent === undefined`): the concept's "zones morph
 * into lane panels" is not scoped further here for nested zones (findings doc). */
function zoneDescendantIds(zoneId: string, ast: ArchDiagram): string[] {
  const parentOf = new Map(ast.zones.map((z) => [z.id, z.parent]));
  const isDescendant = (nodeParent: string | undefined): boolean => {
    for (let id = nodeParent; id !== undefined; id = parentOf.get(id)) {
      if (id === zoneId) return true;
    }
    return false;
  };
  return ast.nodes.filter((n) => isDescendant(n.parent)).map((n) => n.id);
}

/** Which lane a top-level zone morphs into: the majority lane of its descendants' boxes
 * (ties, or no descendant with a box, mean no zone ghost for it — it just fades with the
 * hidden technical pane instead, same as any other element unique to one lens). */
function laneForZone(
  zoneId: string,
  ast: ArchDiagram,
  nodeToBox: Map<string, VisualBox>,
): LaneRole | undefined {
  const counts = new Map<LaneRole, number>();
  for (const id of zoneDescendantIds(zoneId, ast)) {
    const box = nodeToBox.get(id);
    if (!box) continue;
    counts.set(box.lane, (counts.get(box.lane) ?? 0) + 1);
  }
  let best: LaneRole | undefined;
  let bestCount = 0;
  for (const [lane, count] of counts) {
    if (count > bestCount) {
      best = lane;
      bestCount = count;
    }
  }
  return best;
}

interface MemberGhost {
  id: string;
  from: Rect;
  to: Rect;
}

interface BoxGhost {
  id: string;
  from: Rect;
  to: Rect;
}

interface ZoneGhost {
  id: string;
  fromTitle: string;
  toTitle: string;
  from: Rect;
  to: Rect;
}

interface Segment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface FlowSegment extends Segment {
  solid: boolean;
}

interface MorphPlan {
  members: MemberGhost[];
  boxes: BoxGhost[];
  zones: ZoneGhost[];
  technicalFlows: Segment[];
  visualFlows: FlowSegment[];
}

/**
 * Both panes are already mounted and independently fitted BEFORE this component ever exists
 * (`canvas-pane.tsx` mounts technical and visual unconditionally, not just during a
 * transition — the "target layout computed before the animation starts" rule holds because
 * there is no fresh mount/fit race to win), so every rect read here is real, already-settled,
 * on-screen geometry. That is also why no separate "camera" tween is needed: a ghost's
 * `from`/`to` are where its technical/visual counterpart already sits on screen, so flying
 * between them already reads as one continuous move (§7's "one continuous camera move").
 */
function capturePlan(container: HTMLElement, ast: ArchDiagram): MorphPlan | null {
  const containerRect = container.getBoundingClientRect();
  const techEls = container.querySelectorAll<HTMLElement>(
    '[data-lens-pane="technical"] .react-flow__node[data-id]',
  );
  const visEls = container.querySelectorAll<HTMLElement>(
    '[data-lens-pane="visual"] .react-flow__node[data-id]',
  );
  if (techEls.length === 0 || visEls.length === 0) return null;

  const techRect = new Map<string, Rect>();
  for (const el of techEls) {
    const id = el.dataset.id;
    if (id) techRect.set(id, rectFrom(el, containerRect));
  }
  const visRect = new Map<string, Rect>();
  for (const el of visEls) {
    const id = el.dataset.id;
    if (id) visRect.set(id, rectFrom(el, containerRect));
  }

  const lens: VisualLens = deriveVisualLens(ast);
  const nodeToBox = new Map<string, VisualBox>();
  for (const box of lens.boxes) for (const member of box.members) nodeToBox.set(member.id, box);

  const members: MemberGhost[] = [];
  const boxes: BoxGhost[] = [];
  for (const box of lens.boxes) {
    const to = visRect.get(box.id);
    if (!to) continue;
    const memberRects: Rect[] = [];
    box.members.forEach((member, index) => {
      const from = techRect.get(member.id);
      if (!from) return;
      memberRects.push(from);
      // The box's own member-icon row sits low in the box (`capability-box-node.tsx`'s
      // title-then-marks layout) — an approximate slot, not that row's real measured
      // position (findings doc: no per-member sub-layout is computed for this).
      members.push({
        id: member.id,
        from,
        to: {
          left: to.left + 8 + index * 26,
          top: to.top + Math.max(to.height - 30, 24),
          width: 22,
          height: 22,
        },
      });
    });
    if (memberRects.length === 0) continue;
    const union = unionRect(memberRects);
    const cx = union.left + union.width / 2;
    const cy = union.top + union.height / 2;
    const fromW = to.width * 0.6;
    const fromH = to.height * 0.6;
    boxes.push({
      id: box.id,
      from: { left: cx - fromW / 2, top: cy - fromH / 2, width: fromW, height: fromH },
      to,
    });
  }

  const zones: ZoneGhost[] = [];
  for (const zone of ast.zones) {
    if (zone.parent !== undefined) continue;
    const from = techRect.get(zone.id);
    if (!from) continue;
    const lane = laneForZone(zone.id, ast, nodeToBox);
    if (!lane) continue;
    const to = visRect.get(`lane:${lane}`);
    if (!to) continue;
    zones.push({ id: zone.id, fromTitle: zone.title, toTitle: LANE_TITLE[lane], from, to });
  }

  const technicalFlows: Segment[] = [];
  for (const flow of ast.flows) {
    const from = techRect.get(flow.from);
    const to = techRect.get(flow.to);
    if (!from || !to) continue;
    const a = center(from);
    const b = center(to);
    technicalFlows.push({ id: flow.path, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }

  const visualFlows: FlowSegment[] = [];
  for (const flow of lens.flows) {
    const from = visRect.get(flow.from);
    const to = visRect.get(flow.to);
    if (!from || !to) continue;
    const a = center(from);
    const b = center(to);
    visualFlows.push({
      id: flow.id,
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      solid: flow.kind === "data",
    });
  }

  return { members, boxes, zones, technicalFlows, visualFlows };
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** A cheap ease-in-out standing in for the tokens' own `cubic-bezier` (`motion.ts` MOTION.ease
 * is a CSS string, not a JS interpolator) — close enough for a ghost's own eased sub-tween. */
function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

function subProgress(position: number, start: number, end: number): number {
  return smoothstep((position - start) / (end - start));
}

/** A FLIP-style tween: the element's DOM box is fixed at `to` (no layout thrash across
 * frames); only `transform`/`opacity` move, every frame, compositor-friendly (§7's "60 fps
 * … transforms and opacity only"). `t` = 0 renders at `from`, `t` = 1 renders at `to`. */
function flipStyle(from: Rect, to: Rect, t: number): CSSProperties {
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  const sx = to.width === 0 ? 1 : from.width / to.width;
  const sy = to.height === 0 ? 1 : from.height / to.height;
  const inv = 1 - t;
  return {
    position: "absolute",
    left: to.left,
    top: to.top,
    width: to.width,
    height: to.height,
    transform: `translate(${dx * inv}px, ${dy * inv}px) scale(${sx + (1 - sx) * t}, ${sy + (1 - sy) * t})`,
    transformOrigin: "top left",
  };
}

/** §7's phase table, expressed as fractions of the 700 ms total (the store's `position` is
 * already `elapsed / 700` at normal motion — see `lens-store.ts` DURATION_MS). This component
 * never mounts under reduced motion (`canvas-pane.tsx`'s `morphing` gate), so there is no
 * reduced-motion rescale to do here. */
const GATHER_START = 120 / 700;
const GATHER_END = 450 / 700;

export function LensMorphOverlay({
  containerRef,
  position,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  position: number;
}) {
  const ast = useDiagram((s) => s.drawn.ast);
  const astRef = useRef(ast);
  astRef.current = ast;
  const [plan, setPlan] = useState<MorphPlan | null>(null);

  // Mount-only capture: `canvas-pane.tsx` renders this component for exactly one transition's
  // lifetime (mounts when it starts, unmounts once `position` settles at 0 or 1), so "on
  // mount" already is "before the tween starts" — see `capturePlan`'s own doc comment.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const currentAst = astRef.current;
    if (!container || !currentAst) return;
    setPlan(capturePlan(container, currentAst));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately mount-only, see above
  }, []);

  if (!plan) return null;

  const gather = subProgress(position, GATHER_START, GATHER_END);
  // "opacity → 0 in the last 30 %" of the gather phase (§7); scale/position keep tweening
  // with `gather` the whole time, so a member ghost is still exactly at its slot in the box
  // when it finishes fading, not left short.
  const memberOpacity = gather < 0.7 ? 1 : 1 - (gather - 0.7) / 0.3;
  const edgeOut = 1 - smoothstep(position / 0.5);
  const edgeIn = smoothstep((position - 0.5) / 0.5);
  const zoneT = smoothstep(position);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full">
        {plan.technicalFlows.map((seg) => (
          <line
            key={seg.id}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke="var(--border-strong)"
            strokeWidth={1.5}
            opacity={edgeOut}
          />
        ))}
        {plan.visualFlows.map((seg) => (
          <line
            key={seg.id}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke="var(--border-strong)"
            strokeWidth={1.5}
            strokeDasharray={seg.solid ? undefined : "4 3"}
            opacity={edgeIn}
          />
        ))}
      </svg>
      {plan.zones.map((zone) => (
        <div
          key={zone.id}
          style={flipStyle(zone.from, zone.to, zoneT)}
          className="relative overflow-hidden rounded-lg border border-border bg-surface-muted"
        >
          <div
            className="text-meta absolute inset-x-0 top-0 truncate px-3 py-2 font-medium tracking-wide text-muted-foreground uppercase"
            style={{ opacity: 1 - zoneT }}
          >
            {zone.fromTitle}
          </div>
          <div
            className="text-meta absolute inset-x-0 top-0 truncate px-3 py-2 font-medium tracking-wide text-muted-foreground uppercase"
            style={{ opacity: zoneT }}
          >
            {zone.toTitle}
          </div>
        </div>
      ))}
      {plan.boxes.map((box) => (
        <div
          key={box.id}
          style={{ ...flipStyle(box.from, box.to, gather), opacity: gather }}
          className="rounded-lg border border-border bg-card shadow-xs"
        />
      ))}
      {plan.members.map((member) => (
        <div
          key={member.id}
          style={{ ...flipStyle(member.from, member.to, gather), opacity: memberOpacity }}
          className="rounded-sm bg-foreground/25"
        />
      ))}
    </div>
  );
}
