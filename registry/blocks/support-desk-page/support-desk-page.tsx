/**
 * Support desk — queue, conversation, context. The screen a support agent lives in.
 *
 * What it shows a copier: a three-pane work surface inside the workspace shell (`inset="flush"`
 * so the panes own their edges); a queue sorted by the promise that breaks first, each row
 * carrying its time left as a `Meter`; a conversation built from the ai package's `Message`
 * parts; a copilot draft that is grounded in named past tickets and can be sent or discarded,
 * never sent for you; and a context pane with the promise, the customer and those tickets.
 * Sending a reply resets the ticket's clock and re-sorts the queue.
 */
"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  ChartNoAxesColumn,
  Inbox,
  LifeBuoy,
  Send,
  Sparkles,
  Timer,
  Users,
  X,
} from "lucide-react";
import {
  Composer,
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  Message,
  MessageContent,
  MessageResponse,
} from "@elabs-ai/components-ai";
import {
  Badge,
  Button,
  cn,
  Descriptions,
  DescriptionsItem,
  Meter,
  Toaster,
  toast,
} from "@elabs-ai/components-ui";
import {
  WorkspaceShell,
  type WorkspaceNavGroup,
} from "@/components/workspace-shell/workspace-shell";
import {
  tickets as seedTickets,
  type Ticket,
  type TicketMessage,
  type TicketPriority,
} from "./data/tickets";

const PRIORITY_BADGE: Record<TicketPriority, "destructive" | "warning" | "secondary"> = {
  urgent: "destructive",
  high: "warning",
  normal: "secondary",
};

const timeLeft = (minutes: number) =>
  minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;

export interface SupportDeskPageProps {
  /** `"container"` renders the whole app inside a box you give a height. */
  frame?: "viewport" | "container";
  tickets?: Ticket[];
}

