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
import { storySrc } from "./story-frame";

export function StoryThumb({
  id,
  width = 1280,
  ratio = 0.625,
}: {
  id: string;
  /** The virtual viewport width the story renders at before scaling. */
  width?: number;
  /** Height / width of the thumbnail box. */
  ratio?: number;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [near, setNear] = useState(false);
  const [scale, setScale] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const liveId = useStoryId(id);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / width);
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
  }, [width]);

  useEffect(() => setLoaded(false), [theme, id]);

  return (
    <div
      ref={holder}
      aria-hidden="true"
      data-slot="story-thumb"
      className="pointer-events-none relative w-full overflow-hidden bg-background"
      style={{ aspectRatio: `1 / ${ratio}` }}
    >
      {!loaded ? <Skeleton className="absolute inset-0 rounded-none" /> : null}
      {near && scale > 0 && liveId ? (
        <iframe
          src={storySrc(liveId, theme)}
          title=""
          tabIndex={-1}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={`absolute start-0 top-0 origin-top-left border-0 ${loaded ? "opacity-100" : "opacity-0"}`}
          style={{ width, height: width * ratio, transform: `scale(${scale})` }}
        />
      ) : null}
    </div>
  );
}
