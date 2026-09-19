// registry: geo-network-map-01 — copied 2026-09-19
/** Acme Logistics — the long-haul network out of the Rotterdam hub, this quarter. */

export interface NetworkHub {
  id: string;
  name: string;
  /** [longitude, latitude] */
  at: [number, number];
  role: "hub" | "gateway";
}

export const networkHubs: NetworkHub[] = [
  { id: "rtm", name: "Rotterdam", at: [4.4777, 51.9244], role: "hub" },
  { id: "nyc", name: "New York", at: [-74.006, 40.7128], role: "gateway" },
  { id: "sin", name: "Singapore", at: [103.8198, 1.3521], role: "gateway" },
  { id: "sha", name: "Shanghai", at: [121.4737, 31.2304], role: "gateway" },
  { id: "dxb", name: "Dubai", at: [55.2708, 25.2048], role: "gateway" },
  { id: "gru", name: "São Paulo", at: [-46.6333, -23.5505], role: "gateway" },
  { id: "jnb", name: "Johannesburg", at: [28.0473, -26.2041], role: "gateway" },
  { id: "lax", name: "Los Angeles", at: [-118.2437, 34.0522], role: "gateway" },
];

export interface NetworkLane {
  id: string;
  from: string;
  to: string;
  /** Containers moved this quarter. */
  volume: number;
  /** Share of sailings that arrived inside their window, 0–100. */
  onTime: number;
  /** Median door-to-door transit, days. */
  transitDays: number;
}

export const networkLanes: NetworkLane[] = [
  { id: "rtm-sha", from: "rtm", to: "sha", volume: 4_820, onTime: 88, transitDays: 31 },
  { id: "rtm-nyc", from: "rtm", to: "nyc", volume: 3_960, onTime: 95, transitDays: 11 },
  { id: "rtm-sin", from: "rtm", to: "sin", volume: 3_140, onTime: 91, transitDays: 24 },
  { id: "rtm-dxb", from: "rtm", to: "dxb", volume: 2_210, onTime: 93, transitDays: 17 },
  { id: "rtm-lax", from: "rtm", to: "lax", volume: 1_730, onTime: 79, transitDays: 27 },
  { id: "rtm-gru", from: "rtm", to: "gru", volume: 1_280, onTime: 84, transitDays: 19 },
  { id: "rtm-jnb", from: "rtm", to: "jnb", volume: 940, onTime: 90, transitDays: 22 },
];

/** Below this on-time share a lane is called out. */
export const LANE_ON_TIME_FLOOR = 85;
