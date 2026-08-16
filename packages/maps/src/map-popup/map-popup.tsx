"use client";

import MapLibreGL, { type PopupOptions } from "maplibre-gl";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@elabs-ai/components-ui/lib/cn";

import { useMap } from "../map-canvas/map-context";

export type MapPopupProps = {
  /** Longitude coordinate for the popup position. */
  longitude: number;
  /** Latitude coordinate for the popup position. */
  latitude: number;
  /** Callback when the popup is closed. */
  onClose?: () => void;
  /** Popup content. */
  children: ReactNode;
  /** Additional CSS classes for the popup container. */
  className?: string;
  /** Show a close button in the popup (default: false). */
  closeButton?: boolean;
} & Omit<PopupOptions, "className" | "closeButton">;

/**
 * A standalone popup anchored at a lng/lat (not attached to a marker) —
 * typically rendered conditionally from app state (e.g. after a layer click).
 */
export function MapPopup({
  longitude,
  latitude,
  onClose,
  children,
  className,
  closeButton = false,
  ...popupOptions
}: MapPopupProps) {
  const { map } = useMap();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const container = useMemo(() => document.createElement("div"), []);
  const { offset, maxWidth } = popupOptions;

  const popup = useMemo(() => {
    return new MapLibreGL.Popup({
      offset: 16,
      ...popupOptions,
      closeButton: false,
    })
      .setMaxWidth("none")
      .setLngLat([longitude, latitude]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- instance created once; position/options are synced by the effect below
  }, []);

  useEffect(() => {
    if (!map) return;

    const onCloseProp = () => onCloseRef.current?.();

    popup.on("close", onCloseProp);

    popup.setDOMContent(container);
    popup.addTo(map);

    return () => {
      popup.off("close", onCloseProp);
      if (popup.isOpen()) {
        popup.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- popup/container are stable
  }, [map]);

  // Sync popup position and options when they change.
  useEffect(() => {
    const current = popup.getLngLat();
    if (!current || current.lng !== longitude || current.lat !== latitude) {
      popup.setLngLat([longitude, latitude]);
    }
    popup.setOffset(offset ?? 16);
    if (maxWidth) {
      popup.setMaxWidth(maxWidth);
    }
  }, [popup, longitude, latitude, offset, maxWidth]);

  const handleClose = () => {
    popup.remove();
  };

  return createPortal(
    <div
      className={cn(
        "relative max-w-62 rounded-md bg-popover p-3 text-popover-foreground shadow-ring-md",
        "animate-in fade-in-0 zoom-in-95 duration-fast ease-entrance",
        className,
      )}
    >
      {closeButton && (
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close popup"
          className="absolute top-1 right-1 z-10 inline-flex size-5 items-center justify-center rounded-sm text-foreground transition-colors duration-fast hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
      {children}
    </div>,
    container,
  );
}
