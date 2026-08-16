/**
 * Enterprise Admin Console — the baseline-complete archetype-B shell.
 *
 * This scenario exists to be COPIED as the starting point for a professional
 * brand-ui app. Unlike `Layout/App Shell/Basic` (which shows the bare AppShell),
 * it wires the *entire* mandatory enterprise baseline in one screen so an
 * end-user (or the new-app scaffolder) starts on-baseline instead of bolting the
 * chrome on later:
 *
 *   1a. Collapsible Qlik app icon — the standard <AppIcon> (lockup ↔ mark morph,
 *       driven by the sidebar collapsed state).
 *   1b. ThemeProvider wraps the screen (the story decorator below — in a real
 *       app it sits at the root); the TopNav `end` slot exposes a bare
 *       <ThemeSwitcher /> (System / Qlik Bright / Qlik Dark).
 *   1c. Settings as a modal Dialog (Appearance section hosts the switcher).
 *   1d. Sonner <Toaster /> mounted once; feedback via toast().
 *   1e. Right-side detail panel (Sheet, side="right") that preserves the work
 *       surface instead of a page jump.
 *
 * Compose-only: every element is an existing @qlik-coe-emea/qlabs-components-* primitive, semantic
 * tokens only, and it must read in qlik-bright AND qlik-dark. Verify across all
 * three themes with globals=theme:<slug>.
 *
 * Home: this is a cross-package COMPOSITION demo (@qlik-coe-emea/qlabs-components-ui + @qlik-coe-emea/qlabs-components-icons), so
 * it lives in apps/docs/stories — no single library package may own it under the
 * one-way dep rule (apps compose siblings freely). See .storybook/main.ts.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ThemeProvider } from "@qlik-coe-emea/qlabs-components-tokens";
import { AppIcon } from "@qlik-coe-emea/qlabs-components-icons";
import {
  Bell,
  Cable,
  LayoutDashboard,
  ListFilter,
  LogOut,
  ScrollText,
  Settings,
  Workflow,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Descriptions,
  DescriptionsItem,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FilterChip,
  Label,
  MetricCard,
  ResultCount,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  StatusBadge,
  Switch,
  ThemeSwitcher,
  Toaster,
  ViewToolbar,
  ViewToolbarFilters,
  toast,
} from "@qlik-coe-emea/qlabs-components-ui";

/* -------------------------------------------------------------------------- */
/*  Fixtures — a small "Integrations admin" object model                       */
/* -------------------------------------------------------------------------- */

const NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "connections", label: "Connections", icon: Cable },
  { id: "pipelines", label: "Pipelines", icon: Workflow },
  { id: "audit", label: "Audit log", icon: ScrollText },
] as const;

type ConnStatus = "active" | "paused" | "error";

interface Connection {
  id: string;
  name: string;
  kind: string;
  status: ConnStatus;
  rows: number;
  owner: string;
  lastRun: string;
}

const CONNECTIONS: Connection[] = [
  {
    id: "sf",
    name: "Salesforce",
    kind: "CRM",
    status: "active",
    rows: 1_204_882,
    owner: "Avery Rao",
    lastRun: "2 min ago",
  },
  {
    id: "pg",
    name: "Postgres — prod",
    kind: "Database",
    status: "active",
    rows: 8_540_113,
    owner: "Jordan Lee",
    lastRun: "6 min ago",
  },
  {
    id: "ga",
    name: "Google Analytics",
    kind: "Marketing",
    status: "paused",
    rows: 96_540,
    owner: "Avery Rao",
    lastRun: "3 d ago",
  },
  {
    id: "feed",
    name: "Partner feed",
    kind: "Flat file",
    status: "error",
    rows: 0,
    owner: "Sam Cole",
    lastRun: "1 d ago",
  },
];

const STATUS_VARIANT: Record<ConnStatus, "success" | "secondary" | "destructive"> = {
  active: "success",
  paused: "secondary",
  error: "destructive",
};

