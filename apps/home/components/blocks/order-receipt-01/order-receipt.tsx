// registry: order-receipt-01 — copied 2026-09-19
import { CircleCheck, Download, Package } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Descriptions,
  DescriptionsItem,
  Separator,
  Timeline,
} from "@elabs-ai/components-ui";
import { formatMoney, ProductArt, products } from "../commerce-parts/catalog";
import type { CartLine } from "../shopping-cart-01/shopping-cart";

export interface OrderReceiptProps {
  orderId?: string;
  email?: string;
  lines?: CartLine[];
  delivery?: number;
  address?: string;
  arrives?: string;
  onDownload?: () => void;
  locale?: string;
  currency?: string;
}

const DEFAULT_LINES: CartLine[] = [
  { product: products[0]!, quantity: 1, option: "Moss" },
  { product: products[4]!, quantity: 2, option: "Steel" },
];

/**
 * The page after paying — it worked, here is the number, here is when it arrives, and here
 * is what happens between now and then.
 */
export function OrderReceipt({
  orderId = "A-208417",
  email = "ada@acme.example",
  lines = DEFAULT_LINES,
  delivery = 0,
  address = "Waalhaven Oostzijde 1, 3087 BM Rotterdam",
  arrives = "Tuesday 22 September",
  onDownload,
  locale,
  currency,
}: OrderReceiptProps) {
  const money = (value: number) => formatMoney(value, locale, currency);
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);

  return (
    <Card className="mx-auto w-full max-w-2xl" data-slot="order-receipt">
      <CardContent className="flex flex-col gap-6 p-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <CircleCheck aria-hidden="true" className="size-12 text-success-text" />
          <h1 className="text-title font-semibold">Thank you — your order is in</h1>
          <p className="text-body text-muted-foreground">
            A receipt is on its way to <strong className="text-foreground">{email}</strong>.
          </p>
        </header>

        <Descriptions columns={2}>
          <DescriptionsItem label="Order">{orderId}</DescriptionsItem>
          <DescriptionsItem label="Arrives">{arrives}</DescriptionsItem>
          <DescriptionsItem label="Delivered to">{address}</DescriptionsItem>
          <DescriptionsItem label="Paid" numeric>
            {money(subtotal + delivery)}
          </DescriptionsItem>
        </Descriptions>

        <Separator />

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

        <section aria-labelledby="receipt-next" className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-subtitle font-semibold" id="receipt-next">
            <Package aria-hidden="true" className="size-5" />
            What happens next
          </h2>
          <Timeline
            items={[
              {
                title: "Order received",
                description: "We have it and your card was charged.",
                status: "done",
                timestamp: "Now",
              },
              {
                title: "Packed",
                description: "You get a tracking link the moment it leaves.",
                status: "active",
                timestamp: "Today",
              },
              {
                title: "Delivered",
                description: `Expected ${arrives}.`,
                status: "pending",
                timestamp: arrives.split(" ").slice(1).join(" "),
              },
            ]}
          />
        </section>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onDownload} variant="outline">
            <Download aria-hidden="true" />
            Download the invoice
          </Button>
          <Button asChild variant="ghost">
            <a href="#shop">Keep shopping</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
