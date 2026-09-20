// registry: infographic-dependency-web-01 — copied 2026-09-19
/** Acme Logistics — the dispatch platform's services and which calls which. */

export const dependencyNodes = [
  { id: "gateway", label: "Gateway", value: 14, group: "Edge" },
  { id: "portal", label: "Customer portal", value: 8, group: "Edge" },
  { id: "dispatch", label: "Dispatch", value: 12, group: "Core" },
  { id: "planner", label: "Route planner", value: 11, group: "Core" },
  { id: "pricing", label: "Pricing", value: 7, group: "Core" },
  { id: "customs", label: "Customs", value: 6, group: "Core" },
  { id: "tracking", label: "Tracking", value: 9, group: "Core" },
  { id: "ledger", label: "Ledger", value: 10, group: "Data" },
  { id: "warehouse", label: "Warehouse", value: 13, group: "Data" },
  { id: "cache", label: "Cache", value: 5, group: "Data" },
];

export const dependencyLinks = [
  { source: "gateway", target: "dispatch" },
  { source: "gateway", target: "pricing" },
  { source: "gateway", target: "tracking" },
  { source: "portal", target: "gateway" },
  { source: "dispatch", target: "planner" },
  { source: "dispatch", target: "customs" },
  { source: "dispatch", target: "ledger" },
  { source: "planner", target: "cache" },
  { source: "planner", target: "warehouse" },
  { source: "pricing", target: "ledger" },
  { source: "pricing", target: "cache" },
  { source: "customs", target: "ledger" },
  { source: "tracking", target: "warehouse" },
  { source: "ledger", target: "warehouse" },
];

/** Who owns what — the same platform as a hierarchy. */
export const ownershipTree = {
  name: "Dispatch platform",
  children: [
    { name: "Edge", children: [{ name: "Gateway" }, { name: "Customer portal" }] },
    {
      name: "Core",
      children: [
        { name: "Dispatch" },
        { name: "Route planner" },
        { name: "Pricing" },
        { name: "Customs" },
        { name: "Tracking" },
      ],
    },
    { name: "Data", children: [{ name: "Ledger" }, { name: "Warehouse" }, { name: "Cache" }] },
  ],
};
