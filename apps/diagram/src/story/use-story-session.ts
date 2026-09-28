import { useEffect, useLayoutEffect, useMemo } from "react";
import { parseRoute, useRoute } from "../routes/use-hash";
import { useLens } from "../shell/lens-store";
import type { ArchCompileView } from "../spec/compile/compile-arch";
import { storyActions, storyStore, useStory } from "./story-store";

const EMPTY_EXPANSION: readonly string[] = [];
/** Source identity is content, not compile object identity (hash changes can recompile). */
export function useStorySession(
  path: string | null,
  source: string,
  view: ArchCompileView | null | undefined,
) {
  const route = useRoute();
  const target = useLens((s) => s.target);
  const position = useLens((s) => s.position);
  const story = view?.story;
  const sourceKey = useMemo(
    () => `${path ?? ""}\n${source}\n${JSON.stringify(story)}`,
    [path, source, story],
  );
  useLayoutEffect(() => {
    if (story) storyActions.bind(sourceKey, path, story);
  }, [sourceKey, path, story]);
  const available =
    route.kind === "doc" && (route.path === path || route.path === null) && !route.into?.length;
  useLayoutEffect(() => {
    if (!available || target !== "technical") {
      const pendingPlay = storyStore.get().pendingPlay;
      storyActions.end();
      if (available && pendingPlay && target === "technical") storyActions.requestTechnical();
    }
  }, [available, target]);
  useEffect(() => {
    const onHash = () => {
      const next = parseRoute(window.location.hash);
      if (
        next.kind !== "doc" ||
        next.path !== path ||
        next.into?.length ||
        next.lens === "visual"
      ) {
        storyActions.end();
        return;
      }
      const index = next.step === undefined ? null : next.step - 1;
      if (index === null || !storyStore.get().story.steps[index]) storyActions.end();
      else if (index !== storyStore.get().index) storyActions.go(index);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [path]);
  const state = useStory((s) => s);
  return available &&
    target === "technical" &&
    position === 0 &&
    state.source === sourceKey &&
    state.index !== null
    ? (state.story.steps[state.index]?.expand ?? EMPTY_EXPANSION)
    : EMPTY_EXPANSION;
}
