"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Check, CircleCheck, Copy } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  AvatarGroup,
  Badge,
  Button,
  Card,
  CardContent,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  Input,
  SectionHeader,
  TimelineItem,
  TimelineRoot,
  useCopyToClipboard,
  type Status,
} from "@elabs-ai/components-ui";

export interface WaitlistMilestone {
  id: string;
  /** When it lands, as the reader should see it ("October 2026"). */
  when: string;
  title: string;
  body: string;
  /** "Shipped", "In progress", "Planned" — words, not colour alone. */
  status: "shipped" | "building" | "planned";
}

export interface WaitlistJoin {
  /** The place in line, already counted. */
  position: number;
  /** The link to share; each referral moves them up. */
  referralUrl: string;
}

export interface MarketingWaitlistProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  /** People already waiting, used in the count and the avatars. */
  waitingCount?: number;
  /** Initials shown as the first few faces in line. */
  waitingInitials?: string[];
  milestones?: WaitlistMilestone[];
  /**
   * Called with the address. Return the place in line and referral link on success, or a
   * message to show as the error. Omitted, the block simulates a successful join.
   */
  onJoin?: (email: string) => WaitlistJoin | string | Promise<WaitlistJoin | string>;
  locale?: string;
}

const DEFAULT_MILESTONES: WaitlistMilestone[] = [
  {
    id: "alpha",
    when: "September 2026",
    title: "Private alpha",
    body: "Fifty teams, one region, every feature behind a flag we can flip together.",
    status: "shipped",
  },
  {
    id: "beta",
    when: "November 2026",
    title: "Open beta",
    body: "Everyone on this list, in the order they joined. Referrals move you up.",
    status: "building",
  },
  {
    id: "launch",
    when: "February 2027",
    title: "General availability",
    body: "Team plans, SSO and the pricing we promised the alpha: no surprises.",
    status: "planned",
  },
];

/** The block's three words, mapped onto the `Timeline`'s canonical status. */
const STATUS: Record<
  WaitlistMilestone["status"],
  { label: string; variant: "success" | "info" | "outline"; timeline: Status }
> = {
  shipped: { label: "Shipped", variant: "success", timeline: "complete" },
  building: { label: "In progress", variant: "info", timeline: "running" },
  planned: { label: "Planned", variant: "outline", timeline: "pending" },
};

/**
 * A launch waitlist — the pitch, one email field that validates and shows a pending state,
 * and on success the place in line with a referral link and a copy button. The faces and
 * count show who is already waiting; three dated milestones say what is coming and what
 * has shipped.
 */
