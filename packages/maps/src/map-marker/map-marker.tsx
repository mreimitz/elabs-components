"use client";

import MapLibreGL, { type MarkerOptions, type PopupOptions } from "maplibre-gl";
import { createContext, use, useEffect, useMemo, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@elabs-ai/components-ui/lib/cn";

import { useMap } from "../map-canvas/map-context";

type MarkerContextValue = {
  marker: MapLibreGL.Marker;
  map: MapLibreGL.Map | null;
};

const MarkerContext = createContext<MarkerContextValue | null>(null);

function useMarkerContext() {
  const context = use(MarkerContext);
  if (!context) {
    throw new Error("MapMarker sub-components must be used within <MapMarker>");
  }
  return context;
}

export type MapMarkerProps = {
  /** Longitude coordinate for the marker position. */
  longitude: number;
  /** Latitude coordinate for the marker position. */
  latitude: number;
  /** Marker sub-components (MapMarkerContent, MapMarkerPopup, MapMarkerTooltip, MapMarkerLabel). */
  children: ReactNode;
  /** Callback when the marker is clicked. */
  onClick?: (e: MouseEvent) => void;
  /** Callback when the mouse enters the marker. */
  onMouseEnter?: (e: MouseEvent) => void;
  /** Callback when the mouse leaves the marker. */
  onMouseLeave?: (e: MouseEvent) => void;
  /** Callback when a drag starts (requires `draggable`). */
  onDragStart?: (lngLat: { lng: number; lat: number }) => void;
  /** Callback during a drag (requires `draggable`). */
  onDrag?: (lngLat: { lng: number; lat: number }) => void;
  /** Callback when a drag ends (requires `draggable`). */
  onDragEnd?: (lngLat: { lng: number; lat: number }) => void;
} & Omit<MarkerOptions, "element">;

/**
 * A marker anchored at a lng/lat. Compose the pieces you need:
 * `MapMarkerContent` (the visual), `MapMarkerLabel`, `MapMarkerPopup` (opens
 * on click) and `MapMarkerTooltip` (shows on hover).
 */
export function MapMarker({
  longitude,
  latitude,
  children,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onDragStart,
  onDrag,
  onDragEnd,
  draggable = false,
  ...markerOptions
}: MapMarkerProps) {
  const { map } = useMap();

  const callbacksRef = useRef({
    onClick,
    onMouseEnter,
    onMouseLeave,
    onDragStart,
    onDrag,
    onDragEnd,
  });
  callbacksRef.current = {
    onClick,
    onMouseEnter,
    onMouseLeave,
    onDragStart,
    onDrag,
    onDragEnd,
  };

  const marker = useMemo(() => {
    const markerInstance = new MapLibreGL.Marker({
      ...markerOptions,
      element: document.createElement("div"),
      draggable,
    }).setLngLat([longitude, latitude]);

    const handleClick = (e: MouseEvent) => callbacksRef.current.onClick?.(e);
    const handleMouseEnter = (e: MouseEvent) => callbacksRef.current.onMouseEnter?.(e);
    const handleMouseLeave = (e: MouseEvent) => callbacksRef.current.onMouseLeave?.(e);

    markerInstance.getElement()?.addEventListener("click", handleClick);
    markerInstance.getElement()?.addEventListener("mouseenter", handleMouseEnter);
    markerInstance.getElement()?.addEventListener("mouseleave", handleMouseLeave);

    const handleDragStart = () => {
      const lngLat = markerInstance.getLngLat();
      callbacksRef.current.onDragStart?.({ lng: lngLat.lng, lat: lngLat.lat });
    };
    const handleDrag = () => {
      const lngLat = markerInstance.getLngLat();
      callbacksRef.current.onDrag?.({ lng: lngLat.lng, lat: lngLat.lat });
    };
    const handleDragEnd = () => {
      const lngLat = markerInstance.getLngLat();
      callbacksRef.current.onDragEnd?.({ lng: lngLat.lng, lat: lngLat.lat });
    };

    markerInstance.on("dragstart", handleDragStart);
    markerInstance.on("drag", handleDrag);
    markerInstance.on("dragend", handleDragEnd);

    return markerInstance;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- instance created once; position/options are synced by the effect below
  }, []);

  useEffect(() => {
    if (!map) return;

    marker.addTo(map);

    return () => {
      marker.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `marker` is stable (created once above)
  }, [map]);

  const { offset, rotation, rotationAlignment, pitchAlignment } = markerOptions;

  useEffect(() => {
    const current = marker.getLngLat();
    if (current.lng !== longitude || current.lat !== latitude) {
      marker.setLngLat([longitude, latitude]);
    }

    if (marker.isDraggable() !== draggable) {
      marker.setDraggable(draggable);
    }

    const currentOffset = marker.getOffset();
    const newOffset = offset ?? [0, 0];
    const [newOffsetX, newOffsetY] = Array.isArray(newOffset)
      ? newOffset
      : [newOffset.x, newOffset.y];
    if (currentOffset.x !== newOffsetX || currentOffset.y !== newOffsetY) {
      marker.setOffset(newOffset);
    }

    if (marker.getRotation() !== (rotation ?? 0)) {
      marker.setRotation(rotation ?? 0);
    }
    if (marker.getRotationAlignment() !== (rotationAlignment ?? "auto")) {
      marker.setRotationAlignment(rotationAlignment ?? "auto");
    }
    if (marker.getPitchAlignment() !== (pitchAlignment ?? "auto")) {
      marker.setPitchAlignment(pitchAlignment ?? "auto");
    }
  }, [marker, longitude, latitude, draggable, offset, rotation, rotationAlignment, pitchAlignment]);

  return <MarkerContext.Provider value={{ marker, map }}>{children}</MarkerContext.Provider>;
}

export interface MapMarkerContentProps {
  /** Custom marker content. Defaults to a primary-colored dot. */
  children?: ReactNode;
  /** Additional CSS classes for the marker container. */
  className?: string;
}

/** The marker's visual, portaled into the MapLibre marker element. */
export function MapMarkerContent({ children, className }: MapMarkerContentProps) {
  const { marker } = useMarkerContext();

  return createPortal(
    <div className={cn("relative cursor-pointer", className)}>
      {children || <DefaultMarkerIcon />}
    </div>,
    marker.getElement(),
  );
}

function DefaultMarkerIcon() {
  return (
    <div className="relative size-4 rounded-full border-2 border-background bg-primary shadow-sm" />
  );
}

function PopupCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close popup"
      className="absolute top-1 right-1 z-10 inline-flex size-5 items-center justify-center rounded-sm text-foreground transition-colors duration-fast hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <X className="size-3.5" aria-hidden="true" />
    </button>
  );
}

