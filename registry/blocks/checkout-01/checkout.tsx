"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Lock } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FieldControl,
  FieldError,
  FieldLabel,
  FieldRoot,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Separator,
} from "@elabs-ai/components-ui";
import { formatMoney, ProductArt, products } from "@/components/commerce-parts/catalog";
import type { CartLine } from "@/components/shopping-cart-01/shopping-cart";

export interface DeliveryOption {
  id: string;
  label: string;
  detail: string;
  price: number;
}

export interface CheckoutValues {
  email: string;
  name: string;
  address: string;
  city: string;
  postcode: string;
  delivery: string;
}

export interface CheckoutProps {
  lines?: CartLine[];
  deliveryOptions?: DeliveryOption[];
  /**
   * Where your payment provider's hosted card field mounts. The block never renders or reads
   * card numbers itself.
   */
  paymentSlot?: ReactNode;
  onPlaceOrder?: (values: CheckoutValues, total: number) => void;
  locale?: string;
  currency?: string;
}

const DEFAULT_LINES: CartLine[] = [
  { product: products[0]!, quantity: 1, option: "Moss" },
  { product: products[4]!, quantity: 2, option: "Steel" },
];

const DEFAULT_DELIVERY: DeliveryOption[] = [
  { id: "standard", label: "Standard", detail: "2–4 working days", price: 0 },
  { id: "express", label: "Express", detail: "Next working day, ordered before 15:00", price: 14 },
  {
    id: "pickup",
    label: "Pick up in store",
    detail: "Ready in two hours · Rotterdam Centrum",
    price: 0,
  },
];

/**
 * One-page checkout — contact, address and delivery in labelled groups, every field with
 * the right `autocomplete`, errors after the first attempt with focus moved to the first
 * one, a delivery choice that changes the total, and a payment slot for the provider's own
 * card field.
 */
export function Checkout({
  lines = DEFAULT_LINES,
  deliveryOptions = DEFAULT_DELIVERY,
  paymentSlot,
  onPlaceOrder,
  locale,
  currency,
}: CheckoutProps) {
  const [values, setValues] = useState<CheckoutValues>({
    email: "",
    name: "",
    address: "",
    city: "",
    postcode: "",
    delivery: deliveryOptions[0]?.id ?? "",
  });
  const [tried, setTried] = useState(false);
  const set = (key: keyof CheckoutValues) => (value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));
  const money = (value: number) => formatMoney(value, locale, currency);

  const pickup = values.delivery === "pickup";
  const errors: Partial<Record<keyof CheckoutValues, string>> = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
      ? undefined
      : "Enter an email for the receipt.",
    name: values.name.trim() ? undefined : "Enter the name for the delivery.",
    ...(pickup
      ? {}
      : {
          address: values.address.trim() ? undefined : "Enter a street and house number.",
          city: values.city.trim() ? undefined : "Enter a city.",
          postcode: values.postcode.trim() ? undefined : "Enter a postcode.",
        }),
  };
  const firstError = (Object.keys(errors) as (keyof CheckoutValues)[]).find((key) => errors[key]);

  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const delivery = deliveryOptions.find((option) => option.id === values.delivery)?.price ?? 0;
  const total = subtotal + delivery;

  function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    if (firstError) {
      event.currentTarget.querySelector<HTMLElement>(`[name="${firstError}"]`)?.focus();
      return;
    }
    onPlaceOrder?.(values, total);
  }

  const field = (
    key: "email" | "name" | "address" | "city" | "postcode",
    label: string,
    autoComplete: string,
    type = "text",
  ) => (
    <FieldRoot invalid={tried && Boolean(errors[key])} required>
      <FieldLabel>{label}</FieldLabel>
      <FieldControl>
        <Input
          autoComplete={autoComplete}
          name={key}
          onChange={(event) => set(key)(event.target.value)}
          type={type}
          value={values[key]}
        />
      </FieldControl>
      {tried && errors[key] ? <FieldError>{errors[key]}</FieldError> : null}
    </FieldRoot>
  );

  return (
    <form className="@container" data-slot="checkout" noValidate onSubmit={handle}>
      <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-5">
        <div className="flex flex-col gap-6 @4xl:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent>{field("email", "Email for the receipt", "email", "email")}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Delivery</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <RadioGroup
                aria-label="Delivery method"
                onValueChange={set("delivery")}
                value={values.delivery}
              >
                {deliveryOptions.map((option) => (
                  <div
                    className="flex items-start gap-3 rounded-md border border-border p-3 has-[[data-state=checked]]:border-primary"
                    key={option.id}
                  >
                    <RadioGroupItem
                      className="mt-0.5"
                      id={`delivery-${option.id}`}
                      value={option.id}
                    />
                    <Label
                      className="flex flex-1 cursor-pointer flex-col gap-0.5 font-normal"
                      htmlFor={`delivery-${option.id}`}
                    >
                      <span className="flex justify-between gap-2 font-medium">
                        {option.label}
                        <span className="tabular-nums">
                          {option.price === 0 ? "Free" : money(option.price)}
                        </span>
                      </span>
                      <span className="text-meta text-muted-foreground">{option.detail}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              {field("name", "Full name", "name")}
              {pickup ? (
                <p className="text-meta text-muted-foreground">
                  No address needed. Bring the receipt email and something with your name on it.
                </p>
              ) : (
                <>
                  {field("address", "Street and house number", "street-address")}
                  <div className="grid grid-cols-1 gap-5 @md:grid-cols-2">
                    {field("postcode", "Postcode", "postal-code")}
                    {field("city", "City", "address-level2")}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentSlot ?? (
                <p className="rounded-md border border-dashed border-border-strong p-4 text-body text-muted-foreground">
                  Your payment provider's hosted card field mounts here. Card numbers never pass
                  through this block.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="self-start @4xl:col-span-2">
          <CardHeader>
            <CardTitle>Your order</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-col gap-3">
              {lines.map((line) => (
                <li className="flex items-center gap-3" key={line.product.id}>
                  <ProductArt className="size-12 shrink-0" product={line.product} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body font-medium">{line.product.name}</span>
                    <span className="text-meta text-muted-foreground">
                      {line.option} · × {line.quantity}
                    </span>
                  </div>
                  <span className="text-body tabular-nums">
                    {money(line.product.price * line.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <Separator />
            <dl className="flex flex-col gap-2 text-body tabular-nums">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{money(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd>{delivery === 0 ? "Free" : money(delivery)}</dd>
              </div>
              <div className="flex justify-between text-subtitle font-semibold">
                <dt>Total</dt>
                <dd>{money(total)}</dd>
              </div>
            </dl>
            {tried && firstError ? (
              <p className="text-meta text-destructive-text" role="alert">
                Something is missing above — we moved you to it.
              </p>
            ) : null}
            <Button size="lg" type="submit">
              <Lock aria-hidden="true" />
              Pay {money(total)}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
