"use client";

import { LeaderboardWidget } from "./leaderboard-widget";
import { RankedListWidget } from "./ranked-list-widget";
import { TransactionFeedWidget } from "./transaction-feed-widget";

/**
 * Compact summary widgets: a ranked list with share bars + delta (Sales by
 * country), a leaderboard (Top performers), and a transaction/activity feed
 * with signed amounts.
 */
export function StatList() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <RankedListWidget />
      <LeaderboardWidget />
      <TransactionFeedWidget />
    </div>
  );
}
