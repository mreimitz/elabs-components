"use client";

import { Skeleton, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { Experimental_GeneratedImage } from "ai";
import { ImageOff } from "lucide-react";
import type { ImgHTMLAttributes } from "react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type ImageProps = Experimental_GeneratedImage &
  Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
    /**
     * Show a Skeleton placeholder (loading-states.md) until the img element
     * finishes decoding, so the base64 payload does not pop in. Requires
     * explicit `width`+`height` so the reserved box matches the final size
     * (interaction-guidelines.md Images section — prevents CLS); without
     * both there is no box to reserve, so the default is `false` in that
     * case rather than mounting a skeleton that collapses to nothing.
     * @default Boolean(width && height)
     */
    showSkeleton?: boolean;
  };

/** `<img>` wrapper for an AI-SDK generated image, with a decode-aware skeleton. */
export const Image = forwardRef<HTMLImageElement, ImageProps>(function Image(
  {
    base64,
    uint8Array: _uint8Array,
    mediaType,
    className,
    showSkeleton,
    onLoad,
    onError,
    width,
    height,
    alt,
    ...props
  },
  forwardedRef,
) {
  const { t } = useLocale();
  const shouldSkeleton = showSkeleton ?? Boolean(width && height);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  useImperativeHandle(forwardedRef, () => imgRef.current as HTMLImageElement);

  const pending = shouldSkeleton && !loaded && !failed;

  // The live region must exist BEFORE its text appears (ARIA22), so it is
  // always mounted (while a skeleton can render at all) and its label is set
  // one tick later via this effect.
  const [announce, setAnnounce] = useState(false);
  useEffect(() => setAnnounce(pending), [pending]);

  // A cached / instant data-URI decode can finish before React attaches
  // `onLoad` — read `complete` once mounted (gallery.tsx's GalleryImg has the
  // same guard).
  useEffect(() => {
    if (imgRef.current?.complete) setLoaded(true);
  }, []);

  if (failed) {
    return (
      <span
        className={cn(
          "flex flex-col items-center justify-center gap-1 rounded-md bg-muted text-muted-foreground",
          className,
        )}
        style={{ height, width }}
        {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })}
      >
        <ImageOff className="size-6" aria-hidden="true" />
      </span>
    );
  }

  const img = (
    <img
      {...props}
      ref={imgRef}
      alt={alt ?? ""}
      height={height}
      width={width}
      className={cn("h-auto max-w-full overflow-hidden rounded-md", className)}
      src={`data:${mediaType};base64,${base64}`}
      onLoad={(event) => {
        setLoaded(true);
        onLoad?.(event);
      }}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );

  // No skeleton to reserve a box for — render the bare <img> exactly as
  // before this feature landed (a `className` like "w-full" keeps resolving
  // against the real parent, not a shrink-to-fit wrapper), and mount no
  // (permanently empty) live region.
  if (!shouldSkeleton) return img;

  return (
    <span className="relative inline-block max-w-full" style={{ height, width }}>
      <span className="sr-only" role="status" aria-live="polite">
        {announce ? t("loading") : ""}
      </span>
      {pending ? <Skeleton className="absolute inset-0 size-full rounded-md" /> : null}
      {img}
    </span>
  );
});

Image.displayName = "Image";