export type MapMarkerPopupProps = {
  /** Popup content. */
  children: ReactNode;
  /** Additional CSS classes for the popup container. */
  className?: string;
  /** Show a close button in the popup (default: false). */
  closeButton?: boolean;
} & Omit<PopupOptions, "className" | "closeButton">;

/** A popup attached to the marker — MapLibre toggles it on marker click. */
export function MapMarkerPopup({
  children,
  className,
  closeButton = false,
  ...popupOptions
}: MapMarkerPopupProps) {
  const { marker, map } = useMarkerContext();
  const container = useMemo(() => document.createElement("div"), []);
  const { offset, maxWidth } = popupOptions;

  const popup = useMemo(() => {
    return new MapLibreGL.Popup({
      offset: 16,
      ...popupOptions,
      closeButton: false,
    })
      .setMaxWidth("none")
      .setDOMContent(container);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- instance created once; options are synced by the effect below
  }, []);

  useEffect(() => {
    if (!map) return;

    popup.setDOMContent(container);
    marker.setPopup(popup);

    return () => {
      marker.setPopup(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- popup/marker/container are stable
  }, [map]);

  // Sync popup options when they change.
  useEffect(() => {
    popup.setOffset(offset ?? 16);
    if (maxWidth) {
      popup.setMaxWidth(maxWidth);
    }
  }, [popup, offset, maxWidth]);

  const handleClose = () => popup.remove();

  return createPortal(
    <div
      className={cn(
        "relative max-w-62 rounded-md bg-popover p-3 text-popover-foreground shadow-ring-md",
        "animate-in fade-in-0 zoom-in-95 duration-fast ease-entrance",
        className,
      )}
    >
      {closeButton && <PopupCloseButton onClick={handleClose} />}
      {children}
    </div>,
    container,
  );
}

export type MapMarkerTooltipProps = {
  /** Tooltip content. */
  children: ReactNode;
  /** Additional CSS classes for the tooltip container. */
  className?: string;
} & Omit<PopupOptions, "className" | "closeButton" | "closeOnClick">;

/** A hover tooltip attached to the marker. */
export function MapMarkerTooltip({ children, className, ...popupOptions }: MapMarkerTooltipProps) {
  const { marker, map } = useMarkerContext();
  const container = useMemo(() => document.createElement("div"), []);
  const { offset, maxWidth } = popupOptions;

  const tooltip = useMemo(() => {
    return new MapLibreGL.Popup({
      offset: 16,
      ...popupOptions,
      closeOnClick: true,
      closeButton: false,
    }).setMaxWidth("none");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- instance created once; options are synced by the effect below
  }, []);

  useEffect(() => {
    if (!map) return;

    tooltip.setDOMContent(container);

    const handleMouseEnter = () => {
      tooltip.setLngLat(marker.getLngLat()).addTo(map);
    };
    const handleMouseLeave = () => tooltip.remove();

    marker.getElement()?.addEventListener("mouseenter", handleMouseEnter);
    marker.getElement()?.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      marker.getElement()?.removeEventListener("mouseenter", handleMouseEnter);
      marker.getElement()?.removeEventListener("mouseleave", handleMouseLeave);
      tooltip.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tooltip/marker/container are stable
  }, [map]);

  // Sync tooltip options when they change.
  useEffect(() => {
    tooltip.setOffset(offset ?? 16);
    if (maxWidth) {
      tooltip.setMaxWidth(maxWidth);
    }
  }, [tooltip, offset, maxWidth]);

  return createPortal(
    <div
      className={cn(
        "pointer-events-none rounded-md bg-foreground px-2 py-1 text-meta text-balance text-background shadow-md",
        "animate-in fade-in-0 zoom-in-95 duration-fast ease-entrance",
        className,
      )}
    >
      {children}
    </div>,
    container,
  );
}

export interface MapMarkerLabelProps {
  /** Label text content. */
  children: ReactNode;
  /** Additional CSS classes for the label. */
  className?: string;
  /** Position of the label relative to the marker (default: "top"). */
  position?: "top" | "bottom";
}

/**
 * A small always-visible text label above or below the marker. Portaled into
 * the marker element so it anchors to the marker whether composed as a sibling
 * of `MapMarkerContent` or nested inside it (the three-theme sweep caught the
 * sibling composition rendering the label against the map container instead).
 */
export function MapMarkerLabel({ children, className, position = "top" }: MapMarkerLabelProps) {
  const { marker } = useMarkerContext();
  const positionClasses = {
    top: "bottom-full mb-1",
    bottom: "top-full mt-1",
  };

  return createPortal(
    <div
      className={cn(
        "absolute left-1/2 -translate-x-1/2 whitespace-nowrap",
        "text-meta font-medium text-foreground",
        positionClasses[position],
        className,
      )}
    >
      {children}
    </div>,
    marker.getElement(),
  );
}
