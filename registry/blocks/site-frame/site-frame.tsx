/**
 * Site frame — the navbar, the `<main>` and the footer every website page shares.
 *
 * What it shows a copier: a page template is a route, not a shell — the shell is
 * `SiteShell` (`@elabs-ai/components-ui`): skip link, a sticky header, one `<main>`
 * landmark and the footer. This frame fills those slots with the marketing navbar and
 * footer around whatever blocks the route needs. The optional `banner` slot sits above the
 * navbar (a `MarketingBanner`) and scrolls away while the navbar stays; the `after` slot
 * renders below the footer (a cookie banner, a floating CTA). `activeHref` marks the navbar
 * link for the route you are on.
 */
import type { ReactNode } from "react";
import {
  SiteShell,
  SiteShellFooter,
  SiteShellHeader,
  SiteShellMain,
} from "@elabs-ai/components-ui";
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
  /** Keep the navbar pinned while the page scrolls. @default true */
  stickyHeader?: boolean;
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
  stickyHeader = true,
  mainClassName,
  children,
}: SiteFrameProps) {
  return (
    <SiteShell>
      {banner}
      <SiteShellHeader asChild sticky={stickyHeader}>
        <MarketingNavbar
          activeHref={activeHref}
          links={links}
          productName={productName}
          signInHref={hideSignIn ? null : "#sign-in"}
        />
      </SiteShellHeader>
      <SiteShellMain className={mainClassName}>{children}</SiteShellMain>
      <SiteShellFooter asChild>
        <MarketingFooter company={productName} productName={productName} />
      </SiteShellFooter>
      {after}
    </SiteShell>
  );
}
