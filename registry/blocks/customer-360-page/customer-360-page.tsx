/**
 * Customer 360 — one account, everything the team needs before they pick up the phone.
 *
 * What it shows a copier: a record header that answers "who, how much, how healthy, when is
 * the renewal" before any scrolling; a health score that EXPLAINS itself (the
 * `score-explanation-01` block, fed this account's signals); usage against the contract as
 * a `LineChart` with the commitment as a labelled rule; the account's shape against its
 * peers as a `RadarChart`; next actions that can be completed in place; and the people, with
 * the gap in the relationship called out instead of hidden in a list.
 */
"use client";

import { useState } from "react";
import {
  Building2,
  CalendarClock,
  Check,
  Contact,
  FileText,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Phone,
} from "lucide-react";
import {
  type ChartAnalytic,
  ChartCard,
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  MetricCard,
  MetricGrid,
  RadarArea,
  RadarAxis,
  RadarChart,
  RadarGrid,
  RadarLabels,
  ReferenceLine,
  XAxis,
  YAxis,
} from "@elabs-ai/components-charts";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Meter,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Timeline,
  Toaster,
  toast,
} from "@elabs-ai/components-ui";
import { ScoreExplanation } from "@/components/score-explanation-01/score-explanation";
import { WorkspaceAssistant } from "@/components/workspace-shell/workspace-assistant";
import {
  WorkspaceShell,
  type WorkspaceNavGroup,
} from "@/components/workspace-shell/workspace-shell";
import {
  account,
  accountEvents,
  contacts,
  healthMetrics,
  healthProfiles,
  healthSignals,
  nextActions,
  shipmentWeeks,
  type AccountContact,
} from "./data/account";

const NAV: WorkspaceNavGroup[] = [
  {
    label: "Customers",
    items: [
      { id: "home", label: "Home", href: "#home", icon: LayoutDashboard },
      { id: "accounts", label: "Accounts", href: "#accounts", icon: Building2 },
      { id: "people", label: "People", href: "#people", icon: Contact },
      { id: "renewals", label: "Renewals", href: "#renewals", icon: CalendarClock, badge: "7" },
    ],
  },
  {
    label: "Work",
    items: [
      { id: "deals", label: "Deals", href: "#deals", icon: Handshake },
      { id: "tickets", label: "Tickets", href: "#tickets", icon: LifeBuoy, badge: "3" },
      { id: "documents", label: "Documents", href: "#documents", icon: FileText },
    ],
  },
];

const STANCE_BADGE: Record<AccountContact["stance"], "success" | "info" | "secondary" | "warning"> =
  {
    champion: "success",
    supporter: "info",
    neutral: "secondary",
    new: "warning",
  };

