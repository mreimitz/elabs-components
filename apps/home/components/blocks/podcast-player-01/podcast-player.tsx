// registry: podcast-player-01 — copied 2026-09-24
"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@elabs-ai/components-tokens";
import {
  Button,
  Card,
  CardContent,
  Heading,
  IconButton,
  Image,
  Media,
  MediaPlayerControls,
  MediaPlayerMuteButton,
  MediaPlayerPlaybackRateMenu,
  MediaPlayerPlayButton,
  MediaPlayerSeekButton,
  MediaPlayerTime,
  MediaPlayerVolumeSlider,
  ScrollArea,
  Text,
  formatMediaTime,
  useMediaPlayer,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { AudioLines, Pause, Play, Rss, Share2 } from "lucide-react";
import { SHOW, type Chapter, type Episode, type Show, type TranscriptCue } from "./data/episodes";

export interface PodcastPlayerProps {
  /** The show and its episodes. Defaults to the sample. */
  show?: Show;
  /** The episode the player opens on. Default: the newest. */
  defaultEpisodeId?: string;
  className?: string;
}

/** The index of the last entry whose `at` is at or before `time`. */
function activeIndexAt<T extends { at: number }>(entries: readonly T[], time: number): number {
  let index = -1;
  for (let i = 0; i < entries.length; i += 1) {
    if ((entries[i]?.at ?? Infinity) <= time) index = i;
    else break;
  }
  return index;
}

/**
 * A show's episodes with one player: the episode list on one side, the
 * chosen episode on the other as a ui `Media` player composed from its parts
 * — cover art, the waveform stage as the scrubber, a control bar with speed —
 * plus two parts of this block's own that read the player's context:
 * clickable chapters and a transcript that follows playback. Choosing an
 * episode from the list starts it; the list's button pauses and resumes the
 * one that is playing.
 */
export function PodcastPlayer({ show = SHOW, defaultEpisodeId, className }: PodcastPlayerProps) {
  const [episodeId, setEpisodeId] = useState(defaultEpisodeId ?? show.episodes[0]?.id ?? "");
  // Set when the episode was chosen from the list, so the new player starts itself.
  const [startOnMount, setStartOnMount] = useState(false);
  const [paused, setPaused] = useState(true);
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const episode = show.episodes.find((e) => e.id === episodeId) ?? show.episodes[0];

  const choose = (next: Episode) => {
    if (next.id === episode?.id) {
      if (mediaRef.current?.paused) void mediaRef.current?.play();
      else mediaRef.current?.pause();
      return;
    }
    setStartOnMount(true);
    setPaused(true);
    setEpisodeId(next.id);
  };

  return (
    <section
      data-slot="podcast-player"
      aria-labelledby="podcast-player-heading"
      className={cn("flex flex-col gap-6", className)}
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <Text as="span" variant="eyebrow" tone="primary">
            Podcast
          </Text>
          <Heading id="podcast-player-heading" level={2}>
            {show.name}
          </Heading>
          <Text tone="muted" className="max-w-prose text-pretty">
            {show.tagline}
          </Text>
          <Text variant="meta" tone="muted">
            {show.hosts} · {show.episodes.length} episodes
          </Text>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Rss aria-hidden="true" />
            RSS feed
          </Button>
          <Button variant="outline" size="sm">
            <Share2 aria-hidden="true" />
            Share
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Now playing */}
        {episode ? (
          <Card data-slot="podcast-player-now-playing" className="min-w-0 lg:col-span-3">
            <CardContent className="flex flex-col gap-5 p-5">
              <div className="flex gap-4">
                <div className="size-20 shrink-0 overflow-hidden rounded-md border bg-muted shadow-xs sm:size-24">
                  <Image
                    src={episode.cover}
                    alt=""
                    fit="cover"
                    showSkeleton={false}
                    className="size-full"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <Text
                    as="span"
                    variant="eyebrow"
                    tone="muted"
                    className="flex items-center gap-1.5"
                  >
                    <AudioLines className="size-3.5" aria-hidden="true" />
                    {paused ? "Episode" : "Now playing · Episode"} {episode.number}
                  </Text>
                  <Heading level={3} size="subtitle" className="text-pretty">
                    {episode.title}
                  </Heading>
                  <Text variant="meta" tone="muted" className="line-clamp-2 text-pretty">
                    {episode.summary}
                  </Text>
                  <Text variant="meta" tone="muted">
                    With {episode.guests.join(" and ")} · {episode.published} ·{" "}
                    <span className="tabular-nums">{formatMediaTime(episode.seconds)}</span>
                  </Text>
                </div>
              </div>

              {/* `key` remounts the player per episode so time and volume start fresh. */}
              <Media
                key={episode.id}
                kind="audio"
                src={episode.src}
                preload="metadata"
                label={`Episode ${episode.number}: ${episode.title}`}
                onLoadedMetadata={(event) => {
                  mediaRef.current = event.currentTarget;
                }}
                onPlay={() => setPaused(false)}
                onPause={() => setPaused(true)}
                onEnded={() => setPaused(true)}
              >
                <MediaPlayerControls>
                  <MediaPlayerPlayButton />
                  <MediaPlayerSeekButton offset={-15} className="hidden @md/controls:inline-flex" />
                  <MediaPlayerSeekButton offset={15} className="hidden @md/controls:inline-flex" />
                  <MediaPlayerTime mode="current" />
                  <MediaPlayerTime mode="duration" className="me-auto" />
                  <MediaPlayerMuteButton />
                  <MediaPlayerVolumeSlider className="hidden @lg/controls:flex" />
                  <MediaPlayerPlaybackRateMenu />
                </MediaPlayerControls>
                {startOnMount ? <StartOnMount /> : null}
                {/* Inside the player's frame, so both parts read its context. */}
                <div className="grid gap-5 border-t p-4 md:grid-cols-2">
                  <Chapters chapters={episode.chapters} />
                  <Transcript cues={episode.transcript} />
                </div>
              </Media>
            </CardContent>
          </Card>
        ) : null}

        {/* Episodes */}
        <Card data-slot="podcast-player-episodes" className="min-w-0 lg:col-span-2">
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-baseline justify-between gap-3">
              <Heading level={3} size="subtitle">
                All episodes
              </Heading>
              <Text variant="meta" tone="muted">
                Newest first
              </Text>
            </div>
            <ol className="flex flex-col">
              {show.episodes.map((item) => {
                const current = item.id === episode?.id;
                const playing = current && !paused;
                return (
                  <li
                    key={item.id}
                    aria-current={current ? "true" : undefined}
                    className={cn(
                      "flex items-center gap-3 border-t py-3 first:border-t-0",
                      current && "-mx-2 rounded-md border-t-0 bg-muted px-2 [&+li]:border-t-0",
                    )}
                  >
                    <span className="w-6 shrink-0 text-meta tabular-nums text-muted-foreground">
                      {item.number}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="line-clamp-2 text-body font-medium text-foreground text-pretty">
                        {item.title}
                      </span>
                      <span className="truncate text-meta text-muted-foreground">
                        {item.published} ·{" "}
                        <span className="tabular-nums">{formatMediaTime(item.seconds)}</span>
                        {playing ? " · Playing" : ""}
                      </span>
                    </span>
                    <IconButton
                      variant={current ? "default" : "outline"}
                      size="icon-sm"
                      label={
                        playing ? `Pause episode ${item.number}` : `Play episode ${item.number}`
                      }
                      icon={
                        playing ? (
                          <Pause className="fill-current" />
                        ) : (
                          <Play className="fill-current" />
                        )
                      }
                      onClick={() => choose(item)}
                    />
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

/** Starts playback once the player has its element — after the person chose an episode. */
function StartOnMount() {
  const { meta } = useMediaPlayer();
  const started = useRef(false);
  useEffect(() => {
    // The element is bound in the mount commit, before the context's actions
    // are rebuilt for it — so play the element itself, once.
    const element = meta.mediaRef.current;
    if (started.current || !element) return;
    started.current = true;
    element.play().catch(() => {
      // Autoplay refused (no activation): the bar's play button is one click away.
    });
  }, [meta.mediaRef]);
  return null;
}

/** The episode's chapters; the one playing is marked, and each seeks to its start. */
function Chapters({ chapters }: { chapters: Chapter[] }) {
  const { state, actions } = useMediaPlayer();
  const active = activeIndexAt(chapters, state.currentTime);
  return (
    <nav data-slot="podcast-player-chapters" aria-label="Chapters" className="flex flex-col gap-2">
      <Text as="span" variant="eyebrow" tone="muted">
        Chapters
      </Text>
      <ol className="flex flex-col gap-0.5">
        {chapters.map((chapter, i) => (
          <li key={chapter.at}>
            <button
              type="button"
              aria-current={i === active ? "true" : undefined}
              onClick={() => {
                actions.seek(chapter.at);
                actions.play();
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-start text-body focus-ring transition-colors duration-fast ease-standard hover:bg-muted",
                i === active ? "bg-muted text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="w-9 shrink-0 text-meta tabular-nums">
                {formatMediaTime(chapter.at)}
              </span>
              <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
              {i === active ? (
                <AudioLines className="size-4 shrink-0 text-primary" aria-hidden="true" />
              ) : null}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The transcript; the cue being spoken is highlighted and kept in view while it plays. */
function Transcript({ cues }: { cues: TranscriptCue[] }) {
  const { state, actions } = useMediaPlayer();
  const reduced = useReducedMotion();
  const active = activeIndexAt(cues, state.currentTime);
  const activeRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    if (state.paused) return;
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [active, state.paused, reduced]);

  return (
    <section
      data-slot="podcast-player-transcript"
      aria-label="Transcript"
      className="flex min-w-0 flex-col gap-2"
    >
      <Text as="span" variant="eyebrow" tone="muted">
        Transcript
      </Text>
      <ScrollArea className="h-48 rounded-md border bg-background">
        <ol className="flex flex-col gap-1 p-2">
          {cues.map((cue, i) => (
            <li key={cue.at} ref={i === active ? activeRef : undefined}>
              <button
                type="button"
                onClick={() => actions.seek(cue.at)}
                aria-current={i === active ? "true" : undefined}
                className={cn(
                  "flex w-full gap-2 rounded-md px-2 py-1 text-start text-body focus-ring transition-colors duration-fast ease-standard hover:bg-muted",
                  i === active
                    ? "border-s-2 border-s-primary bg-muted text-foreground"
                    : "border-s-2 border-s-transparent text-muted-foreground",
                )}
              >
                <span className="w-14 shrink-0 truncate text-meta font-medium">{cue.speaker}</span>
                <span className="min-w-0 flex-1 text-pretty">{cue.text}</span>
              </button>
            </li>
          ))}
        </ol>
      </ScrollArea>
    </section>
  );
}
