/**
 * The "movers" list — the accounts with the largest MRR change this quarter, derived from
 * `orders.ts` (RM-095). Consistency is structural, not asserted after the fact: `CHURN_MOVERS`
 * is computed by aggregating the SAME `generateOrders(...)` rows `orders.ts` exports, grouped
 * by month, so a mover's `mrrChange` is always the sum of real order amounts, never a
 * separately typed number (`fixtures.test.ts` "MRR consistency").
 */
import { ACCOUNT_REGIONS, generateOrders, type OrderRow } from "./orders";
import type { Region } from "./company";

/** Sample size for the movers computation — large enough for a stable top-8, far short of
 *  the full 50k so this module stays cheap to import from the hero. */
export const CHURN_SAMPLE_SIZE = 6_000;

/** Q3 FY26's three calendar months, as `Date#getUTCMonth()` values (Jul = 6, Sep = 8). */
const FIRST_MONTH = 6;
const LAST_MONTH = 8;

export interface AccountMrr {
  account: string;
  region: Region;
  /** Sum of order amounts in the quarter's first month. */
  firstMonth: number;
  /** Sum of order amounts in the quarter's last month. */
  lastMonth: number;
  /** `lastMonth - firstMonth` — positive is expansion, negative is contraction. */
  mrrChange: number;
}

/** Group `orders` by account and sum each account's first- and last-month amounts. */
export function aggregateAccountMrr(orders: readonly OrderRow[]): AccountMrr[] {
  const byAccount = new Map<string, { firstMonth: number; lastMonth: number }>();
  for (const order of orders) {
    const month = Number(order.created.slice(5, 7)) - 1; // 0-indexed, matches getUTCMonth()
    if (month !== FIRST_MONTH && month !== LAST_MONTH) continue;
    const entry = byAccount.get(order.account) ?? { firstMonth: 0, lastMonth: 0 };
    if (month === FIRST_MONTH) entry.firstMonth += order.amount;
    else entry.lastMonth += order.amount;
    byAccount.set(order.account, entry);
  }
  return Array.from(byAccount.entries()).map(([account, { firstMonth, lastMonth }]) => ({
    account,
    region: ACCOUNT_REGIONS[account]!,
    firstMonth: Math.round(firstMonth * 100) / 100,
    lastMonth: Math.round(lastMonth * 100) / 100,
    mrrChange: Math.round((lastMonth - firstMonth) * 100) / 100,
  }));
}

/** The `count` accounts with the largest ABSOLUTE MRR change, largest first. */
export function topMovers(orders: readonly OrderRow[], count: number): AccountMrr[] {
  return aggregateAccountMrr(orders)
    .sort((a, b) => Math.abs(b.mrrChange) - Math.abs(a.mrrChange))
    .slice(0, count);
}

export const CHURN_MOVERS_COUNT = 8;

/** The movers list the dashboard tab renders. */
export const CHURN_MOVERS: AccountMrr[] = topMovers(
  generateOrders(CHURN_SAMPLE_SIZE),
  CHURN_MOVERS_COUNT,
);
