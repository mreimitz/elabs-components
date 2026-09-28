import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useReactFlow } from "@elabs-ai/components-flow";
import type { Viewport } from "@xyflow/react";
import { navigate, parseRoute, useRoute } from "../routes/use-hash";
import { diagramStore } from "../state/diagram-store";
import { createStore } from "../state/create-store";
import { motionMs } from "../motion";
import { interactionActions } from "./interaction-store";
import type { DrillCrumb } from "./drill-target";

export const drillView = createStore<{
  crumbs: readonly DrillCrumb[];
  error?: string;
  root: string | null;
}>({ crumbs: [], root: null });
export const useDrillView = () => useSyncExternalStore(drillView.subscribe, drillView.get);
const frames = new Map<string, { viewport: Viewport; focus: string }>();
let generation = 0;
// Any source/dependency/layout revision invalidates both pending camera animations and
// saved coordinates; a same-path reload is a new document session too.
let revision = diagramStore.get();
diagramStore.subscribe(() => {
  const next = diagramStore.get();
  if (
    next.path !== revision.path ||
    next.loadCount !== revision.loadCount ||
    next.text !== revision.text ||
    next.drawn !== revision.drawn ||
    next.layoutRequest !== revision.layoutRequest
  ) {
    frames.clear();
    generation++;
  }
  revision = next;
});
if (typeof window !== "undefined")
  window.addEventListener("hashchange", () => {
    generation++;
  });
function frameKey(root: string | null, chain: readonly string[]) {
  return `${root ?? "shared"}:${chain.join(".")}`;
}
export function backFromDrill(depth?: number) {
  const route = parseRoute(window.location.hash);
  if (route.kind !== "doc" || !route.into?.length) return;
  generation++;
  const into = route.into.slice(0, depth ?? -1);
  navigate({ ...route, into: into.length ? into : undefined });
}
/** Camera belongs to its still-mounted parent canvas, never the editor document store. */
export function useDrillCamera(
  chain: readonly string[],
  ready: boolean,
  pane: React.RefObject<HTMLDivElement | null>,
) {
  const route = useRoute();
  const { getNode, getInternalNode, getViewport, setViewport, fitBounds } = useReactFlow();
  const key = chain.join(".");
  const wasHere = useRef(false);
  const root = route.kind === "doc" ? route.path : null;
  const here = route.kind === "doc" && (route.into?.join(".") ?? "") === key;
  useEffect(() => {
    if (!here) {
      wasHere.current = false;
      return;
    }
    if (!ready || wasHere.current) return;
    wasHere.current = true;
    const saved = frames.get(frameKey(root, chain));
    if (!saved) return;
    const requested = ++generation;
    void setViewport(saved.viewport, { duration: motionMs("base") }).then(() => {
      if (requested !== generation) return;
      pane.current
        ?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(saved.focus)}"]`)
        ?.focus({ preventScroll: true });
    });
  }, [here, ready, key, root, setViewport, pane, chain]);
  return useCallback(
    async (id: string) => {
      const current = parseRoute(window.location.hash);
      if (current.kind !== "doc" || (current.into?.join(".") ?? "") !== key) return;
      const node = getNode(id);
      const internal = getInternalNode(id);
      if (
        !node ||
        typeof node.data.component !== "string" ||
        node.data.broken ||
        node.data.pending ||
        !internal
      )
        return;
      const requested = ++generation;
      const load = diagramStore.get().loadCount;
      frames.set(frameKey(current.path, chain), { viewport: getViewport(), focus: id });
      interactionActions.closeCard();
      await fitBounds(
        {
          ...internal.internals.positionAbsolute,
          width: node.measured?.width ?? 224,
          height: node.measured?.height ?? 160,
        },
        { duration: motionMs("base"), padding: 0.25 },
      );
      const now = parseRoute(window.location.hash);
      if (
        requested !== generation ||
        load !== diagramStore.get().loadCount ||
        now.kind !== "doc" ||
        now.path !== current.path ||
        (now.into?.join(".") ?? "") !== key
      )
        return;
      navigate({ ...now, into: [...chain, ...id.split(".")] });
    },
    [getNode, getInternalNode, getViewport, fitBounds, key, chain],
  );
}
