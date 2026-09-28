import { useSyncExternalStore } from "react";
import { createStore } from "../state/create-store";
import { prefersReducedMotion } from "../motion";
const KEY = "atlas-flow-animation-paused";
const readPaused = () => {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
};
const preference = createStore({ paused: readPaused(), reduced: prefersReducedMotion() });
let users = 0,
  dispose: (() => void) | undefined;
function subscribe(listener: () => void) {
  if (users++ === 0) {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => preference.set({ reduced: prefersReducedMotion() });
    const storage = (event: StorageEvent) => {
      if (event.key === KEY) preference.set({ paused: readPaused() });
    };
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-motion-pref"],
    });
    media.addEventListener("change", update);
    window.addEventListener("storage", storage);
    dispose = () => {
      observer.disconnect();
      media.removeEventListener("change", update);
      window.removeEventListener("storage", storage);
    };
    update();
  }
  const unsubscribe = preference.subscribe(listener);
  return () => {
    unsubscribe();
    if (--users === 0) dispose?.();
  };
}
export function useParticlePreference() {
  return useSyncExternalStore(subscribe, preference.get);
}
export function toggleParticles() {
  const paused = !preference.get().paused;
  preference.set({ paused });
  try {
    localStorage.setItem(KEY, String(paused));
  } catch {
    /* Current-session preference still works without storage. */
  }
}
