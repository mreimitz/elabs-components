"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useReducedMotion } from "@elabs-ai/components-tokens";

import { useMap } from "../map-canvas/map-context";
import {
  planGroupsFromRegions,
  planRegionCentre,
  type MapPlanGroup,
  type MapPlanRegion,
} from "../lib/plan-regions";
import { usePlanProjection, type PlanScreenBox } from "../lib/use-plan-projection";
import { warnMapOnce } from "../lib/warn-once";

/** Beyond this many regions a keyboard walk stops being usable — see `MapPlanOverlay`. */
const REGION_WARN_CEILING = 500;
/** Beyond this many members, a group is no better to walk than the whole plan was. */
const GROUP_MEMBER_CEILING = 64;
/** A label needs at least this much room, in px, before it is worth drawing. */
const LABEL_MIN_WIDTH = 44;
const LABEL_MIN_HEIGHT = 14;
/** How long the camera takes to bring an off-screen region into view. */
const TRAVEL_DURATION_MS = 260;

/** How the overlay lays its buttons out. */
export type MapPlanOverlayMode = "regions" | "groups";

export type MapPlanOverlayProps = {
  /**
   * The interactive regions, in reading order. Keep the array MEMOIZED — it
   * drives the projection pass.
   */
  regions: readonly MapPlanRegion[];
  /**
   * Accessible name for the set of regions ("Rooms on level 3"). Supplied by the
   * consumer so it can be localized.
   */
  label: string;
  /** The selected region id(s) — the same value handed to `<MapGeoJSON selectedId>`. */
  selectedId?: string | readonly string[] | null;
  /** Fired when a region is activated by click, `Enter` or `Space`; `null` on `Escape`. */
  onSelect?: (id: string | null, region: MapPlanRegion | null) => void;
  /**
   * Fired when the pointer or keyboard focus moves to another region. Feed it to
   * `<MapGeoJSON hoveredId>` so the shape and the proxy highlight together.
   */
  onActiveChange?: (id: string | null, region: MapPlanRegion | null) => void;
  /**
   * `"regions"` (default) puts one button on every region. `"groups"` puts one
   * button on each `group` instead, and `Enter` descends into its members — the
   * answer for a plan with more regions than a keyboard can reasonably walk (a
   * train with 192 seats), where the first question is always "which coach?".
   */
  mode?: MapPlanOverlayMode;
  /**
   * The accessible description of a group's button — "64 seats", localized by the
   * consumer. Group mode only.
   */
  describeGroup?: (group: MapPlanGroup) => string;
  /** Draw each region's label in the overlay (default true). */
  showLabels?: boolean;
  /** Hide the labels below this zoom, when a fitted plan is too small to read. */
  labelMinZoom?: number;
  /**
   * Let the regions take the pointer as well as the keyboard (default true).
   * With `false` the overlay is keyboard-only and clicks reach the canvas, where
   * `<MapGeoJSON onClick>` picks the shape itself — the right choice for
   * interlocking, non-rectangular shapes whose boxes overlap.
   */
  capturePointer?: boolean;
  /** Extra classes for the overlay root. */
  className?: string;
};

/** Reading-order index, for the fallback when no region lies in the arrow's cone. */
function orderIndex(regions: readonly MapPlanRegion[], id: string | null) {
  return id == null ? -1 : regions.findIndex((region) => region.id === id);
}

type Direction = "start" | "end" | "up" | "down";

const DIRECTION_VECTORS: Record<Direction, [number, number]> = {
  end: [1, 0],
  start: [-1, 0],
  up: [0, -1],
  down: [0, 1],
};

/**
 * The nearest region centre inside a ±45° cone — how a sighted user reads an
 * arrow key on a plan. Falls back to reading order, so an arrow always moves.
 */
function nearestInDirection(
  regions: readonly MapPlanRegion[],
  fromId: string,
  direction: Direction,
  flipY: boolean,
): MapPlanRegion | null {
  const from = regions.find((region) => region.id === fromId);
  if (!from) return null;

  const centre = (region: MapPlanRegion) => {
    const point = planRegionCentre(region.bounds);
    return { x: point.x, y: flipY ? -point.y : point.y };
  };
  const origin = centre(from);
  const [dirX, dirY] = DIRECTION_VECTORS[direction];

  let best: MapPlanRegion | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const region of regions) {
    if (region.id === fromId) continue;
    const target = centre(region);
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const along = dx * dirX + dy * dirY;
    if (along <= 0) continue;
    // cos(45°) — inside the cone when the along-axis share dominates.
    const distance = Math.hypot(dx, dy);
    if (along / distance < Math.SQRT1_2) continue;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = region;
    }
  }

  if (best) return best;

  const index = orderIndex(regions, fromId);
  const step = direction === "end" || direction === "down" ? 1 : -1;
  return regions[index + step] ?? null;
}