/* -------------------------------------------------------------------------- */
/*  1a. Sidebar — collapsing Qlik identity + primary view nav + account         */
/* -------------------------------------------------------------------------- */

function ConsoleSidebar({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Qlik Integrations" asChild>
              <a href="#overview" aria-label="Qlik Integrations — home">
                {/* The standard app icon: full lockup, morphs to the Q mark on collapse. */}
                <AppIcon height={20} aria-hidden />
                <span className="grid flex-1 text-start leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate text-body font-semibold">Integrations</span>
                  <span className="truncate text-meta text-muted-foreground">Admin console</span>
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((n) => (
                <SidebarMenuItem key={n.id}>
                  <SidebarMenuButton
                    isActive={active === n.id}
                    tooltip={n.label}
                    onClick={() => onSelect(n.id)}
                  >
                    <n.icon aria-hidden="true" />
                    <span>{n.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip="Account">
                  <Avatar className="size-7 rounded-md">
                    <AvatarFallback className="rounded-md text-meta">AR</AvatarFallback>
                  </Avatar>
                  <span className="grid flex-1 text-start leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate text-body font-medium">Avery Rao</span>
                    <span className="truncate text-meta text-muted-foreground">avery@acme.co</span>
                  </span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-48">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuItem>
                  <Settings className="me-2 size-4" aria-hidden="true" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <LogOut className="me-2 size-4" aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

/* -------------------------------------------------------------------------- */
/*  1c. Settings — modal Dialog with an Appearance section                      */
/* -------------------------------------------------------------------------- */

function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Device-level preferences for this console.</DialogDescription>
        </DialogHeader>

        <section aria-label="Appearance" className="space-y-2">
          <h3 className="text-body font-semibold text-foreground">Appearance</h3>
          <div className="flex items-center justify-between gap-4">
            <Label className="text-body text-muted-foreground">Theme</Label>
            <ThemeSwitcher />
          </div>
        </section>

        <Separator />

        <section aria-label="Notifications" className="space-y-3">
          <h3 className="text-body font-semibold text-foreground">Notifications</h3>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="set-incidents" className="text-body text-muted-foreground">
              Alert me on pipeline failures
            </Label>
            <Switch id="set-incidents" defaultChecked />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="set-digest" className="text-body text-muted-foreground">
              Weekly digest email
            </Label>
            <Switch id="set-digest" />
          </div>
        </section>

        <DialogFooterRow onSave={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function DialogFooterRow({ onSave }: { onSave: () => void }) {
  return (
    <div className="mt-2 flex justify-end gap-2">
      <Button
        size="sm"
        onClick={() => {
          onSave();
          toast.success("Settings saved");
        }}
      >
        Save changes
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  1e. Detail panel — right Sheet that preserves the list                      */
/* -------------------------------------------------------------------------- */

function ConnectionDetailSheet({
  connection,
  onOpenChange,
}: {
  connection: Connection | null;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={connection !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {connection ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {connection.name}
                <Badge variant={STATUS_VARIANT[connection.status]}>{connection.status}</Badge>
              </SheetTitle>
              <SheetDescription>
                {connection.kind} connection · owned by {connection.owner}
              </SheetDescription>
            </SheetHeader>

            <div className="px-4">
              <Descriptions columns={1} layout="vertical">
                <DescriptionsItem label="Rows synced" numeric>
                  {connection.rows.toLocaleString()}
                </DescriptionsItem>
                <DescriptionsItem label="Last run">{connection.lastRun}</DescriptionsItem>
                <DescriptionsItem label="Owner">{connection.owner}</DescriptionsItem>
                <DescriptionsItem label="Connection ID">{connection.id}</DescriptionsItem>
              </Descriptions>
            </div>

            <SheetFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.success(`Re-sync queued for ${connection.name}`)}
              >
                Re-sync now
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main views                                                                  */
/* -------------------------------------------------------------------------- */

/** Sentence-case status text, so a chip reads "Status: Paused", not "Status: paused". */
const STATUS_TEXT: Record<ConnStatus, string> = {
  active: "Active",
  paused: "Paused",
  error: "Error",
};

function OverviewView({ onInspect }: { onInspect: (c: Connection) => void }) {
  const active = CONNECTIONS.filter((c) => c.status === "active").length;
  // The one active-filter slice this screen supports. The picker lives in the
  // toolbar's `actions`; what it produces shows up on the left as a FilterChip
  // (see Docs/View Toolbar Contract, R2 + R3).
  const [statusFilter, setStatusFilter] = useState<ConnStatus | null>(null);
  const visible = statusFilter ? CONNECTIONS.filter((c) => c.status === statusFilter) : CONNECTIONS;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          emphasis="headline"
          label="Connections"
          value={String(CONNECTIONS.length)}
          description={`${active} active`}
        />
        <MetricCard
          label="Rows synced (24h)"
          value="9.8M"
          delta="4.2%"
          deltaDirection="up"
          description="vs prior day"
        />
        <MetricCard
          label="Failed runs"
          value="1"
          delta="1"
          deltaDirection="up"
          description="needs attention"
        />
        <MetricCard
          label="Avg latency"
          value="1.4s"
          delta="0.2s"
          deltaDirection="down"
          description="p95 sync time"
        />
      </div>

      {/*
       * The status/filters/actions row, as the ONE named grammar (#331) instead
       * of a bespoke section header. This replaced a hand-rolled
       * `<span className="text-meta">{n} total</span>` — one of the five
       * result-count idioms the contract exists to collapse — with `ResultCount`,
       * which tells the truth ("2 of 4") once a filter is active.
       */}
      <div className="space-y-3">
        <ViewToolbar
          info="Every data connection in this tenant. Select one to inspect its recent runs and owner."
          actions={
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ListFilter aria-hidden="true" />
                    Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(["active", "paused", "error"] as const).map((s) => (
                    <DropdownMenuItem key={s} onSelect={() => setStatusFilter(s)}>
                      {STATUS_TEXT[s]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={() => toast.success("Export queued")}>
                Export
              </Button>
            </>
          }
        >
          <h2 className="text-body font-semibold text-foreground">Connections</h2>
          {statusFilter ? (
            <ViewToolbarFilters onClearAll={() => setStatusFilter(null)}>
              <FilterChip
                label={`Status: ${STATUS_TEXT[statusFilter]}`}
                onRemove={() => setStatusFilter(null)}
              />
            </ViewToolbarFilters>
          ) : null}
          <ResultCount count={visible.length} total={statusFilter ? CONNECTIONS.length : undefined}>
            connections
          </ResultCount>
        </ViewToolbar>

        <section aria-label="Connections" className="rounded-xl border bg-card">
          <ul className="divide-y">
            {visible.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onInspect(c)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-foreground">
                      {c.name}
                    </span>
                    <span className="block truncate text-meta text-muted-foreground">{c.kind}</span>
                  </span>
                  <span className="hidden tabular-nums text-meta text-muted-foreground sm:block">
                    {c.rows.toLocaleString()} rows
                  </span>
                  <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function PlaceholderView({ label }: { label: string }) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <h2 className="text-body font-semibold text-foreground">{label}</h2>
      <p className="mt-1 text-body text-muted-foreground">
        This view is a placeholder in the baseline scenario. Swap in your real {label.toLowerCase()}{" "}
        surface (a DataTable from <code>@qlik-coe-emea/qlabs-components-data</code>, a canvas from{" "}
        <code>@qlik-coe-emea/qlabs-components-flow</code>, …).
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  The console                                                                 */
/* -------------------------------------------------------------------------- */

function AdminConsole({ defaultSidebarOpen = true }: { defaultSidebarOpen?: boolean }) {
  const [active, setActive] = useState<string>("overview");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selected, setSelected] = useState<Connection | null>(null);

  const activeLabel = NAV.find((n) => n.id === active)?.label ?? "Overview";

  return (
    <SidebarProvider defaultOpen={defaultSidebarOpen}>
      <ConsoleSidebar active={active} onSelect={setActive} />

      <SidebarInset className="flex min-w-0 flex-col">
        {/* TopNav: start = trigger + breadcrumb ("where am I"); end = theme + settings + action. */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-surface-elevated/80 px-3 backdrop-blur">
          <SidebarTrigger className="-ms-1" />
          <Separator orientation="vertical" className="me-1 h-5" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden sm:flex">
                <BreadcrumbLink href="#overview">Integrations</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{activeLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="ms-auto flex items-center gap-1.5">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="size-4" aria-hidden="true" />
            </Button>
            <ThemeSwitcher />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="size-4" aria-hidden="true" />
            </Button>
            <Button size="sm" onClick={() => toast.success("Connection wizard opened")}>
              New connection
            </Button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          {active === "overview" ? (
            <OverviewView onInspect={setSelected} />
          ) : active === "audit" ? (
            <AuditView />
          ) : (
            <PlaceholderView label={activeLabel} />
          )}
        </main>
      </SidebarInset>

      {/* 1c · 1d · 1e — the mandatory global overlays, mounted once. */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ConnectionDetailSheet connection={selected} onOpenChange={(v) => !v && setSelected(null)} />
      <Toaster />
    </SidebarProvider>
  );
}

/** A second view so the StatusBadge execution-status vocabulary is also shown. */
function AuditView() {
  const events = [
    { id: "1", status: "complete" as const, text: "Salesforce sync finished", when: "2 min ago" },
    { id: "2", status: "running" as const, text: "Postgres — prod sync in progress", when: "now" },
    {
      id: "3",
      status: "failed" as const,
      text: "Partner feed sync failed (timeout)",
      when: "1 d ago",
    },
    {
      id: "4",
      status: "skipped" as const,
      text: "Google Analytics sync skipped (paused)",
      when: "3 d ago",
    },
  ];
  return (
    <section aria-label="Audit log" className="rounded-xl border bg-card">
      <ul className="divide-y">
        {events.map((e) => (
          <li key={e.id} className="flex items-center gap-3 px-4 py-3">
            <StatusBadge status={e.status} />
            <span className="min-w-0 flex-1 truncate text-body text-foreground">{e.text}</span>
            <span className="shrink-0 text-meta text-muted-foreground">{e.when}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stories                                                                      */
/* -------------------------------------------------------------------------- */

const meta = {
  title: "Patterns/Templates/Enterprise Admin Console",
  component: AdminConsole,
  // <ThemeSwitcher /> reads the @qlik-coe-emea/qlabs-components-tokens React context, so the screen needs
  // a real <ThemeProvider> (the global decorator only sets the data-theme
  // attribute). In a consuming app this provider sits at the root.
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The baseline-complete archetype-B console — the recommended starting point for a professional brand-ui app. It wires the entire mandatory enterprise baseline in one screen: a collapsible Qlik app icon (lockup ↔ mark), a primary view sidebar with breadcrumb, a TopNav `end` slot with <ThemeSwitcher /> (System / Qlik Bright / Qlik Dark), a Settings modal whose Appearance section hosts the switcher, a Sonner <Toaster /> mounted once, and a right-side Sheet detail panel that preserves the work surface. Compose-only from @qlik-coe-emea/qlabs-components-* primitives; semantic tokens only; reads in all three themes.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AdminConsole>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The full baseline-complete console. */
export const Default: Story = {};

/** Same console with the primary navigation collapsed to the icon rail. */
export const CollapsedNav: Story = { args: { defaultSidebarOpen: false } };