export function MarketingWaitlist({
  eyebrow = "Coming soon",
  title = "Orbit Copilot writes the follow-up before the call ends",
  description = "It listens to the meeting, drafts the recap, the next steps and the CRM update, and asks you before anything is sent.",
  waitingCount = 1283,
  waitingInitials = ["AO", "RM", "MT", "JW", "LH"],
  milestones = DEFAULT_MILESTONES,
  onJoin,
  locale = "en-US",
}: MarketingWaitlistProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [joined, setJoined] = useState<WaitlistJoin | null>(null);
  const { copied, copy } = useCopyToClipboard();
  const [copyFailed, setCopyFailed] = useState(false);
  const number = new Intl.NumberFormat(locale);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      return setError("Enter an email address we can write to.");
    }
    setError(null);
    setState("pending");
    const result = await (onJoin
      ? onJoin(address)
      : {
          position: waitingCount + 1,
          referralUrl: `https://orbit.example/waitlist?ref=${address.split("@")[0]}`,
        });
    if (typeof result === "string") {
      setError(result);
      return setState("idle");
    }
    setJoined(result);
    setState("done");
  }

  async function copyLink() {
    if (!joined) return;
    setCopyFailed(!(await copy(joined.referralUrl)));
  }

  return (
    <section
      className="@container mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 py-16"
      data-slot="marketing-waitlist"
    >
      <div className="grid grid-cols-1 gap-10 @3xl:grid-cols-[3fr_2fr] @3xl:gap-16">
        <div className="flex flex-col gap-8">
          <SectionHeader
            as="h2"
            description={description}
            eyebrow={eyebrow}
            size="lg"
            title={title}
          />

          {state === "done" && joined ? (
            <Alert
              aria-live="polite"
              className="flex flex-col gap-4 p-5"
              data-slot="marketing-waitlist-joined"
              role="status"
              variant="success"
            >
              <CircleCheck aria-hidden="true" className="text-success" />
              <AlertTitle as="h3" className="text-subtitle">
                You’re <span className="tabular-nums">#{number.format(joined.position)}</span> in
                line
              </AlertTitle>
              <AlertDescription>
                We wrote to <strong className="font-medium text-foreground">{email.trim()}</strong>.
                Every person who joins from your link moves you up ten places.
              </AlertDescription>
              <div className="flex flex-col gap-2 @md:flex-row">
                <Input
                  aria-label="Your referral link"
                  className="text-code"
                  readOnly
                  value={joined.referralUrl}
                />
                <Button className="shrink-0" onClick={copyLink} type="button" variant="outline">
                  {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {copied ? "Copied" : "Copy link"}
                </Button>
              </div>
              {copyFailed ? (
                <p className="text-meta text-muted-foreground">
                  Copying is blocked here — select the link and copy it yourself.
                </p>
              ) : null}
            </Alert>
          ) : (
            <form
              className="flex flex-col gap-3"
              data-slot="marketing-waitlist-form"
              noValidate
              onSubmit={submit}
            >
              <FieldRoot invalid={error !== null} required>
                <FieldLabel>Work email</FieldLabel>
                <div className="flex flex-col gap-2 @md:flex-row">
                  <FieldControl>
                    <Input
                      autoComplete="email"
                      inputMode="email"
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@company.com"
                      type="email"
                      value={email}
                    />
                  </FieldControl>
                  <Button className="shrink-0" disabled={state === "pending"} type="submit">
                    {state === "pending" ? "Joining…" : "Join the waitlist"}
                  </Button>
                </div>
                <FieldDescription>
                  One email when your spot opens. Nothing else, no sharing.
                </FieldDescription>
                {error ? <FieldError>{error}</FieldError> : null}
              </FieldRoot>
            </form>
          )}

          {/* A <div>, not a <p>: AvatarGroup renders block content, which a <p> cannot hold. */}
          <div className="flex items-center gap-3" data-slot="marketing-waitlist-social">
            <AvatarGroup aria-hidden="true" className="-space-x-1">
              {waitingInitials.map((who) => (
                <Avatar key={who}>
                  <AvatarFallback className="text-caption">{who}</AvatarFallback>
                </Avatar>
              ))}
            </AvatarGroup>
            <p className="text-body text-muted-foreground">
              <strong className="font-semibold tabular-nums text-foreground">
                {number.format(waitingCount)}
              </strong>{" "}
              people are already in line
            </p>
          </div>
        </div>

        <Card className="h-fit" data-slot="marketing-waitlist-roadmap">
          <CardContent className="flex flex-col gap-1 p-5">
            <h3 className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
              What’s coming
            </h3>
            <TimelineRoot
              aria-label="Roadmap"
              className="mt-3"
              data-slot="marketing-waitlist-milestones"
            >
              {milestones.map((item) => {
                const status = STATUS[item.status];
                return (
                  <TimelineItem
                    description={
                      <time className="text-meta tabular-nums text-muted-foreground">
                        {item.when}
                      </time>
                    }
                    detail={
                      <p className="text-body text-muted-foreground text-pretty">{item.body}</p>
                    }
                    key={item.id}
                    status={status.timeline}
                    timestamp={<Badge variant={status.variant}>{status.label}</Badge>}
                  >
                    {item.title}
                  </TimelineItem>
                );
              })}
            </TimelineRoot>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
