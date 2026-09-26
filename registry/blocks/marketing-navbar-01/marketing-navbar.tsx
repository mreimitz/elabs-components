"use client";

import { useState, type HTMLAttributes } from "react";
import { Menu } from "lucide-react";
import { AppIcon } from "@elabs-ai/components-icons";
import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  ThemeSwitcher,
  cn,
} from "@elabs-ai/components-ui";

export interface NavbarLink {
  label: string;
  href: string;
}

export interface MarketingNavbarProps extends HTMLAttributes<HTMLElement> {
  productName?: string;
  links?: NavbarLink[];
  /** The route the visitor is on — marked with `aria-current`, not colour alone. */
  activeHref?: string;
  /** Pass `null` for a navbar with the one call to action and no sign-in link. */
  signInHref?: string | null;
  ctaLabel?: string;
  ctaHref?: string;
}

const DEFAULT_LINKS: NavbarLink[] = [
  { label: "Product", href: "#product" },
  { label: "Solutions", href: "#solutions" },
  { label: "Pricing", href: "#pricing" },
  { label: "Customers", href: "#customers" },
  { label: "Docs", href: "#docs" },
];

/**
 * Site navigation — the links inline when there is room, in a sheet when there is not. Laid
 * out by its container, so it behaves the same in a preview pane as on a page.
 */
export function MarketingNavbar({
  productName = "Acme",
  links = DEFAULT_LINKS,
  activeHref,
  signInHref = "#login",
  ctaLabel = "Start free",
  ctaHref = "#register",
  className,
  ...props
}: MarketingNavbarProps) {
  const [open, setOpen] = useState(false);
  return (
    <header
      className={cn(
        "@container h-header w-full border-b border-border-strong bg-background",
        className,
      )}
      data-slot="marketing-navbar"
      {...props}
    >
      <div className="mx-auto flex h-full w-full max-w-7xl items-center gap-6 px-4">
        <a
          aria-label={`${productName} home`}
          className="shrink-0 rounded-sm focus-ring"
          href="#top"
        >
          <AppIcon height={24} title={productName} />
        </a>
        <nav aria-label="Main" className="hidden min-w-0 flex-1 @3xl:block">
          <ul className="flex items-center gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  aria-current={link.href === activeHref ? "page" : undefined}
                  className="rounded-md px-3 py-2 text-body text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-ring aria-[current=page]:font-semibold aria-[current=page]:text-foreground"
                  href={link.href}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <ThemeSwitcher className="hidden @xl:inline-flex" variant="ghost" />
          {signInHref ? (
            <Button asChild className="hidden @xl:inline-flex" variant="ghost">
              <a href={signInHref}>Sign in</a>
            </Button>
          ) : null}
          <Button asChild>
            <a href={ctaHref}>{ctaLabel}</a>
          </Button>
          <Sheet onOpenChange={setOpen} open={open}>
            <SheetTrigger asChild>
              <Button
                aria-label="Open the menu"
                className="@3xl:hidden"
                size="icon"
                variant="outline"
              >
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>{productName}</SheetTitle>
                <SheetDescription>Where do you want to go?</SheetDescription>
              </SheetHeader>
              <nav aria-label="Main, in the menu" className="flex flex-col gap-1 px-4">
                {links.map((link) => (
                  <a
                    aria-current={link.href === activeHref ? "page" : undefined}
                    className="rounded-md px-3 py-2.5 text-body hover:bg-accent focus-ring aria-[current=page]:font-semibold"
                    href={link.href}
                    key={link.href}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
                {signInHref ? (
                  <a
                    className="rounded-md px-3 py-2.5 text-body hover:bg-accent focus-ring"
                    href={signInHref}
                    onClick={() => setOpen(false)}
                  >
                    Sign in
                  </a>
                ) : null}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
