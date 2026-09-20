/**
 * story-ready.ts — when an embedded Storybook story is actually on screen.
 *
 * An iframe's `load` event fires when Storybook's document has loaded, which is BEFORE the
 * story mounts: for a moment the frame is a white page with Storybook's own "preparing"
 * spinner, whatever the site's theme. Revealing on `load` flashes that white page — most
 * visibly in dark mode. This polls until the story has rendered (or Storybook reports it has
 * no such story) and only then answers.
 */
export type StoryOutcome = "ready" | "missing";

const PREPARING = ["sb-show-preparing-story", "sb-show-preparing-docs"];
const MISSING = ["sb-show-errordisplay", "sb-show-nopreview"];

/** Calls `done` once; returns a cancel function for unmount or a source change. */
export function whenStoryRendered(
  frame: HTMLIFrameElement,
  done: (outcome: StoryOutcome) => void,
  { interval = 120, tries = 80 }: { interval?: number; tries?: number } = {},
): () => void {
  let cancelled = false;
  let timer = 0;
  let count = 0;
  const check = () => {
    if (cancelled || !frame.isConnected) return;
    let body: HTMLElement | null = null;
    try {
      body = frame.contentDocument?.body ?? null;
    } catch {
      // Cross-origin (a Storybook served from another host): nothing to inspect, so trust `load`.
      return done("ready");
    }
    const has = (names: string[]) => names.some((name) => body?.classList.contains(name));
    if (body && has(MISSING)) return done("missing");
    const rendered =
      (frame.contentDocument?.getElementById("storybook-root")?.childElementCount ?? 0) > 0;
    if (body && rendered && !has(PREPARING)) return done("ready");
    // Out of patience: show whatever is there rather than a skeleton forever.
    if (count++ >= tries) return done("ready");
    timer = window.setTimeout(check, interval);
  };
  check();
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
