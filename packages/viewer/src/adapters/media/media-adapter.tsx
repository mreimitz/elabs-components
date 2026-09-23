"use client";

/**
 * Video / audio adapter — renders ui `Audio` / `Video` (ADR 0041).
 *
 * The player lives in `@elabs-ai/components-ui`, one layer down, so the viewer
 * composes it without a sideways edge into `@elabs-ai/components-ai` (whose
 * `AudioPlayer` is itself a preset over the same `MediaPlayer*` parts). That
 * gives token-styled controls that follow the theme, keyboard shortcuts on the
 * player root, and one loading / error model — where the browser's native
 * chrome ignored tokens and differed per engine.
 *
 * An undecodable file is still the adapter's call: the element's `error` event
 * swaps the whole player for the viewer's own `StatePanel`, so ui's compact
 * error panel never shows here.
 */

import {
  Audio,
  cn,
  StatePanel,
  useLocale,
  Video,
  type ResolvedFileSource,
} from "@elabs-ai/components-ui";
import { useEffect, useState } from "react";

import { toViewerError } from "../../core/errors";
import type {
  AdapterDocument,
  AdapterLoadContext,
  AdapterModule,
  AdapterRendererProps,
  FileAdapter,
} from "../../core/types";
import { mediaManifest } from "./media-manifest";

export interface MediaDocument extends AdapterDocument {
  kind: "media";
  /** A URL the element can play — the source's own URL, or a minted object URL. */
  url: string;
  /** Which element to render. `resolveFileKind` already decided this. */
  media: "video" | "audio";
}

class MediaAdapter implements FileAdapter {
  #source?: ResolvedFileSource;

  async load(source: ResolvedFileSource, context: AdapterLoadContext): Promise<MediaDocument> {
    this.#source = source;
    try {
      // Deliberately `url()`, never `bytes()`: an object URL lets the browser
      // stream and seek. Buffering a 2 GB video into memory to hand it to a
      // `<video>` element would be the wrong shape at every size.
      const url = await source.url(context.signal);
      return { kind: "media", url, media: source.category === "audio" ? "audio" : "video" };
    } catch (error) {
      throw toViewerError(error, "read-failed", { fileName: source.name });
    }
  }

  dispose(): void {
    this.#source?.revoke();
    this.#source = undefined;
  }
}

function MediaRenderer({ document: doc, source, className }: AdapterRendererProps) {
  const media = doc as MediaDocument;
  const { t } = useLocale();
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [media.url]);

  if (failed) {
    // Terminal: the browser has no decoder for this codec. Retrying cannot help,
    // so this states the fact rather than offering a button that does nothing.
    // The panel carries `role="alert"` itself, and sits centred like every other
    // viewer state — a message pinned to the top-left of an empty pane reads as
    // a broken render.
    return (
      <div className={cn("flex min-h-full flex-col justify-center p-4", className)}>
        <StatePanel
          kind="error"
          title={t("viewer.media.unsupportedTitle")}
          description={t("viewer.media.unsupported", { name: source.name })}
        />
      </div>
    );
  }

  const label = t("viewer.media.label", { name: source.name });

  if (media.media === "audio") {
    return (
      <div className={cn("flex min-h-full items-center justify-center p-4", className)}>
        <Audio
          src={media.url}
          preload="metadata"
          label={label}
          onError={() => setFailed(true)}
          className="w-full max-w-lg"
        />
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-full items-center justify-center p-4", className)}>
      {/* No autoplay: a viewer opens files the reader chose to look at, not to
          listen to. Sound starting on its own is the reason browsers block it.
          No `aspectRatio`: an arbitrary file's ratio is unknown until metadata
          loads, so the video sizes by its own intrinsic dimensions inside a
          width cap, and the pane scrolls if a tall one outgrows it. */}
      <Video
        src={media.url}
        preload="metadata"
        label={label}
        onError={() => setFailed(true)}
        className="w-full max-w-4xl"
      />
    </div>
  );
}

const adapterModule: AdapterModule = {
  manifest: mediaManifest,
  create: () => new MediaAdapter(),
  Renderer: MediaRenderer,
};

export default adapterModule;
