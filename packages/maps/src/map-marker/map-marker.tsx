"use client";

import MapLibreGL, { type MarkerOptions, type PopupOptions } from "maplibre-gl";
import { createContext, use, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useLocale } from "@elabs-ai/components-ui";

import { useMap } from "../map-canvas/map-context";
import {
  type MapResponsive,
  useMapBreakpoint,
  resolveMapResponsive,
} from "../lib/use-map-breakpoint";
import {
  type MapLabelAnchor,
  mapAnchorGeometry,
  mapAnchorTransform,
} from "../map-annotation/anchor";

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

/**
 * A marker's own text label — the locator-map label: one of eight positions,
 * optionally on a box, optionally pushed out on a callout line.
 */
export interface MapMarkerLabelSpec {
  /** The label text. */
  text: string;
  /** Where the label sits relative to the point (default `"top"`). */
  position?: MapLabelAnchor;
  /** Set the label on a background box so it reads over a busy basemap. */
  box?: boolean;
  /** Push the label further out and draw a callout line back to the point. */
  callout?: boolean;
}

export type MapMarkerProps = {
  /** Longitude coordinate for the marker position. */
  longitude: number;
  /** Latitude coordinate for the marker position. */
  latitude: number;
  /**
   * Marker sub-components (MapMarkerContent, MapMarkerPopup, MapMarkerTooltip,
   * MapMarkerLabel). Optional when `label` alone marks the place — an inline
   * area label, for example.
   */
  children?: ReactNode;
  /**
   * Whether the marker shows at a tier (default `true` everywhere):
   * `{ base: true, narrow: false }` drops it from a phone-width map. The
   * Datawrapper advice applies — duplicate a marker with a shorter label and
   * the opposite `showAt` rather than cramming one label into both.
   */
  showAt?: MapResponsive<boolean>;
  /** A text label drawn with the marker (see {@link MapMarkerLabelSpec}). */
  label?: MapMarkerLabelSpec;
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
  showAt = true,
  label,
  ...markerOptions
}: MapMarkerProps) {
  const { map } = useMap();
  const visible = resolveMapResponsive(showAt, useMapBreakpoint());
  const [marker, setMarker] = useState<MapLibreGL.Marker | null>(null);

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

  const { anchor, className, offset, rotation, rotationAlignment, pitchAlignment } = markerOptions;

  // `longitude`/`latitude`/`draggable` at construction time only — the sync
  // effect below corrects them on the very next commit, and are read from a
  // ref here so they don't force a rebuild on every position change (see the
  // `anchor`/`className` note below for what SHOULD force one).
  const initialRef = useRef({ longitude, latitude, draggable });
  initialRef.current = { longitude, latitude, draggable };

  // Builds (and tears down) the actual MapLibre `Marker` instance. This is a
  // real `useEffect`, never `useMemo`: `useMemo`'s initializer runs during
  // RENDER — including on the server, where `document` doesn't exist — and
  // React offers no guarantee it runs only once (it may discard and recompute
  // a memoized value), which would silently leak marker instances/listeners.
  //
  // `anchor` and `className` have no MapLibre setter (`Marker` bakes both into
  // its constructor), so they are the only options that must REBUILD the
  // instance; every other option (position, draggable, offset, rotation,
  // alignment) has a live setter and is kept in sync by the effect further
  // below without ever recreating the marker.
  useEffect(() => {
    const markerInstance = new MapLibreGL.Marker({
      anchor,
      className,
      element: document.createElement("div"),
      draggable: initialRef.current.draggable,
    }).setLngLat([initialRef.current.longitude, initialRef.current.latitude]);

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

    setMarker(markerInstance);
  }, [anchor, className]);

  // Attaches/detaches the CURRENT marker instance to the map — its own effect
  // so both a `map` change and an `anchor`/`className`-driven rebuild above
  // are handled the same way, without a double `remove()`.
  // A marker hidden at this tier (`showAt`) is simply not on the map.
  useEffect(() => {
    if (!map || !marker || !visible) return;

    marker.addTo(map);

    return () => {
      marker.remove();
    };
  }, [map, marker, visible]);

  useEffect(() => {
    if (!marker) return;

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

  // No marker yet (first client tick after mount, or the moment an
  // `anchor`/`className` rebuild is in flight) — render nothing rather than
  // a sub-component (`MapMarkerContent` et al.) reaching into a null marker,
  // and nothing at all on the server.
  if (!marker) {
    return null;
  }

  return (
    <MarkerContext.Provider value={{ marker, map }}>
      {children}
      {label && <MarkerOwnLabel label={label} />}
    </MarkerContext.Provider>
  );
}

const LABEL_GAP = 10;
const CALLOUT_DISTANCE = 28;

/** The `label` prop, portaled into the marker element and centred on the point. */
function MarkerOwnLabel({ label }: { label: MapMarkerLabelSpec }) {
  const { marker } = useMarkerContext();
  const { text, position = "top", box = false, callout = false } = label;
  const distance = callout ? CALLOUT_DISTANCE : LABEL_GAP;
  const { dx, dy } = mapAnchorGeometry(position, distance);

  return createPortal(
    <>
      {callout && (
        <svg
          aria-hidden="true"
          data-slot="map-marker-callout"
          className="pointer-events-none absolute overflow-visible text-foreground"
          // The marker element is centred on the point; draw from its centre.
          style={{ left: "50%", top: "50%" }}
          width={1}
          height={1}
        >
          <line x1={0} y1={0} x2={dx} y2={dy} stroke="currentColor" strokeWidth={1} />
        </svg>
      )}
      <div
        data-slot="map-marker-label"
        data-position={position}
        className={cn(
          "pointer-events-none absolute whitespace-nowrap text-meta font-medium text-foreground",
          box && "rounded-sm bg-background/90 px-1 py-px",
        )}
        // Geographic placement: physical offsets from the point in every
        // writing direction (east stays east), like MapLibre's own anchors.
        style={{ left: "50%", top: "50%", transform: mapAnchorTransform(position, distance) }}
      >
        {text}
      </div>
    </>,
    marker.getElement(),
  );
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
  const { t } = useLocale();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("maps.popup.close")}
      className="absolute top-1 right-1 z-10 inline-flex size-5 items-center justify-center rounded-sm text-foreground transition-colors duration-fast hover:bg-muted focus-ring-inset"
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
 * of `MapMarkerContent` or nested inside it (a cross-theme sweep caught the
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
