import { GRID_TODAY, seeded } from "@/components/grid-parts/grid-kit";

export type EventLevel = "debug" | "info" | "warn" | "error";

export interface LogEvent {
  id: string;
  /** `YYYY-MM-DD HH:mm:ss.SSS`, newest first. */
  time: string;
  level: EventLevel;
  service: string;
  host: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  route: string;
  status: number;
  /** Request duration in milliseconds. */
  duration: number;
  traceId: string;
  message: string;
}

export const EVENT_LEVELS: readonly EventLevel[] = ["debug", "info", "warn", "error"];

const SERVICES: [string, string[]][] = [
  ["checkout", ["/api/cart", "/api/checkout", "/api/payment/intent", "/api/coupons/apply"]],
  ["catalog", ["/api/products", "/api/products/:id", "/api/search"]],
  ["accounts", ["/api/session", "/api/users/:id", "/api/password/reset"]],
  ["fulfilment", ["/api/shipments", "/api/labels", "/api/returns"]],
  ["notifications", ["/api/email/send", "/api/webhooks"]],
];

const FAILURES: [number, string][] = [
  [500, "Unhandled exception: cannot read properties of undefined (reading 'total')"],
  [502, "Upstream payment provider returned 502 Bad Gateway"],
  [503, "Connection pool exhausted (max 50) — request queued too long"],
  [504, "Timed out after 10000 ms waiting for inventory-service"],
];
const WARNINGS: [number, string][] = [
  [429, "Rate limit reached for API key ending 4f2a"],
  [409, "Optimistic lock conflict on cart, retried once"],
  [200, "Slow query: 1 842 ms on orders_by_customer"],
  [404, "Coupon code not found"],
];

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/**
 * A deterministic stream of `total` events ending at the fixture's "today".
 * `page(offset, size)` stands in for the server: it builds only that slice.
 */
export function eventSource(total = 5000) {
  const end = new Date(
    GRID_TODAY.getFullYear(),
    GRID_TODAY.getMonth(),
    GRID_TODAY.getDate(),
    14,
    32,
  ).getTime();

  const at = (index: number): LogEvent => {
    const rnd = seeded(index * 2654435761 + 3);
    const [service, routes] = rnd.pick(SERVICES);
    const level = rnd.weighted<EventLevel>([
      ["info", 70],
      ["debug", 14],
      ["warn", 11],
      ["error", 5],
    ]);
    const [status, message] =
      level === "error"
        ? rnd.pick(FAILURES)
        : level === "warn"
          ? rnd.pick(WARNINGS)
          : ([rnd.pick([200, 200, 200, 201, 204, 304]), "Request completed"] as const);
    const base = level === "error" ? 1800 : level === "warn" ? 700 : 40;
    const duration = Math.round(base + rnd.next() ** 3 * (level === "error" ? 8200 : 900));
    const t = new Date(end - index * 1700 - rnd.int(0, 1600));
    return {
      id: `evt-${pad(index, 5)}`,
      time: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}.${pad(t.getMilliseconds(), 3)}`,
      level,
      service,
      host: `${service}-${rnd.pick(["7d9f", "c21a", "b04e"])}`,
      method: service === "catalog" ? "GET" : rnd.pick(["GET", "POST", "POST", "PUT", "DELETE"]),
      route: rnd.pick(routes),
      status,
      duration,
      traceId: Math.floor(rnd.next() * 0xffffffff)
        .toString(16)
        .padStart(8, "0"),
      message,
    };
  };

  return {
    total,
    page: (offset: number, size: number): LogEvent[] =>
      Array.from({ length: Math.max(0, Math.min(size, total - offset)) }, (_, i) => at(offset + i)),
  };
}
