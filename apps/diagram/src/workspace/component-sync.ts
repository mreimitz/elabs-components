import { useEffect } from "react";
import { diagramActions, diagramStore } from "../state/diagram-store";
import {
  clearComponentFiles,
  currentComponentFiles,
  dropComponentFile,
  putComponentFiles,
} from "../state/component-files";
import { neededFiles } from "../spec/compose/resolver";
import { parseRoute } from "../routes/use-hash";
import { onWorkspaceEvent, onWorkspaceReopen } from "./live-reload";
import { preloadComponents } from "./component-loader";
/** Refresh projections only: text, persisted text, identity and history stay intact. */
export function startComponentSync(): () => void {
  let generation = 0;
  let active = false;
  let disposed = false;
  const refresh = async () => {
    const request = ++generation;
    const state = diagramStore.get();
    const current = () => {
      const now = diagramStore.get();
      const route = parseRoute(location.hash);
      return (
        !disposed &&
        request === generation &&
        now.loadCount === state.loadCount &&
        now.text === state.text &&
        now.path === state.path &&
        (route.kind !== "doc" || route.path === now.path)
      );
    };
    active = false;
    if (!current()) return;
    active = true;
    try {
      const files = await preloadComponents(state.text, current, currentComponentFiles());
      if (files && current()) {
        putComponentFiles(files);
        diagramActions.recompile();
      }
    } finally {
      if (request === generation) active = false;
    }
  };
  const run = () => void refresh();
  let identity = diagramStore.get().loadCount;
  let text = diagramStore.get().text;
  const offStore = diagramStore.subscribe(() => {
    const state = diagramStore.get();
    if (state.loadCount !== identity || state.text !== text) {
      identity = state.loadCount;
      text = state.text;
      generation += 1;
      active = false;
    }
    if (
      !active &&
      state.compiled.ast &&
      neededFiles(state.compiled.ast, currentComponentFiles()).length
    )
      run();
  });
  const offEvent = onWorkspaceEvent((event) => {
    const relevant = currentComponentFiles().has(event.path);
    // An unseen dependency may also be in flight.
    dropComponentFile(event.path);
    if (relevant || active) run();
  });
  const offReopen = onWorkspaceReopen(() => {
    clearComponentFiles();
    run();
  });
  window.addEventListener("hashchange", run);
  run();
  return () => {
    disposed = true;
    generation += 1;
    offStore();
    offEvent();
    offReopen();
    window.removeEventListener("hashchange", run);
  };
}
export function useComponentSync(): void {
  useEffect(startComponentSync, []);
}
