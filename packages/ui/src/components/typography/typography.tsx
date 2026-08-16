/**
 * Typography primitives — the semantic type-role API (#187/#188, research 07 §B.3).
 *
 * `Text` and `Heading` map intent → a type ROLE. Each `text-<role>` utility is
 * backed by the `--text-<role>` tokens in @elabs/components-tokens and bundles all four
 * dimensions (size + leading + weight + tracking) while staying composable —
 * `leading-*` / `font-*` / `tracking-*` overrides still win. Reach for these
 * primitives (or a `text-<role>` utility) — never a raw size utility (sm/xl/…).
 */
import { forwardRef, type HTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

/**
 * The role font sizes in rem — a TS mirror of the `--text-<role>` tokens
 * (packages/tokens/src/themes.css) for consumers that need the numbers at
 * runtime (e.g. @elabs/components-editor's markdown-scale CSS-var seam). Edit the tokens
 * first; typography.test.tsx pins this mirror to themes.css.
 */
export const TEXT_ROLE_REM = {
  display: 1.875,
  title: 1.25,
  subtitle: 1,
  body: 0.875,
  caption: 0.8125,
  meta: 0.75,
  kpi: 2,
  code: 0.8125,
} as const;

export type TextRole = keyof typeof TEXT_ROLE_REM;

export const textVariants = cva("", {
  variants: {
    variant: {
      /** A lead paragraph — the subtitle rung at body weight (research 07 §B.3). */
      lead: "text-subtitle font-normal",
      body: "text-body",
      caption: "text-caption",
      meta: "text-meta",
      /** KPI values pair with tabular figures (interaction-guidelines). */
      kpi: "text-kpi tabular-nums",
      /** Inline/block code pairs with the `--font-mono` seam. */
      code: "text-code font-mono",
    },
    tone: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      /** #399 — the on-surface TEXT rung, not the `--primary` FILL. */
      primary: "text-primary-text",
    },
  },
  defaultVariants: { variant: "body", tone: "default" },
});

export type TextVariant = NonNullable<VariantProps<typeof textVariants>["variant"]>;
export type TextTone = NonNullable<VariantProps<typeof textVariants>["tone"]>;

export interface TextProps
  extends HTMLAttributes<HTMLParagraphElement>, VariantProps<typeof textVariants> {
  /** Render as a different element. Defaults to "p". */
  as?: "p" | "span" | "div";
  /** Render the child element as the text root (Radix Slot) instead. */
  asChild?: boolean;
}

export const Text = forwardRef<HTMLParagraphElement, TextProps>(function Text(
  { className, variant, tone, as: Tag = "p", asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : Tag;
  return <Comp ref={ref} className={cn(textVariants({ variant, tone }), className)} {...props} />;
});

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export const headingVariants = cva("text-balance text-foreground", {
  variants: {
    size: {
      /** display + title carry the `--font-display` brand seam (research 07 §E.5). */
      display: "font-display text-display",
      title: "font-display text-title",
      subtitle: "text-subtitle",
    },
  },
  defaultVariants: { size: "title" },
});

export type HeadingSize = NonNullable<VariantProps<typeof headingVariants>["size"]>;

/** Default visual rung per heading level: 1 → display, 2–3 → title, 4–6 → subtitle. */
const LEVEL_SIZE: Record<HeadingLevel, HeadingSize> = {
  1: "display",
  2: "title",
  3: "title",
  4: "subtitle",
  5: "subtitle",
  6: "subtitle",
};

export interface HeadingProps
  extends HTMLAttributes<HTMLHeadingElement>, VariantProps<typeof headingVariants> {
  /** Semantic heading level — drives the rendered tag AND the default size. */
  level?: HeadingLevel;
  /** Render the child element as the heading root (Radix Slot) instead. */
  asChild?: boolean;
}

/**
 * `level` keeps the a11y heading order; `size` overrides the visual rung
 * independently, so a visually-small `<h2>` stays an `<h2>`.
 */
export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(function Heading(
  { className, level = 2, size, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : (`h${level}` as const);
  return (
    <Comp
      ref={ref}
      className={cn(headingVariants({ size: size ?? LEVEL_SIZE[level] }), className)}
      {...props}
    />
  );
});
