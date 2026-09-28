import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useReactFlow, type Node } from "@elabs-ai/components-flow";
// P4: flow exposes the instance but not this pure viewport helper.
import { getViewportForBounds, type Viewport } from "@xyflow/react";
import { chromeFitPadding } from "../chrome/fit-padding";
import { canvasChrome } from "../chrome/canvas-chrome";
import { motionMs, prefersReducedMotion } from "../motion";
import { useLens } from "../shell/lens-store";
import { litStoryNodes, visibleStoryTarget } from "./visible-targets";
import { advanceProgress, followPosition } from "./camera-math";
import { storyActions, storyStore, useStory } from "./story-store";

export function useStoryCamera(
  paneRef: RefObject<HTMLDivElement | null>,
  ready: boolean,
  nodes: readonly Node[],
  structure: string,
) {
  const flow = useReactFlow();
  const state = useStory((s) => s);
  const step = state.index === null ? undefined : state.story.steps[state.index];
  const technical = useLens((s) => s.position === 0 && s.target === "technical");
  const generation = useRef(0);
  const [litNodes, litEdges] = useMemo(
    () => (step ? [litStoryNodes(step.nodeIds, nodes), new Set(step.edgeIds)] : [null, null]),
    [step, nodes],
  );
  const geometry = JSON.stringify(
    nodes.map((node) => [
      node.id,
      node.parentId,
      node.position.x,
      node.position.y,
      node.width,
      node.height,
      node.measured?.width,
      node.measured?.height,
      node.hidden,
    ]),
  );
  const fit = useRef<Viewport | null>(null);
  const original = useRef<{ source: string; viewport: Viewport } | null>(null);
  const cameraReady = useRef(false);
  const active = Boolean(step && technical);
  const [paneGeometry, setPaneGeometry] = useState("");
  useEffect(() => {
    const pane = paneRef.current?.querySelector<HTMLElement>(".react-flow");
    if (!pane) return;
    const chrome = canvasChrome(pane);
    const bar = chrome?.querySelector<HTMLElement>('[data-slot="story-bar"]');
    const measure = () => {
      const box = pane.getBoundingClientRect();
      const caption = bar?.getBoundingClientRect();
      setPaneGeometry(
        `${box.width}:${box.height}:${caption?.top}:${caption?.width}:${caption?.height}`,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    if (bar) observer.observe(bar);
    measure();
    return () => observer.disconnect();
  }, [paneRef, active]);
  useEffect(() => {
    if (ready && technical && state.pendingPlay) storyActions.play();
  }, [ready, technical, state.pendingPlay]);
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane || !active) return;
    const manual = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[data-slot="story-bar"]')) return;
      storyActions.manual();
      generation.current++;
    };
    const chrome = canvasChrome(pane.querySelector<HTMLElement>(".react-flow") ?? pane);
    for (const element of new Set([pane, chrome].filter(Boolean))) {
      element?.addEventListener("pointerdown", manual, true);
      element?.addEventListener("wheel", manual, true);
      element?.addEventListener("touchstart", manual, true);
    }
    const hidden = () => {
      if (document.hidden) manual(new Event("hidden"));
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      for (const element of new Set([pane, chrome].filter(Boolean))) {
        element?.removeEventListener("pointerdown", manual, true);
        element?.removeEventListener("wheel", manual, true);
        element?.removeEventListener("touchstart", manual, true);
      }
    };
  }, [active, paneRef]);
  useEffect(() => {
    const token = ++generation.current;
    cameraReady.current = false;
    const host = paneRef.current;
    if (host) {
      host.dataset.storyCameraReady = "false";
      host.dataset.storyCameraStep = step?.id ?? "";
    }
    if (!active || !step) {
      // A source/lens change invalidates the old camera; only an ordinary End restores it.
      if (original.current?.source !== state.source) original.current = null;
      else if (original.current && ready) {
        void flow.setViewport(original.current.viewport);
        original.current = null;
      }
      return;
    }
    if (!ready || !state.camera) return;
    const pane = paneRef.current?.querySelector<HTMLElement>(".react-flow");
    if (!pane) return;
    const selected = step.nodeIds.flatMap((id) => {
      const visible = visibleStoryTarget(id, flow.getNodes());
      const node = visible ? flow.getInternalNode(visible.id) : undefined;
      return node && !node.hidden
        ? [{ ...node, parentId: undefined, position: node.internals.positionAbsolute }]
        : [];
    });
    if (!selected.length) return;
    if (!original.current)
      original.current = { source: state.source, viewport: flow.getViewport() };
    const bounds = flow.getNodesBounds(selected);
    const box = pane.getBoundingClientRect();
    const padding = chromeFitPadding(pane, selected, { minZoom: 0.05, maxZoom: 1.25 });
    let target = getViewportForBounds(bounds, box.width, box.height, 0.1, 1.25, padding ?? 24);
    fit.current = target;
    if (step.camera === "follow" && !prefersReducedMotion()) {
      target = followViewport(pane, step.follow, storyStore.get().progress, target.zoom) ?? target;
    }
    const from = flow.getViewport();
    const duration = motionMs("camera");
    const start = performance.now();
    let frame = 0;
    const apply = (time: number) => {
      if (token !== generation.current) return;
      const amount = duration === 0 ? 1 : Math.min(1, (time - start) / duration);
      const eased = amount * amount * (3 - 2 * amount);
      const viewport = {
        x: from.x + (target.x - from.x) * eased,
        y: from.y + (target.y - from.y) * eased,
        zoom: from.zoom + (target.zoom - from.zoom) * eased,
      };
      if (amount < 1) {
        void flow.setViewport(viewport);
        frame = requestAnimationFrame(apply);
      } else {
        const latest =
          step.camera === "follow" && !prefersReducedMotion()
            ? followViewport(
                pane,
                step.follow,
                storyStore.get().progress,
                fit.current?.zoom ?? target.zoom,
              )
            : null;
        // The viewport API resolves asynchronously; publish readiness only after its DOM
        // commit. A superseding step/layout/source still owns the cancellation token.
        void flow.setViewport(latest ?? viewport).then(() => {
          if (token !== generation.current) return;
          frame = requestAnimationFrame(() => {
            if (token !== generation.current) return;
            cameraReady.current = true;
            if (host) host.dataset.storyCameraReady = "true";
          });
        });
      }
    };
    frame = requestAnimationFrame(apply);
    return () => {
      if (generation.current === token) generation.current = token + 1;
      cancelAnimationFrame(frame);
    };
  }, [
    active,
    step,
    state.source,
    state.camera,
    technical,
    ready,
    structure,
    geometry,
    paneGeometry,
    flow,
    paneRef,
  ]);
  useEffect(() => {
    if (!active || !step || !state.playing || !ready) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const current = storyStore.get();
      if (!current.playing || current.index !== state.index || current.source !== state.source)
        return;
      const elapsed = cameraReady.current ? Math.min(100, now - last) : 0;
      last = now;
      const progress = advanceProgress(current.progress, elapsed, step.duration);
      storyStore.set({ progress });
      if (progress >= 1) {
        if ((current.index ?? 0) + 1 < current.story.steps.length)
          storyActions.go((current.index ?? 0) + 1, true);
        else storyActions.pause();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, ready, step, state.index, state.source, state.playing]);
  useEffect(() => {
    if (
      !active ||
      !step ||
      !ready ||
      !state.camera ||
      !cameraReady.current ||
      !fit.current ||
      prefersReducedMotion() ||
      step.camera !== "follow"
    )
      return;
    const pane = paneRef.current?.querySelector<HTMLElement>(".react-flow");
    const viewport = pane
      ? followViewport(pane, step.follow, state.progress, fit.current.zoom)
      : null;
    if (viewport) void flow.setViewport(viewport);
  }, [active, step, ready, state.progress, state.camera, flow, paneRef]);
  // Changes to positions caused by layout must settle before fitting. Node dim attributes do
  // not invalidate the camera, and neither does ordinary selection.
  const releaseForDrill = useCallback(() => {
    if (storyStore.get().index === null) return undefined;
    const viewport = original.current?.viewport ?? flow.getViewport();
    generation.current++;
    original.current = null;
    storyActions.end();
    return viewport;
  }, [flow]);
  return { litNodes, litEdges, releaseForDrill };
}

