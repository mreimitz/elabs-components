// registry: app-shell — copied 2026-09-19
"use client";
/**
 * The site's frame IS the library's flagship app shell (`Layout/App Shell/Flagship`, the
 * `app-shell` registry block): a collapsible navigation rail, a flush content column under a
 * top bar, and a summoned dock on the right. Copied from the block and re-pointed at the site:
 *
 *  - the rail's groups are the catalogue (Templates, Blocks, Visualizations, one entry per
 *    package), each expanding to its families and their pages, with a filter box. An entry links
 *    to its highlights, a family links to its full listing; collapsed, every entry is an icon
 *    with a tooltip;
 *  - the top bar keeps the block's order — nav toggle, breadcrumbs, search, appearance, dock
 *    toggle — with the site's ⌘K search and the library's `ThemeSwitcher` in those seats;
 *  - the dock holds what an agent needs (install command, the routine) and the appearance dials;
 *  - `NavUser` and `NavNotifications` are left out: the site has no account and no inbox.
 *
 * As in the block, `<main>` (SidebarInset) is the scroll container, not the document, so the
 * top bar never scrolls away and the rail stays full height.
 */
import { Fragment, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChartSpline,
  Blocks,
  BookOpen,
  Bot,
  ChevronRight,
  Code,
  Component,
  FileText,
  GitBranch,
  Home,
  LayoutTemplate,
  Link2,
  Map as MapIcon,
  Megaphone,
  Palette,
  PanelLeft,
  PanelRight,
  Scale,
  Shapes,
  Rocket,
  Sparkles,
  Table2,
  Terminal,
  Workflow,
} from "lucide-react";
import { AppIcon, ServiceLogo } from "@elabs-ai/components-icons";
import { useTheme } from "@elabs-ai/components-tokens";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  CommandChip,
  IconButton,
  SideDock,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SkipLink,
  ThemeSwitcher,
  useSidebar,
} from "@elabs-ai/components-ui";
import { SearchInput } from "@elabs-ai/components-data";
import { SiteSearch } from "../../catalog/site-search";
import { SITE_SERVICE_LOGOS } from "./service-marks";
import { buildNav, type NavBranch, type NavGroup, type NavLeaf } from "../../catalog/nav-model";
import { useNavFilter } from "../../catalog/use-nav-filter";
import { HeroDials } from "../../hero/hero-dials";
import { CATALOG_NAV, branchHref, familyHref, hrefOf } from "../../../lib/catalog-nav";
import { familyOfTheme, writeThemeToUrl } from "../../../lib/theme-state";
import { catalogCopy, heroCopy, shellCopy, siteShellCopy } from "../../../content/copy";

const copy = siteShellCopy;
const NAV = buildNav(catalogCopy.sections);

type Icon = ComponentType<{ className?: string }>;
const BRANCH_ICONS: Record<string, Icon> = {
  templates: LayoutTemplate,
  blocks: Blocks,
  visualizations: ChartSpline,
  "components/ui": Component,
  "components/data": Table2,
  "components/charts": BarChart3,
  "components/ai": Bot,
  "components/flow": Workflow,
  "components/maps": MapIcon,
  "components/editor": Code,
  "components/viewer": FileText,
  "components/terminal": Terminal,
  "components/process": GitBranch,
  "components/marketing": Megaphone,
  "components/icons": Shapes,
  "components/tokens": Palette,
};

const isActive = (href: string, path: string) =>
  href === path || (href !== "/" && path.startsWith(`${href}/`));

/** One page in the rail: a single line, the full name on hover when it is cut short. */
function Leaf({ item, pathname }: { item: NavLeaf; pathname: string }) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton href={item.href} isActive={pathname === item.href} title={item.name}>
        <span>{item.name}</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}

/**
 * A family inside a branch (Visualizations → KPI Cards). Its name links to the family's own
 * listing — every page in it — and the chevron beside it unfolds those pages in the rail.
 */
