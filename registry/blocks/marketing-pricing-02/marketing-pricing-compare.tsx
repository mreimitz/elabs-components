"use client";

import { Fragment, useState, type ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  SectionHeader,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ToggleGroup,
  ToggleGroupItem,
} from "@elabs-ai/components-ui";

/** A cell of the matrix: included, not included, or a limit in words ("Up to 10"). */
export type CompareCell = boolean | string;

export interface ComparePlan {
  id: string;
  name: string;
  audience: string;
  /** Monthly price when billed monthly, or `null` for "talk to us". */
  monthly: number | null;
  cta: string;
  href: string;
  /** Marked "Most popular" in words and with a border — never colour alone. */
  featured?: boolean;
}

export interface CompareFeature {
  id: string;
  label: string;
  /** One line under the label for a feature that needs explaining. */
  hint?: string;
  /** One value per plan, in the plans' order. */
  values: CompareCell[];
}

export interface CompareGroup {
  id: string;
  label: string;
  features: CompareFeature[];
}

export interface MarketingPricingCompareProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  plans?: ComparePlan[];
  groups?: CompareGroup[];
  /** Share taken off when billed yearly, 0–1. */
  yearlyDiscount?: number;
  currency?: string;
  locale?: string;
  /** Under the matrix: what every plan has in common. */
  footnote?: ReactNode;
}

const DEFAULT_PLANS: ComparePlan[] = [
  {
    id: "starter",
    name: "Starter",
    audience: "One depot",
    monthly: 290,
    cta: "Start free",
    href: "#register",
  },
  {
    id: "business",
    name: "Business",
    audience: "A regional network",
    monthly: 890,
    cta: "Start free",
    href: "#register",
    featured: true,
  },
  {
    id: "scale",
    name: "Scale",
    audience: "Several countries",
    monthly: 2400,
    cta: "Start free",
    href: "#register",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    audience: "One control tower",
    monthly: null,
    cta: "Talk to sales",
    href: "#contact",
  },
];

const DEFAULT_GROUPS: CompareGroup[] = [
  {
    id: "core",
    label: "Core",
    features: [
      {
        id: "parcels",
        label: "Parcels a month",
        values: ["Up to 5,000", "Up to 50,000", "Up to 500,000", "Unlimited"],
      },
      { id: "depots", label: "Depots", values: ["1", "Up to 10", "Up to 60", "Unlimited"] },
      { id: "routing", label: "Route planning and driver app", values: [true, true, true, true] },
      {
        id: "replanning",
        label: "Live re-planning",
        hint: "Routes rebuild when a stop slips or a vehicle drops out.",
        values: [false, true, true, true],
      },
      { id: "customs", label: "Customs module", values: [false, true, true, true] },
      {
        id: "forecast",
        label: "Demand forecast",
        hint: "Twelve weeks ahead, per depot, from your own history.",
        values: [false, false, true, true],
      },
    ],
  },
  {
    id: "collaboration",
    label: "Collaboration",
    features: [
      { id: "seats", label: "Seats", values: ["5", "25", "150", "Unlimited"] },
      { id: "portal", label: "Customer tracking portal", values: [true, true, true, true] },
      { id: "carriers", label: "Shared views for carriers", values: [false, true, true, true] },
      { id: "api", label: "API and webhooks", values: ["Read only", true, true, true] },
      { id: "workspaces", label: "Workspaces per region", values: [false, false, true, true] },
    ],
  },
  {
    id: "security",
    label: "Security",
    features: [
      { id: "sso", label: "Single sign-on (SAML)", values: [false, true, true, true] },
      { id: "scim", label: "SCIM provisioning", values: [false, false, true, true] },
      { id: "roles", label: "Custom roles", values: [false, false, true, true] },
      {
        id: "audit",
        label: "Audit log retention",
        values: ["30 days", "1 year", "3 years", "7 years"],
      },
      { id: "residency", label: "Data residency by region", values: [false, false, false, true] },
    ],
  },
  {
    id: "support",
    label: "Support",
    features: [
      {
        id: "email",
        label: "Email support",
        values: ["Next business day", "4 hours", "1 hour", "1 hour"],
      },
      { id: "phone", label: "Phone and chat", values: [false, true, true, true] },
      {
        id: "onboarding",
        label: "Guided onboarding",
        values: [false, "2 sessions", "Unlimited", "Unlimited"],
      },
      { id: "csm", label: "Named success manager", values: [false, false, true, true] },
      { id: "sla", label: "Uptime SLA", values: ["—", "99.9%", "99.95%", "99.99%"] },
    ],
  },
];

