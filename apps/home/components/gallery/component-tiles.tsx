"use client";
/**
 * The component gallery's tiles: small, working compositions of the library's app UI over the
 * Ashgrove fixtures — a form, a table, a chat turn, a command menu — the shapes a product is
 * actually made of. The home page's wall shows the `wall` ones; `/components` shows all of them
 * by category. Every control is live: type, toggle, open, pick.
 */
import { useId, useState, type ReactNode } from "react";
import { FileText, MoreHorizontal, Receipt, Settings, Upload } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  AlertTitle,
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
  Calendar,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  Descriptions,
  DescriptionsItem,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  Label,
  Progress,
  Rating,
  SegmentedField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  StatusBadge,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TagInput,
} from "@elabs-ai/components-ui";
import { MetricCard, Sparkline } from "@elabs-ai/components-charts";
import { DataTable, type ColumnDef } from "@elabs-ai/components-data";
import {
  Conversation,
  ConversationContent,
  Message,
  MessageContent,
  Tool,
  ToolContent,
  ToolHeader,
} from "@elabs-ai/components-ai";
import { KpiTrendReference } from "../blocks/kpi-trend-reference-01/kpi-trend-reference";
import { KpiStatusThreshold } from "../blocks/kpi-status-threshold-01/kpi-status-threshold";
import { KpiMovers } from "../blocks/kpi-movers-01/kpi-movers";
import { galleryCopy } from "../../content/copy";
import type { ComponentTileId } from "./component-tile-meta";
import { HERO_SEED } from "../hero/hero-stream";
import {
  ACCOUNTS,
  ARR_SERIES,
  CHURN_SERIES,
  REGIONS,
  SETTINGS_MEMBERS,
  SETTINGS_NOTIFICATIONS,
  generateOrders,
  headlineDelta,
  headlineValue,
  type KpiSeries,
  type OrderRow,
  type OrderStatus,
} from "../../content/fixtures";

const copy = galleryCopy.wall;

type DateRange = { from: Date | undefined; to?: Date | undefined };

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const RECENT_ORDERS: OrderRow[] = generateOrders(40)
  .sort((a, b) => b.created.localeCompare(a.created))
  .slice(0, 5);

const ORDER_STATUS: Record<OrderStatus, "success" | "info" | "destructive" | "secondary"> = {
  paid: "success",
  pending: "info",
  overdue: "destructive",
  refunded: "secondary",
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("");

function formatHeadline(series: KpiSeries): string {
  const value = headlineValue(series);
  return series.unit === "usd" ? `$${(value / 1_000_000).toFixed(1)}M` : `${value.toFixed(1)}%`;
}

function formatDelta(series: KpiSeries): string {
  const delta = headlineDelta(series);
  const sign = delta >= 0 ? "+" : "−";
  const abs = Math.abs(delta);
  return series.unit === "usd"
    ? `${sign}$${(abs / 1_000_000).toFixed(1)}M`
    : `${sign}${abs.toFixed(1)} pts`;
}

function KpiTile({ series, positiveIsGood }: { series: KpiSeries; positiveIsGood: boolean }) {
  return (
    <MetricCard
      label={series.label}
      value={formatHeadline(series)}
      delta={formatDelta(series)}
      deltaDirection={headlineDelta(series) >= 0 ? "up" : "down"}
      positiveIsGood={positiveIsGood}
      description={copy.kpi.since}
      sparkline={
        <Sparkline
          values={series.points.map((p) => p.value)}
          variant="line"
          fit="fill"
          fitDomain
          height={40}
          label={copy.kpi.sparkLabel(series.label)}
        />
      }
    />
  );
}

function ChatTile() {
  const { chat } = HERO_SEED;
  return (
    <Card className="gap-0 p-0">
      <Conversation aria-label={copy.chat.label}>
        <ConversationContent className="gap-3 p-4">
          <Message from="user">
            <MessageContent>{chat.question}</MessageContent>
          </Message>
          <Message from="assistant">
            <Tool defaultOpen className="mb-0">
              <ToolHeader
                type={`tool-${chat.tool.name}`}
                title={chat.tool.name}
                summary={chat.tool.summary}
                state={chat.tool.state}
              />
              <ToolContent className="p-3">
                <p className="text-meta text-muted-foreground">{chat.tool.result}</p>
              </ToolContent>
            </Tool>
            <MessageContent>{chat.answer}</MessageContent>
          </Message>
        </ConversationContent>
      </Conversation>
    </Card>
  );
}

const ORDER_COLUMNS: ColumnDef<OrderRow>[] = [
  { accessorKey: "account", header: copy.order.account },
  {
    accessorKey: "amount",
    header: copy.order.amount,
    meta: { numeric: true },
    cell: ({ row }) => usd.format(row.original.amount),
  },
  {
    accessorKey: "status",
    header: copy.order.status,
    cell: ({ row }) => (
      <Badge variant={ORDER_STATUS[row.original.status]} className="capitalize">
        {row.original.status}
      </Badge>
    ),
  },
];

function TableTile() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.table.title}</CardTitle>
        <CardDescription>{copy.table.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={ORDER_COLUMNS} data={RECENT_ORDERS} />
      </CardContent>
    </Card>
  );
}

