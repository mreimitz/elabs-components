// registry: product-detail-01 — copied 2026-09-19
"use client";

import { useState } from "react";
import { RotateCcw, ShieldCheck, Truck } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  NumberInput,
  Rating,
  ToggleGroup,
  ToggleGroupItem,
} from "@elabs-ai/components-ui";
import { formatMoney, ProductArt, products, type Product } from "../commerce-parts/catalog";

export interface ProductDetailProps {
  product?: Product;
  onAdd?: (line: { product: Product; color: string; size?: string; quantity: number }) => void;
  locale?: string;
  currency?: string;
}

/**
 * A product page — options that must be chosen before buying (and a button that says which
 * one is missing), a quantity capped by stock, delivery promises as facts, and the details
 * in an accordion.
 */
export function ProductDetail({
  product = products[2]!,
  onAdd,
  locale,
  currency,
}: ProductDetailProps) {
  const [color, setColor] = useState(product.colors[0] ?? "");
  const [size, setSize] = useState<string | undefined>(undefined);
  const [quantity, setQuantity] = useState<number | null>(1);
  const [added, setAdded] = useState(false);
  const soldOut = product.stock === 0;
  const needsSize = Boolean(product.sizes?.length) && !size;

  return (
    <section className="@container" data-slot="product-detail">
      <div className="grid grid-cols-1 gap-8 @3xl:grid-cols-2">
        <ProductArt className="aspect-square w-full rounded-lg" product={product} />
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-meta text-muted-foreground">{product.category}</span>
            <h1 className="text-title font-semibold">{product.name}</h1>
            <span className="flex items-center gap-2 text-meta text-muted-foreground">
              <Rating
                allowHalf
                aria-label={`${product.rating} out of 5`}
                readOnly
                value={product.rating}
              />
              {product.rating} · {product.reviews} reviews
            </span>
            <p className="flex items-baseline gap-2 tabular-nums">
              <span className="text-display font-semibold">
                {formatMoney(product.price, locale, currency)}
              </span>
              {product.was ? (
                <s className="text-body text-muted-foreground">
                  <span className="sr-only">was </span>
                  {formatMoney(product.was, locale, currency)}
                </s>
              ) : null}
            </p>
            <p className="text-body text-muted-foreground text-pretty">{product.blurb}</p>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-meta font-medium" id="pd-color">
              Colour: <span className="font-normal text-muted-foreground">{color}</span>
            </span>
            <ToggleGroup
              aria-labelledby="pd-color"
              className="justify-start"
              onValueChange={(value) => value && setColor(value)}
              type="single"
              value={color}
              variant="outline"
            >
              {product.colors.map((name) => (
                <ToggleGroupItem key={name} value={name}>
                  {name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {product.sizes?.length ? (
            <div className="flex flex-col gap-2">
              <span className="text-meta font-medium" id="pd-size">
                Size (EU):{" "}
                <span className="font-normal text-muted-foreground">{size ?? "choose one"}</span>
              </span>
              <ToggleGroup
                aria-labelledby="pd-size"
                className="flex-wrap justify-start"
                onValueChange={(value) => setSize(value || undefined)}
                type="single"
                value={size ?? ""}
                variant="outline"
              >
                {product.sizes.map((name) => (
                  <ToggleGroupItem key={name} value={name}>
                    {name}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-2 text-meta font-medium">
              Quantity
              <NumberInput
                clamp
                disabled={soldOut}
                max={Math.max(1, product.stock)}
                min={1}
                onValueChange={setQuantity}
                value={quantity}
              />
            </label>
            <Button
              className="min-w-48 flex-1"
              disabled={soldOut || needsSize}
              onClick={() => {
                setAdded(true);
                onAdd?.({ product, color, size, quantity: quantity ?? 1 });
              }}
              size="lg"
            >
              {soldOut
                ? "Sold out"
                : needsSize
                  ? "Choose a size"
                  : added
                    ? "Added — add another"
                    : "Add to cart"}
            </Button>
          </div>
          {!soldOut && product.stock <= 5 ? (
            <Badge className="self-start" variant="warning">
              Only {product.stock} left
            </Badge>
          ) : null}
          <p aria-live="polite" className="sr-only">
            {added ? `${product.name} added to your cart.` : ""}
          </p>

          <ul className="flex flex-col gap-2 text-body">
            <li className="flex items-center gap-2">
              <Truck aria-hidden="true" className="size-4 text-primary" />
              Free delivery over $100 · arrives in 2–4 working days
            </li>
            <li className="flex items-center gap-2">
              <RotateCcw aria-hidden="true" className="size-4 text-primary" />
              60 days to send it back, used or not
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
              Repaired for free for five years
            </li>
          </ul>

          <Accordion collapsible type="single">
            <AccordionItem value="materials">
              <AccordionTrigger headingLevel={2}>Materials and care</AccordionTrigger>
              <AccordionContent>
                Full-grain leather upper, recycled polyester lining, resoleable rubber outsole.
                Brush off dry mud; re-wax twice a year.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="fit">
              <AccordionTrigger headingLevel={2}>Fit</AccordionTrigger>
              <AccordionContent>
                True to size with a roomy toe box. Between sizes, go up half for thick socks.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </section>
  );
}
