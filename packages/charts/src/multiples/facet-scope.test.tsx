/**
 * `applyFacetScope`'s value-axis check (RM-192, ADR 0042 A.2 row 11): it reads a `YAxis`
 * child's raw `position` prop, or the deprecated `orientation` one, before any alias
 * resolves — see the comment at `facet-scope.tsx`'s `name === "YAxis"` branch. A caller
 * still on the old prop name must get the same panel placement as one on the new name.
 */

import { isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import type { ChartFacetScopeValue } from "../charts/chart-config-context";
import { YAxis } from "../charts/y-axis";
import { applyFacetScope } from "./facet-scope";

function scopeAt(column: number, columns: number): ChartFacetScopeValue {
  return {
    panelKey: `panel-${column}`,
    column,
    columns,
    row: 0,
    rows: 1,
    bottom: true,
    sharedY: true,
    sharedX: false,
  };
}

function keepsYAxis(children: ReactNode): boolean {
  return (children as ReactNode[]).some((child) => isValidElement(child) && child.type === YAxis);
}

describe("applyFacetScope — YAxis `position`/`orientation` read identically (RM-192)", () => {
  it("the outer (right) column keeps a right value axis under either prop name", () => {
    const scope = scopeAt(1, 2);
    expect(keepsYAxis(applyFacetScope(<YAxis position="right" />, scope))).toBe(true);
    expect(keepsYAxis(applyFacetScope(<YAxis orientation="right" />, scope))).toBe(true);
  });

  it("an inner column drops a right value axis under either prop name", () => {
    const scope = scopeAt(0, 2);
    expect(keepsYAxis(applyFacetScope(<YAxis position="right" />, scope))).toBe(false);
    expect(keepsYAxis(applyFacetScope(<YAxis orientation="right" />, scope))).toBe(false);
  });

  it("an explicit `position` wins over `orientation` when a caller (wrongly) sets both", () => {
    // Raw-prop read, same precedence rule as the alias engine (new-wins): `position` decides.
    const scope = scopeAt(0, 2);
    expect(keepsYAxis(applyFacetScope(<YAxis orientation="right" position="left" />, scope))).toBe(
      true,
    );
  });
});
