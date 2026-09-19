/** Acme Logistics — the Rotterdam last-mile fleet, this morning. */

export type VehicleState = "on route" | "delayed" | "idle";

export interface FleetVehicle {
  id: string;
  driver: string;
  state: VehicleState;
  /** Stops completed and planned today. */
  stopsDone: number;
  stopsTotal: number;
  /** Minutes against plan at the last stop; positive is late. */
  minutesLate: number;
  /** The planned route, [longitude, latitude] per stop. */
  route: [number, number][];
  /** How many points of `route` are already driven. */
  driven: number;
}

export const FLEET_DEPOT: [number, number] = [4.4205, 51.9067];

export const fleetVehicles: FleetVehicle[] = [
  {
    id: "RT-104",
    driver: "M. de Vries",
    state: "on route",
    stopsDone: 9,
    stopsTotal: 16,
    minutesLate: -4,
    route: [
      FLEET_DEPOT,
      [4.4412, 51.9142],
      [4.4661, 51.9225],
      [4.4889, 51.9301],
      [4.5102, 51.9264],
      [4.5243, 51.9147],
      [4.5011, 51.9032],
    ],
    driven: 4,
  },
  {
    id: "RT-117",
    driver: "S. Bakker",
    state: "delayed",
    stopsDone: 5,
    stopsTotal: 14,
    minutesLate: 23,
    route: [
      FLEET_DEPOT,
      [4.4021, 51.9168],
      [4.379, 51.9234],
      [4.3512, 51.919],
      [4.333, 51.9085],
      [4.3489, 51.8961],
    ],
    driven: 3,
  },
  {
    id: "RT-122",
    driver: "A. El Idrissi",
    state: "on route",
    stopsDone: 11,
    stopsTotal: 15,
    minutesLate: 2,
    route: [
      FLEET_DEPOT,
      [4.4377, 51.8952],
      [4.4598, 51.8861],
      [4.4872, 51.8803],
      [4.512, 51.8872],
      [4.5301, 51.899],
    ],
    driven: 5,
  },
  {
    id: "RT-131",
    driver: "J. Visser",
    state: "idle",
    stopsDone: 0,
    stopsTotal: 12,
    minutesLate: 0,
    route: [FLEET_DEPOT, [4.4102, 51.8921], [4.3904, 51.8834], [4.3701, 51.879]],
    driven: 1,
  },
];
