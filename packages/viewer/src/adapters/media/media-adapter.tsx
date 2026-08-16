"use client";

/**
 * Video / audio adapter — native elements, deliberately.
 *
 * `@elabs-ai/components-ai` ships a designed `AudioPlayer` built on
 * `media-chrome`, and this adapter does NOT reach for it: `ai` is a Layer-2
 * sibling, so importing it would be a sideways edge the dependency gate rejects
 * (and would pull a chat package into a file viewer). Native `<video controls>`
 * / `<audio controls>` are the honest answer here — they bring the platform's
 * own accessible transport, keyboard handling, picture-in-picture, captions
 * menu and OS media keys, none of which a custom skin gets for free.
 *
 * The plan's "extract `AudioPlayer` down to `ui`" would let both sides share one
 * skinned player. That is a real refactor of an existing component with its own
 * tests and stories, so it is tracked separately rather than smuggled in here.
 */

import { cn, StatePanel, useLocale, type ResolvedFileSource } from "@elabs-ai/components-ui";
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
      <div className={cn("flex min-h-full items-center justify-center", className)}>
        <audio
          src={media.url}
          controls
          aria-label={label}
          onError={() => setFailed(true)}
          className="w-full max-w-lg"
        />
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-full items-center justify-center", className)}>
      <video
        src={media.url}
        controls
        // No autoplay: a viewer opens files the reader chose to look at, not to
        // listen to. Sound starting on its own is the reason browsers block it.
        aria-label={label}
        onError={() => setFailed(true)}
        className="max-h-full max-w-full"
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