function CellValue({ value, plan }: { value: CompareCell; plan: string }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center">
        <Check aria-hidden="true" className="size-4 text-success" />
        <span className="sr-only">Included in {plan}</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center text-muted-foreground">
        <Minus aria-hidden="true" className="size-4" />
        <span className="sr-only">Not included in {plan}</span>
      </span>
    );
  }
  return <span className="text-body tabular-nums">{value}</span>;
}

/**
 * The full feature matrix — three or four plans across the top with price and a button
 * that stay in view while the rows scroll, feature groups as row groups, and cells that say
 * "included", "not included" or the limit in words. The billing toggle recomputes every
 * price; the popular plan is named as such and framed. Below `@3xl` the same data stacks
 * into one card per plan so nothing scrolls sideways on a phone.
 */
export function MarketingPricingCompare({
  eyebrow = "Compare plans",
  title = "Everything in every plan, side by side",
  description = "Start on any plan and move up when the network grows. Prices exclude tax.",
  plans = DEFAULT_PLANS,
  groups = DEFAULT_GROUPS,
  yearlyDiscount = 0.2,
  currency = "USD",
  locale = "en-US",
  footnote = "Every plan includes unlimited tracking pages, two-factor sign-in and daily exports. Fourteen days free on Starter, Business and Scale.",
}: MarketingPricingCompareProps) {
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const priceOf = (plan: ComparePlan) =>
    plan.monthly === null
      ? null
      : billing === "yearly"
        ? Math.round(plan.monthly * (1 - yearlyDiscount))
        : plan.monthly;
  const period = billing === "yearly" ? "a month, billed yearly" : "a month, billed monthly";

  return (
    <section
      className="@container mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-16"
      data-slot="marketing-pricing-compare"
    >
      <SectionHeader
        actions={
          <ToggleGroup
            aria-label="Billing period"
            onValueChange={(value) => value && setBilling(value as "monthly" | "yearly")}
            type="single"
            value={billing}
            variant="segmented"
          >
            <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
            <ToggleGroupItem value="yearly">
              Yearly, save {percent.format(yearlyDiscount)}
            </ToggleGroupItem>
          </ToggleGroup>
        }
        as="h2"
        description={description}
        eyebrow={eyebrow}
        title={title}
      />

      {/*
        A plain <table> with the ui Table PARTS rather than the `Table` root: the root wraps
        itself in an `overflow-auto` scroll region, which would become the sticky header’s
        scroll container and pin it to nothing. Here the page is the scroller, so the plan
        row (price + button) stays in view while the rows go by.
      */}
      <table
        className="hidden w-full border-separate border-spacing-0 caption-bottom text-body @3xl:table"
        data-slot="marketing-pricing-compare-matrix"
      >
        <caption className="sr-only">Features by plan</caption>
        <TableHeader className="sticky top-0 z-10 [&_tr]:border-0">
          <TableRow className="border-0 hover:bg-transparent">
            <TableHead
              className="h-auto w-[28%] border-b border-border-strong bg-background px-3 pb-4 align-bottom"
              scope="col"
            >
              <span className="sr-only">Feature</span>
            </TableHead>
            {plans.map((plan) => {
              const price = priceOf(plan);
              return (
                <TableHead
                  className={cn(
                    "h-auto border-b border-border-strong bg-background px-3 pb-4 pt-3 align-top",
                    plan.featured &&
                      "rounded-t-lg border-x-2 border-t-2 border-primary border-b-border-strong",
                  )}
                  key={plan.id}
                  scope="col"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-subtitle font-semibold normal-case tracking-normal text-foreground">
                        {plan.name}
                      </span>
                      {plan.featured ? <Badge>Most popular</Badge> : null}
                    </div>
                    <span className="text-meta font-normal normal-case tracking-normal text-muted-foreground">
                      {plan.audience}
                    </span>
                    <span className="flex flex-col normal-case tracking-normal">
                      <span className="text-title font-semibold tabular-nums text-foreground">
                        {price === null ? "Custom" : money.format(price)}
                      </span>
                      <span className="text-meta font-normal text-muted-foreground">
                        {price === null ? "Volume pricing" : period}
                      </span>
                    </span>
                    <Button
                      asChild
                      className="normal-case tracking-normal"
                      size="sm"
                      variant={plan.featured ? "default" : "outline"}
                    >
                      <a href={plan.href}>{plan.cta}</a>
                    </Button>
                  </div>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        {groups.map((group) => (
          <TableBody key={group.id}>
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead className="h-auto bg-transparent pb-2 pt-6" scope="rowgroup">
                <span className="block text-subtitle font-semibold normal-case tracking-normal text-foreground">
                  {group.label}
                </span>
              </TableHead>
              {plans.map((plan) => (
                <TableCell
                  className={cn("py-0", plan.featured && "border-x-2 border-x-primary")}
                  key={plan.id}
                />
              ))}
            </TableRow>
            {group.features.map((feature, index) => {
              const last = index === group.features.length - 1;
              return (
                <TableRow className="border-0" key={feature.id}>
                  <TableHead
                    className="h-auto border-b border-border-strong bg-transparent py-3 font-normal"
                    scope="row"
                  >
                    <span className="block text-body normal-case tracking-normal text-foreground">
                      {feature.label}
                    </span>
                    {feature.hint ? (
                      <span className="block text-meta normal-case tracking-normal text-muted-foreground">
                        {feature.hint}
                      </span>
                    ) : null}
                  </TableHead>
                  {plans.map((plan, planIndex) => (
                    <TableCell
                      className={cn(
                        "border-b border-border-strong py-3 text-center",
                        plan.featured && "border-x-2 border-x-primary",
                        plan.featured && last && group.id === groups[groups.length - 1]?.id
                          ? "rounded-b-lg border-b-2 border-b-primary"
                          : null,
                      )}
                      key={plan.id}
                    >
                      <CellValue plan={plan.name} value={feature.values[planIndex] ?? false} />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        ))}
      </table>

      {/* Narrow containers: one card per plan, the same rows grouped the same way. */}
      <ul className="flex flex-col gap-4 @3xl:hidden" data-slot="marketing-pricing-compare-cards">
        {plans.map((plan, planIndex) => {
          const price = priceOf(plan);
          return (
            <li key={plan.id}>
              <Card className={cn(plan.featured && "border-2 border-primary")}>
                <CardContent className="flex flex-col gap-5 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="flex items-center gap-2">
                        <h3 className="text-subtitle font-semibold">{plan.name}</h3>
                        {plan.featured ? <Badge>Most popular</Badge> : null}
                      </span>
                      <span className="text-meta text-muted-foreground">{plan.audience}</span>
                    </div>
                    <p className="flex flex-col items-end">
                      <span className="text-title font-semibold tabular-nums">
                        {price === null ? "Custom" : money.format(price)}
                      </span>
                      <span className="text-meta text-muted-foreground">
                        {price === null ? "Volume pricing" : period}
                      </span>
                    </p>
                  </div>
                  <Button asChild variant={plan.featured ? "default" : "outline"}>
                    <a href={plan.href}>{plan.cta}</a>
                  </Button>
                  <dl className="flex flex-col gap-4">
                    {groups.map((group) => (
                      <Fragment key={group.id}>
                        <dt className="border-b border-border-strong pb-1 text-caption font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.label}
                        </dt>
                        {group.features.map((feature, index) => (
                          <dd
                            className="flex items-start justify-between gap-4 text-body"
                            key={feature.id}
                          >
                            <span
                              className={cn(
                                "min-w-0",
                                index === group.features.length - 1 && "pb-1",
                              )}
                            >
                              {feature.label}
                            </span>
                            <span className="shrink-0 text-end">
                              <CellValue
                                plan={plan.name}
                                value={feature.values[planIndex] ?? false}
                              />
                            </span>
                          </dd>
                        ))}
                      </Fragment>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      {footnote ? (
        <p
          className="text-meta text-muted-foreground text-pretty"
          data-slot="marketing-pricing-compare-footnote"
        >
          {footnote}
        </p>
      ) : null}
    </section>
  );
}