function InviteTile() {
  const emailId = useId();
  const roleId = useId();
  const regionsId = useId();
  const digestId = useId();
  // Radix fills an empty `SelectValue` from the chosen item only after mount; the wall is
  // server-rendered and must show its final values at first paint, so the label is explicit.
  const [role, setRole] = useState<keyof typeof copy.invite.roles>("member");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.invite.title}</CardTitle>
        <CardDescription>{copy.invite.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={emailId}>{copy.invite.email}</Label>
          <Input id={emailId} type="email" placeholder={copy.invite.emailPlaceholder} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={roleId}>{copy.invite.role}</Label>
          <Select value={role} onValueChange={(next) => setRole(next as typeof role)}>
            <SelectTrigger id={roleId} className="w-full">
              <SelectValue>{copy.invite.roles[role]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">{copy.invite.roles.admin}</SelectItem>
              <SelectItem value="member">{copy.invite.roles.member}</SelectItem>
              <SelectItem value="viewer">{copy.invite.roles.viewer}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={regionsId}>{copy.invite.regions}</Label>
          <TagInput
            id={regionsId}
            defaultValue={[REGIONS[0], REGIONS[1]]}
            placeholder={copy.invite.regionsPlaceholder}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id={digestId} defaultChecked />
          <Label htmlFor={digestId}>{copy.invite.digest}</Label>
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost">{copy.invite.cancel}</Button>
        <Button>{copy.invite.submit}</Button>
      </CardFooter>
    </Card>
  );
}

function CalendarTile() {
  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date(2026, 8, 7),
    to: new Date(2026, 8, 18),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.calendar.title}</CardTitle>
        <CardDescription>{copy.calendar.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Calendar
          mode="range"
          defaultMonth={new Date(2026, 8, 1)}
          selected={range}
          onSelect={setRange}
        />
      </CardContent>
    </Card>
  );
}

