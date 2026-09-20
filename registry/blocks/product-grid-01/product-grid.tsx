"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Rating,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
} from "@elabs-ai/components-ui";
import {
  formatMoney,
  ProductArt,
  products as catalog,
  type Product,
} from "@/components/commerce-parts/catalog";

export interface ProductGridProps {
  products?: Product[];
  onAdd?: (product: Product) => void;
  locale?: string;
  currency?: string;
}

type Sort = "featured" | "price-asc" | "price-desc" | "rating";

/**
 * A product listing — category filter with counts, sorting, and cards that tell the truth
 * about stock: "3 left" and "sold out" are words on the card, and a sold-out product cannot
 * be added.
 */
export function ProductGrid({ products = catalog, onAdd, locale, currency }: ProductGridProps) {
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState<Sort>("featured");
  const [added, setAdded] = useState<string | null>(null);
  const categories = useMemo(
    () => ["All", ...new Set(products.map((p) => p.category))],
    [products],
  );

  const shown = useMemo(() => {
    const list =
      category === "All" ? [...products] : products.filter((p) => p.category === category);
    if (sort === "price-asc") list.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") list.sort((a, b) => b.price - a.price);
    if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [category, products, sort]);

  return (
    <section className="@container flex flex-col gap-5" data-slot="product-grid">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          aria-label="Category"
          className="flex-wrap"
          onValueChange={(value) => value && setCategory(value)}
          size="sm"
          type="single"
          value={category}
          variant="outline"
        >
          {categories.map((name) => (
            <ToggleGroupItem key={name} value={name}>
              {name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Select onValueChange={(value) => setSort(value as Sort)} value={sort}>
          <SelectTrigger aria-label="Sort by" className="min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="featured">Featured</SelectItem>
            <SelectItem value="price-asc">Price, low to high</SelectItem>
            <SelectItem value="price-desc">Price, high to low</SelectItem>
            <SelectItem value="rating">Best rated</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p aria-live="polite" className="sr-only">
        {added ? `${added} added to your cart.` : ""}
      </p>
      <ul className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
        {shown.map((product) => {
          const soldOut = product.stock === 0;
          return (
            <li key={product.id}>
              <Card className="h-full overflow-hidden p-0">
                <div className="relative">
                  <ProductArt className="aspect-4/3 rounded-none" product={product} />
                  <div className="absolute start-3 top-3 flex gap-1.5">
                    {product.was ? (
                      <Badge>Save {Math.round((1 - product.price / product.was) * 100)}%</Badge>
                    ) : null}
                    {soldOut ? (
                      <Badge variant="secondary">Sold out</Badge>
                    ) : product.stock <= 5 ? (
                      <Badge variant="warning">{product.stock} left</Badge>
                    ) : null}
                  </div>
                </div>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-caption text-muted-foreground">{product.category}</span>
                    <h3 className="text-body font-semibold">{product.name}</h3>
                    <span className="flex items-center gap-2 text-caption text-muted-foreground">
                      <Rating
                        allowHalf
                        aria-label={`${product.rating} out of 5`}
                        readOnly
                        value={product.rating}
                      />
                      {product.rating} ({product.reviews})
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-baseline gap-2 tabular-nums">
                      <span className="text-subtitle font-semibold">
                        {formatMoney(product.price, locale, currency)}
                      </span>
                      {product.was ? (
                        <s className="text-meta text-muted-foreground">
                          <span className="sr-only">was </span>
                          {formatMoney(product.was, locale, currency)}
                        </s>
                      ) : null}
                    </p>
                    <Button
                      disabled={soldOut}
                      onClick={() => {
                        setAdded(product.name);
                        onAdd?.(product);
                      }}
                      size="sm"
                      variant={soldOut ? "outline" : "default"}
                    >
                      {soldOut ? "Sold out" : "Add to cart"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
