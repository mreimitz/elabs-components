/**
 * A 3-object-type, 4-event OCEL 2.0 JSON log (RM-066) — small enough to verify by hand.
 *
 * | event | activity    | time  | order | item   | package |
 * | ----- | ----------- | ----- | ----- | ------ | ------- |
 * | e1    | Place Order | 09:00 | o1    | i1, i2 |         |
 * | e2    | Pick Item   | 10:00 |       | i1     |         |
 * | e3    | Pack        | 11:00 | o1    | i1, i2 | p1      |
 * | e4    | Ship        | 12:00 | o1    |        | p1      |
 *
 * Projections: `order` has 3 rows (o1: Place Order → Pack → Ship), `item` has 5 (i1: Place
 * Order → Pick Item → Pack; i2: Place Order → Pack), `package` has 2 (p1: Pack → Ship).
 * `Pack` occurs in all three types; `Pick Item` only in `item`.
 */
import type { OcelJson } from "../adapters/ocel";

export const OCEL_SAMPLE: OcelJson = {
  objectTypes: [
    { name: "order", attributes: [{ name: "value", type: "float" }] },
    { name: "item", attributes: [] },
    { name: "package", attributes: [] },
  ],
  eventTypes: [
    { name: "Place Order", attributes: [{ name: "channel", type: "string" }] },
    { name: "Pick Item", attributes: [] },
    { name: "Pack", attributes: [] },
    { name: "Ship", attributes: [] },
  ],
  objects: [
    {
      id: "o1",
      type: "order",
      attributes: [
        { name: "value", time: "2026-01-05T08:00:00.000Z", value: 120 },
        { name: "value", time: "2026-01-05T11:30:00.000Z", value: 95 },
      ],
    },
    { id: "i1", type: "item" },
    { id: "i2", type: "item" },
    { id: "p1", type: "package" },
  ],
  events: [
    {
      id: "e1",
      type: "Place Order",
      time: "2026-01-05T09:00:00.000Z",
      attributes: [{ name: "channel", value: "web" }],
      relationships: [
        { objectId: "o1", qualifier: "placed" },
        { objectId: "i1", qualifier: "contains" },
        { objectId: "i2", qualifier: "contains" },
      ],
    },
    {
      id: "e2",
      type: "Pick Item",
      time: "2026-01-05T10:00:00.000Z",
      relationships: [{ objectId: "i1", qualifier: "picked" }],
    },
    {
      id: "e3",
      type: "Pack",
      time: "2026-01-05T11:00:00.000Z",
      relationships: [
        { objectId: "o1", qualifier: "for" },
        { objectId: "i1", qualifier: "packed" },
        { objectId: "i2", qualifier: "packed" },
        { objectId: "i2", qualifier: "checked" },
        { objectId: "p1", qualifier: "into" },
      ],
    },
    {
      id: "e4",
      type: "Ship",
      time: "2026-01-05T12:00:00.000Z",
      relationships: [
        { objectId: "o1", qualifier: "for" },
        { objectId: "p1", qualifier: "shipped" },
      ],
    },
  ],
};
