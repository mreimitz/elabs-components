# Ashgrove — one fixture dataset, Q3 FY26

Every surface on `elabs-ai.com` — the hero, the dashboard tabs, the assistant tab, the flow
canvas, the process explorer and the settings tab — describes the same fictional company, the
same quarter, and the same numbers. That is the concept's credibility rule
(`docs/review/2026-09-18-homepage-concept.md` §5, "Real size, real data"): every label reads
like it belongs to a real company, and a number shown twice on the page is never shown
differently twice.

## The company

**Ashgrove Systems, Inc.** — a mid-market B2B subscription billing and revenue-analytics
platform. Clearly fictional; chosen to resemble no real vendor. Four regions (EMEA, AMER,
APAC, LATAM), twelve product modules (`company.ts`), one fiscal quarter: **Q3 FY26**
(2026-07-01 to 2026-09-30, 13 weekly points).

## The story the tour tells

1. **A back-office team browsing 2M orders** (§4.2) — `orders.ts`'s `generateOrders(n)` is the
   same seeded generator whether asked for 50 or 10,000 rows; the data-app tab calls it with
   `ORDERS_FULL_COUNT` (10,000) so the virtualised `DataTable` is honestly showing scale, not a
   fixed 50-row demo. 480 accounts, each with one fixed region and one fixed account owner
   (`ACCOUNT_REGIONS`/`ACCOUNT_OWNERS`) — a customer's orders don't jump regions.
2. **An ops analyst finding why 12 % of cases take twice as long** (§4.2) — `process-log.ts`
   generates ~2,000 order-to-cash cases across six activities. Exactly 12 % run the
   manual-review variant (one extra `Credit Check`), and that variant's expected total
   duration is exactly double the standard path's — not a coincidence of jitter, a designed
   `12/7` step multiplier (see the module doc). The process explorer tab's use-case sentence
   quotes `PROCESS_LOG_CASE_COUNT` and `PROCESS_LOG_SLOW_VARIANT_SHARE` directly, so the copy
   can never drift from the data.
3. **A copilot that shows its work** (§4.2) — `conversation.ts` is a `UIMessage[]`: a user
   asks why churn rose in EMEA, the assistant reasons, calls a `query_kpis` tool whose result
   is `kpis.ts`'s own churn series, cites two sources, and returns an `AutoChart` spec as an
   artifact. Every number in the transcript is READ from `kpis.ts`, never retyped.

## The invariants (`fixtures.test.ts`)

- **Churn headline == last point.** The hero's churn KPI is `KPI_HEADLINES.find(h => h.id ===
"churn").value`, which is a direct read of `CHURN_SERIES.points.at(-1).value` — the same
  number the dashboard tab's chart draws as its last point.
- **Deltas are computed, not typed.** `headlineDelta(series)` is always `last - first`;
  nothing in `kpis.ts` hand-types a second, possibly-stale delta.
- **MRR consistency.** `churn.ts`'s `CHURN_MOVERS` is the output of aggregating REAL rows from
  `orders.ts`'s `generateOrders(CHURN_SAMPLE_SIZE)` by account and month — never a separately
  authored list of names and numbers.
- **Seed determinism.** `generateOrders(n)` and `generateProcessLog(cases, seed)` are pure:
  the same arguments return deep-equal output on every run, in every process.
- **Generation budget.** `generateOrders(10_000)` completes in well under 150 ms, so the
  data-app tab's "real size" claim costs nothing to render.
- **No placeholder text, throwaway numbered labels, or generic stand-in brand names.** The
  deny-list itself lives only in `fixtures.test.ts` (the checker), never spelled out in a
  shipped fixture or doc file — a grep of this folder's actual data and doc files for any of
  those banned words returns nothing.
- **No `Math.random`.** Every fixture is seeded via `lib/prng.ts`'s `mulberry32` — see that
  module's doc for why `@elabs-ai/components-charts`' `seededRnd` could not be used directly
  (it is not part of that package's public API surface).
- **Types.** `conversation.ts` imports exactly `import type { UIMessage } from "ai";` — no
  runtime import of the AI SDK (D6, ADR 0008).

## Files

| File              | Exports                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `company.ts`      | `COMPANY_NAME`, `REGIONS`, `PRODUCTS`, `OWNERS`, `FISCAL_QUARTER_WEEKS`                                         |
| `kpis.ts`         | `KPI_SERIES`, `KPI_HEADLINES`, `CHURN_SERIES`, `CHURN_BY_REGION`, `headlineValue`, `headlineDelta`              |
| `orders.ts`       | `generateOrders(n)`, `OrderRow`, `ordersColumns`, `ACCOUNTS`, `ACCOUNT_REGIONS`, `ACCOUNT_OWNERS`               |
| `churn.ts`        | `CHURN_MOVERS`, `aggregateAccountMrr`, `topMovers`                                                              |
| `conversation.ts` | `CONVERSATION` (`UIMessage[]`)                                                                                  |
| `flow.ts`         | `FLOW_NODES`, `FLOW_EDGES`                                                                                      |
| `process-log.ts`  | `generateProcessLog`, `PROCESS_LOG`, `PROCESS_LOG_CASE_COUNT`, `PROCESS_LOG_SLOW_VARIANT_SHARE`                 |
| `settings.ts`     | `SETTINGS_WORKSPACE`, `SETTINGS_MEMBERS`, `SETTINGS_NOTIFICATIONS`, `SETTINGS_API_KEYS`, `SETTINGS_DANGER_ZONE` |
| `lib/prng.ts`     | `mulberry32`, `pick`, `intBetween`, `seededShuffledIndices`                                                     |

Import the whole set from `index.ts`, or one module at a time — nothing in this folder depends
on anything outside it except `@elabs-ai/components-data` (`ColumnDef`), `@elabs-ai/components-
charts` (`ChartSpec`), `@elabs-ai/components-flow` (`Node`/`Edge`) and `@elabs-ai/components-
process/core` (`EventRow`/`EventLog`) — all type-only imports, so none of it carries a runtime
dependency on those packages' engines.