/**
 * The keyboard and label layer of a plan. MapLibre draws every shape into one
 * WebGL canvas, so a room is not a DOM element and cannot be focused, named or
 * given a pressed state. This overlay puts one real `<button aria-pressed>` over
 * each region — the shapes stay in WebGL, the semantics come back to the DOM.
 *
 * ```tsx
 * <MapCanvas blank plan={{ width: 2400, height: 1600, unit: "cm" }}>
 *   <MapGeoJSON data={rooms} promoteId="id" selectedId={selection.selectedIds} hoveredId={active} />
 *   <MapPlanOverlay
 *     regions={regions}
 *     label={t("floor.rooms")}
 *     selectedId={selection.selectedIds}
 *     onSelect={(id) => selection.select(id)}
 *     onActiveChange={setActive}
 *   />
 * </MapCanvas>
 * ```
 *
 * Roughly 250 regions stay comfortable and 500 is the hard ceiling: past that a
 * `Tab`-and-arrow walk is no longer a usable way to reach one seat, and the
 * regions want `mode="groups"` instead — one button per coach or wing, `Enter`
 * to go in, `Escape` to come back out, `PageUp`/`PageDown` to change group at
 * either level.
 */
export function MapPlanOverlay({
  regions,
  label,
  selectedId,
  onSelect,
  onActiveChange,
  mode = "regions",
  describeGroup,
  showLabels = true,
  labelMinZoom,
  capturePointer = true,
  className,
}: MapPlanOverlayProps) {
  const { map, plan, loading } = useMap();
  const reducedMotion = useReducedMotion();
  const [activeId, setActiveId] = useState<string | null>(null);
  /** Group mode only: which group the keyboard is inside, if any. */
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);

  const buttonsRef = useRef(new Map<string, HTMLButtonElement>());
  const labelsRef = useRef(new Map<string, HTMLElement>());
  /**
   * A button to focus once it exists. Changing group level swaps the whole set of
   * buttons, so the target is not in the DOM when the key is pressed — and a
   * `requestAnimationFrame` would drop the focus on the floor whenever the frame
   * lands after the next keystroke.
   */
  const pendingFocusRef = useRef<string | null>(null);

  const selectedIds = useMemo(() => {
    if (selectedId == null) return [] as string[];
    return Array.isArray(selectedId) ? [...selectedId] : [selectedId as string];
  }, [selectedId]);

  const groups = useMemo(
    () => (mode === "groups" ? planGroupsFromRegions(regions) : []),
    [mode, regions],
  );
  const openGroup = useMemo(
    () => groups.find((group) => group.key === openGroupKey) ?? null,
    [groups, openGroupKey],
  );

  /**
   * What actually gets a button: every region, the groups, or one group's members.
   * Everything downstream — the projection pass, the arrow keys, the roving tab
   * stop — works from this one list.
   */
  const visibleRegions = useMemo<readonly MapPlanRegion[]>(() => {
    if (mode !== "groups") return regions;
    if (openGroup) return openGroup.members;
    return groups.map((group) => {
      const description = describeGroup?.(group);
      return description ? { ...group.region, description } : group.region;
    });
  }, [describeGroup, groups, mode, openGroup, regions]);

  const groupByRegionId = useMemo(() => {
    const index = new Map<string, MapPlanGroup>();
    for (const group of groups) index.set(group.region.id, group);
    return index;
  }, [groups]);

  if (!plan) {
    warnMapOnce(
      "plan-overlay-no-plan",
      "<MapPlanOverlay> needs a plan coordinate system: set `plan` on <MapCanvas>.",
    );
  }
  if (mode === "regions" && regions.length > REGION_WARN_CEILING) {
    warnMapOnce(
      "plan-overlay-region-count",
      `<MapPlanOverlay> has ${regions.length} regions. Past ~${REGION_WARN_CEILING} a keyboard walk stops being a usable way to reach one of them — set mode="groups" instead.`,
    );
  }
  const biggestGroup = groups.reduce((most, group) => Math.max(most, group.members.length), 0);
  if (biggestGroup > GROUP_MEMBER_CEILING) {
    warnMapOnce(
      "plan-overlay-group-size",
      `<MapPlanOverlay> has a group of ${biggestGroup} regions. Past ~${GROUP_MEMBER_CEILING} members a group is no easier to walk than the whole plan was — split it.`,
    );
  }

  const callbacksRef = useRef({ onSelect, onActiveChange });
  callbacksRef.current = { onSelect, onActiveChange };

  const regionById = useMemo(() => {
    const index = new Map<string, MapPlanRegion>();
    for (const region of visibleRegions) index.set(region.id, region);
    return index;
  }, [visibleRegions]);

  /**
   * Labels are sized in the same pass that places the boxes: a label that cannot
   * fit its region is hidden rather than allowed to spill over the shape next
   * door, and it shrinks to `shortLabel` before it disappears.
   */
  const handleFrame = useCallback(
    (boxes: ReadonlyMap<string, PlanScreenBox>) => {
      if (!showLabels) return;
      const zoom = map?.getZoom?.();
      const belowZoom = labelMinZoom !== undefined && zoom !== undefined && zoom < labelMinZoom;

      for (const [id, box] of boxes) {
        const element = labelsRef.current.get(id);
        if (!element) continue;
        const region = regionById.get(id);
        const fits = !belowZoom && box.width >= LABEL_MIN_WIDTH && box.height >= LABEL_MIN_HEIGHT;
        element.style.visibility = fits ? "visible" : "hidden";
        if (!fits || !region) continue;
        const short = region.shortLabel ?? region.label;
        // A rough per-character estimate is enough here: it only decides which
        // of two strings to draw, and a wrong guess still truncates cleanly.
        const roomFor = Math.floor(box.width / 7);
        element.textContent = region.label.length <= roomFor ? region.label : short;
      }
    },
    [labelMinZoom, map, regionById, showLabels],
  );

  const { register, refresh } = usePlanProjection({
    map,
    plan,
    regions: visibleRegions,
    enabled: !!plan,
    onFrame: handleFrame,
  });

  // Focus whatever a level change asked for, in the commit that created it.
  useLayoutEffect(() => {
    const id = pendingFocusRef.current;
    if (id == null) return;
    pendingFocusRef.current = null;
    buttonsRef.current.get(id)?.focus();
  });

  // Re-run the pass when the label rules change, so a zoom threshold or a
  // switched-off label takes effect without waiting for the next map move.
  useEffect(() => {
    refresh();
  }, [refresh, showLabels, labelMinZoom, visibleRegions]);

  const setActive = useCallback(
    (id: string | null) => {
      setActiveId(id);
      callbacksRef.current.onActiveChange?.(id, id ? (regionById.get(id) ?? null) : null);
    },
    [regionById],
  );

  /** Move focus, and bring the region into view when it sits off-screen. */
  const focusRegion = useCallback(
    (region: MapPlanRegion | null) => {
      if (!region) return;
      setActive(region.id);
      buttonsRef.current.get(region.id)?.focus();

      if (!map || !plan) return;
      const canvas = map.getCanvas?.();
      const width = canvas?.clientWidth ?? 0;
      const height = canvas?.clientHeight ?? 0;
      const centre = planRegionCentre(region.bounds);
      const point = map.project(plan.toLngLat(centre));
      const outside = point.x < 0 || point.y < 0 || point.x > width || point.y > height;
      if (!outside) return;

      map.easeTo({
        center: plan.toLngLat(centre),
        duration: reducedMotion ? 0 : TRAVEL_DURATION_MS,
      });
    },
    [map, plan, reducedMotion, setActive],
  );

  const flipY = plan?.extent.origin === "bottom-left";

  /** Open a group and put focus on its first member. */
  const enterGroup = useCallback(
    (group: MapPlanGroup) => {
      const first = group.members[0];
      setOpenGroupKey(group.key);
      if (!first) return;
      pendingFocusRef.current = first.id;
      setActive(first.id);
    },
    [setActive],
  );

  /** Leave the open group and put focus back on the group's own button. */
  const leaveGroup = useCallback(() => {
    const key = openGroupKey;
    if (key == null) return false;
    setOpenGroupKey(null);
    const groupRegionId = groups.find((group) => group.key === key)?.region.id;
    if (groupRegionId) {
      pendingFocusRef.current = groupRegionId;
      setActive(groupRegionId);
    }
    return true;
  }, [groups, openGroupKey, setActive]);

  /**
   * A button press means "go in" on a group and "select" on a region — the one
   * place the two levels of group mode differ.
   */
  const activate = useCallback(
    (region: MapPlanRegion) => {
      const group = groupByRegionId.get(region.id);
      if (group) {
        enterGroup(group);
        return;
      }
      callbacksRef.current.onSelect?.(region.id, region);
    },
    [enterGroup, groupByRegionId],
  );

  /** `PageUp`/`PageDown`: the group before or after this one, at either level. */
  const stepGroup = useCallback(
    (step: 1 | -1, fromRegionId: string) => {
      if (groups.length === 0) return;
      const fromKey =
        openGroupKey ??
        groups.find((group) => group.region.id === fromRegionId)?.key ??
        groups[0]!.key;
      const index = groups.findIndex((group) => group.key === fromKey);
      const next = groups[index + step];
      if (!next) return;
      if (openGroupKey != null) enterGroup(next);
      else focusRegion(next.region);
    },
    [enterGroup, focusRegion, groups, openGroupKey],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, region: MapPlanRegion) => {
      const direction: Direction | null =
        event.key === "ArrowRight"
          ? "end"
          : event.key === "ArrowLeft"
            ? "start"
            : event.key === "ArrowUp"
              ? "up"
              : event.key === "ArrowDown"
                ? "down"
                : null;

      if (direction) {
        event.preventDefault();
        focusRegion(nearestInDirection(visibleRegions, region.id, direction, !!flipY));
        return;
      }

      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        focusRegion((event.key === "Home" ? visibleRegions[0] : visibleRegions.at(-1)) ?? null);
        return;
      }

      if (event.key === "PageUp" || event.key === "PageDown") {
        if (groups.length === 0) return;
        event.preventDefault();
        stepGroup(event.key === "PageDown" ? 1 : -1, region.id);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        // Inside a group, Escape steps back OUT of it; otherwise it clears the
        // selection. One key, the level it is on.
        if (leaveGroup()) return;
        callbacksRef.current.onSelect?.(null, null);
      }
    },
    [flipY, focusRegion, groups.length, leaveGroup, stepGroup, visibleRegions],
  );

  // Roving tabindex: exactly one stop into the set, then arrows inside it.
  const tabStopId =
    activeId ??
    visibleRegions.find((region) => selectedIds.includes(region.id))?.id ??
    visibleRegions[0]?.id ??
    null;

  return (
    <div
      data-slot="map-plan-overlay"
      // The overlay sits over the canvas but under the loading veil, so a
      // keyboard user never lands on a button hidden behind it.
      className={cn("pointer-events-none absolute inset-0", loading && "invisible", className)}
    >
      {/* `role="list"` is explicit: `display: contents` drops list semantics in
          some engines, and the set needs its name to survive. */}
      <ul data-slot="map-plan-overlay-list" role="list" aria-label={label} className="contents">
        {visibleRegions.map((region) => {
          const isGroup = groupByRegionId.has(region.id);
          const isSelected = !isGroup && selectedIds.includes(region.id);
          const accessibleName = region.description
            ? `${region.label}, ${region.description}`
            : region.label;

          return (
            <li
              key={region.id}
              ref={(element) => register(region.id, element)}
              // Placed by the projection pass; `absolute` with no inset so the
              // transform it writes is the only source of position.
              className="pointer-events-none absolute"
            >
              <button
                type="button"
                ref={(element) => {
                  if (element) buttonsRef.current.set(region.id, element);
                  else buttonsRef.current.delete(region.id);
                }}
                data-slot="map-plan-overlay-region"
                data-selected={isSelected || undefined}
                data-group={isGroup || undefined}
                // A group's button is not a toggle: pressing it replaces the
                // group buttons with its members, and `aria-expanded` would then
                // describe a control that is no longer on screen.
                aria-pressed={isGroup ? undefined : isSelected}
                tabIndex={region.id === tabStopId ? 0 : -1}
                className={cn(
                  "absolute inset-0 rounded-sm focus-ring",
                  capturePointer ? "pointer-events-auto" : "pointer-events-none",
                )}
                onFocus={() => setActive(region.id)}
                onBlur={() => setActive(null)}
                onPointerEnter={() => setActive(region.id)}
                onPointerLeave={() => setActive(null)}
                onClick={() => activate(region)}
                onKeyDown={(event) => handleKeyDown(event, region)}
              >
                <span className="sr-only">{accessibleName}</span>
              </button>
              {showLabels && (
                <span
                  ref={(element) => {
                    if (element) labelsRef.current.set(region.id, element);
                    else labelsRef.current.delete(region.id);
                  }}
                  data-slot="map-plan-overlay-label"
                  // Aria-hidden and a SIBLING of the button: the button already
                  // says the label as the start of its accessible name (WCAG
                  // 2.5.3), and nesting it would say it twice.
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none absolute inset-0 m-auto grid h-fit w-fit max-w-full",
                    "place-items-center truncate rounded-sm bg-card px-1 text-meta text-foreground",
                  )}
                >
                  {region.label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
