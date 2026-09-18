"use client";

/**
 * Site nav (RM-093, concept §4.6 + §6). Every link is a real `<a href>` — the nav reads and
 * navigates with JavaScript off; only the family switch and the < 768px `Sheet` menu need
 * hydration. Sticky, `backdrop-blur` via `TopNav`'s surface tokens (ADR 0038, `.claude/rules/
 * home.md` "Tokens only").
 */
import {
  Button,
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
  ThemeFamilySwitch,
  TopNav,
  navigationMenuTriggerStyle,
} from "@elabs-ai/components-ui";
import { BrandLogo } from "@elabs-ai/components-icons";
import { useSiteTheme } from "../lib/theme-state";
import { shellCopy } from "../content/copy";

const NAV_LINKS = [
  { href: "/storybook/", label: shellCopy.nav.components },
  { href: "/#tour", label: shellCopy.nav.templates },
  { href: "/#agents", label: shellCopy.nav.forAgents },
  { href: "/#tokens", label: shellCopy.nav.themesLink },
] as const;

/** The compact family + mode switch bound to the site's theme state (RM-091's `SiteThemeSwitch`,
 * sized down for the nav rail — `size="sm"` has no route through that wrapper, so this reimplements
 * its two-line binding directly over `useSiteTheme`). */
function NavThemeSwitch() {
  const { family, mode, setFamily, setMode, families } = useSiteTheme();
  return (
    <ThemeFamilySwitch
      size="sm"
      families={families.map((f) => ({ id: f.id, label: f.label, swatch: f.swatches[mode] }))}
      value={family}
      onChange={setFamily}
      mode={mode}
      onModeChange={setMode}
    />
  );
}

// Text, not icon glyphs: apps/home may import react/next/motion/@vercel/analytics/@elabs-ai/*
// only (`pnpm check --rule home-imports`) — lucide-react is a package-internal dependency, not
// one the site itself may import — and a plain label reads without JS exactly as well.
function ExternalLinks() {
  return (
    <>
      <Button variant="ghost" size="sm" asChild>
        <a href={shellCopy.links.github}>{shellCopy.nav.github}</a>
      </Button>
      <Button variant="ghost" size="sm" asChild>
        <a href={shellCopy.links.npm}>{shellCopy.nav.npm}</a>
      </Button>
    </>
  );
}

export function SiteNav() {
  return (
    <>
      {/* First in DOM, per the concept's "reads with JS off": visible on focus, skips the nav. */}
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:start-4 focus-visible:top-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-background focus-visible:px-4 focus-visible:py-2 focus-ring"
      >
        {shellCopy.nav.skipToContent}
      </a>
      <TopNav
        data-slot="site-nav"
        start={
          <a href="/" className="flex items-center rounded-md focus-ring">
            <BrandLogo variant="lockup" title={shellCopy.wordmark} height={24} />
          </a>
        }
        end={
          <>
            <div className="hidden items-center gap-1 md:flex">
              <NavThemeSwitch />
              <ExternalLinks />
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  aria-label={shellCopy.nav.openMenu}
                >
                  {shellCopy.nav.menuTitle}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" data-slot="site-nav-sheet">
                <SheetTitle>{shellCopy.nav.menuTitle}</SheetTitle>
                <SheetDescription className="sr-only">{shellCopy.wordmark}</SheetDescription>
                <nav aria-label={shellCopy.nav.menuTitle} className="flex flex-col gap-1">
                  {NAV_LINKS.map((link) => (
                    <SheetClose asChild key={link.href}>
                      <a
                        href={link.href}
                        className="rounded-md px-3 py-2 text-body hover:bg-accent focus-ring"
                      >
                        {link.label}
                      </a>
                    </SheetClose>
                  ))}
                </nav>
                <div className="flex items-center gap-2 border-t pt-4">
                  <NavThemeSwitch />
                </div>
                <div className="flex items-center gap-1">
                  <ExternalLinks />
                </div>
              </SheetContent>
            </Sheet>
          </>
        }
      >
        <NavigationMenu className="hidden md:block">
          <NavigationMenuList>
            {NAV_LINKS.map((link) => (
              <NavigationMenuItem key={link.href}>
                <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                  <a href={link.href}>{link.label}</a>
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>
      </TopNav>
    </>
  );
}
