import { useSyncExternalStore } from "react";
import { createStore } from "../state/create-store";
import { parseRoute, toHash } from "../routes/use-hash";
import type { ResolvedStory } from "./types";

const EMPTY: ResolvedStory = { explicit: false, steps: [], issues: [] };
export interface StoryState {
  source: string;
  path: string | null;
  story: ResolvedStory;
  index: number | null;
  progress: number;
  playing: boolean;
  /** Manual gestures pause the clock and relinquish the camera until an explicit action. */
  camera: boolean;
  pendingPlay: boolean;
}
export const storyStore = createStore<StoryState>({
  source: "",
  path: null,
  story: EMPTY,
  index: null,
  progress: 0,
  playing: false,
  camera: false,
  pendingPlay: false,
});
export function useStory<T>(select: (state: StoryState) => T): T {
  return useSyncExternalStore(storyStore.subscribe, () => select(storyStore.get()));
}
function shareStep(index: number | null) {
  const route = parseRoute(window.location.hash);
  if (route.kind !== "doc" || route.into?.length || route.path !== storyStore.get().path) return;
  window.history.replaceState(
    window.history.state,
    "",
    toHash({ ...route, step: index === null ? undefined : index + 1 }),
  );
}
export const storyActions = {
  bind(source: string, path: string | null, story: ResolvedStory) {
    if (storyStore.get().source === source) return;
    const route = parseRoute(window.location.hash);
    const first = storyStore.get().path !== path || !storyStore.get().source;
    const index =
      first &&
      route.kind === "doc" &&
      !route.into?.length &&
      route.lens !== "visual" &&
      route.step &&
      story.steps[route.step - 1]
        ? route.step - 1
        : null;
    storyStore.set({
      source,
      path,
      story,
      index,
      progress: 0,
      playing: false,
      camera: index !== null,
      pendingPlay: false,
    });
    if (!first) shareStep(null);
  },
  go(index: number, playing = false) {
    if (!storyStore.get().story.steps[index]) return;
    storyStore.set({ index, progress: 0, playing, camera: true, pendingPlay: false });
    shareStep(index);
  },
  move(delta: number) {
    const state = storyStore.get();
    storyActions.go((state.index ?? -1) + delta, state.playing);
  },
  play() {
    const state = storyStore.get();
    if (state.index === null || state.progress >= 1)
      storyActions.go(
        state.index === null || state.index === state.story.steps.length - 1 ? 0 : state.index + 1,
        true,
      );
    else storyStore.set({ playing: true, camera: true, pendingPlay: false });
  },
  pause() {
    storyStore.set({ playing: false });
  },
  seek(progress: number) {
    storyStore.set({ progress: Math.max(0, Math.min(1, progress)), playing: false, camera: true });
  },
  manual() {
    if (storyStore.get().index !== null) storyStore.set({ playing: false, camera: false });
  },
  end() {
    storyStore.set({ index: null, progress: 0, playing: false, camera: false, pendingPlay: false });
    shareStep(null);
  },
  requestTechnical() {
    storyStore.set({ pendingPlay: true });
  },
};
