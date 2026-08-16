"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@qlik-coe-emea/qlabs-components-ui";
import { TRANSACTIONS } from "./data/transactions";

/** A transaction/activity feed — icon + title + subtitle + signed amount. */
export function TransactionFeedWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent transactions</CardTitle>
        <CardDescription>Last 24 hours</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {TRANSACTIONS.map((t) => (
            <li key={t.title} className="flex items-center gap-3 py-1.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted-foreground">
                <t.icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-body font-medium text-foreground">{t.title}</div>
                <div className="truncate text-meta text-muted-foreground">{t.sub}</div>
              </div>
              <span
                className={[
                  "shrink-0 text-body font-semibold tabular-nums",
                  t.positive ? "text-success-text" : "text-destructive-text",
                ].join(" ")}
              >
                {t.amount}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
