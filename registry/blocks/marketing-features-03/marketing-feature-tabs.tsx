"use client";

import { useState, type ReactNode } from "react";
import { BarChart3, Kanban, MessageSquareText, Paperclip } from "lucide-react";
import {
  AgentMessage,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  UserMessage,
} from "@elabs-ai/components-ai";
import { MetricGrid, Sparkline } from "@elabs-ai/components-charts";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  MetricCard,
  SectionHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from "@elabs-ai/components-ui";

export interface FeatureTab {
  id: string;
  icon: ReactNode;
  title: string;
  /** One line under the title in the list. */
  summary: string;
  /** The live preview for this tab — real components, not a screenshot. */
  preview: ReactNode;
  /** Accessible name for the preview. */
  previewLabel: string;
}

export interface MarketingFeatureTabsProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  tabs?: FeatureTab[];
  /** The tab open at first. Defaults to the first. */
  defaultTab?: string;
  className?: string;
}

/* ---------- Preview 1: the board ---------- */

interface BoardCard {
  title: string;
  tag: string;
  tagVariant: "default" | "secondary" | "outline" | "info" | "warning";
  owner: string;
  attachments?: number;
}

interface BoardColumn {
  name: string;
  cards: BoardCard[];
}

const BOARD: BoardColumn[] = [
  {
    name: "Up next",
    cards: [
      {
        title: "Onboarding emails, week 2",
        tag: "Lifecycle",
        tagVariant: "secondary",
        owner: "Ines Marques",
      },
      {
        title: "Pricing page copy",
        tag: "Website",
        tagVariant: "outline",
        owner: "Kwame Mensah",
        attachments: 2,
      },
      {
        title: "Renewal reminder flow",
        tag: "Lifecycle",
        tagVariant: "secondary",
        owner: "Yuki Tanaka",
      },
    ],
  },
  {
    name: "In progress",
    cards: [
      {
        title: "Q4 launch brief",
        tag: "Launch",
        tagVariant: "info",
        owner: "Olav Berg",
        attachments: 5,
      },
      {
        title: "Case study: Halden",
        tag: "Content",
        tagVariant: "outline",
        owner: "Priya Nair",
        attachments: 1,
      },
    ],
  },
  {
    name: "In review",
    cards: [
      {
        title: "Webinar landing page",
        tag: "Website",
        tagVariant: "outline",
        owner: "Ines Marques",
      },
      {
        title: "Partner announcement",
        tag: "Needs legal",
        tagVariant: "warning",
        owner: "Olav Berg",
        attachments: 3,
      },
    ],
  },
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

function BoardPreview() {
  return (
    <div className="@container">
      <ol className="grid grid-cols-1 gap-3 @lg:grid-cols-3">
        {BOARD.map((column) => (
          <li
            className="flex min-w-0 flex-col gap-2 rounded-lg bg-surface-muted p-2"
            key={column.name}
          >
            <div className="flex items-center justify-between px-1 py-1">
              <span className="text-caption font-semibold">{column.name}</span>
              <span className="text-meta text-muted-foreground tabular-nums">
                {column.cards.length}
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {column.cards.map((card) => (
                <li key={card.title}>
                  <Card className="flex flex-col gap-2 p-3 shadow-xs">
                    <span className="text-body font-medium text-pretty">{card.title}</span>
                    <span className="flex items-center justify-between gap-2">
                      <Badge variant={card.tagVariant}>{card.tag}</Badge>
                      <span className="flex items-center gap-2 text-meta text-muted-foreground">
                        {card.attachments ? (
                          <span className="flex items-center gap-0.5 tabular-nums">
                            <Paperclip aria-hidden="true" className="size-3.5" />
                            <span className="sr-only">Attachments: </span>
                            {card.attachments}
                          </span>
                        ) : null}
                        <Avatar className="size-6">
                          <AvatarFallback className="text-meta">
                            {initials(card.owner)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="sr-only">{card.owner}</span>
                      </span>
                    </span>
                  </Card>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------- Preview 2: the assistant ---------- */

function AssistantPreview() {
  return (
    <Card className="flex flex-col gap-5 p-5">
      <UserMessage>
        <MessageHeader className="justify-end">
          <span>Olav</span>
          <MessageAvatar name="Olav Berg" />
        </MessageHeader>
        <MessageContent>
          What is still blocking the Q4 launch, and who owns each piece?
        </MessageContent>
      </UserMessage>
      <AgentMessage emphasis="answer">
        <MessageHeader>
          <MessageAvatar name="Orbit" role="agent" />
          <span>Orbit</span>
          <span aria-hidden="true">·</span>
          <span>read 3 boards, 14 comments</span>
        </MessageHeader>
        <MessageContent className="flex flex-col gap-3">
          <p>Three things are still open, all due before the 14 October freeze:</p>
          <ul className="flex flex-col gap-2">
            <li className="flex flex-wrap items-center gap-2">
              <Badge variant="warning">Needs legal</Badge>
              <span>
                <span className="font-medium">Partner announcement</span> — waiting on the counsel
                review Olav requested on Tuesday.
              </span>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <Badge variant="info">In progress</Badge>
              <span>
                <span className="font-medium">Q4 launch brief</span> — Olav, last edit 2 hours ago;
                the pricing section is still a placeholder.
              </span>
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Up next</Badge>
              <span>
                <span className="font-medium">Pricing page copy</span> — Kwame, not started; it
                depends on the brief above.
              </span>
            </li>
          </ul>
          <p className="text-muted-foreground">
            Want me to draft the pricing section from the brief’s current numbers?
          </p>
        </MessageContent>
      </AgentMessage>
    </Card>
  );
}

/* ---------- Preview 3: the numbers ---------- */

const CYCLE = [11.2, 10.8, 10.1, 9.6, 9.9, 8.7, 8.1, 7.4, 7.0, 6.8, 6.1, 5.8];
const SHIPPED = [14, 16, 15, 19, 21, 20, 24, 26, 25, 29, 31, 34];
const OVERDUE = [9, 8, 9, 7, 6, 6, 5, 4, 4, 3, 3, 2];

function ReportsPreview() {
  return (
    <MetricGrid columns={3}>
      <MetricCard
        delta="−48%"
        deltaDirection="down"
        description="from first comment to shipped"
        label="Cycle time"
        positiveIsGood={false}
        size="lg"
        sparkline={
          <Sparkline fit="fill" height={40} label="Cycle time, twelve weeks" values={CYCLE} />
        }
        value="5.8 days"
      />
      <MetricCard
        delta="+143%"
        deltaDirection="up"
        description="this week, across five teams"
        label="Shipped"
        size="lg"
        sparkline={
          <Sparkline
            fit="fill"
            height={40}
            label="Items shipped a week, twelve weeks"
            values={SHIPPED}
          />
        }
        value="34"
      />
      <MetricCard
        delta="−7"
        deltaDirection="down"
        description="both flagged three days early"
        label="Overdue"
        positiveIsGood={false}
        size="lg"
        sparkline={
          <Sparkline fit="fill" height={40} label="Overdue items, twelve weeks" values={OVERDUE} />
        }
        value="2"
      />
    </MetricGrid>
  );
}

const DEFAULT_TABS: FeatureTab[] = [
  {
    id: "board",
    icon: <Kanban aria-hidden="true" />,
    title: "Boards that stay honest",
    summary:
      "Every card carries its owner, its tag and what is attached — nothing hides in a comment.",
    preview: <BoardPreview />,
    previewLabel: "A three-column board of marketing work",
  },
  {
    id: "assistant",
    icon: <MessageSquareText aria-hidden="true" />,
    title: "Ask the workspace",
    summary: "Orbit reads the boards and the comments, and answers with the cards it used.",
    preview: <AssistantPreview />,
    previewLabel: "A conversation asking what blocks the launch",
  },
  {
    id: "reports",
    icon: <BarChart3 aria-hidden="true" />,
    title: "Numbers without a spreadsheet",
    summary:
      "Cycle time, throughput and overdue work per team, computed from the boards themselves.",
    preview: <ReportsPreview />,
    previewLabel: "Three metric tiles with twelve-week trends",
  },
];

/**
 * A tabbed feature explorer: the features listed down the left, each with a glyph and a
 * one-liner; the chosen one rendered live on the right from real components. Arrow keys
 * move through the list; the list stacks above the preview when the container is narrow.
 */
export function MarketingFeatureTabs({
  eyebrow = "One workspace",
  title = "The board, the assistant and the numbers — one product",
  description = "Orbit is where the work lives, so the assistant and the reports never go stale.",
  tabs = DEFAULT_TABS,
  defaultTab,
  className,
}: MarketingFeatureTabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id ?? "");
  return (
    <section
      className={cn(
        "@container mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-16",
        className,
      )}
      data-slot="marketing-feature-tabs"
    >
      <SectionHeader as="h2" description={description} eyebrow={eyebrow} size="lg" title={title} />
      <Tabs
        className="grid gap-6 @3xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] @3xl:gap-10"
        onValueChange={setActive}
        orientation="vertical"
        value={active}
      >
        <TabsList
          aria-label="Features"
          className="flex h-auto w-full flex-col items-stretch justify-start gap-1 self-start rounded-none bg-transparent p-0"
          data-slot="marketing-feature-tabs-list"
          variant="segmented"
        >
          {tabs.map((tab) => (
            <TabsTrigger
              className="h-auto justify-start gap-3 rounded-lg border-s-2 border-transparent px-4 py-3 text-start whitespace-normal data-[state=active]:border-s-primary"
              key={tab.id}
              value={tab.id}
            >
              <span className="mt-0.5 shrink-0 text-primary [&>svg]:size-5">{tab.icon}</span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-body font-semibold">{tab.title}</span>
                <span className="text-meta font-normal text-muted-foreground">{tab.summary}</span>
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent
            className="mt-0 min-w-0 rounded-xl bg-surface-muted p-4 @md:p-6"
            data-slot="marketing-feature-tabs-preview"
            key={tab.id}
            value={tab.id}
          >
            <figure aria-label={tab.previewLabel} className="min-w-0">
              {tab.preview}
            </figure>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
