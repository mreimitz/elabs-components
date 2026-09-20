export type DepotRow = { depot: string; onTime: number };

/** Fictional: share of parcels delivered inside the promised window, Q3, per depot. */
export const ON_TIME_BY_DEPOT: DepotRow[] = [
  { depot: "Rotterdam", onTime: 96 },
  { depot: "Lyon", onTime: 93 },
  { depot: "Gdańsk", onTime: 92 },
  { depot: "Milan", onTime: 88 },
  { depot: "Leipzig", onTime: 86 },
  { depot: "Porto", onTime: 84 },
  { depot: "Vienna", onTime: 81 },
  { depot: "Malmö", onTime: 79 },
  { depot: "Zaragoza", onTime: 71 },
  { depot: "Cork", onTime: 66 },
  { depot: "Thessaloniki", onTime: 58 },
];
