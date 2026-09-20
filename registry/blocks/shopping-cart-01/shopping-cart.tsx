"use client";

import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  IconButton,
  Input,
  Meter,
  NumberInput,
  Separator,
} from "@elabs-ai/components-ui";
import {
  formatMoney,
  ProductArt,
  products,
  type Product,
} from "@/components/commerce-parts/catalog";

export interface CartLine {
  product: Product;
  quantity: number;
  option: string;
}

export interface ShoppingCartProps {
  defaultLines?: CartLine[];
  /** Order value from which delivery is free. */
  freeDeliveryFrom?: number;
  deliveryFee?: number;
  /** Codes that work, and the share they take off. */
  coupons?: Record<string, number>;
  onCheckout?: (lines: CartLine[], total: number) => void;
  locale?: string;
  currency?: string;
}

const DEFAULT_LINES: CartLine[] = [
  { product: products[0]!, quantity: 1, option: "Moss" },
  { product: products[4]!, quantity: 2, option: "Steel" },
];

/**
 * The cart — quantities capped by stock, a line you can remove and undo, a coupon that
 * answers either way, progress toward free delivery, and totals that always add up.
 */
export function ShoppingCart({
  defaultLines = DEFAULT_LINES,
  freeDeliveryFrom = 400,
  deliveryFee = 9,
  coupons = { TRAIL10: 0.1 },
  onCheckout,
  locale,
  currency,
}: ShoppingCartProps) {
  const [lines, setLines] = useState(defaultLines);
  const [removed, setRemoved] = useState<CartLine | null>(null);
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const money = (value: number) => formatMoney(value, locale, currency);

  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const discount = applied ? subtotal * (coupons[applied] ?? 0) : 0;
  const delivery = subtotal - discount >= freeDeliveryFrom || lines.length === 0 ? 0 : deliveryFee;
  const total = subtotal - discount + delivery;
  const toFree = Math.max(0, freeDeliveryFrom - (subtotal - discount));

  function apply(event: FormEvent) {
    event.preventDefault();
    const key = code.trim().toUpperCase();
    if (coupons[key]) {
      setApplied(key);
      setCouponError(null);
      setCode("");
    } else setCouponError("That code is not valid, or it has expired.");
  }

  return (
    <section className="@container" data-slot="shopping-cart">
      <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-3">
        <Card className="@4xl:col-span-2">
          <CardHeader>
            <CardTitle>
              {lines.length === 0
                ? "Your cart is empty"
                : `Your cart · ${lines.reduce((n, l) => n + l.quantity, 0)} items`}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {removed ? (
              <p
                aria-live="polite"
                className="flex items-center justify-between gap-3 rounded-md bg-surface-muted px-3 py-2 text-body"
              >
                <span>{removed.product.name} removed.</span>
                <Button
                  onClick={() => {
                    setLines((prev) => [...prev, removed]);
                    setRemoved(null);
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Undo
                </Button>
              </p>
            ) : null}
            {lines.length === 0 ? (
              <p className="py-8 text-center text-body text-muted-foreground">
                Nothing here yet. What you add shows up with its delivery date.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {lines.map((line) => (
                  <li className="flex flex-wrap items-center gap-4 py-4" key={line.product.id}>
                    <ProductArt className="size-20 shrink-0" product={line.product} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-body font-medium">{line.product.name}</span>
                      <span className="text-meta text-muted-foreground">
                        {line.option} · {money(line.product.price)} each
                      </span>
                    </div>
                    <NumberInput
                      aria-label={`Quantity of ${line.product.name}`}
                      clamp
                      max={line.product.stock}
                      min={1}
                      onValueChange={(value) =>
                        setLines((prev) =>
                          prev.map((l) =>
                            l.product.id === line.product.id ? { ...l, quantity: value ?? 1 } : l,
                          ),
                        )
                      }
                      value={line.quantity}
                    />
                    <span className="w-20 text-end text-body font-medium tabular-nums">
                      {money(line.product.price * line.quantity)}
                    </span>
                    <IconButton
                      icon={<Trash2 />}
                      label={`Remove ${line.product.name}`}
                      onClick={() => {
                        setRemoved(line);
                        setLines((prev) => prev.filter((l) => l.product.id !== line.product.id));
                      }}
                      variant="ghost"
                    />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {lines.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <Meter
                  aria-label={
                    toFree === 0 ? "Delivery is free" : `${money(toFree)} away from free delivery`
                  }
                  max={freeDeliveryFrom}
                  size="xs"
                  value={Math.min(freeDeliveryFrom, subtotal - discount)}
                />
                <p className="text-meta text-muted-foreground">
                  {toFree === 0
                    ? "Delivery is free on this order."
                    : `${money(toFree)} more and delivery is free.`}
                </p>
              </div>
            ) : null}
            <form className="flex flex-col gap-1.5" onSubmit={apply}>
              <div className="flex gap-2">
                <Input
                  aria-invalid={couponError !== null}
                  aria-label="Discount code"
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Discount code"
                  value={code}
                />
                <Button disabled={!code.trim()} type="submit" variant="outline">
                  Apply
                </Button>
              </div>
              {couponError ? (
                <p className="text-meta text-destructive-text" role="alert">
                  {couponError}
                </p>
              ) : null}
            </form>
            <dl className="flex flex-col gap-2 text-body tabular-nums">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{money(subtotal)}</dd>
              </div>
              {applied ? (
                <div className="flex justify-between">
                  <dt className="flex items-center gap-2 text-muted-foreground">
                    Code {applied}
                    <button
                      className="rounded-sm text-meta underline underline-offset-2 focus-ring"
                      onClick={() => setApplied(null)}
                      type="button"
                    >
                      remove
                    </button>
                  </dt>
                  <dd>−{money(discount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd>{delivery === 0 ? "Free" : money(delivery)}</dd>
              </div>
              <Separator />
              <div className="flex justify-between text-subtitle font-semibold">
                <dt>Total</dt>
                <dd>{money(total)}</dd>
              </div>
            </dl>
            <Button
              disabled={lines.length === 0}
              onClick={() => onCheckout?.(lines, total)}
              size="lg"
            >
              Go to checkout
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
