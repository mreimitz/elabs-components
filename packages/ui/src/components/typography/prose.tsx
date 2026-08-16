/**
 * Prose primitives — reading-surface typography, promoted from @elabs/components-editor
 * (#188; ADR-0012 own/re-export model: @elabs/components-ui owns the canonical source,
 * `@elabs/components-editor/markdown` re-exports them under their original names —
 * Heading, Text, Link, List, Blockquote, InlineCode). The markdown preview maps
 * onto them (`#` → ProseHeading, paragraph → ProseText, `[]()` → ProseLink,
 * `-` → ProseList, `>` → ProseBlockquote, `` `code` `` → ProseInlineCode).
 * Generic, composable, theme-safe; usable in any app surface, not just markdown.
 *
 * `Prose*`-prefixed here because this barrel also exports the app `Heading` /
 * `Text` primitives (typography.tsx): the app scale ranks UI chrome against the
 * page; the prose scale ranks rungs WITHIN one reading column, so a document h1
 * deliberately sits BELOW the app `display` rung.
 */
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type HTMLAttributes,
  type OlHTMLAttributes,
} from "react";
import { cn } from "../../lib/cn";
import { TEXT_ROLE_REM } from "./typography";

export type ProseHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Canonical reading-scale heading sizes in rem — the single source the markdown
 * WYSIWYG editor derives its CSS vars from (@elabs/components-editor `markdown-scale`).
 * h2/h4/h5/h6 sit exactly on the title/subtitle/body roles; h1 (1.5rem) and
 * h3 (1.125rem) are intermediate reading rungs with no app role.
 */
export const PROSE_HEADING_REM: Record<ProseHeadingLevel, number> = {
  1: 1.5,
  2: TEXT_ROLE_REM.title,
  3: 1.125,
  4: TEXT_ROLE_REM.subtitle,
  5: TEXT_ROLE_REM.body,
  6: TEXT_ROLE_REM.body,
};

/** Canonical prose heading weight (Tailwind `font-semibold`). */
export const PROSE_HEADING_WEIGHT = 600;

/** Canonical prose heading letter-spacing (Tailwind `tracking-tight`). */
export const PROSE_HEADING_TRACKING = "-0.025em";

/*
 * h1/h3 keep raw Tailwind steps (2xl / lg): the reading scale needs rungs
 * BETWEEN the app roles (see PROSE_HEADING_REM) — baselined in the text-scale
 * ratchet. The base classes' font-semibold / tracking-tight override the role
 * companions, so the role re-points are render-identical to the old raw steps.
 */
const HEADING_SIZE: Record<ProseHeadingLevel, string> = {
  1: "text-2xl",
  2: "text-title",
  3: "text-lg",
  4: "text-subtitle",
  5: "text-body",
  6: "text-body text-muted-foreground",
};

export interface ProseHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: ProseHeadingLevel;
}

export const ProseHeading = forwardRef<HTMLHeadingElement, ProseHeadingProps>(function ProseHeading(
  { level = 2, className, ...props },
  ref,
) {
  const Tag = `h${level}` as const;
  return (
    <Tag
      ref={ref}
      className={cn(
        "scroll-m-20 font-semibold tracking-tight text-foreground",
        HEADING_SIZE[level],
        className,
      )}
      {...props}
    />
  );
});

const TEXT_VARIANT = {
  body: "text-body leading-relaxed text-foreground",
  muted: "text-body leading-relaxed text-muted-foreground",
  lead: "text-subtitle font-normal leading-relaxed text-foreground",
  small: "text-meta font-normal text-muted-foreground",
} as const;

export interface ProseTextProps extends HTMLAttributes<HTMLParagraphElement> {
  variant?: keyof typeof TEXT_VARIANT;
  /** Render as a different element (e.g. "span"). Defaults to "p". */
  as?: "p" | "span" | "div";
}

export const ProseText = forwardRef<HTMLParagraphElement, ProseTextProps>(function ProseText(
  { variant = "body", as: Tag = "p", className, ...props },
  ref,
) {
  return <Tag ref={ref} className={cn(TEXT_VARIANT[variant], className)} {...props} />;
});

export interface ProseLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Opens in a new tab with safe rel. Auto-detected for http(s) hrefs when unset. */
  external?: boolean;
}

export const ProseLink = forwardRef<HTMLAnchorElement, ProseLinkProps>(function ProseLink(
  { external, href, className, ...props },
  ref,
) {
  const isExternal = external ?? (typeof href === "string" && /^https?:\/\//.test(href));
  return (
    <a
      ref={ref}
      href={href}
      className={cn(
        // #399 — `text-primary-text`, not the `text-primary` FILL rung: a prose
        // link is ordinary body text and owes WCAG 1.4.3 AA (4.5:1), which the
        // fill only guarantees at the 1.4.11 mark bar (3:1).
        "font-medium text-primary-text underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...props}
    />
  );
});

export interface ProseListProps extends OlHTMLAttributes<HTMLElement> {
  ordered?: boolean;
}

export const ProseList = forwardRef<HTMLUListElement & HTMLOListElement, ProseListProps>(
  function ProseList({ ordered = false, className, ...props }, ref) {
    const Tag = ordered ? "ol" : "ul";
    return (
      <Tag
        ref={ref}
        className={cn(
          "my-1 space-y-1 ps-6 text-body text-foreground",
          ordered ? "list-decimal" : "list-disc",
          className,
        )}
        {...props}
      />
    );
  },
);

export const ProseListItem = forwardRef<HTMLLIElement, HTMLAttributes<HTMLLIElement>>(
  function ProseListItem({ className, ...props }, ref) {
    return (
      <li
        ref={ref}
        className={cn("leading-relaxed [&>ul]:mt-1 [&>ol]:mt-1", className)}
        {...props}
      />
    );
  },
);

export const ProseBlockquote = forwardRef<HTMLQuoteElement, HTMLAttributes<HTMLQuoteElement>>(
  function ProseBlockquote({ className, ...props }, ref) {
    return (
      <blockquote
        ref={ref}
        className={cn(
          "border-s-2 border-border ps-4 text-body italic text-muted-foreground",
          className,
        )}
        {...props}
      />
    );
  },
);

export const ProseInlineCode = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(
  function ProseInlineCode({ className, ...props }, ref) {
    return (
      <code
        ref={ref}
        // 0.85em (not the fixed `code` role): inline code must scale RELATIVE to
        // whatever text it sits in (body, a heading, …). Baselined in the ratchet.
        className={cn(
          "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground",
          className,
        )}
        {...props}
      />
    );
  },
);
