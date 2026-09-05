/**
 * Dashboard template — the canonical full-screen dashboard composition
 * (app-shell + MetricGrid + MetricCard). This story is the single source of
 * truth: `pnpm gen:templates` derives the consumer template source
 * (`docs/playbooks/templates/dashboard.tsx`) from it.
 * Verify across every theme with globals=theme:<slug>.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  MetricCard,
} from "@elabs-ai/components-ui";
import { AppIcon } from "@elabs-ai/components-icons";
import { MetricGrid } from "./metric-grid/metric-grid";
import { ChartCard } from "./chart-card/chart-card";
import { BarChart3, Home, Settings, Users } from "lucide-react";

const nav = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "settings", label: "Settings", icon: Settings },
];

const metrics = [
  {
    label: "Monthly Revenue",
    value: "$124,500",
    delta: "+8.2%",
    deltaDirection: "up" as const,
    description: "vs. prior month",
  },
  {
    label: "Active Users",
    value: "3,842",
    delta: "+3.1%",
    deltaDirection: "up" as const,
    description: "30-day active",
  },
  {
    label: "Avg. Session",
    value: "4m 32s",
    delta: "-0.4%",
    deltaDirection: "down" as const,
    positiveIsGood: false,
    description: "last 7 days",
  },
  {
    label: "Open Issues",
    value: "12",
    delta: "-25%",
    deltaDirection: "down" as const,
    positiveIsGood: false,
    description: "vs. last week",
  },
];

/**
 * A simple tokenized bar chart used as a placeholder child — no charting lib needed.
 *
 * **Every bar needs a definite-height ancestor to size against.** A percentage
 * height resolves against the parent's height, and a flex item is only given one
 * when the cross-axis stretches it. The first version of this put the columns in
 * an `items-end` row, which sizes each column to its CONTENT instead — so
 * `height: 55%` had nothing to resolve against, computed to 0, and both chart
 * cards on this screen rendered completely blank in every theme.
 *
 * The fix keeps the columns stretched (`items-stretch` + `h-full`) and moves the
 * bottom-anchoring down one level, onto a `flex-1` track that the flex algorithm
 * gives a definite height. The bar sizes against that track, so its percentage is
 * measured against the plot area alone and the label below never eats into it.
 */
function PlaceholderBars({ bars }: { bars: { label: string; pct: number; colorClass: string }[] }) {
  return (
    <div className="flex h-full items-stretch gap-2 pb-4">
      {bars.map(({ label, pct, colorClass }) => (
        <div key={label} className="flex h-full flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end">
            <div
              role="img"
              className={`w-full rounded-sm ${colorClass}`}
              style={{ height: `${pct}%` }}
              aria-label={`${label}: ${pct}%`}
            />
          </div>
          <span className="text-meta text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}

const revenueBars = [
  { label: "Jan", pct: 55, colorClass: "bg-chart-1" },
  { label: "Feb", pct: 72, colorClass: "bg-chart-1" },
  { label: "Mar", pct: 60, colorClass: "bg-chart-1" },
  { label: "Apr", pct: 85, colorClass: "bg-chart-1" },
  { label: "May", pct: 68, colorClass: "bg-chart-1" },
  { label: "Jun", pct: 90, colorClass: "bg-chart-1" },
];

const sessionBars = [
  { label: "Mon", pct: 40, colorClass: "bg-chart-2" },
  { label: "Tue", pct: 65, colorClass: "bg-chart-2" },
  { label: "Wed", pct: 80, colorClass: "bg-chart-2" },
  { label: "Thu", pct: 55, colorClass: "bg-chart-2" },
  { label: "Fri", pct: 75, colorClass: "bg-chart-2" },
];

function DashboardTemplate() {
  const [active, setActive] = useState("overview");
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="px-3 py-2">
          <div className="flex items-center gap-2">
            <AppIcon height={20} aria-hidden />
            <span className="truncate font-semibold group-data-[collapsible=icon]:hidden">
              Analytics
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((n) => (
                  <SidebarMenuItem key={n.id}>
                    <SidebarMenuButton
                      isActive={active === n.id}
                      tooltip={n.label}
                      onClick={() => setActive(n.id)}
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
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <h1 className="text-body font-medium capitalize">{active}</h1>
        </header>
        <main className="flex flex-col gap-6 p-6">
          <section aria-label="Key metrics">
            <MetricGrid columns={4}>
              {metrics.map((m) => (
                <MetricCard
                  key={m.label}
                  label={m.label}
                  value={m.value}
                  delta={m.delta}
                  deltaDirection={m.deltaDirection}
                  positiveIsGood={m.positiveIsGood ?? true}
                  description={m.description}
                />
              ))}
            </MetricGrid>
          </section>
          <section aria-label="Chart area" className="grid gap-4 md:grid-cols-2">
            <ChartCard
              title="Revenue is up 8% quarter over quarter"
              description="Monthly revenue, Jan – Jun 2025"
              source="Source: Internal analytics, updated daily"
            >
              <PlaceholderBars bars={revenueBars} />
            </ChartCard>
            <ChartCard
              title="Sessions are steady week over week"
              description="Active sessions, last 5 weekdays"
              source="Source: Internal analytics, updated daily"
            >
              <PlaceholderBars bars={sessionBars} />
            </ChartCard>
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

const meta = {
  title: "Patterns/Templates/Dashboard",
  parameters: { layout: "fullscreen" },
  tags: ["autodocs"],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <DashboardTemplate /> };
