"use client";

/**
 * ChoroplethKeyboardNav — visually-hidden keyboard-navigation overlay for the
 * choropleth chart.
 *
 * The SVG surface is `aria-hidden="true"` (raw `<path>` elements carry no
 * semantic meaning for AT). This component renders a visually-hidden `<ul>`
 * **in the HTML overlay layer** (not in the SVG) so keyboard users can:
 *
 * - Tab into the list to reach the first / currently-focused feature.
 * - Use ArrowRight / ArrowDown / ArrowLeft / ArrowUp to cycle through features
 *   (roving tabindex — the focused item is `tabIndex=0`, all others `-1`).
 * - Press Home / End to jump to the first / last feature.
 * - Focus events sync `hoveredFeatureIndex` (and `focusedFeatureIndex`) so the
 *   SVG highlights the corresponding region.
 * - Blur clears the hover/focus state unless focus stays within the list.
 *
 * Each list item receives an accessible name via `aria-label` in the format:
 * "Region Name: value" (or just "Region Name" when no value accessor is
 * supplied).
 *
 * Design choices:
 * - Visually hidden via `sr-only` + `pointer-events-none` — keyboard users get
 *   full access; mouse users are unaffected.
 * - `aria-label` on the `<ul>` ("Map regions") so AT announces context.
 * - Items use `role="option"` inside an `aria-multiselectable="false"` listbox
 *   so AT announces "N of M" position automatically in many SRs.
 * - No raw motion utilities — the SVG side uses CSS-variable `--t-fast` /
 *   `--ease-entrance` already; this HTML overlay has no CSS transitions.
 */

import { useCallback, useRef } from "react";
import type { ChoroplethFeature } from "./choropleth-context";
import { useChoroplethInteraction, useChoroplethStable } from "./choropleth-context";

export interface ChoroplethKeyboardNavProps {
  /**
   * Accessible label for the `<ul>` list. Announced by AT when the user tabs
   * into the nav overlay. Defaults to "Map regions".
   */
  navLabel?: string;
  /**
   * Returns the display name for a feature.
   * Defaults to `feature.properties.name ?? "Feature N"`.
   */
  getFeatureName?: (feature: ChoroplethFeature, index: number) => string;
  /**
   * Returns the numeric value for a feature (for the accessible name).
   * When absent, only the name is announced.
   */
  getFeatureValue?: (feature: ChoroplethFeature, index: number) => number | string | undefined;
  /**
   * Label for the value, e.g. "Score". Prepended in "Label: value" form.
   * Defaults to "Value".
   */
  valueLabel?: string;
}

export function ChoroplethKeyboardNav({
  navLabel = "Map regions",
  getFeatureName,
  getFeatureValue,
  valueLabel = "Value",
}: ChoroplethKeyboardNavProps) {
  const { features } = useChoroplethStable();
  const { focusedFeatureIndex, setFocusedFeatureIndex, setHoveredFeatureIndex, setTooltipData } =
    useChoroplethInteraction();

  // Keep refs to the <li> elements so we can imperatively focus them.
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  // Roving tabindex: focused item = 0, rest = -1. When no feature is focused
  // yet, the first item accepts Tab so the user can enter the list.
  const rovingIndex = focusedFeatureIndex ?? 0;

  const focusItem = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(features.length - 1, index));
      setFocusedFeatureIndex(clamped);
      setHoveredFeatureIndex(clamped);
      itemRefs.current[clamped]?.focus();
    },
    [features.length, setFocusedFeatureIndex, setHoveredFeatureIndex],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLUListElement>) => {
      if (features.length === 0) return;

      const current = focusedFeatureIndex ?? 0;

      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          focusItem((current + 1) % features.length);
          break;
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          focusItem((current - 1 + features.length) % features.length);
          break;
        case "Home":
          event.preventDefault();
          focusItem(0);
          break;
        case "End":
          event.preventDefault();
          focusItem(features.length - 1);
          break;
        default:
          break;
      }
    },
    [features.length, focusedFeatureIndex, focusItem],
  );

  const handleItemFocus = useCallback(
    (index: number) => {
      setFocusedFeatureIndex(index);
      setHoveredFeatureIndex(index);
    },
    [setFocusedFeatureIndex, setHoveredFeatureIndex],
  );

  const handleListBlur = useCallback(
    (event: React.FocusEvent<HTMLUListElement>) => {
      // Only clear if focus leaves the list entirely.
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setFocusedFeatureIndex(null);
        setHoveredFeatureIndex(null);
        setTooltipData(null);
      }
    },
    [setFocusedFeatureIndex, setHoveredFeatureIndex, setTooltipData],
  );

  if (features.length === 0) return null;

  return (
    // sr-only + pointer-events-none: visible to AT, invisible to mouse users.
    // position:absolute so it doesn't affect layout.
    <ul
      aria-label={navLabel}
      className="sr-only pointer-events-none absolute inset-0"
      onBlur={handleListBlur}
      onKeyDown={handleKeyDown}
      // listbox semantics: AT announces "item N of M" automatically in most SRs.
      role="listbox"
      aria-multiselectable="false"
      aria-activedescendant={
        focusedFeatureIndex !== null ? `choropleth-feature-${focusedFeatureIndex}` : undefined
      }
    >
      {features.map((feature, index) => {
        const name = getFeatureName
          ? getFeatureName(feature, index)
          : (feature.properties?.name ?? `Feature ${index + 1}`);

        const rawValue = getFeatureValue?.(feature, index);
        const valueStr = rawValue !== undefined ? `${valueLabel}: ${rawValue}` : undefined;

        const accessibleName = valueStr ? `${name}, ${valueStr}` : name;
        const isActive = focusedFeatureIndex === index;

        return (
          <li
            aria-label={accessibleName}
            aria-selected={isActive}
            id={`choropleth-feature-${index}`}
            // Feature index is stable for a given dataset — safe as an identity.
            key={index}
            onFocus={() => handleItemFocus(index)}
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            role="option"
            // Roving tabindex: only the active item (or the first, as entry point)
            // is reachable via Tab. Arrow keys move within the list.
            tabIndex={index === rovingIndex ? 0 : -1}
          >
            {accessibleName}
          </li>
        );
      })}
    </ul>
  );
}

ChoroplethKeyboardNav.displayName = "ChoroplethKeyboardNav";

export default ChoroplethKeyboardNav;
