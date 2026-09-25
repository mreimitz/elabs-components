/**
 * Site frame — the navbar, the `<main>` and the footer every website page shares.
 *
 * What it shows a copier: a page template is a route, not a shell — it composes the
 * marketing navbar, one `<main>` landmark and the footer around whatever blocks the route
 * needs. The optional `banner` slot sits above the navbar (a `MarketingBanner`), the
 * `after` slot below the footer (a cookie banner, a floating CTA). `activeHref` marks the
 * navbar link for the route you are on.
 */
import type { ReactNode } from "react";
import { cn } from "@elabs-ai/components-ui";
import { MarketingFooter } from "@/components/marketing-footer-01/marketing-footer";
import {
  MarketingNavbar,
  type NavbarLink,
} from "@/components/marketing-navbar-01/marketing-navbar";

export const SITE_LINKS: NavbarLink[] = [
  { label: "Product", href: "#product" },
  { label: "Pricing", href: "#pricing" },
  { label: "Customers", href: "#customers" },
  { label: "Blog", href: "#blog" },
  { label: "Docs", href: "#docs" },
];

export interface SiteFrameProps {
  /** Wordmark in the navbar and footer. */
  productName?: string;
  /** Navbar links; defaults to the site's five sections. */
  links?: NavbarLink[];
  /** `href` of the link that matches the current route. */
  activeHref?: string;
  /** Rendered above the navbar — a `MarketingBanner`. */
  banner?: ReactNode;
  /** Rendered after the footer — a cookie banner, a floating CTA. */
  after?: ReactNode;
  /** Hide the navbar's sign-in link (auth pages). */
  hideSignIn?: boolean;
  /** Extra classes on the `<main>` landmark. */
  mainClassName?: string;
  children: ReactNode;
}

export function SiteFrame({
  productName = "Harbourline",
  links = SITE_LINKS,
  activeHref,
  banner,
  after,
  hideSignIn = false,
  mainClassName,
  children,
}: SiteFrameProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground" data-slot="site-frame">
      {banner}
      <MarketingNavbar
        activeHref={activeHref}
        links={links}
        productName={productName}
        signInHref={hideSignIn ? null : "#sign-in"}
      />
      <main className={cn("flex flex-1 flex-col", mainClassName)} data-slot="site-frame-main">
        {children}
      </main>
      <MarketingFooter company={productName} productName={productName} />
      {after}
    </div>
  );
}
