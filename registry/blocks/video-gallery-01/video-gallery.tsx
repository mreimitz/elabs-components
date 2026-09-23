"use client";

import { useMemo, useState } from "react";
import {
  AspectRatio,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  IconButton,
  Image,
  ToggleGroup,
  ToggleGroupItem,
  Video,
  formatMediaTime,
  type VideoTrack,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { VIDEOS, VIDEO_CATEGORIES, type GalleryVideo, type VideoCategory } from "./data/videos";

export type VideoGalleryFilter = VideoCategory | "all";

export interface VideoGalleryProps {
  /** The set to show. Defaults to the sample data. */
  videos?: GalleryVideo[];
  /** The category the filter starts on. Default `"all"`. */
  defaultCategory?: VideoGalleryFilter;
  className?: string;
}

/**
 * A filterable grid of video tiles — poster, play mark, duration, title and
 * date — that opens the chosen video in a dialog with the ui `Video` player
 * (captions, keyboard, docked controls) and previous/next to move through the
 * set. Tiles are real buttons named "Play <title>, <length>"; the dialog is a
 * `Dialog`, so focus, Escape and the backdrop are handled for you.
 */
export function VideoGallery({
  videos = VIDEOS,
  defaultCategory = "all",
  className,
}: VideoGalleryProps) {
  const [category, setCategory] = useState<VideoGalleryFilter>(defaultCategory);
  const [activeId, setActiveId] = useState<string | null>(null);

  const visible = useMemo(
    () => (category === "all" ? videos : videos.filter((v) => v.category === category)),
    [videos, category],
  );
  const activeIndex = visible.findIndex((v) => v.id === activeId);
  const active = activeIndex >= 0 ? visible[activeIndex] : null;

  return (
    <section
      className={cn("flex flex-col gap-4", className)}
      aria-labelledby="video-gallery-heading"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 id="video-gallery-heading" className="text-title font-semibold text-foreground">
            Video library
          </h2>
          <p className="text-body text-muted-foreground">
            {visible.length} of {videos.length} videos · pick one to play it here.
          </p>
        </div>
        <ToggleGroup
          type="single"
          variant="segmented"
          size="sm"
          value={category}
          onValueChange={(v) => v && setCategory(v as VideoGalleryFilter)}
          aria-label="Category"
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          {VIDEO_CATEGORIES.map((c) => (
            <ToggleGroupItem key={c} value={c}>
              {c}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((v) => (
          <li key={v.id} className="min-w-0">
            <button
              type="button"
              onClick={() => setActiveId(v.id)}
              aria-label={`Play ${v.title}, ${formatMediaTime(v.seconds)}`}
              className="group/tile flex w-full flex-col gap-2 rounded-lg text-start focus-ring"
            >
              <AspectRatio
                ratio={16 / 9}
                className="overflow-hidden rounded-lg border bg-muted shadow-xs"
              >
                <Image
                  src={v.poster}
                  alt=""
                  fit="cover"
                  showSkeleton={false}
                  className="size-full transition-transform duration-base ease-standard group-hover/tile:scale-[1.03] motion-reduce:transition-none"
                />
                {/* The play mark: decorative — the button's name already says "Play". */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition-transform duration-base ease-standard group-hover/tile:scale-110 motion-reduce:transition-none">
                    <Play className="size-5 fill-current" />
                  </span>
                </span>
                <Badge variant="secondary" className="absolute bottom-2 end-2 tabular-nums">
                  {formatMediaTime(v.seconds)}
                </Badge>
              </AspectRatio>
              <span className="flex min-w-0 flex-col gap-0.5 px-0.5">
                <span className="line-clamp-2 text-body font-medium text-foreground">
                  {v.title}
                </span>
                <span className="truncate text-meta text-muted-foreground">
                  {v.category} · {v.published}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={active !== null} onOpenChange={(open) => !open && setActiveId(null)}>
        {active ? (
          <DialogContent size="xl">
            <DialogHeader>
              <DialogTitle>{active.title}</DialogTitle>
              <DialogDescription>{active.description}</DialogDescription>
            </DialogHeader>
            {/* `key` remounts the player per video so time, volume and captions start fresh. */}
            <Video
              key={active.id}
              src={active.src}
              poster={active.poster}
              tracks={toTracks(active)}
              aspectRatio={16 / 9}
              preload="metadata"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-meta text-muted-foreground">
                {active.category} · {active.published} ·{" "}
                <span className="tabular-nums">{formatMediaTime(active.seconds)}</span>
              </p>
              <div className="flex items-center gap-2">
                <IconButton
                  variant="outline"
                  size="icon-sm"
                  label="Previous video"
                  icon={<ChevronLeft />}
                  disabled={activeIndex <= 0}
                  onClick={() => setActiveId(visible[activeIndex - 1]?.id ?? null)}
                />
                <span className="text-meta tabular-nums text-muted-foreground">
                  {activeIndex + 1} / {visible.length}
                </span>
                <IconButton
                  variant="outline"
                  size="icon-sm"
                  label="Next video"
                  icon={<ChevronRight />}
                  disabled={activeIndex >= visible.length - 1}
                  onClick={() => setActiveId(visible[activeIndex + 1]?.id ?? null)}
                />
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}

function toTracks(video: GalleryVideo): VideoTrack[] {
  return video.captions
    ? [{ src: video.captions, kind: "captions", srclang: "en", label: "English" }]
    : [];
}
