import { describe, expect, it } from "vitest";

import { svgIdPart } from "./svg-id";

describe("svgIdPart", () => {
  it("keeps a plain key as it is", () => {
    expect(svgIdPart("revenue_2024-q1")).toBe("revenue_2024-q1");
  });

  it("replaces whatever would break a url(#id) reference", () => {
    expect(svgIdPart("On time")).toBe("On_time");
    expect(svgIdPart("Cost per parcel, € (net)")).toBe("Cost_per_parcel_____net_");
  });
});
