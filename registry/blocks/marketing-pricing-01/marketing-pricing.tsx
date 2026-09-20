"use client";

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  cn,
  SectionHeader,
  ToggleGroup,
  ToggleGroupItem,
} from "@elabs-ai/components-ui";

export interface PricingPlan {
  id: string;
  name: string;
  audience: string;
  /** Monthly price when billed monthly, or `null` for "talk to us". */
  monthly: number | null;
  features: string[];
  cta: string;
  href: string;
  featured?: boolean;
}

export interface MarketingPricingProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  plans?: PricingPlan[];
  /** Share taken off when billed yearly, 0–1. */
  yearlyDiscount?: number;
  currency?: string;
  locale?: string;
}

const DEFAULT_PLANS: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    audience: "One depot getting off spreadsheets",
    monthly: 290,
    features: [
      "Up to 5,000 parcels a month",
      "Route planning and driver app",
      "Email support, next business day",
    ],
    cta: "Start free",
    href: "#register",
  },
  {
    id: "business",
    name: "Business",
    audience: "A network with promises to keep",
    monthly: 890,
    features: [
      "Up to 50,000 parcels a month",
      "Live re-planning and exceptions",
      "Customs module",
      "Single sign-on",
      "Support inside four hours",
    ],
    cta: "Start free",
    href: "#register",
    featured: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    audience: "Many regions, one control tower",
    monthly: null,
    features: [
      "Unlimited parcels",
      "Data residency by region",
      "Audit trail and custom roles",
      "A named success manager",
    ],
    cta: "Talk to sales",
    href: "#contact",
  },
];

/**
 * Pricing — three plans named for who they are for, a billing toggle that recomputes every
 * price, and one plan marked as the usual choice with words, not colour alone.
 */
export function MarketingPricing({
  eyebrow = "Pricing",
  title = "Priced by what you ship",
  description = "Every plan starts with fourteen days free. No card needed.",
  plans = DEFAULT_PLANS,
  yearlyDiscount = 0.2,
  currency = "USD",
  locale = "en-US",
}: MarketingPricingProps) {
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });

  return (
    <section
      className="@container mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-16"
      data-slot="marketing-pricing"
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
      <ul className="grid grid-cols-1 gap-4 @4xl:grid-cols-3">
        {plans.map((plan) => {
          const price =
            plan.monthly === null
              ? null
              : billing === "yearly"
                ? Math.round(plan.monthly * (1 - yearlyDiscount))
                : plan.monthly;
          return (
            <li key={plan.id}>
              <Card className={cn("h-full", plan.featured && "border-primary shadow-md")}>
                <CardContent className="flex h-full flex-col gap-6 p-6">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-subtitle font-semibold">{plan.name}</h3>
                      {plan.featured ? <Badge>Most teams pick this</Badge> : null}
                    </div>
                    <p className="text-body text-muted-foreground">{plan.audience}</p>
                  </div>
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-display font-semibold tabular-nums">
                      {price === null ? "Custom" : money.format(price)}
                    </span>
                    {price === null ? null : (
                      <span className="text-meta text-muted-foreground">
                        a month, billed {billing === "yearly" ? "yearly" : "monthly"}
                      </span>
                    )}
                  </p>
                  <ul className="flex flex-1 flex-col gap-2.5">
                    {plan.features.map((feature) => (
                      <li className="flex items-start gap-2 text-body" key={feature}>
                        <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button asChild variant={plan.featured ? "default" : "outline"}>
                    <a href={plan.href}>{plan.cta}</a>
                  </Button>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
