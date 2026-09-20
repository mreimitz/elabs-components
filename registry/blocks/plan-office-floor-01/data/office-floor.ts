/**
 * A synthetic office floor, drawn in CENTIMETRES — the unit a real floor plan
 * arrives in. Nothing here is geographic: `x` runs east along the building and
 * `y` runs south from its north-west corner, exactly as the drawing does.
 *
 * Used by the plan-map stories. Kept as data, not as a picture: a plan drawn as
 * GeoJSON paints from tokens, themes correctly, prints, and never blurs.
 */

/** The floor's own extent. Hand this to `<MapCanvas plan>`. */
export const OFFICE_FLOOR_EXTENT = {
  width: 2400,
  height: 1400,
  unit: "cm",
} as const;

export type RoomStatus = "free" | "occupied";

export interface RoomProperties {
  id: string;
  name: string;
  /** What the room is for — the second, non-colour channel in the readout. */
  kind: "meeting" | "desk" | "focus" | "service";
  status: RoomStatus;
  seats: number;
  [key: string]: unknown;
}

type Rect = {
  id: string;
  name: string;
  kind: RoomProperties["kind"];
  status: RoomStatus;
  seats: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 *  ┌──────────┬──────────┬──────────┐
 *  │ Helsinki │  Oslo    │ Reykjavik│
 *  ├──────────┴────┬─────┴──────────┤
 *  │   corridor    │                │
 *  ├─────────┬─────┴────┬───────────┤
 *  │ Bergen  │  Aarhus  │  Utility  │
 *  └─────────┴──────────┴───────────┘
 */
const ROOMS: Rect[] = [
  {
    id: "helsinki",
    name: "Helsinki",
    kind: "meeting",
    status: "occupied",
    seats: 10,
    x: 60,
    y: 60,
    width: 700,
    height: 420,
  },
  {
    id: "oslo",
    name: "Oslo",
    kind: "meeting",
    status: "free",
    seats: 6,
    x: 820,
    y: 60,
    width: 700,
    height: 420,
  },
  {
    id: "reykjavik",
    name: "Reykjavik",
    kind: "focus",
    status: "free",
    seats: 2,
    x: 1580,
    y: 60,
    width: 760,
    height: 420,
  },
  {
    id: "studio",
    name: "Studio",
    kind: "desk",
    status: "occupied",
    seats: 24,
    x: 60,
    y: 760,
    width: 1000,
    height: 580,
  },
  {
    id: "aarhus",
    name: "Aarhus",
    kind: "meeting",
    status: "free",
    seats: 8,
    x: 1120,
    y: 760,
    width: 620,
    height: 580,
  },
  {
    id: "utility",
    name: "Utility",
    kind: "service",
    status: "occupied",
    seats: 0,
    x: 1800,
    y: 760,
    width: 540,
    height: 580,
  },
];

function rectangle({ x, y, width, height }: Rect): GeoJSON.Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [x, y],
        [x + width, y],
        [x + width, y + height],
        [x, y + height],
        [x, y],
      ],
    ],
  };
}

/** The rooms, as a feature collection in plan units. */
export const officeFloorRooms: GeoJSON.FeatureCollection<GeoJSON.Polygon, RoomProperties> = {
  type: "FeatureCollection",
  features: ROOMS.map((room) => ({
    type: "Feature",
    id: room.id,
    properties: {
      id: room.id,
      name: room.name,
      kind: room.kind,
      status: room.status,
      seats: room.seats,
    },
    geometry: rectangle(room),
  })),
};

/**
 * The corridor between the two room bands — a shape with no fill, which is why
 * `MapGeoJSON` grows an invisible hit line: a 1 px hairline is not a target.
 */
export const officeFloorCorridor: GeoJSON.FeatureCollection<
  GeoJSON.LineString,
  { id: string; name: string }
> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "corridor",
      properties: { id: "corridor", name: "Corridor" },
      geometry: {
        type: "LineString",
        coordinates: [
          [60, 620],
          [2340, 620],
        ],
      },
    },
  ],
};

/** The building's outer wall, for the vector-only plan's own outline. */
export const officeFloorShell: GeoJSON.Feature<GeoJSON.Polygon, { id: string }> = {
  type: "Feature",
  id: "shell",
  properties: { id: "shell" },
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [20, 20],
        [2380, 20],
        [2380, 1380],
        [20, 1380],
        [20, 20],
      ],
    ],
  },
};

/** The second floor, so a multi-floor plan has something to switch to. */
export const secondFloorRooms: GeoJSON.FeatureCollection<GeoJSON.Polygon, RoomProperties> = {
  type: "FeatureCollection",
  features: [
    { id: "lab", name: "Lab", kind: "desk", status: "occupied", seats: 18 },
    { id: "library", name: "Library", kind: "focus", status: "free", seats: 4 },
    { id: "kitchen", name: "Kitchen", kind: "service", status: "free", seats: 12 },
  ].map((room, index) => {
    const rect: Rect = {
      ...(room as Omit<Rect, "x" | "y" | "width" | "height">),
      x: 60 + index * 780,
      y: 200,
      width: 700,
      height: 1000,
    };
    return {
      type: "Feature" as const,
      id: rect.id,
      properties: {
        id: rect.id,
        name: rect.name,
        kind: rect.kind,
        status: rect.status,
        seats: rect.seats,
      },
      geometry: rectangle(rect),
    };
  }),
};
