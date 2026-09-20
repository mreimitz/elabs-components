"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Locate, Maximize, Minus, Plus, Scan } from "lucide-react";
import { Spinner, useLocale } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";

import { useMapFrame } from "../lib/use-map-breakpoint";
import { useMap } from "../map-canvas/map-context";

export interface MapControlsProps {
  /** Position of the controls on the map (default: "bottom-right"). */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  /**
   * Show zoom in/out buttons. Default: true on an interactive map, false on a
   * static one (`<MapCanvas interactive={false}>`), whose whole point is a
   * fixed view — set `showZoom` explicitly to override either way.
   */
  showZoom?: boolean;
  /** Show a compass button to reset bearing/pitch (default: false). */
  showCompass?: boolean;
  /** Show a locate button to fly to the user's location (default: false). */
  showLocate?: boolean;
  /** Show a fullscreen toggle button (default: false). */
  showFullscreen?: boolean;
  /**
   * Show a button that frames the whole plan again — a plan map has an edge to
   * come back to, so this defaults to ON there and off on a geographic map.
   */
  showFit?: boolean;
  /**
   * What the fit button frames. Defaults to the plan's own extent; pass bounds
   * to frame something else (one wing, the selected cluster).
   */
  fitBounds?: [[number, number], [number, number]];
  /** Called after the camera has been asked to frame the plan. */
  onFit?: () => void;
  /** Additional CSS classes for the controls container. */
  className?: string;
  /** Callback with user coordinates when located. */
  onLocate?: (coords: { longitude: number; latitude: number }) => void;
  /** Callback when geolocation fails or is denied. */
  onLocateError?: (error: GeolocationPositionError) => void;
}

// bottom-right sits above MapLibre's attribution control — keep it visible.
const positionClasses = {
  "top-left": "top-2 left-2",
  "top-right": "top-2 right-2",
  "bottom-left": "bottom-2 left-2",
  "bottom-right": "bottom-10 right-2",
};

function ControlGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col divide-y overflow-hidden rounded-md bg-surface-elevated shadow-ring-sm">
      {children}
    </div>
  );
}

function ControlButton({
  onClick,
  label,
  children,
  disabled = false,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      type="button"
      className={cn(
        "flex size-8 items-center justify-center text-foreground transition-colors duration-fast",
        "hover:bg-surface-muted",
        "focus-ring-inset",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

/** Branded zoom / compass / locate / fullscreen controls. Render inside `<MapCanvas>`. */
export function MapControls({
  position = "bottom-right",
  showZoom,
  showCompass = false,
  showLocate = false,
  showFullscreen = false,
  showFit,
  fitBounds,
  className,
  onLocate,
  onLocateError,
  onFit,
}: MapControlsProps) {
  const { map, plan } = useMap();
  const { t } = useLocale();
  const { interactive } = useMapFrame();
  // A static map (`interactive={false}`) is a fixed editorial view: zoom chrome
  // invites a gesture the map will not answer, and a click leaves the reader on
  // a frame they cannot pan back from. The host may still ask for it.
  const zoomVisible = showZoom ?? interactive;
  const [waitingForLocation, setWaitingForLocation] = useState(false);
  const fitVisible = showFit ?? plan != null;

  const handleZoomIn = useCallback(() => {
    map?.zoomTo(map.getZoom() + 1, { duration: 300 });
  }, [map]);

  const handleZoomOut = useCallback(() => {
    map?.zoomTo(map.getZoom() - 1, { duration: 300 });
  }, [map]);

  const handleResetBearing = useCallback(() => {
    map?.resetNorthPitch({ duration: 300 });
  }, [map]);

  const handleLocate = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    setWaitingForLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          longitude: pos.coords.longitude,
          latitude: pos.coords.latitude,
        };
        map?.flyTo({
          center: [coords.longitude, coords.latitude],
          zoom: 14,
          duration: 1500,
        });
        onLocate?.(coords);
        setWaitingForLocation(false);
      },
      (error) => {
        onLocateError?.(error);
        setWaitingForLocation(false);
      },
    );
  }, [map, onLocate, onLocateError]);

  const handleFit = useCallback(() => {
    const bounds = fitBounds ?? plan?.bounds;
    if (!map || !bounds) return;
    map.fitBounds(bounds, { padding: 24, duration: 300 });
    onFit?.();
  }, [fitBounds, map, onFit, plan]);

  const handleFullscreen = useCallback(() => {
    const container = map?.getContainer();
    if (!container) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void container.requestFullscreen();
    }
  }, [map]);

  // Nothing to show (a static map with no explicit group) renders no box at all.
  if (!zoomVisible && !fitVisible && !showCompass && !showLocate && !showFullscreen) return null;

  return (
    <div
      className={cn("absolute z-10 flex flex-col gap-1.5", positionClasses[position], className)}
    >
      {zoomVisible && (
        <ControlGroup>
          <ControlButton onClick={handleZoomIn} label={t("maps.controls.zoomIn")}>
            <Plus className="size-4" aria-hidden="true" />
          </ControlButton>
          <ControlButton onClick={handleZoomOut} label={t("maps.controls.zoomOut")}>
            <Minus className="size-4" aria-hidden="true" />
          </ControlButton>
        </ControlGroup>
      )}
      {showCompass && (
        <ControlGroup>
          <CompassButton onClick={handleResetBearing} />
        </ControlGroup>
      )}
      {showLocate && (
        <ControlGroup>
          <ControlButton
            onClick={handleLocate}
            label={t("maps.controls.locate")}
            disabled={waitingForLocation}
          >
            {waitingForLocation ? (
              <Spinner label={t("maps.controls.locating")} className="size-4 text-foreground" />
            ) : (
              <Locate className="size-4" aria-hidden="true" />
            )}
          </ControlButton>
        </ControlGroup>
      )}
      {fitVisible && (
        <ControlGroup>
          <ControlButton onClick={handleFit} label={t("maps.controls.fit")}>
            <Scan className="size-4" aria-hidden="true" />
          </ControlButton>
        </ControlGroup>
      )}
      {showFullscreen && (
        <ControlGroup>
          <ControlButton onClick={handleFullscreen} label={t("maps.controls.fullscreen")}>
            <Maximize className="size-4" aria-hidden="true" />
          </ControlButton>
        </ControlGroup>
      )}
    </div>
  );
}

function CompassButton({ onClick }: { onClick: () => void }) {
  const { map } = useMap();
  const { t } = useLocale();
  const compassRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!map || !compassRef.current) return;

    const compass = compassRef.current;

    const updateRotation = () => {
      const bearing = map.getBearing();
      const pitch = map.getPitch();
      compass.style.transform = `rotateX(${pitch}deg) rotateZ(${-bearing}deg)`;
    };

    map.on("rotate", updateRotation);
    map.on("pitch", updateRotation);
    updateRotation();

    return () => {
      map.off("rotate", updateRotation);
      map.off("pitch", updateRotation);
    };
  }, [map]);

  return (
    <ControlButton onClick={onClick} label={t("maps.controls.resetBearing")}>
      <svg
        ref={compassRef}
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-5 transition-transform duration-fast"
        style={{ transformStyle: "preserve-3d" }}
      >
        <path d="M12 2L16 12H12V2Z" className="fill-destructive" />
        <path d="M12 2L8 12H12V2Z" className="fill-destructive/50" />
        <path d="M12 22L16 12H12V22Z" className="fill-muted-foreground/60" />
        <path d="M12 22L8 12H12V22Z" className="fill-muted-foreground/30" />
      </svg>
    </ControlButton>
  );
}