export default function SupportDeskPage({
  frame = "viewport",
  tickets: initial = seedTickets,
}: SupportDeskPageProps) {
  const [replies, setReplies] = useState<Record<string, TicketMessage[]>>({});
  const [discarded, setDiscarded] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState(initial[0]?.id ?? "");

  // A sent reply resets the clock to the full promise — which is what re-sorts the queue.
  const queue = useMemo(
    () =>
      initial
        .map((ticket) => ({
          ...ticket,
          messages: [...ticket.messages, ...(replies[ticket.id] ?? [])],
          slaMinutesLeft: replies[ticket.id]?.length ? ticket.slaMinutes : ticket.slaMinutesLeft,
          answered: Boolean(replies[ticket.id]?.length),
        }))
        .sort((a, b) => a.slaMinutesLeft - b.slaMinutesLeft),
    [initial, replies],
  );
  const ticket = queue.find((item) => item.id === selectedId) ?? queue[0];
  const breaching = queue.filter((item) => item.slaMinutesLeft <= 15 && !item.answered);

  const NAV: WorkspaceNavGroup[] = [
    {
      label: "Support",
      items: [
        {
          id: "inbox",
          label: "My queue",
          href: "#inbox",
          icon: Inbox,
          badge: String(queue.filter((item) => !item.answered).length),
        },
        { id: "team", label: "Team queue", href: "#team", icon: Users, badge: "23" },
        { id: "sla", label: "Promises at risk", href: "#sla", icon: Timer },
      ],
    },
    {
      label: "Resources",
      items: [
        { id: "kb", label: "Knowledge base", href: "#kb", icon: BookOpen },
        { id: "reports", label: "Reports", href: "#reports", icon: ChartNoAxesColumn },
        { id: "help", label: "Help center", href: "#help", icon: LifeBuoy },
      ],
    },
  ];

  if (!ticket) return null;

  const send = (text: string) => {
    setReplies((prev) => ({
      ...prev,
      [ticket.id]: [
        ...(prev[ticket.id] ?? []),
        { from: "agent", author: "Jonas Weber", time: "now", text },
      ],
    }));
    toast.success("Reply sent", { description: `${ticket.id} · the clock restarts` });
  };
  const draftOpen = !ticket.answered && !discarded.includes(ticket.id);

  return (
    <>
      <WorkspaceShell
        activeId="inbox"
        frame={frame}
        inset="flush"
        nav={NAV}
        notifications={[
          { id: "1", fallback: "LH", text: "Leila Haddad replied on T-88214", time: "2m ago" },
        ]}
        orgName="Acme Logistics"
        productName="Support"
        trail={[
          { href: "#support", label: "Support" },
          { href: "#inbox", label: "My queue" },
        ]}
        user={{ name: "Jonas Weber", email: "jonas@acme-logistics.example" }}
      >
        <div className="@container h-full" data-slot="support-desk">
          <div className="grid h-full min-h-0 grid-cols-1 @3xl:grid-cols-[18rem_minmax(0,1fr)] @6xl:grid-cols-[20rem_minmax(0,1fr)_20rem]">
            {/* Queue */}
            <section
              aria-label="My queue"
              className="flex min-h-0 flex-col border-b border-border @3xl:border-e @3xl:border-b-0"
            >
              {/* `h-header`: the pane bands line up with the shell's top bar in every theme. */}
              <header className="flex h-header shrink-0 items-center justify-between gap-2 border-b border-border px-4">
                <h1 className="text-subtitle font-semibold">My queue</h1>
                <Badge variant={breaching.length === 0 ? "secondary" : "destructive"}>
                  {breaching.length === 0
                    ? "no promise at risk"
                    : `${breaching.length} at risk in 15 min`}
                </Badge>
              </header>
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {queue.map((item) => {
                  const active = item.id === ticket.id;
                  return (
                    <li className="border-b border-border" key={item.id}>
                      <button
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "flex w-full flex-col gap-2 p-4 text-start focus-ring-inset hover:bg-accent",
                          active && "bg-accent",
                        )}
                        onClick={() => setSelectedId(item.id)}
                        type="button"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-meta text-muted-foreground">
                            {item.company} · {item.channel}
                          </span>
                          <Badge
                            variant={item.answered ? "success" : PRIORITY_BADGE[item.priority]}
                          >
                            {item.answered ? "answered" : item.priority}
                          </Badge>
                        </span>
                        <span className="line-clamp-2 text-body font-medium">{item.subject}</span>
                        <span className="flex items-center gap-2">
                          <Meter
                            aria-label={`${timeLeft(item.slaMinutesLeft)} left of a ${timeLeft(item.slaMinutes)} promise`}
                            className="flex-1"
                            max={item.slaMinutes}
                            size="xs"
                            value={item.slaMinutesLeft}
                          />
                          <span className="w-20 shrink-0 text-end text-caption text-muted-foreground tabular-nums">
                            {timeLeft(item.slaMinutesLeft)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Conversation */}
            <section aria-label="Conversation" className="flex min-h-0 min-w-0 flex-col">
              <header className="flex h-header shrink-0 items-center justify-between gap-2 border-b border-border px-4">
                <h2 className="min-w-0 truncate text-subtitle font-semibold">{ticket.subject}</h2>
                <Badge
                  className="shrink-0"
                  variant={ticket.answered ? "success" : PRIORITY_BADGE[ticket.priority]}
                >
                  {ticket.answered ? "answered" : `${timeLeft(ticket.slaMinutesLeft)} left`}
                </Badge>
              </header>
              <p className="px-4 pt-3 text-meta text-muted-foreground">
                {ticket.id} · {ticket.customer}, {ticket.company} · waiting since{" "}
                {ticket.waitingSince}
              </p>

              <Conversation className="min-h-0 flex-1">
                <ConversationContent>
                  {ticket.messages.map((message, index) => (
                    <Message
                      from={message.from === "agent" ? "user" : "assistant"}
                      key={`${ticket.id}-${index}`}
                    >
                      <MessageContent>
                        <span className="text-caption text-muted-foreground">
                          {message.author} · {message.time}
                        </span>
                        <MessageResponse>{message.text}</MessageResponse>
                      </MessageContent>
                    </Message>
                  ))}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>

              <div className="flex flex-col gap-3 border-t border-border p-4">
                {draftOpen ? (
                  <div
                    className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted p-4"
                    data-slot="support-desk-draft"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-meta font-medium">
                        <Sparkles aria-hidden="true" className="size-4 text-primary" />
                        Suggested reply
                        {ticket.similar.length > 0 ? (
                          <span className="font-normal text-muted-foreground">
                            · grounded in {ticket.similar.map((item) => item.id).join(", ")}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="text-body">
                      <MessageResponse>{ticket.draft}</MessageResponse>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => send(ticket.draft)} size="sm">
                        <Send aria-hidden="true" />
                        Send as written
                      </Button>
                      <Button
                        onClick={() => setDiscarded((prev) => [...prev, ticket.id])}
                        size="sm"
                        variant="outline"
                      >
                        <X aria-hidden="true" />
                        Discard and write my own
                      </Button>
                    </div>
                  </div>
                ) : null}
                <Composer
                  onSubmit={(message) => {
                    const text = message.text?.trim();
                    if (text) send(text);
                  }}
                  placeholder={`Reply to ${ticket.customer.split(" ")[0]}…`}
                  sendStatus="ready"
                  showAttach={false}
                  showVoice={false}
                  status={
                    ticket.answered
                      ? "Answered — the clock has restarted"
                      : "Replies go to the customer"
                  }
                />
              </div>
            </section>

            {/* Context */}
            <aside
              aria-label="Ticket context"
              className="hidden min-h-0 flex-col gap-6 overflow-y-auto border-s border-border p-4 @6xl:flex"
            >
              <section aria-labelledby="ctx-promise" className="flex flex-col gap-2">
                <h3 className="text-body font-semibold" id="ctx-promise">
                  The promise
                </h3>
                <Meter
                  aria-label={`${timeLeft(ticket.slaMinutesLeft)} left`}
                  max={ticket.slaMinutes}
                  value={ticket.slaMinutesLeft}
                />
                <p className="text-meta text-muted-foreground">
                  {timeLeft(ticket.slaMinutesLeft)} left of a {timeLeft(ticket.slaMinutes)} reply
                  promise for {ticket.plan} customers.
                </p>
              </section>
              <section aria-labelledby="ctx-customer" className="flex flex-col gap-2">
                <h3 className="text-body font-semibold" id="ctx-customer">
                  Customer
                </h3>
                <Descriptions columns={1}>
                  <DescriptionsItem label="Contact">{ticket.customer}</DescriptionsItem>
                  <DescriptionsItem label="Company">{ticket.company}</DescriptionsItem>
                  <DescriptionsItem label="Plan">{ticket.plan}</DescriptionsItem>
                  <DescriptionsItem label="Channel">{ticket.channel}</DescriptionsItem>
                </Descriptions>
              </section>
              <section aria-labelledby="ctx-similar" className="flex flex-col gap-2">
                <h3 className="text-body font-semibold" id="ctx-similar">
                  Solved before
                </h3>
                {ticket.similar.length === 0 ? (
                  <p className="text-meta text-muted-foreground">
                    Nothing similar in the last 90 days — this one is new.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {ticket.similar.map((item) => (
                      <li className="flex flex-col gap-0.5" key={item.id}>
                        <span className="text-body">{item.title}</span>
                        <span className="text-meta text-muted-foreground">
                          {item.id} · {item.resolution}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </aside>
          </div>
        </div>
      </WorkspaceShell>
      <Toaster />
    </>
  );
}
