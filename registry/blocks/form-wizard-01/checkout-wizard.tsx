"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Descriptions,
  DescriptionsItem,
  Wizard,
  WizardNav,
  WizardStep,
  WizardSteps,
} from "@elabs/components-ui";
import { STEPS } from "./data/steps";
import { Field } from "./field";

/**
 * A multi-step form with a horizontal numbered stepper (the `Wizard`
 * primitive) — a checkout flow (Customer → Shipping → Payment → Review) with
 * real fields, correct autocomplete/type hints, and a `Descriptions` review
 * step.
 */
export function CheckoutWizard() {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Place your order</CardTitle>
        <CardDescription>Four quick steps — your cart is saved as you go.</CardDescription>
      </CardHeader>
      <CardContent>
        <Wizard steps={STEPS} defaultStep={0} className="flex flex-col gap-6">
          <WizardSteps />

          <WizardStep step={0}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="cw-name" label="Full name" autoComplete="name" placeholder="Avery Rao" />
              <Field
                id="cw-email"
                label="Email"
                type="email"
                autoComplete="email"
                placeholder="avery@acme.co"
              />
              <Field
                id="cw-phone"
                label="Phone"
                type="tel"
                autoComplete="tel"
                placeholder="+1 555 0100"
              />
            </div>
          </WizardStep>

          <WizardStep step={1}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  id="cw-addr"
                  label="Street address"
                  autoComplete="street-address"
                  placeholder="100 Market St"
                />
              </div>
              <Field
                id="cw-city"
                label="City"
                autoComplete="address-level2"
                placeholder="San Francisco"
              />
              <Field
                id="cw-zip"
                label="ZIP / Postal code"
                autoComplete="postal-code"
                placeholder="94105"
              />
            </div>
          </WizardStep>

          <WizardStep step={2}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  id="cw-cardname"
                  label="Name on card"
                  autoComplete="cc-name"
                  placeholder="Avery Rao"
                />
              </div>
              <div className="sm:col-span-2">
                <Field
                  id="cw-cardnum"
                  label="Card number"
                  autoComplete="cc-number"
                  placeholder="4242 4242 4242 4242"
                />
              </div>
              <Field id="cw-exp" label="Expiry" autoComplete="cc-exp" placeholder="MM/YY" />
              <Field id="cw-cvc" label="CVC" autoComplete="cc-csc" placeholder="123" />
            </div>
          </WizardStep>

          <WizardStep step={3}>
            <div className="space-y-4">
              <p className="text-body text-muted-foreground">
                Review your details, then place the order.
              </p>
              <Descriptions columns={2} layout="vertical">
                <DescriptionsItem label="Customer">Avery Rao · avery@acme.co</DescriptionsItem>
                <DescriptionsItem label="Ship to">
                  100 Market St, San Francisco 94105
                </DescriptionsItem>
                <DescriptionsItem label="Payment">Visa ending 4242</DescriptionsItem>
                <DescriptionsItem label="Total" numeric>
                  $128.00
                </DescriptionsItem>
              </Descriptions>
            </div>
          </WizardStep>

          <WizardNav finishLabel="Place order" />
        </Wizard>
      </CardContent>
    </Card>
  );
}
