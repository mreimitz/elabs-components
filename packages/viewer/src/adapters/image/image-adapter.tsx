"use client";

/**
 * Image adapter — the reference implementation of "adapters emit data".
 *
 * It renders an `<img>`, never a `<canvas>`. anyview draws images to a canvas
 * (`ImageAdapter.ts:118`, `PageRenderer.tsx:128`), which throws away the alt
 * text, the browser's own decoding and zoom, and the ability to select or save
 * the image — with no route back, because its API has no alt-text path at all.
 * Here the description travels on the `FileSource` itself, so a screen reader
 * user gets the same information a sighted user does.
 */

import { cn, StatePanel, useLocale } from "@elabs-ai/components-ui";
import { useEffect, useState } from "react";

import type {
  AdapterDocument,
  AdapterLoadContext,
  AdapterModule,
  AdapterRendererProps,
  FileAdapter,
} from "../../core/types";
import { imageManifest } from "./image-manifest";
import { toViewerError } from "../../core/errors";
import type { ResolvedFileSource } from "@elabs-ai/components-ui";

export interface ImageDocument extends AdapterDocument {
  kind: "image";
  /** A URL an `<img>` can load — the source's own URL, or a minted object URL. */
  url: string;
  /** Intrinsic size, once decoded. Used to reserve the box and to label the file. */
  width?: number;
  height?: number;
}

/** Decode just enough to learn the intrinsic size. Never rejects the load. */
function measure(
  url: string,
  signal?: AbortSignal,
): Promise<{ width: number; height: number } | undefined> {
  if (typeof Image !== "function") return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const img = new Image();
    const done = (value?: { width: number; height: number }) => {
      img.onload = null;
      img.onerror = null;
      resolve(value);
    };
    img.onload = () => done({ width: img.naturalWidth, height: img.naturalHeight });
    // A measurement failure is not a load failure — the <img> will surface it.
    img.onerror = () => done(undefined);
    signal?.addEventListener("abort", () => done(undefined), { once: true });
    img.src = url;
  });
}

class ImageAdapter implements FileAdapter {
  #source?: ResolvedFileSource;

  async load(source: ResolvedFileSource, context: AdapterLoadContext): Promise<ImageDocument> {
    this.#source = source;
    try {
      const url = await source.url(context.signal);
      const size = await measure(url, context.signal);
      return { kind: "image", url, ...size };
    } catch (error) {
      throw toViewerError(error, "read-failed", { fileName: source.name });
    }
  }

  dispose(): void {
    // Releases the object URL this load minted, if any. A remote public image
    // never minted one, and `revoke()` is a no-op there.
    this.#source?.revoke();
    this.#source = undefined;
  }
}

function ImageRenderer({
  document: doc,
  source,
  className,
  zoom = "fit-page",
  rotation = 0,
}: AdapterRendererProps) {
  const image = doc as ImageDocument;
  const { t } = useLocale();
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [image.url]);

  if (failed) {
    // A terminal, settled failure (loading-states.md): the browser tried and
    // gave up, so this is not a transient not-ready state.
    return (
      <div className={cn("flex min-h-full flex-col justify-center p-4", className)}>
        <StatePanel
          kind="error"
          title={t("viewer.error.imageFailedTitle")}
          description={t("viewer.error.imageFailed", { name: source.name })}
        />
      </div>
    );
  }

  const fitting = typeof zoom !== "number";
  // A quarter turn swaps the axes: what was the image's height is now the width
  // the reader sees. Everything below that treats 90/270 differently is that one
  // fact — 180 leaves the bounds alone and needs none of it.
  const quarter = rotation === 90 || rotation === 270;
  const scaled =
    fitting || image.width === undefined || image.height === undefined
      ? undefined
      : { width: image.width * zoom, height: image.height * zoom };
  // A `transform` does not change layout, so a turned image at a fixed scale
  // needs a box with the ROTATED bounds. Without one it overflows the pane on
  // every side, and the half above the top edge is unreachable — scrolling only
  // ever reaches transform overflow past the END edges.
  const boxed = quarter && scaled !== undefined;

  const img = (
    <img
      src={image.url}
      // An image with no author description is decorative to AT — an empty alt
      // is correct and deliberate, not a missing label.
      alt={source.alt ?? ""}
      width={image.width}
      height={image.height}
      onError={() => setFailed(true)}
      className={cn(
        "block object-contain",
        !quarter && zoom === "fit-page" && "max-h-full max-w-full",
        !quarter && zoom === "fit-width" && "h-auto max-w-full",
        // Turned on its side, the pane's HEIGHT caps the image's width and its
        // width caps the height. Container units read the pane directly, so the
        // fit needs no measurement. Both fit modes converge here deliberately:
        // an image whose rotated width filled the pane would overflow the top
        // edge as well, which is the unreachable half described above.
        fitting && quarter && "max-h-[100cqw] max-w-[100cqh]",
        // At a fixed scale the intrinsic cap has to come off, or "200%" would
        // silently stop at the pane's width.
        !fitting && "max-w-none",
        boxed && "absolute top-1/2 left-1/2",
      )}
      style={{
        ...scaled,
        ...(rotation === 0
          ? undefined
          : {
              transform: boxed
                ? `translate(-50%, -50%) rotate(${rotation}deg)`
                : `rotate(${rotation}deg)`,
            }),
      }}
    />
  );

  return (
    // Centred on both axes: a small image pinned to the top-left of a tall pane
    // reads as a layout accident. While fitting, the box takes the pane's height
    // so `max-h-full` has something definite to resolve against; at a fixed
    // scale it grows instead, and `FileViewerContent` scrolls it.
    <div
      className={cn(
        "flex items-center justify-center",
        fitting ? "h-full" : "min-h-full",
        // Only a size container can answer `cqh`, and only a definite height
        // makes one — which is exactly the fitting case.
        fitting && quarter && "[container-type:size]",
        className,
      )}
    >
      {quarter && scaled ? (
        <div className="relative shrink-0" style={{ width: scaled.height, height: scaled.width }}>
          {img}
        </div>
      ) : (
        img
      )}
    </div>
  );
}

const adapterModule: AdapterModule = {
  manifest: imageManifest,
  create: () => new ImageAdapter(),
  Renderer: ImageRenderer,
};

export default adapterModule;
