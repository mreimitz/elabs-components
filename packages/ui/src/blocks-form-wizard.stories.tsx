/**
 * Form Wizard — a multi-step form with a horizontal numbered stepper.
 *
 * The `Wizard` primitive provides the stepper + step state; the reference
 * dashboards pair it with real form fields per step and a Review step. This
 * block is the copy-ready checkout-style flow (Customer → Shipping → Payment →
 * Review) so a builder doesn't re-derive the field layout, autocomplete hints,
 * or the summary step each time.
 *
 * Compose-only from @elabs/components-* primitives; semantic tokens only; reads in all
 * three themes. Verify with globals=theme:<slug>.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Descriptions,
  DescriptionsItem,
  Input,
  Label,
  Wizard,
  WizardNav,
  WizardStep,
  WizardSteps,
  type WizardStepMeta,
} from "./index";

const STEPS: WizardStepMeta[] = [
  { id: "customer", title: "Customer", description: "Contact details" },
  { id: "shipping", title: "Shipping", description: "Delivery address" },
  { id: "payment", title: "Payment", description: "Card details" },
  { id: "review", title: "Review", description: "Confirm & place" },
];

function Field({
  id,
  label,
  placeholder,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} placeholder={placeholder} autoComplete={autoComplete} />
    </div>
  );
}

function CheckoutWizard() {
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

const meta = {
  title: "Patterns/Blocks/Form Wizard",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A multi-step form with a horizontal numbered stepper (the Wizard primitive) — a checkout flow (Customer → Shipping → Payment → Review) with real fields, correct autocomplete/type hints per interaction-guidelines, and a Descriptions review step. Semantic tokens only; reads in all three themes.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <CheckoutWizard /> };
