"use client";
/**
 * StoryThumb — a story as a live thumbnail: rendered at a desktop width and scaled down to the
 * card, like a screenshot that follows the theme. Decorative (the card's link names the target),
 * so it takes no pointer or keyboard focus. Mounts when near the viewport.
 */
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@elabs-ai/components-ui";
import { useTheme } from "@elabs-ai/components-tokens";
import { useStoryId } from "../../lib/story-alias";
import { whenStoryRendered, type StoryOutcome } from "../../lib/story-ready";
import { reportStoryTheme, useStoryTheme } from "../../lib/story-theme";
import { storySrc } from "./story-frame";
import { thumbTransform, type ThumbCrop } from "./thumb-crop";

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
  const { theme } = useTheme();
  const [near, setNear] = useState(false);
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
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined") setNear(true);
    else {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setNear(true);
            io?.disconnect();
          }
        },
        { rootMargin: "400px 0px" },
      );
      io.observe(el);
    }
    return () => {
      ro?.disconnect();
      io?.disconnect();
    };
  }, []);
  const { scale, transform } = thumbTransform(box, width, crop);

  useEffect(() => {
    setOutcome(null);
    return () => cancel.current?.();
  }, [storyTheme, id]);

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
      {near && scale > 0 && liveId ? (
        <iframe
          src={storySrc(liveId, storyTheme)}
          title=""
          tabIndex={-1}
          loading="lazy"
          onLoad={(event) => {
            cancel.current?.();
            const frame = event.currentTarget;
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
