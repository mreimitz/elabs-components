"use client";
/**
 * StoryFrame — one Storybook story as a live preview. The site never keeps a second copy of an
 * example: what renders here IS the story (`/storybook/iframe.html?id=…`, same origin through the
 * rewrite), in the visitor's current theme (`globals=theme:<theme>`).
 *
 * Frames mount only when they scroll near the viewport, size themselves to the story's content
 * (same-origin, so the document height is readable), and say so plainly when the deployed
 * Storybook does not have the story yet (the site and Storybook deploy on release; a newer story
 * in the repo is not an error).
 */
import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button, Skeleton } from "@elabs-ai/components-ui";
import { useTheme } from "@elabs-ai/components-tokens";
import { catalogCopy } from "../../content/copy";
import { useStoryId } from "../../lib/story-alias";
import { reportStoryTheme, useStoryTheme } from "../../lib/story-theme";
import { StoryExpand, type StoryExpandDetail } from "./story-expand";

const copy = catalogCopy.frame;

export type StoryFrameSize = "auto" | "tall" | "screen";

const MIN_HEIGHT = 96;
const MAX_AUTO_HEIGHT = 720;
const FIXED_HEIGHT: Record<Exclude<StoryFrameSize, "auto">, number> = { tall: 480, screen: 720 };

export function storySrc(id: string, theme: string): string {
  const globals = theme ? `&globals=theme:${encodeURIComponent(theme)}` : "";
  return `/storybook/iframe.html?id=${encodeURIComponent(id)}&viewMode=story${globals}`;
}

export function StoryFrame({
  id,
  name,
  size = "auto",
  toolbar = true,
  detail,
  className,
}: {
  id: string;
  name: string;
  size?: StoryFrameSize;
  toolbar?: boolean;
  /** What the enlarge dialog's detail pane says about the page this example belongs to. */
  detail?: StoryExpandDetail;
  className?: string;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const { theme } = useTheme();
  const storyTheme = useStoryTheme(theme);
  const [near, setNear] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "pending">("loading");
  const [height, setHeight] = useState(size === "auto" ? 240 : FIXED_HEIGHT[size]);

  useEffect(() => {
    const el = holder.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") return setNear(true);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  // A theme switch reloads the frame with the new global; show the skeleton while it does.
  useEffect(() => setState("loading"), [storyTheme, id]);

  function onLoad() {
    const doc = frame.current?.contentDocument;
    if (!doc) return setState("ready");
    let observer: ResizeObserver | undefined;
    let tries = 0;
    const settle = () => {
      const body = doc.body;
      if (!body) return;
      const missing =
        body.classList.contains("sb-show-errordisplay") ||
        body.classList.contains("sb-show-nopreview");
      const rendered = (doc.getElementById("storybook-root")?.childElementCount ?? 0) > 0;
      if (missing) return setState("pending");
      if (!rendered && tries++ < 40) return void window.setTimeout(settle, 150);
      if (reportStoryTheme(storyTheme, doc)) return;
      setState("ready");
      if (size !== "auto") return;
      const measure = () => {
        const root = doc.getElementById("storybook-root");
        const next = Math.ceil(
          Math.max(root?.scrollHeight ?? 0, root?.getBoundingClientRect().height ?? 0) + 48,
        );
        // A story that fills its viewport (an app shell, a canvas, a map) reports almost no
        // intrinsic height — give it a working-size stage instead of a sliver.
        const fills = (root?.scrollHeight ?? 0) < 56;
        setHeight(
          fills ? FIXED_HEIGHT.tall : Math.min(MAX_AUTO_HEIGHT, Math.max(MIN_HEIGHT, next)),
        );
      };
      measure();
      const root = doc.getElementById("storybook-root");
      if (root && typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(measure);
        observer.observe(root);
      }
    };
    settle();
    frame.current?.addEventListener("beforeunload", () => observer?.disconnect(), { once: true });
  }

  const liveId = useStoryId(id);
  const src = liveId ? storySrc(liveId, storyTheme) : null;
  return (
    <div
      ref={holder}
      data-slot="story-frame"
      data-state={state}
      className={`group/frame relative overflow-hidden rounded-lg border border-border bg-background ${className ?? ""}`}
      // A story the live Storybook does not have yet is one quiet line, not an empty stage.
      style={{ height: state === "pending" ? 56 : height }}
    >
      {state === "loading" ? (
        <div className="absolute inset-0 flex flex-col gap-3 p-6" aria-hidden="true">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="min-h-0 flex-1" />
        </div>
      ) : null}
      {state === "pending" ? (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-meta text-muted-foreground">
          {copy.pending}
        </p>
      ) : null}
      {near && src ? (
        <iframe
          ref={frame}
          src={src}
          title={copy.previewOf(name)}
          loading="lazy"
          onLoad={onLoad}
          className={`size-full border-0 ${state === "ready" ? "opacity-100" : "opacity-0"}`}
        />
      ) : null}
      {toolbar && state === "ready" ? (
        <div className="absolute end-2 top-2 flex gap-1 opacity-0 transition-opacity duration-fast ease-standard group-focus-within/frame:opacity-100 group-hover/frame:opacity-100">
          <StoryExpand id={id} name={name} detail={detail} />
          <Button asChild size="icon-sm" variant="outline">
            <a href={`/storybook/?path=/story/${liveId ?? id}`} aria-label={copy.openStory}>
              <ExternalLink aria-hidden="true" />
            </a>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
