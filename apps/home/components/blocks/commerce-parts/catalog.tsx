// registry: commerce-parts — copied 2026-09-19
/**
 * Commerce parts — the small shared vocabulary of the commerce blocks: a catalogue of sample
 * products, a token-painted stand-in for product photography, and one money formatter.
 */
import type { LucideIcon } from "lucide-react";
import { Backpack, Coffee, Flashlight, Footprints, Tent, Watch } from "lucide-react";
import { cn } from "@elabs-ai/components-ui";

export interface Product {
  id: string;
  name: string;
  category: string;
  /** Price in the currency's major unit. */
  price: number;
  /** The price before a markdown, when there is one. */
  was?: number;
  rating: number;
  reviews: number;
  /** Units left; 0 is sold out. */
  stock: number;
  colors: string[];
  sizes?: string[];
  blurb: string;
  icon: LucideIcon;
  /** Which chart token paints the stand-in art, 1–5. */
  tone: 1 | 2 | 3 | 4 | 5;
}

export const products: Product[] = [
  {
    id: "trail-40",
    name: "Trail 40 backpack",
    category: "Packs",
    price: 189,
    was: 229,
    rating: 4.7,
    reviews: 312,
    stock: 14,
    colors: ["Moss", "Slate", "Rust"],
    blurb: "Forty litres, a frame that carries on the hips, and a lid that becomes a day bag.",
    icon: Backpack,
    tone: 1,
  },
  {
    id: "ridge-2",
    name: "Ridge 2 tent",
    category: "Shelter",
    price: 429,
    rating: 4.8,
    reviews: 188,
    stock: 3,
    colors: ["Sand", "Pine"],
    blurb: "Two people, three seasons, up in four minutes with cold hands.",
    icon: Tent,
    tone: 2,
  },
  {
    id: "summit-mid",
    name: "Summit mid boots",
    category: "Footwear",
    price: 215,
    rating: 4.5,
    reviews: 541,
    stock: 27,
    colors: ["Bark", "Graphite"],
    sizes: ["39", "40", "41", "42", "43", "44", "45"],
    blurb: "Waterproof leather that is broken in by the second walk.",
    icon: Footprints,
    tone: 3,
  },
  {
    id: "beam-400",
    name: "Beam 400 headlamp",
    category: "Lighting",
    price: 59,
    was: 69,
    rating: 4.6,
    reviews: 97,
    stock: 0,
    colors: ["Black"],
    blurb: "Four hundred lumens, a red mode for the tent, and a lock so it stays off in the bag.",
    icon: Flashlight,
    tone: 4,
  },
  {
    id: "brew-kit",
    name: "Camp brew kit",
    category: "Kitchen",
    price: 74,
    rating: 4.9,
    reviews: 264,
    stock: 41,
    colors: ["Steel"],
    blurb: "A pour-over that packs into its own mug.",
    icon: Coffee,
    tone: 5,
  },
  {
    id: "alti-watch",
    name: "Alti field watch",
    category: "Navigation",
    price: 349,
    rating: 4.4,
    reviews: 129,
    stock: 8,
    colors: ["Black", "Olive"],
    blurb: "Altitude, barometer and three weeks on a charge.",
    icon: Watch,
    tone: 1,
  },
];

export const formatMoney = (value: number, locale = "en-US", currency = "USD") =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);

/** A stand-in for product photography: a token-painted tile that follows the theme. */
export function ProductArt({ product, className }: { product: Product; className?: string }) {
  const Icon = product.icon;
  return (
    <div
      aria-hidden="true"
      className={cn("flex items-center justify-center rounded-md", className)}
      style={{
        background: `color-mix(in oklab, var(--chart-${product.tone}) 18%, var(--card))`,
        color: `var(--chart-${product.tone})`,
      }}
    >
      <Icon className="size-1/3" strokeWidth={1.25} />
    </div>
  );
}
