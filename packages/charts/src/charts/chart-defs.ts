import { Children, isValidElement, type ReactElement, type ReactNode } from "react";

/** The `$$typeof` tags of the two exotic wrapper types this module names by `displayName`. */
const REACT_MEMO_TYPE = Symbol.for("react.memo");
const REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");

/**
 * `child`'s component name — a plain function's own `displayName` or function `name`;
 * a `memo()`/`forwardRef()`-wrapped component's `displayName` ONLY (neither exotic
 * object carries a usable `.name` — reading `.name` off one only ever sees `undefined`,
 * never the wrapped function's name). `""` for anything else an element's `type` can be:
 * a host tag (`"div"`), a Context, a `lazy()` component, a Fragment, or a non-element —
 * so a consumer's `<GradientCtx.Provider>` or `<Suspense>`-boundary child is never
 * mistaken for a named chart part just because it happens to carry its own `displayName`.
 */
export function getChartChildComponentName(child: ReactElement): string {
  const type = child.type;
  if (typeof type === "function") {
    return (type as { displayName?: string; name?: string }).displayName || type.name || "";
  }
  if (typeof type === "object" && type !== null) {
    const exotic = type as { $$typeof?: symbol; displayName?: string };
    if (exotic.$$typeof === REACT_MEMO_TYPE || exotic.$$typeof === REACT_FORWARD_REF_TYPE) {
      return exotic.displayName || "";
    }
  }
  return "";
}

/**
 * Is `child` a React element whose component is named `name` — checking both
 * `displayName` and function `name` for a plain function component (`PieCenter`,
 * `RingCenter`), or `displayName` ONLY for a `memo()`/`forwardRef()` object
 * (`getChartChildComponentName`, which never reads a fabricated `.name` off
 * one)? Either field matching for a plain function is enough, so a component
 * exported under a `displayName` that differs from its own function `name`
 * (or vice versa) still matches. `false` for a string child, a Context, a
 * `lazy()` component, a Fragment, text or `null`.
 */
export function isNamedChartChild(child: ReactNode, name: string): boolean {
  if (!isValidElement(child)) {
    return false;
  }
  if (getChartChildComponentName(child) === name) {
    return true;
  }
  const type = child.type;
  return typeof type === "function" && type.name === name;
}

const VISX_PATTERN_COMPONENT_NAMES = new Set([
  "Lines",
  "Circles",
  "Waves",
  "Hexagons",
  "Path",
  "Pattern",
]);

/** @visx/pattern default exports use short names (e.g. `Lines`); also match *Pattern* displayNames. */
export function isPatternDefComponent(child: ReactElement): boolean {
  const name = getChartChildComponentName(child);
  return name.includes("Pattern") || VISX_PATTERN_COMPONENT_NAMES.has(name);
}

export function isGradientDefComponent(child: ReactElement): boolean {
  const name = getChartChildComponentName(child);
  return name.includes("Gradient") || name === "LinearGradient" || name === "RadialGradient";
}

export function isChartDefsComponent(child: ReactElement): boolean {
  return isPatternDefComponent(child) || isGradientDefComponent(child);
}

/** Split hoisted defs: @visx/pattern nodes already wrap `<defs>` and render at the svg root. */
export function partitionChartDefNodes(defNodes: ReactElement[]): {
  patternDefNodes: ReactElement[];
  gradientDefNodes: ReactElement[];
} {
  const patternDefNodes: ReactElement[] = [];
  const gradientDefNodes: ReactElement[] = [];

  for (const node of defNodes) {
    if (isPatternDefComponent(node)) {
      patternDefNodes.push(node);
    } else {
      gradientDefNodes.push(node);
    }
  }

  return { patternDefNodes, gradientDefNodes };
}

export function collectChartDefsChildren(children: ReactNode): ReactElement[] {
  const defNodes: ReactElement[] = [];

  Children.forEach(children, (child) => {
    if (isValidElement(child) && isChartDefsComponent(child)) {
      defNodes.push(child);
    }
  });

  return defNodes;
}

/**
 * Children a cartesian container paints AFTER its pointer overlay, so they
 * stay clickable and draggable above it: markers (`ChartMarkers`,
 * `MarkerGroup`, or any type flagged `__isChartMarkers`) and `ChartBrush`.
 * The one classifier Line, Area, Composed, Bar and Scatter share.
 */
export function isPostOverlayComponent(child: ReactElement): boolean {
  if ((child.type as { __isChartMarkers?: boolean }).__isChartMarkers) {
    return true;
  }
  const name = getChartChildComponentName(child);
  return name === "ChartMarkers" || name === "MarkerGroup" || name === "ChartBrush";
}
