"use client";

import { Image, type ImageProps } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import type { Experimental_GeneratedImage } from "ai";
import { forwardRef } from "react";

export type GeneratedImageProps = Experimental_GeneratedImage &
  Omit<ImageProps, "src" | "alt" | "aspectRatio" | "showSkeleton"> & {
    /** Accessible text. Omit (or `""`) for a decorative image. @default "" */
    alt?: string;
    /**
     * Show a `Skeleton` in the reserved `width` × `height` box until the base64
     * payload decodes, so it does not pop in. Without both dimensions there is
     * no box to reserve, so the default is off in that case.
     * @default Boolean(width && height)
     */
    showSkeleton?: boolean;
  };

/**
 * An AI-SDK generated image (`Experimental_GeneratedImage`) rendered through
 * the ui `Image` primitive as a base64 data URL — decode-aware skeleton,
 * `ImageOff` fallback on a terminal error.
 */
export const GeneratedImage = forwardRef<HTMLImageElement, GeneratedImageProps>(
  function GeneratedImage(
    {
      base64,
      uint8Array: _uint8Array,
      mediaType,
      alt = "",
      showSkeleton,
      width,
      height,
      className,
      ...props
    },
    ref,
  ) {
    return (
      <Image
        {...props}
        ref={ref}
        data-slot="generated-image"
        src={`data:${mediaType};base64,${base64}`}
        alt={alt}
        width={width}
        height={height}
        showSkeleton={showSkeleton ?? Boolean(width && height)}
        className={cn("rounded-md", className)}
      />
    );
  },
);

GeneratedImage.displayName = "GeneratedImage";
