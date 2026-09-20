"use client";

import { CreditCard, Download } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Meter,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@elabs-ai/components-ui";

export interface BillingInvoice {
  id: string;
  date: string;
  amount: number;
  state: "paid" | "due" | "failed";
}

export interface SettingsBillingProps {
  plan?: { name: string; price: number; renews: string };
  usage?: { label: string; used: number; included: number }[];
  card?: { brand: string; last4: string; expires: string };
  invoices?: BillingInvoice[];
  onChangePlan?: () => void;
  onUpdateCard?: () => void;
  onDownload?: (invoice: BillingInvoice) => void;
  currency?: string;
  locale?: string;
}

const STATE_BADGE = { paid: "success", due: "warning", failed: "destructive" } as const;

/**
 * Billing — the plan and when it renews, usage against what the plan includes (with the
 * overage said in words once it is crossed), the card on file by its last four digits only,
 * and the invoices.
 */
export function SettingsBilling({
  plan = { name: "Business", price: 712, renews: "14 December 2026" },
  usage = [
    { label: "Parcels this month", used: 43_800, included: 50_000 },
    { label: "Seats", used: 5, included: 8 },
    { label: "API calls this month", used: 1_260_000, included: 1_000_000 },
  ],
  card = { brand: "Visa", last4: "4417", expires: "08/28" },
  invoices = [
    { id: "INV-2026-09", date: "1 Sep 2026", amount: 712, state: "due" },
    { id: "INV-2026-08", date: "1 Aug 2026", amount: 764, state: "paid" },
    { id: "INV-2026-07", date: "1 Jul 2026", amount: 712, state: "paid" },
  ],
  onChangePlan,
  onUpdateCard,
  onDownload,
  currency = "USD",
  locale = "en-US",
}: SettingsBillingProps) {
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  const number = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });

  return (
    <div
      className="@container mx-auto flex w-full max-w-3xl flex-col gap-6"
      data-slot="settings-billing"
    >
      <div className="grid grid-cols-1 gap-6 @2xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {plan.name} plan <Badge variant="success">active</Badge>
            </CardTitle>
            <CardDescription>
              {money.format(plan.price)} a month, billed yearly. Renews {plan.renews}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onChangePlan} variant="outline">
              Change plan
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payment method</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <CreditCard aria-hidden="true" className="size-4" />
              {card.brand} ending {card.last4} · expires {card.expires}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onUpdateCard} variant="outline">
              Update card
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>Against what the {plan.name} plan includes.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {usage.map((item) => {
            const over = item.used > item.included;
            return (
              <div className="flex flex-col gap-1.5" key={item.label}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-body">{item.label}</span>
                  <span className="text-meta text-muted-foreground tabular-nums">
                    {number.format(item.used)} of {number.format(item.included)}
                  </span>
                </div>
                <Meter
                  aria-label={`${item.label}: ${number.format(item.used)} of ${number.format(item.included)}`}
                  max={Math.max(item.used, item.included)}
                  marker={over ? item.included : undefined}
                  markerLabel={over ? "included" : undefined}
                  size="sm"
                  value={item.used}
                />
                {over ? (
                  <p className="text-meta text-warning-text">
                    {number.format(item.used - item.included)} over — billed as overage on the next
                    invoice.
                  </p>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-end">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Download</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="text-code">{invoice.id}</TableCell>
                  <TableCell>{invoice.date}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {money.format(invoice.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATE_BADGE[invoice.state]}>{invoice.state}</Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <Button onClick={() => onDownload?.(invoice)} size="sm" variant="ghost">
                      <Download aria-hidden="true" />
                      PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
