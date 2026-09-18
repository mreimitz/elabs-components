import { describe, expect, it } from "vitest";

import { CHARTS_A2UI_CATALOG_SCHEMA } from "./catalog.generated";
import { CHARTS_A2UI_BINDINGS } from "./charts-catalog";

describe("charts A2UI catalog", () => {
  it("binds exactly the generated schema's types, all from this package", () => {
    expect(Object.keys(CHARTS_A2UI_BINDINGS).sort()).toEqual(
      Object.keys(CHARTS_A2UI_CATALOG_SCHEMA).sort(),
    );
    for (const [type, entry] of Object.entries(CHARTS_A2UI_CATALOG_SCHEMA)) {
      expect(entry.source, type).toBe("@elabs-ai/components-charts");
      expect(entry.builtin, type).toBeUndefined();
    }
  });

  it("AutoChart takes a required spec object and reports datapoint clicks", () => {
    expect(CHARTS_A2UI_CATALOG_SCHEMA.AutoChart!.props.spec).toMatchObject({
      type: "object",
      required: true,
    });
    expect(CHARTS_A2UI_CATALOG_SCHEMA.AutoChart!.events).toEqual({
      datapointClick: "onDatapointClick",
    });
    expect(CHARTS_A2UI_CATALOG_SCHEMA.ChartCard!.children).toBe(true);
  });
});