function SubGroup({
  group,
  pathname,
  forceOpen,
}: {
  group: NavGroup;
  pathname: string;
  forceOpen: boolean;
}) {
  const here = pathname === group.href || group.leaves.some((item) => item.href === pathname);
  const [open, setOpen] = useState(here);
  useEffect(() => {
    if (here) setOpen(true);
  }, [here]);
  return (
    <Collapsible open={forceOpen || open} onOpenChange={setOpen} asChild>
      <SidebarMenuSubItem>
        <div className="flex items-center">
          <CollapsibleTrigger
            aria-label={copy.toggleFamily(group.label)}
            className="group/sub flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent focus-ring"
          >
            <ChevronRight
              aria-hidden="true"
              className="size-4 transition-transform duration-fast ease-standard group-data-[state=open]/sub:rotate-90"
            />
          </CollapsibleTrigger>
          <SidebarMenuSubButton
            href={group.href}
            isActive={pathname === group.href}
            title={group.label}
            className="min-w-0 flex-1 font-medium"
          >
            <span className="min-w-0 flex-1 truncate">{group.label}</span>
            <span className="text-caption text-sidebar-muted-foreground tabular-nums">
              {group.leaves.length}
            </span>
          </SidebarMenuSubButton>
        </div>
        <CollapsibleContent>
          <SidebarMenuSub className="mx-2 me-0 pe-0">
            {group.leaves.map((item) => (
              <Leaf key={item.href} item={item} pathname={pathname} />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuSubItem>
    </Collapsible>
  );
}

function Branch({
  branch,
  pathname,
  forceOpen,
}: {
  branch: NavBranch;
  pathname: string;
  forceOpen: boolean;
}) {
  const here = isActive(branch.href, pathname);
  const [open, setOpen] = useState(here);
  useEffect(() => {
    if (here) setOpen(true);
  }, [here]);
  const Icon = BRANCH_ICONS[branch.id] ?? Component;
  return (
    <Collapsible open={forceOpen || open} onOpenChange={setOpen} asChild>
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={here} tooltip={branch.label}>
          <a href={branch.href}>
            <Icon />
            <span className="capitalize">{branch.label}</span>
          </a>
        </SidebarMenuButton>
        <SidebarMenuBadge className="end-8">{branch.count}</SidebarMenuBadge>
        <CollapsibleTrigger
          aria-label={branch.label}
          className="group/trigger absolute end-1 top-1 flex size-6 items-center justify-center rounded-md text-sidebar-foreground group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent focus-ring"
        >
          <ChevronRight
            aria-hidden="true"
            className="size-4 transition-transform duration-fast ease-standard group-data-[state=open]/trigger:rotate-90"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {branch.groups.length > 1
              ? branch.groups.map((group) => (
                  <SubGroup
                    key={group.id}
                    group={group}
                    pathname={pathname}
                    forceOpen={forceOpen}
                  />
                ))
              : branch.groups[0]?.leaves.map((item) => (
                  <Leaf key={item.href} item={item} pathname={pathname} />
                ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function PlainItem({
  href,
  label,
  icon: Icon,
  pathname,
}: {
  href: string;
  label: string;
  icon: Icon;
  pathname: string;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={href === pathname} tooltip={label}>
        <a href={href}>
          <Icon />
          <span>{label}</span>
        </a>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SiteNavRail({ pathname }: { pathname: string }) {
  const [filter, setFilter] = useState("");
  const needle = filter.trim().toLowerCase();
  const branches = useNavFilter(NAV, filter);
  const sections = branches.filter((b) => !b.id.startsWith("components/"));
  const packages = branches.filter((b) => b.id.startsWith("components/"));

  // Bring the current page's row into view inside the rail's own scroll port.
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const port = rail.current?.querySelector<HTMLElement>('[data-sidebar="content"]');
    const active = port?.querySelector<HTMLElement>(
      '[data-slot="sidebar-menu-sub-button"][data-active="true"]',
    );
    if (!active || !port) return;
    const offset = active.getBoundingClientRect().top - port.getBoundingClientRect().top;
    port.scrollTop = Math.max(0, port.scrollTop + offset - port.clientHeight / 2);
  }, [pathname]);

  return (
    // `data-density="comfortable"`: the collapsed icon buttons scale with `--spacing`; under
    // `compact` they sit off-centre in the fixed icon rail (the block's own note).
    <Sidebar ref={rail} collapsible="icon" data-density="comfortable">
      <SidebarHeader className="gap-0 p-0">
        {/* The rail's top is a header band like the top bar beside it: the ONE shared height
            (`h-header`) and a bottom rule, so the two rules sit on one line in every theme
            and at every density. `SidebarHeader`'s own padding would make it content-sized. */}
        <a
          href="/"
          data-slot="sidebar-brand"
          className="flex h-header shrink-0 items-center gap-2 border-b border-sidebar-border px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 focus-ring-inset"
        >
          <AppIcon morph="auto" title={copy.product} height={22} className="shrink-0" />
          <span className="min-w-0 truncate text-meta text-sidebar-muted-foreground group-data-[collapsible=icon]:hidden">
            {copy.org}
          </span>
        </a>
        <div className="p-2 group-data-[collapsible=icon]:hidden">
          <SearchInput
            value={filter}
            onValueChange={setFilter}
            label={catalogCopy.sidebar.filter}
            placeholder={catalogCopy.sidebar.filterPlaceholder}
          />
        </div>
      </SidebarHeader>

      <nav aria-label={copy.primaryNav} className="contents">
        <SidebarContent className="min-h-0 overflow-y-auto">
          {branches.length === 0 ? (
            <p className="px-4 py-2 text-meta text-sidebar-muted-foreground">
              {catalogCopy.sidebar.empty}
            </p>
          ) : null}
          <SidebarGroup>
            <SidebarGroupLabel>{copy.groups.explore}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {needle ? null : (
                  <>
                    <PlainItem href="/" label={copy.nav.overview} icon={Home} pathname={pathname} />
                    <PlainItem
                      href="/start"
                      label={copy.nav.start}
                      icon={Rocket}
                      pathname={pathname}
                    />
                  </>
                )}
                {sections.map((branch) => (
                  <Branch
                    key={branch.id}
                    branch={branch}
                    pathname={pathname}
                    forceOpen={needle.length > 0}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          {packages.length > 0 ? (
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <a href="/components">{copy.groups.components}</a>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {packages.map((branch) => (
                    <Branch
                      key={branch.id}
                      branch={branch}
                      pathname={pathname}
                      forceOpen={needle.length > 0}
                    />
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ) : null}
          {needle ? null : (
            <SidebarGroup>
              <SidebarGroupLabel>{copy.groups.more}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <PlainItem
                    href="/agents"
                    label={copy.nav.agents}
                    icon={Sparkles}
                    pathname={pathname}
                  />
                  <PlainItem
                    href="/#themes"
                    label={copy.nav.themes}
                    icon={Palette}
                    pathname={pathname}
                  />
                  <PlainItem
                    href="/storybook/"
                    label={copy.nav.storybook}
                    icon={BookOpen}
                    pathname={pathname}
                  />
                  <PlainItem
                    href="/resources"
                    label={copy.nav.resources}
                    icon={Link2}
                    pathname={pathname}
                  />
                  <PlainItem
                    href="/attributions"
                    label={copy.nav.attributions}
                    icon={Scale}
                    pathname={pathname}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>
      </nav>
    </Sidebar>
  );
}

interface Crumb {
  href: string;
  label: string;
}

const STATIC_LABELS: Record<string, string> = {
  "/templates": catalogCopy.sections.templates,
  "/blocks": catalogCopy.sections.blocks,
  "/visualizations": catalogCopy.sections.visualizations,
  "/components": catalogCopy.sections.components,
  "/start": copy.nav.start,
  "/agents": copy.nav.agents,
  "/attributions": copy.nav.attributions,
  "/resources": copy.nav.resources,
};
const PAGE_LABELS = new Map(CATALOG_NAV.map((entry) => [hrefOf(entry), entry.name]));
const FAMILY_LABELS = new Map(CATALOG_NAV.map((entry) => [familyHref(entry), entry.group]));
/** A detail page's family, so its trail reads Section / Family / Page. */
const FAMILY_OF_PAGE = new Map(CATALOG_NAV.map((entry) => [hrefOf(entry), entry]));

function trailOf(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let href = "";
  for (const segment of segments) {
    href += `/${segment}`;
    // `/…/group/<family>`: `group` is a URL seam, not a page.
    if (segment === "group" && !PAGE_LABELS.has(href)) continue;
    // A family is a crumb only where the branch has more than one.
    const page = FAMILY_OF_PAGE.get(href);
    const branch = page ? NAV.find((b) => b.href === branchHref(page)) : undefined;
    if (page && branch && branch.groups.length > 1)
      crumbs.push({ href: familyHref(page), label: page.group });
    crumbs.push({
      href,
      label: STATIC_LABELS[href] ?? PAGE_LABELS.get(href) ?? FAMILY_LABELS.get(href) ?? segment,
    });
  }
  return crumbs;
}

function SiteTopBar({
  pathname,
  dockOpen,
  onDockOpenChange,
}: {
  pathname: string;
  dockOpen: boolean;
  onDockOpenChange: (open: boolean) => void;
}) {
  const crumbs = trailOf(pathname);
  // The provider's own toggle, not the desktop `open` state: below the mobile breakpoint the rail
  // is a Sheet with its own `openMobile`, and only `toggleSidebar` flips the right one.
  const { toggleSidebar, isMobile, open, openMobile } = useSidebar();
  const navOpen = isMobile ? openMobile : open;
  return (
    <header
      data-slot="app-top-bar"
      className="flex h-header shrink-0 items-center gap-2 border-b border-border-strong px-3"
    >
      <IconButton
        label={navOpen ? copy.collapseNav : copy.expandNav}
        icon={<PanelLeft />}
        aria-expanded={navOpen}
        onClick={toggleSidebar}
        className="pointer-coarse:size-11"
      />
      {crumbs.length >= 1 ? (
        <Breadcrumb className="min-w-0 flex-1">
          <BreadcrumbList className="flex-nowrap">
            {crumbs.map((crumb, index) => {
              const last = index === crumbs.length - 1;
              return (
                <Fragment key={crumb.href}>
                  <BreadcrumbItem className="min-w-0">
                    {last ? (
                      <BreadcrumbPage className="truncate capitalize">{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={crumb.href} className="truncate capitalize">
                        {crumb.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {last ? null : <BreadcrumbSeparator />}
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : (
        <span
          data-slot="app-top-bar-title"
          className="min-w-0 flex-1 truncate text-body font-semibold text-foreground"
        >
          {copy.nav.overview}
        </span>
      )}
      <div className="flex shrink-0 items-center gap-1">
        <SiteSearch />
        {(
          [
            { name: "github", href: shellCopy.links.github, label: copy.nav.github },
            { name: "npm", href: shellCopy.links.npm, label: copy.nav.npm },
          ] as const
        ).map((link) => (
          <Button
            key={link.name}
            asChild
            variant="ghost"
            size="icon"
            className="hidden sm:inline-flex pointer-coarse:size-11"
          >
            <a href={link.href} aria-label={link.label}>
              <ServiceLogo
                name={link.name}
                logos={SITE_SERVICE_LOGOS}
                variant="mono"
                size={16}
                decorative
              />
            </a>
          </Button>
        ))}
        <ThemeSwitcher variant="ghost" className="hidden sm:inline-flex" />
        <IconButton
          label={dockOpen ? copy.hideDock : copy.showDock}
          icon={<PanelRight />}
          aria-expanded={dockOpen}
          onClick={() => onDockOpenChange(!dockOpen)}
          className="pointer-coarse:size-11"
        />
      </div>
    </header>
  );
}

/**
 * Below the rail's breakpoint the primary navigation is a Sheet that only JavaScript can open —
 * so with JavaScript off, a phone would have no way from one section to the next. The server
 * renders the sections once more inside `<noscript>`, hidden wherever the rail is visible; a
 * browser that runs the script never shows it.
 */
function NoScriptNav() {
  const links = [
    { href: "/", label: copy.nav.overview },
    { href: "/start", label: copy.nav.start },
    ...NAV.map((branch) => ({ href: branch.href, label: branch.label })),
    { href: "/agents", label: copy.nav.agents },
    { href: "/resources", label: copy.nav.resources },
  ];
  return (
    <noscript>
      <nav
        aria-label={copy.primaryNav}
        data-slot="app-noscript-nav"
        className="flex flex-wrap gap-x-4 gap-y-1 border-b border-border px-3 py-2 text-meta md:hidden"
      >
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="text-foreground underline-offset-4 hover:underline focus-ring"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </noscript>
  );
}

export interface SiteShellProps {
  children: ReactNode;
  /** Per-host install commands for the dock, resolved on the server from install.json. */
  hosts: { id: string; label: string; command: string }[];
  /** The agent's routine (`info → search → docs → build → audit`), from cli.json. */
  routine: string;
}

export function SiteShell({ children, hosts, routine }: SiteShellProps) {
  const pathname = usePathname() ?? "/";
  const [navOpen, setNavOpen] = useState(true);
  const [dockOpen, setDockOpen] = useState(false);
  const port = useRef<HTMLDivElement>(null);
  const chip = heroCopy.chip;

  // `?theme=<family>&mode=<mode>` stays the shareable source of truth whoever switched the
  // theme — the top bar's ThemeSwitcher, the dock's, or a theme card.
  const { theme } = useTheme();
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const current = familyOfTheme(theme);
    if (current) writeThemeToUrl(current.family, current.mode);
  }, [theme]);

  // `<main>` scrolls, not the document: a new route starts at the top, and an in-page `#hash`
  // (the rail's Themes link, a TOC entry) is honoured inside the port.
  useEffect(() => {
    const el = port.current;
    if (!el) return;
    const hash = window.location.hash.slice(1);
    const target = hash ? document.getElementById(hash) : null;
    if (target) target.scrollIntoView({ block: "start" });
    else el.scrollTop = 0;
  }, [pathname]);

  return (
    <SidebarProvider
      open={navOpen}
      onOpenChange={setNavOpen}
      className="h-svh"
      data-nav={navOpen ? "expanded" : "collapsed"}
      data-dock={dockOpen ? "open" : "closed"}
    >
      <SkipLink />
      <SiteNavRail pathname={pathname} />
      <SidebarInset id="main-content" tabIndex={-1} className="min-w-0">
        <SiteTopBar pathname={pathname} dockOpen={dockOpen} onDockOpenChange={setDockOpen} />
        <NoScriptNav />
        <div
          ref={port}
          data-slot="app-shell-content"
          tabIndex={0}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth focus-ring-inset"
        >
          {children}
        </div>
      </SidebarInset>
      <SideDock
        title={copy.dock.title}
        description={copy.dock.description}
        open={dockOpen}
        onOpenChange={setDockOpen}
      >
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h3 className="text-body font-semibold text-foreground">{copy.dock.connect}</h3>
            <CommandChip
              aria-label={chip.label}
              hosts={hosts}
              labels={{
                copy: chip.copy,
                copied: chip.copied,
                selectFallback: chip.selectFallback,
                chooseHost: chip.chooseHost,
                menuLabel: chip.menuLabel,
              }}
              className="w-full"
            />
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-body font-semibold text-foreground">{copy.dock.routine}</h3>
            <code className="text-code text-muted-foreground">{routine}</code>
            <Button asChild variant="outline" size="sm" className="self-start">
              <a href="/agents">{copy.dock.more}</a>
            </Button>
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-body font-semibold text-foreground">{copy.dock.appearance}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <ThemeSwitcher />
              <HeroDials />
            </div>
          </section>
        </div>
      </SideDock>
    </SidebarProvider>
  );
}
