import { Children, isValidElement, type ReactElement, type ReactNode } from "react";

/**
 * `child`'s component name — its `displayName`, or its function `name`, or `""` for a
 * host element (`"div"`), a fragment or a non-element. Works for a plain function
 * component AND a `memo()`/`forwardRef()`-wrapped one (`child.type` is then an object,
 * not a function, but still carries `displayName`/`name`).
 */
export function getChartChildComponentName(child: ReactElement): string {
  const type = child.type as { displayName?: string; name?: string } | string;
  if (typeof type === "string") {
    return "";
  }
  return type.displayName || type.name || "";
}

/**
 * Is `child` a React element whose component is named `name` — checking both
 * `displayName` and `name` off whatever `child.type` is, a plain function or a
 * `memo()`/`forwardRef()` object? Either field matching is enough, so a component
 * exported under a different `displayName` than its function `name` (or vice versa)
 * still matches. `false` for a string child, a fragment, text or `null`.
 */
export function isNamedChartChild(child: ReactNode, name: string): boolean {
  if (!isValidElement(child)) {
    return false;
  }
  const type = child.type as { displayName?: string; name?: string } | string;
  if (typeof type === "string") {
    return false;
  }
  return type.displayName === name || type.name === name;
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
