import { describe, expect, it } from "vitest";

import { DATA_A2UI_CATALOG_SCHEMA } from "./catalog.generated";
import { DATA_A2UI_BINDINGS } from "./data-catalog";

describe("data A2UI catalog", () => {
  it("binds exactly the generated schema's types, all from this package", () => {
    expect(Object.keys(DATA_A2UI_BINDINGS).sort()).toEqual(
      Object.keys(DATA_A2UI_CATALOG_SCHEMA).sort(),
    );
    for (const [type, entry] of Object.entries(DATA_A2UI_CATALOG_SCHEMA)) {
      expect(entry.source, type).toBe("@elabs-ai/components-data");
    }
  });

  it("AutoGrid takes a required spec object and reports row clicks", () => {
    expect(DATA_A2UI_CATALOG_SCHEMA.AutoGrid!.props.spec).toMatchObject({
      type: "object",
      required: true,
    });
    expect(DATA_A2UI_CATALOG_SCHEMA.AutoGrid!.events).toEqual({ rowClick: "onRowClick" });
    expect(DATA_A2UI_CATALOG_SCHEMA.AutoGrid!.props.loading).toMatchObject({ type: "boolean" });
  });
});