function followViewport(
  pane: HTMLElement,
  follow: readonly { edgeId: string; reverse: boolean }[],
  progress: number,
  fitZoom: number,
): Viewport | null {
  const at = followPosition(progress, follow.length);
  const item = at ? follow[at.index] : undefined;
  if (!at || !item) return null;
  const edge = [...pane.querySelectorAll<SVGGElement>(".react-flow__edge")].find(
    (element) =>
      element.dataset.id === item.edgeId ||
      (element.dataset.id?.startsWith("flow-group-proxy__") &&
        element.dataset.id.endsWith(`__${item.edgeId}`)),
  );
  const path = edge?.querySelector<SVGPathElement>("path.react-flow__edge-path");
  if (!path) return null;
  const point = path.getPointAtLength(
    path.getTotalLength() * (item.reverse ? 1 - at.fraction : at.fraction),
  );
  const box = pane.getBoundingClientRect();
  const bar = canvasChrome(pane)
    ?.querySelector<HTMLElement>('[data-slot="story-bar"]')
    ?.getBoundingClientRect();
  const usable = bar ? Math.max(80, bar.top - box.top - 16) : box.height * 0.65;
  const zoom = Math.min(1.25, Math.max(fitZoom, 0.65));
  return { x: box.width / 2 - point.x * zoom, y: usable / 2 - point.y * zoom, zoom };
}
