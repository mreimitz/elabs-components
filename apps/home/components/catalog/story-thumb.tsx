"use client";
/**
 * StoryThumb — a story as a live thumbnail: rendered at a desktop width and scaled down to the
 * card, like a screenshot that follows the theme. Decorative (the card's link names the target),
 * so it takes no pointer or keyboard focus. Loads when near the viewport and is pointed at a blank
 * page when scrolled far away (`use-near-viewport.ts`), so a listing never holds more than a
 * screenful or two of live Storybook documents.
 */
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@elabs-ai/components-ui";
import { useTheme } from "@elabs-ai/components-tokens";
import { useStoryId } from "../../lib/story-alias";
import { whenStoryRendered, type StoryOutcome } from "../../lib/story-ready";
import { reportStoryTheme, useStoryTheme } from "../../lib/story-theme";
import { useNearViewport } from "../../lib/use-near-viewport";
import { storySrc } from "./story-frame";
import { thumbTransform, type ThumbCrop } from "./thumb-crop";

/**
 * A story whose play function focuses an element does two things to the page around it: the
 * browser scrolls that element into view through every scroller above it — this page's
 * included, so the listing jumps under the reader a few seconds after it loads — and keyboard
 * focus leaves the page for the frame (someone typing in the rail's filter loses their caret).
 * A thumbnail takes no pointer or keyboard input, so focus inside it is only ever a script's.
 * (`inert` on the frame does not stop a script's own `focus()` inside it; tried.)
 *
 * The story is same-origin, so its `focus` is wrapped: it never scrolls, and the page gets its
 * focus back. The element stays the frame document's `activeElement`, which is what a play
 * function's `toHaveFocus` reads. A cross-origin Storybook cannot be reached and is left alone.
 */
function keepFocusInThePage(frame: HTMLIFrameElement) {
  try {
    const proto = (frame.contentWindow as (Window & typeof globalThis) | null)?.HTMLElement
      .prototype;
    if (!proto) return;
    const focus = proto.focus;
    proto.focus = function (options?: FocusOptions) {
      const before = document.activeElement;
      focus.call(this, { ...options, preventScroll: true });
      if (document.activeElement !== frame || before === frame) return;
      if (before instanceof HTMLElement && before !== document.body)
        before.focus({ preventScroll: true });
      else frame.blur();
    };
  } catch {
    // Cross-origin frame.
  }
}

export function StoryThumb({
  id,
  width = 1280,
  ratio = 0.625,
  crop,
}: {
  id: string;
  /** The virtual viewport width the story renders at before scaling. */
  width?: number;
  /** Height / width of the thumbnail box. */
  ratio?: number;
  /** Show a window of the story instead of the whole frame (`thumb-crop.ts`). */
  crop?: ThumbCrop;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const near = useNearViewport(holder);
  // The frame element is created the first time the card comes near, and then kept.
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (near) setSeen(true);
  }, [near]);
  const { theme } = useTheme();
  const [box, setBox] = useState(0);
  // `null` while Storybook is still preparing the story: the frame stays hidden behind the
  // skeleton, so its white loading page never shows through a dark theme.
  const [outcome, setOutcome] = useState<StoryOutcome | null>(null);
  const cancel = useRef<() => void>(undefined);
  const liveId = useStoryId(id);
  const storyTheme = useStoryTheme(theme);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const measure = () => setBox(el.clientWidth);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const { scale, transform } = thumbTransform(box, width, crop);

  // A released frame comes back through the skeleton, like a first load.
  useEffect(() => {
    setOutcome(null);
    return () => cancel.current?.();
  }, [storyTheme, id, near]);

  return (
    <div
      ref={holder}
      aria-hidden="true"
      data-slot="story-thumb"
      className="pointer-events-none relative w-full overflow-hidden bg-background"
      style={{ aspectRatio: `1 / ${ratio}` }}
    >
      {/* Loading is a skeleton; a story the served Storybook does not have yet is an empty
          WELL — a faded hairline hatch, which reads as "nothing here yet", not "still loading". */}
      {outcome === "missing" ? (
        <div data-slot="story-thumb-missing" className="absolute inset-0">
          <div className="size-full bg-hairline-hatch" />
        </div>
      ) : outcome !== "ready" ? (
        <Skeleton className="absolute inset-0 rounded-none" />
      ) : null}
      {seen && scale > 0 && liveId ? (
        <iframe
          // Far away, the frame is pointed at a blank page instead of being REMOVED. Removing an
          // iframe whose story's play function left focus inside it fires that story's focus
          // listeners synchronously, inside React's commit, against a node that no longer has a
          // window — Storybook's user-event throws ("Could not determine window of node"), the
          // commit is left half done and the whole page falls to the error boundary. Navigating
          // the frame away unloads the story in a live window and frees just as much.
          src={near ? storySrc(liveId, storyTheme) : "about:blank"}
          title=""
          tabIndex={-1}
          loading="lazy"
          onLoad={(event) => {
            cancel.current?.();
            if (!near) return;
            const frame = event.currentTarget;
            keepFocusInThePage(frame);
            cancel.current = whenStoryRendered(frame, (result) => {
              // A story rendered in the wrong theme is swapped before it is ever shown.
              if (result === "ready" && reportStoryTheme(storyTheme, frame.contentDocument)) return;
              setOutcome(result);
            });
          }}
          className={`absolute start-0 top-0 origin-top-left border-0 ${outcome === "ready" ? "opacity-100" : "opacity-0"}`}
          style={{ width, height: width * ratio, transform }}
        />
      ) : null}
    </div>
  );
}