function CommandTile() {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <Command>
        <CommandInput placeholder={copy.command.placeholder} />
        <CommandList>
          <CommandEmpty>{copy.command.empty}</CommandEmpty>
          <CommandGroup heading={copy.command.actions}>
            <CommandItem>
              <Receipt aria-hidden="true" />
              {copy.command.newInvoice}
              <CommandShortcut>⌘N</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Upload aria-hidden="true" />
              {copy.command.exportOrders}
              <CommandShortcut>⌘E</CommandShortcut>
            </CommandItem>
            <CommandItem>
              <Settings aria-hidden="true" />
              {copy.command.openSettings}
              <CommandShortcut>⌘,</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandGroup heading={copy.command.accounts}>
            {ACCOUNTS.slice(0, 3).map((account) => (
              <CommandItem key={account}>
                <FileText aria-hidden="true" />
                {account}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </Card>
  );
}

function NotificationsTile() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.notifications.title}</CardTitle>
        <CardDescription>{copy.notifications.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {SETTINGS_NOTIFICATIONS.map((item) => (
          <div key={item.id} className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <Label htmlFor={`wall-${item.id}`}>{item.label}</Label>
              <p className="text-meta text-muted-foreground">{item.description}</p>
            </div>
            <Switch id={`wall-${item.id}`} defaultChecked={item.enabled} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TeamTile() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.team.title}</CardTitle>
        <CardDescription>{copy.team.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {SETTINGS_MEMBERS.slice(0, 4).map((member) => (
          <div key={member.email} className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{initials(member.name)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body font-medium">{member.name}</span>
              <span className="truncate text-meta text-muted-foreground">{member.email}</span>
            </div>
            <Badge variant="outline" className="capitalize">
              {member.role}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton
                  variant="ghost"
                  size="icon-sm"
                  label={copy.team.manage(member.name)}
                  icon={<MoreHorizontal aria-hidden="true" />}
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>{copy.team.changeRole}</DropdownMenuItem>
                <DropdownMenuItem>{copy.team.resend}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">{copy.team.remove}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PipelineTile() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.pipeline.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-body">{copy.pipeline.steps.extract}</span>
            <StatusBadge status="complete" size="sm" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-body">{copy.pipeline.steps.reconcile}</span>
            <StatusBadge status="running" size="sm" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-body">{copy.pipeline.steps.publish}</span>
            <StatusBadge status="pending" size="sm" />
          </div>
        </div>
        <Progress value={58} aria-label={copy.pipeline.progressLabel} />
        <Alert variant="warning">
          <AlertTitle>{copy.pipeline.alertTitle}</AlertTitle>
          <AlertDescription>{copy.pipeline.alertBody}</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

function ControlsTile() {
  const sliderId = useId();
  const seasonId = useId();
  const [confidence, setConfidence] = useState(80);
  const c = copy.controls;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{c.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span id={sliderId} className="text-meta font-medium">
              {c.confidence}
            </span>
            <span className="text-meta text-muted-foreground tabular-nums">{confidence}%</span>
          </div>
          <Slider
            aria-labelledby={sliderId}
            min={50}
            max={99}
            step={1}
            value={[confidence]}
            onValueChange={([v]) => setConfidence(v ?? 80)}
          />
        </div>
        <SegmentedField
          label={c.horizon}
          defaultValue="quarter"
          options={[
            { value: "month", label: c.horizons.month },
            { value: "quarter", label: c.horizons.quarter },
            { value: "year", label: c.horizons.year },
          ]}
        />
        <SegmentedField
          label={c.basis}
          defaultValue="billings"
          options={[
            { value: "bookings", label: c.bases.bookings },
            { value: "billings", label: c.bases.billings },
            { value: "cash", label: c.bases.cash },
          ]}
        />
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor={seasonId}>{c.seasonality}</Label>
          <Switch id={seasonId} defaultChecked />
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-meta font-medium">{c.quality}</span>
          <Rating defaultValue={4} aria-label={c.quality} />
        </div>
      </CardContent>
    </Card>
  );
}

function FaqTile() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.faq.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible defaultValue="faq-0">
          {copy.faq.items.map((item, i) => (
            <AccordionItem key={item.q} value={`faq-${i}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

function VerifyTile() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.verify.title}</CardTitle>
        <CardDescription>{copy.verify.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <InputOTP maxLength={6} aria-label={copy.verify.label}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
        <Button className="w-full">{copy.verify.submit}</Button>
      </CardContent>
    </Card>
  );
}

function OrderTile() {
  const order = RECENT_ORDERS[0]!;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.order.title}</CardTitle>
        <CardDescription>{order.id}</CardDescription>
      </CardHeader>
      <CardContent>
        <Descriptions>
          <DescriptionsItem label={copy.order.account}>{order.account}</DescriptionsItem>
          <DescriptionsItem label={copy.order.product}>{order.product}</DescriptionsItem>
          <DescriptionsItem label={copy.order.owner}>{order.owner}</DescriptionsItem>
          <DescriptionsItem label={copy.order.amount} numeric>
            {usd.format(order.amount)}
          </DescriptionsItem>
          <DescriptionsItem label={copy.order.status}>
            <Badge variant={ORDER_STATUS[order.status]} className="capitalize">
              {order.status}
            </Badge>
          </DescriptionsItem>
        </Descriptions>
      </CardContent>
    </Card>
  );
}

function EmptyTile() {
  return (
    <Card>
      <CardContent>
        <EmptyState
          icon={<Receipt aria-hidden="true" />}
          title={copy.empty.title}
          description={copy.empty.description}
          actions={<Button variant="outline">{copy.empty.action}</Button>}
        />
      </CardContent>
    </Card>
  );
}

function NavTile() {
  const n = copy.nav;
  return (
    <Card>
      <CardHeader>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#components">{n.crumbs.home}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#components">{n.crumbs.accounts}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{ACCOUNTS[0]}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">{n.tabs.overview}</TabsTrigger>
            <TabsTrigger value="invoices">{n.tabs.invoices}</TabsTrigger>
            <TabsTrigger value="usage">{n.tabs.usage}</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="pt-3 text-body text-muted-foreground">
            {n.tabBody.overview}
          </TabsContent>
          <TabsContent value="invoices" className="pt-3 text-body text-muted-foreground">
            {n.tabBody.invoices}
          </TabsContent>
          <TabsContent value="usage" className="pt-3 text-body text-muted-foreground">
            {n.tabBody.usage}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export const COMPONENT_RENDERS: Record<ComponentTileId, () => ReactNode> = {
  "kpi-arr": () => <KpiTile series={ARR_SERIES} positiveIsGood />,
  chat: () => <ChatTile />,
  invite: () => <InviteTile />,
  "kpi-trend": () => <KpiTrendReference />,
  table: () => <TableTile />,
  command: () => <CommandTile />,
  "kpi-churn": () => <KpiTile series={CHURN_SERIES} positiveIsGood={false} />,
  controls: () => <ControlsTile />,
  pipeline: () => <PipelineTile />,
  team: () => <TeamTile />,
  calendar: () => <CalendarTile />,
  "kpi-status": () => <KpiStatusThreshold />,
  notifications: () => <NotificationsTile />,
  verify: () => <VerifyTile />,
  order: () => <OrderTile />,
  nav: () => <NavTile />,
  faq: () => <FaqTile />,
  empty: () => <EmptyTile />,
  "kpi-movers": () => <KpiMovers />,
};
