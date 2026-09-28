import { renderHook } from "@testing-library/react";
import type * as ReactModule from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return { ...actual, useId: () => ":r7:extra:" };
});

// Imported AFTER the mock above, so it picks up the stubbed `useId`.
const { useSvgId, svgIdPart } = await import("./svg-id");

describe("svgIdPart", () => {
  it("keeps a plain key as it is", () => {
    expect(svgIdPart("revenue_2024-q1")).toBe("revenue_2024-q1");
  });

  it("replaces whatever would break a url(#id) reference", () => {
    expect(svgIdPart("On time")).toBe("On_time");
    expect(svgIdPart("Cost per parcel, € (net)")).toBe("Cost_per_parcel_____net_");
  });
});

describe("useSvgId", () => {
  // `react`'s own `useId` is stubbed above to a fixed, colon-heavy id — two
  // separate real calls to `useId()` never return the same value even inside
  // one render, so the only way to pin "the SAME id, colons stripped, nothing
  // more" is to control what `useId()` itself returns.
  it("is React's own useId with every colon stripped — nothing more", () => {
    const { result } = renderHook(() => useSvgId());
    expect(result.current).toBe(":r7:extra:".replace(/:/g, ""));
  });

  it("touches only colons — unlike svgIdPart it does not sanitize spaces or punctuation", () => {
    const { result } = renderHook(() => useSvgId());
    expect(result.current).not.toContain(":");
    expect(result.current).toBe("r7extra");
  });
});
