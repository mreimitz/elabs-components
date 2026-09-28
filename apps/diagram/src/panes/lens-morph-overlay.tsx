import { profileVariables } from "../style/profile-paint";
import type { StyleProfile } from "../style/types";
import { useDiagramStyle } from "../style/react-style";
import { memo, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { ArchMark } from "../nodes/arch-mark";
import type { ArchDiagram } from "../spec/dialect";
import { lensStore, registerLensPreparation } from "../shell/lens-store";
import { isLayoutReady } from "./layout-ready-store";
import { diagramStore, useDiagram } from "../state/diagram-store";
import { visualSnapshot } from "../visual/snapshot";
import { layoutVisualLens } from "../visual/lane-layout";
import { type VisualBox, type VisualLens } from "../visual/visual-model";

/** Technical members gather into capability boxes in graph coordinates. Both live panes and
 * the overlay use the same interpolated camera, with real content at each endpoint. */

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

function cameraOf(element: HTMLElement): Camera {
  const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
  return { x: matrix.e, y: matrix.f, zoom: matrix.a };
}

function rectFrom(el: Element, container: DOMRect, camera: Camera): Rect {
  const r = el.getBoundingClientRect();
  return {
    left: (r.left - container.left - camera.x) / camera.zoom,
    top: (r.top - container.top - camera.y) / camera.zoom,
    width: r.width / camera.zoom,
    height: r.height / camera.zoom,
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
): string | undefined {
  const counts = new Map<string, number>();
  for (const id of zoneDescendantIds(zoneId, ast)) {
    const box = nodeToBox.get(id);
    if (!box) continue;
    const lane = box.controlPlane ? "@control-plane" : box.lane;
    counts.set(lane, (counts.get(lane) ?? 0) + 1);
  }
  let best: string | undefined;
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
  title: string;
  icon?: string;
  from: Rect;
  to: Rect;
}

interface BoxGhost {
  id: string;
  content: HTMLElement;
  /** A blank rectangle would read as nothing was there — carry the box's own title so the
   * ghost still names what is gathering. */
  title: string;
  from: Rect;
  to: Rect;
}

interface ZoneGhost {
  targetPaint?: CSSProperties;
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
  technicalBackground: string;
  visualBackground: string;
  technicalText: string;
  visualText: string;
  fromCamera: Camera;
  toCamera: Camera;
  members: MemberGhost[];
  boxes: BoxGhost[];
  zones: ZoneGhost[];
  technicalFlows: Segment[];
  visualFlows: FlowSegment[];
}

/** Capture both layouts in graph coordinates; a single camera transforms the whole morph. */
function capturePlan(
  container: HTMLElement,
  ast: ArchDiagram,
  hero: string | null,
  profile: StyleProfile,
): MorphPlan | null {
  const containerRect = container.getBoundingClientRect();
  const technicalViewport = container.querySelector<HTMLElement>(
    '[data-lens-pane="technical"] .react-flow__viewport',
  );
  const visualViewport = container.querySelector<HTMLElement>(
    '[data-lens-pane="visual"] .react-flow__viewport',
  );
  if (!technicalViewport || !visualViewport) return null;
  const fromCamera = cameraOf(technicalViewport);
  const toCamera = cameraOf(visualViewport);
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
    if (id) techRect.set(id, rectFrom(el, containerRect, fromCamera));
  }
  const visRect = new Map<string, Rect>();
  for (const el of visEls) {
    const id = el.dataset.id;
    if (id) visRect.set(id, rectFrom(el, containerRect, toCamera));
  }

  const lens: VisualLens = visualSnapshot(ast, hero, profile).lens;
  const renderedLanes = layoutVisualLens(lens).lanes.map(({ lane }) => lane);
  const nodeToBox = new Map<string, VisualBox>();
  for (const box of lens.boxes) for (const member of box.members) nodeToBox.set(member.id, box);

  const members: MemberGhost[] = [];
  const boxes: BoxGhost[] = [];
  for (const box of lens.boxes) {
    const to = visRect.get(box.id);
    if (!to) continue;
    const memberRects: Rect[] = [];
    box.members.forEach((member) => {
      const from = techRect.get(member.id);
      if (!from) return;
      memberRects.push(from);
      // The member's real, laid-out row inside the visual box (`capability-box-node.tsx`'s own
      // `data-member-id`, its header row for a `soleMember` box, its member-list row
      // otherwise) — never a synthetic estimate of where that row might sit.
      const row = container.querySelector<HTMLElement>(
        `[data-lens-pane="visual"] [data-member-id="${CSS.escape(member.id)}"]`,
      );
      if (!row) return;
      members.push({
        id: member.id,
        title: member.title,
        icon: member.icon,
        from,
        to: rectFrom(row, containerRect, toCamera),
      });
    });
    if (memberRects.length === 0) continue;
    const union = unionRect(memberRects);
    const cx = union.left + union.width / 2;
    const cy = union.top + union.height / 2;
    const fromW = to.width * 0.6;
    const fromH = to.height * 0.6;
    const content = container.querySelector<HTMLElement>(
      `[data-lens-pane="visual"] .react-flow__node[data-id="${CSS.escape(box.id)}"] [data-slot="capability-box"]`,
    );
    if (!content) continue;
    boxes.push({
      id: box.id,
      content: content.cloneNode(true) as HTMLElement,
      title: box.title,
      from: { left: cx - fromW / 2, top: cy - fromH / 2, width: fromW, height: fromH },
      to,
    });
  }

  const lanePaint = (id: string): CSSProperties | undefined => {
    const element = container.querySelector<HTMLElement>(
      `[data-lens-pane="visual"] .react-flow__node[data-id="lane:${CSS.escape(id)}"] [data-slot="lane-panel"]`,
    );
    if (!element) return;
    const computed = getComputedStyle(element);
    return {
      backgroundColor: computed.backgroundColor,
      borderColor: computed.borderColor,
      borderStyle: computed.borderStyle,
      borderWidth: computed.borderWidth,
      borderRadius: computed.borderRadius,
      borderTopColor: computed.borderTopColor,
      borderTopWidth: computed.borderTopWidth,
      borderTopStyle: computed.borderTopStyle as CSSProperties["borderTopStyle"],
    };
  };
  const zones: ZoneGhost[] = [];
  const zonedLanes = new Set<string>();
  for (const zone of ast.zones) {
    if (zone.parent !== undefined) continue;
    const from = techRect.get(zone.id);
    if (!from) continue;
    const lane = laneForZone(zone.id, ast, nodeToBox);
    if (!lane) continue;
    const to = visRect.get(`lane:${lane}`);
    if (!to) continue;
    zonedLanes.add(lane);
    zones.push({
      id: zone.id,
      targetPaint: lanePaint(lane),
      fromTitle: zone.title,
      toTitle: renderedLanes.find((item) => item.id === lane)?.title ?? lane,
      from,
      to,
    });
  }
  // A lane with no matching top-level zone (e.g. "Sources" built only from actors/network
  // nodes) would have no ghost at all and just pop in at the very end. It gets one too, growing
  // from the union of ITS boxes' own technical rects instead of a zone's — same gather/dress
  // timeline, no zone title to cross-fade from.
  for (const lane of renderedLanes) {
    if (zonedLanes.has(lane.id)) continue;
    const to = visRect.get(`lane:${lane.id}`);
    if (!to) continue;
    const memberRects = lens.boxes
      .filter((box) => (box.controlPlane ? "@control-plane" : box.lane) === lane.id)
      .flatMap((box) => box.members.map((member) => techRect.get(member.id)))
      .filter((rect): rect is Rect => rect !== undefined);
    if (memberRects.length === 0) continue;
    zones.push({
      id: `lane:${lane.id}`,
      targetPaint: lanePaint(lane.id),
      fromTitle: "",
      toTitle: lane.title,
      from: unionRect(memberRects),
      to,
    });
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

  // Resolve tokens within their actual pane scope once, never during an animation frame.
  const paneColor = (pane: Element, value: string): string => {
    const token = /^var\((--[a-z\d-]+)\)$/.exec(value);
    return token ? getComputedStyle(pane).getPropertyValue(token[1]!).trim() : value;
  };
  return {
    fromCamera,
    toCamera,
    members,
    boxes,
    zones,
    technicalFlows,
    visualFlows,
    technicalBackground: paneColor(technicalViewport, "var(--canvas)"),
    visualBackground: paneColor(
      visualViewport,
      profile.ground.followTheme ? "var(--canvas)" : profile.ground.fill,
    ),
    technicalText: paneColor(technicalViewport, "var(--foreground)"),
    visualText: paneColor(visualViewport, "var(--foreground)"),
  };
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** A cheap ease-in-out standing in for the tokens' own `cubic-bezier` (`motion.ts` MOTION.ease
 * is a CSS string, not a JS interpolator) — close enough for a ghost's own eased sub-tween. */
export function smoothstep(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

export function subProgress(position: number, start: number, end: number): number {
  return smoothstep((position - start) / (end - start));
}

/** The scale factor a FLIP tween (`flipStyle`) is actually rendering at time `t` along one
 * axis — the inverse of this, applied to a child, cancels the parent's non-uniform scale so
 * text inside a ghost stays legible instead of stretching. `to` is never 0 in practice (a box/lane ghost's
 * target rect is real, measured geometry). */
function scaleAt(from: number, to: number, t: number): number {
  if (to === 0) return 1;
  const s = from / to;
  return s + (1 - s) * t;
}

/** A ghost's frame scales (compositor-friendly `transform`); its label counter-scales by the
 * inverse, from the SAME origin, so the two cancel and the text renders at 1:1 throughout —
 * an "unscaled layer" without a second, unscaled DOM copy of the whole subtree. */
function unscaledLabelStyle(from: Rect, to: Rect, t: number): CSSProperties {
  const sx = scaleAt(from.width, to.width, t);
  const sy = scaleAt(from.height, to.height, t);
  return {
    position: "absolute",
    inset: 0,
    transform: `scale(${1 / sx}, ${1 / sy})`,
    transformOrigin: "top left",
  };
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
export const GATHER_START = 120 / 700;
const GATHER_END = 450 / 700;
/** §7's "dress" phase: the visual pane's own real content fades IN over the transition's last
 * 200 ms (`canvas-pane.tsx` reads this: real content must be the first and last frame, never
 * a blank ghost-only interval at either end). */
export const DRESS_START = 500 / 700;

const BoxContent = memo(function BoxContent({
  element,
  textOpacity,
}: {
  element: HTMLElement;
  textOpacity: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const target = ref.current;
    if (!target) return;
    const copy = element.cloneNode(true) as HTMLElement;
    copy.tabIndex = -1;
    target.replaceChildren(copy);
    return () => target.replaceChildren();
  }, [element]);
  useLayoutEffect(() => {
    for (const child of ref.current?.firstElementChild?.children ?? [])
      (child as HTMLElement).style.opacity = String(textOpacity);
  }, [element, textOpacity]);
  return <div ref={ref} className="absolute inset-0" />;
});

export const LensMorphOverlay = memo(
  function LensMorphOverlay({
    containerRef,
    position,
    active,
  }: {
    containerRef: RefObject<HTMLDivElement | null>;
    position: number;
    active: boolean;
  }) {
    const style = useDiagramStyle();
    const heroRef = useRef(style.hero);
    heroRef.current = style.hero;
    const profileRef = useRef(style.visual);
    profileRef.current = style.visual;
    const ast = useDiagram((s) => s.drawn.ast);
    const astRef = useRef(ast);
    astRef.current = ast;
    const [plan, setPlan] = useState<MorphPlan | null>(null);

    // Prepare geometry while idle, after either graph lays out. Starting a transition only
    // changes compositor transforms; it never synchronously walks and clones both live graphs.
    useLayoutEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      let timer: ReturnType<typeof setTimeout>;
      const schedule = () => {
        clearTimeout(timer);
        if (lensStore.get().animating) return;
        timer = setTimeout(() => {
          if (!lensStore.get().animating && astRef.current)
            setPlan(capturePlan(container, astRef.current, heroRef.current, profileRef.current));
        }, 80);
      };
      const observer = new MutationObserver(schedule);
      for (const pane of container.querySelectorAll("[data-lens-pane]"))
        observer.observe(pane, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["style"],
        });
      const resize = new ResizeObserver(schedule);
      resize.observe(container);
      schedule();
      return () => {
        clearTimeout(timer);
        observer.disconnect();
        resize.disconnect();
      };
    }, [containerRef, ast, style.visual, style.hero]);
    useLayoutEffect(() => {
      let mounted = true;
      const unregister = registerLensPreparation(
        () =>
          new Promise<boolean>((resolve) => {
            let previous = "";
            let stableFrames = 0;
            let attempts = 0;
            const prepare = () => {
              const container = containerRef.current;
              if (!mounted || !container || !astRef.current) {
                resolve(false);
                return;
              }
              const panes = container.querySelectorAll<HTMLElement>(
                "[data-lens-pane] .react-flow__viewport",
              );
              if (panes.length !== 2) {
                resolve(false);
                return;
              }
              const signature = [...panes].map((pane) => pane.style.transform).join("|");
              stableFrames = signature === previous ? stableFrames + 1 : 0;
              previous = signature;
              const ready =
                isLayoutReady(diagramStore.get().path) &&
                container.querySelector('[data-lens-pane="visual"] [data-visual-ready="true"]');
              if (ready && stableFrames >= 2) {
                const next = capturePlan(
                  container,
                  astRef.current,
                  heroRef.current,
                  profileRef.current,
                );
                setPlan(next);
                // Commit the prepared overlay before publishing its first moving frame.
                requestAnimationFrame(() => resolve(mounted && next !== null));
              } else if (++attempts < 120) requestAnimationFrame(prepare);
              else resolve(false);
            };
            requestAnimationFrame(prepare);
          }),
      );
      return () => {
        mounted = false;
        unregister();
      };
    }, [containerRef]);

    // The real source/target content participates in exactly the same camera while fading.
    // The stores retain their settled viewports; restore their DOM transform when the tween ends.
    useLayoutEffect(() => {
      if (!active) return;
      const viewports = [
        ...(containerRef.current?.querySelectorAll<HTMLElement>(".react-flow__viewport") ?? []),
      ];
      const original = viewports.map((viewport) => viewport.style.transform);
      return () =>
        viewports.forEach((viewport, index) => {
          viewport.style.transform = original[index]!;
        });
    }, [containerRef, active]);
    const cameraProgress = smoothstep(position);
    const camera = plan
      ? {
          x: plan.fromCamera.x + (plan.toCamera.x - plan.fromCamera.x) * cameraProgress,
          y: plan.fromCamera.y + (plan.toCamera.y - plan.fromCamera.y) * cameraProgress,
          zoom: plan.fromCamera.zoom + (plan.toCamera.zoom - plan.fromCamera.zoom) * cameraProgress,
        }
      : null;
    const cameraTransform = camera
      ? `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`
      : "";
    useLayoutEffect(() => {
      if (!active || !cameraTransform) return;
      for (const viewport of containerRef.current?.querySelectorAll<HTMLElement>(
        ".react-flow__viewport",
      ) ?? [])
        viewport.style.transform = cameraTransform;
    }, [cameraTransform, containerRef, active]);
    if (!plan) return null;

    const gather = subProgress(position, GATHER_START, GATHER_END);
    // "opacity → 0 in the last 30 %" of the gather phase (§7); scale/position keep tweening
    // with `gather` the whole time, so a member ghost is still exactly at its slot in the box
    // when it finishes fading, not left short.
    const textHandoff = subProgress(position, GATHER_END - 0.04, DRESS_START);
    const memberOpacity = 1 - textHandoff;
    const edgeOut = 1 - smoothstep(position / 0.5);
    const edgeIn = smoothstep((position - 0.5) / 0.5);
    const zoneT = smoothstep(position);
    // The overlay itself would otherwise sit at a flat, fully-opaque weight for its whole "gather"
    // span (`gather` reaches 1 at `GATHER_END` and holds there) while `canvas-pane.tsx`'s two real
    // panes are already both fully transparent — an opaque ghost layer popping in over blank
    // panes, and popping back out in one frame the instant this component unmounts at a settled
    // `position`, is exactly the "swap" S10 §7 rules out. The whole overlay instead ramps in
    // lock-step with the SOURCE pane's own fade-out (0 → 1 over the same `[0, GATHER_START]`
    // window `technicalOpacity` fades 1 → 0 over) and ramps back out in lock-step with the TARGET
    // pane's fade-in (1 → 0 over the same `[DRESS_START, 1]` window `visualOpacity` fades 0 → 1
    // over) — direction-agnostic (a pure function of `position`), so a mid-flight reverse crosses
    // the same curve backwards with no discontinuity. Applied to the outer container below, it
    // multiplies every ghost's own opacity (CSS `opacity` compounds on nested elements), so this
    // is the one place that needs to change, not each ghost kind's own timing.
    const overlayOpacity =
      position <= GATHER_START
        ? subProgress(position, 0, GATHER_START)
        : position >= DRESS_START
          ? 1 - subProgress(position, DRESS_START, 1)
          : 1;

    const fixedVisual = !style.visual.ground.followTheme;
    return (
      <div
        data-slot="lens-morph-overlay"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ opacity: active ? overlayOpacity : 0, visibility: active ? "visible" : "hidden" }}
        aria-hidden="true"
        inert
      >
        {fixedVisual ? (
          <>
            <div
              data-morph-ground="technical"
              className="absolute inset-0"
              style={{ backgroundColor: plan.technicalBackground }}
            />
            <div
              data-morph-ground="visual"
              className="absolute inset-0"
              style={{ backgroundColor: plan.visualBackground, opacity: cameraProgress }}
            />
          </>
        ) : null}
        <div
          data-morph-camera
          className="absolute inset-0 origin-top-left"
          style={{ transform: cameraTransform }}
        >
          <svg className="absolute inset-0 h-full w-full overflow-visible">
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
                stroke={
                  fixedVisual
                    ? seg.solid
                      ? style.visual.flows.data.stroke
                      : style.visual.flows.control.stroke
                    : "var(--border-strong)"
                }
                strokeWidth={
                  fixedVisual
                    ? seg.solid
                      ? style.visual.flows.data.width
                      : style.visual.flows.control.width
                    : 1.5
                }
                strokeDasharray={
                  fixedVisual
                    ? seg.solid
                      ? undefined
                      : style.visual.flows.control.dash === "none"
                        ? undefined
                        : style.visual.flows.control.dash
                    : seg.solid
                      ? undefined
                      : "4 3"
                }
                opacity={edgeIn}
              />
            ))}
          </svg>
          {plan.zones.map((zone) => (
            <div
              key={zone.id}
              data-morph-lane={zone.id}
              style={flipStyle(zone.from, zone.to, zoneT)}
              className="relative overflow-hidden rounded-lg border border-border bg-surface-muted"
            >
              {fixedVisual ? (
                <div className="absolute inset-0" style={{ ...zone.targetPaint, opacity: zoneT }} />
              ) : null}
              {/* The frame above scales non-uniformly (a zone's aspect ratio rarely matches its
              lane's) — this layer counter-scales by the inverse from the same origin so the
              title renders at 1:1 the whole time instead of stretching with it. */}
              <div style={unscaledLabelStyle(zone.from, zone.to, zoneT)}>
                {zone.fromTitle ? (
                  <div
                    className="text-meta absolute inset-x-0 top-0 truncate px-3 py-2 font-medium tracking-wide text-muted-foreground uppercase"
                    style={{ opacity: 1 - subProgress(position, 0, 0.4) }}
                  >
                    {zone.fromTitle}
                  </div>
                ) : null}
                <div
                  className="text-meta absolute inset-x-0 top-0 truncate px-3 py-2 font-medium tracking-wide text-muted-foreground uppercase"
                  style={{
                    opacity: subProgress(position, 0.6, 1),
                    color: fixedVisual ? style.visual.roles.zone.text : undefined,
                  }}
                >
                  {zone.toTitle}
                </div>
              </div>
            </div>
          ))}
          {plan.boxes.map((box) => (
            <div
              key={box.id}
              data-morph-box={box.id}
              style={{
                ...profileVariables(style.visual),
                ...flipStyle(box.from, box.to, gather),
                opacity: gather,
              }}
            >
              <BoxContent element={box.content} textOpacity={textHandoff} />
            </div>
          ))}
          {plan.members.map((member) => (
            <div
              key={member.id}
              style={{
                ...flipStyle(member.from, member.to, gather),
                opacity: memberOpacity,
              }}
              className="overflow-hidden"
            >
              {/* The same `flex items-center gap-1.5` + `ArchMark`/`text-meta` shape
              `capability-box-node.tsx`'s own member row renders — an anonymous grey square read
              as nothing was there; this ghost carries the member's own icon and name gathering
              into place, same as the box ghost above carries its title. Counter-scaled by the
              parent's own FLIP tween (`unscaledLabelStyle`) for the same reason a zone/box
              ghost's title is: the icon and text must not stretch with the frame around them. */}
              {(fixedVisual
                ? [
                    { id: "technical", color: plan.technicalText, opacity: 1 - cameraProgress },
                    { id: "visual", color: plan.visualText, opacity: cameraProgress },
                  ]
                : [{ id: "neutral" }]
              ).map(({ id, ...paint }) => (
                <div
                  key={id}
                  style={{ ...unscaledLabelStyle(member.from, member.to, gather), ...paint }}
                  className="flex min-w-0 items-center gap-1.5"
                >
                  <ArchMark icon={member.icon} size={16} variant="mono" className="shrink-0" />
                  <span className="text-meta min-w-0 truncate">{member.title}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  },
  (previous, next) =>
    previous.containerRef === next.containerRef && !previous.active && !next.active,
);