/** The shipments chart's analytic: the linear trend, against the commitment rule. */
const SHIPMENTS_ANALYTICS: ChartAnalytic[] = [
  { kind: "trend", model: "linear", label: "Trend", id: "shipments-trend" },
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

export interface Customer360PageProps {
  /** `"container"` renders the whole app inside a box you give a height. */
  frame?: "viewport" | "container";
  locale?: string;
}

export default function Customer360Page({
  frame = "viewport",
  locale = "en-US",
}: Customer360PageProps) {
  const [done, setDone] = useState<string[]>([]);
  const number = new Intl.NumberFormat(locale);
  const over = Math.round(
    ((account.actualShipments - account.committedShipments) / account.committedShipments) * 100,
  );
  const weeksAbove = shipmentWeeks.filter((week) => week.shipments > week.commitment).length;
  const openActions = nextActions.filter((action) => !done.includes(action.id));

  return (
    <>
      <WorkspaceShell
        activeId="accounts"
        dock={{
          title: "Account brief",
          description: "Written from this account's usage, tickets and meetings.",
          showLabel: "Show the account brief",
          hideLabel: "Hide the account brief",
          defaultWidth: 380,
          children: (
            <WorkspaceAssistant
              brief={[
                {
                  title: "Healthy, with one soft spot",
                  body: "Volume and payments are well above peers; support is 18 points below them because of two old tickets.",
                },
                {
                  title: `Renewal in ${account.daysToRenewal} days`,
                  body: "The COO asked for a carbon report per lane. It is the opening for a three-year term.",
                },
              ]}
              prompts={[
                {
                  prompt: "What should I say to Tomas on the first call?",
                  answer:
                    "Lead with what his team already gets: clearance time fell from **31 to 19 hours** after the customs module went live in August. Then ask what he wants from Depot 2 — the label-printing ticket is his team's daily pain, and a fix date from you would land well.",
                },
                {
                  prompt: "Is there expansion room?",
                  answer:
                    "Yes. They ship **16% above commitment** and pay overage on it. Moving the commitment to 4,900 a month at the current rate card saves them about 6% and adds roughly $140k ARR. The returns module is the other gap: they run it on spreadsheets today.",
                },
              ]}
            />
          ),
        }}
        frame={frame}
        nav={NAV}
        orgName="Acme Logistics"
        productName="Customers"
        trail={[
          { href: "#accounts", label: "Accounts" },
          { href: "#northwind", label: account.name },
        ]}
        user={{ name: account.owner, email: "ava@acme-logistics.example" }}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          {/* Record header: who, how much, how healthy, when — before any scrolling. */}
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar className="size-14 rounded-lg">
                <AvatarFallback className="rounded-lg text-subtitle font-semibold">
                  {account.initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-title font-semibold">{account.name}</h1>
                  <Badge variant="info">{account.tier}</Badge>
                  <Badge variant="outline">Customer since {account.customerSince}</Badge>
                </div>
                <p className="text-body text-muted-foreground">
                  {account.industry} · {account.region} · Owner {account.owner} · Success{" "}
                  {account.successManager}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => toast.success("Call logged")} variant="outline">
                <Phone aria-hidden="true" />
                Log a call
              </Button>
              <Button onClick={() => toast.success("Draft opened in your mail client")}>
                <Mail aria-hidden="true" />
                Email the team
              </Button>
            </div>
          </header>

          <MetricGrid columns={4}>
            <MetricCard
              delta={account.arrChange}
              deltaDirection="up"
              description="vs. a year ago"
              label="Annual recurring revenue"
              value={`$${number.format(account.arr)}k`}
            />
            <MetricCard
              description={`${number.format(account.actualShipments)} of ${number.format(account.committedShipments)} committed`}
              label="Shipments last month"
              value={`${over}% over`}
              visual={
                <Meter
                  aria-label={`${over}% above the monthly commitment`}
                  marker={(account.committedShipments / account.actualShipments) * 100}
                  markerLabel="commitment"
                  size="sm"
                  value={100}
                />
              }
            />
            <MetricCard
              delta={account.npsChange}
              deltaDirection="up"
              description="vs. last survey"
              label="Net promoter score"
              value={String(account.nps)}
            />
            <MetricCard
              description={`Renews ${account.renewal}`}
              label="Days to renewal"
              value={String(account.daysToRenewal)}
            />
          </MetricGrid>

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="people">People ({contacts.length})</TabsTrigger>
            </TabsList>

            <TabsContent className="flex flex-col gap-6" value="overview">
              <div className="grid grid-cols-1 gap-6 @5xl:grid-cols-3">
                <ChartCard
                  className="@5xl:col-span-2"
                  description="Shipments per week for 26 weeks, with the linear trend. The solid rule is the contract's weekly commitment; everything above it is billed as overage."
                  height={300}
                  title={`Above commitment in ${weeksAbove} of the last ${shipmentWeeks.length} weeks`}
                >
                  <LineChart
                    accessibleLabel="Weekly shipments with their linear trend, against the contract commitment"
                    analytics={SHIPMENTS_ANALYTICS}
                    data={shipmentWeeks}
                    plotHeight={250}
                  >
                    <Grid horizontal />
                    <Line
                      curve="monotone"
                      dataKey="shipments"
                      stroke="var(--chart-1)"
                      strokeWidth={2.5}
                    />
                    <ReferenceLine label="commitment 970" value={970} />
                    <XAxis />
                    <YAxis domain={[800, "auto"]} />
                    <ChartTooltip />
                  </LineChart>
                </ChartCard>

                <Card>
                  <CardHeader>
                    <CardTitle>
                      {openActions.length === 0
                        ? "Nothing left to do this week"
                        : `${openActions.length} things to do before the renewal`}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="flex flex-col gap-4">
                      {nextActions.map((action) => {
                        const isDone = done.includes(action.id);
                        return (
                          <li className="flex items-start gap-3" key={action.id}>
                            <Button
                              aria-label={
                                isDone ? `Reopen: ${action.title}` : `Mark done: ${action.title}`
                              }
                              aria-pressed={isDone}
                              className="mt-0.5 shrink-0"
                              onClick={() =>
                                setDone((prev) =>
                                  isDone
                                    ? prev.filter((id) => id !== action.id)
                                    : [...prev, action.id],
                                )
                              }
                              size="icon-sm"
                              variant={isDone ? "default" : "outline"}
                            >
                              <Check aria-hidden="true" className={isDone ? "" : "opacity-0"} />
                            </Button>
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span
                                className={
                                  isDone
                                    ? "text-body font-medium text-muted-foreground line-through"
                                    : "text-body font-medium"
                                }
                              >
                                {action.title}
                              </span>
                              <span className="text-meta text-muted-foreground">{action.why}</span>
                              <span className="text-caption text-muted-foreground">
                                {action.owner} · {action.due}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 @4xl:grid-cols-2">
                <ScoreExplanation
                  locale={locale}
                  omittedSignals={4}
                  score={account.health}
                  signals={healthSignals}
                  subject="the health score"
                />
                <Card>
                  <CardHeader>
                    <CardTitle>Strong everywhere except support</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-3">
                    <RadarChart
                      accessibleLabel="Account health across five dimensions against the median strategic account"
                      data={healthProfiles}
                      metrics={healthMetrics}
                      size={280}
                    >
                      <RadarGrid />
                      <RadarAxis />
                      <RadarLabels fontSize={11} offset={14} />
                      {healthProfiles.map((profile, i) => (
                        <RadarArea index={i} key={profile.label} />
                      ))}
                    </RadarChart>
                    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                      {healthProfiles.map((profile, i) => (
                        <li className="flex items-center gap-1.5 text-meta" key={profile.label}>
                          <span
                            aria-hidden="true"
                            className="size-2.5 rounded-full"
                            style={{ background: `var(--chart-${i + 1})` }}
                          />
                          {profile.label}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="activity">
              <Card>
                <CardHeader>
                  <CardTitle>What happened, newest first</CardTitle>
                </CardHeader>
                <CardContent>
                  <Timeline
                    items={accountEvents.map((event) => ({
                      title: event.title,
                      description: event.detail,
                      status: event.status,
                      timestamp: event.time,
                    }))}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="people">
              <Card>
                <CardHeader>
                  <CardTitle>One new decision-maker, no relationship yet</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col divide-y divide-border">
                    {contacts.map((person) => (
                      <li className="flex items-center gap-3 py-3" key={person.name}>
                        <Avatar>
                          <AvatarFallback>{initials(person.name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-body font-medium">{person.name}</span>
                          <span className="truncate text-meta text-muted-foreground">
                            {person.role}
                          </span>
                        </div>
                        <span className="hidden text-meta text-muted-foreground sm:block">
                          {person.lastTouch}
                        </span>
                        <Badge
                          className="w-24 justify-center"
                          variant={STANCE_BADGE[person.stance]}
                        >
                          {person.stance}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </WorkspaceShell>
      <Toaster />
    </>
  );
}
