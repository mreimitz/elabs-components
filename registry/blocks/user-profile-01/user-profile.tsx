"use client";

import { useState } from "react";
import {
  CalendarDays,
  Check,
  FolderKanban,
  GitMerge,
  Link2,
  type LucideIcon,
  MapPin,
  MessageSquare,
  MessageSquareText,
  Rocket,
  Star,
  UserPlus,
} from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Timeline,
  type TimelineEntry,
} from "@elabs-ai/components-ui";

export interface ProfilePerson {
  name: string;
  handle: string;
  role: string;
  team?: string;
  location: string;
  /** ISO date the account was created. */
  joined: string;
  website?: { label: string; href: string };
  about: string;
  skills: string[];
}

export interface ProfileStat {
  label: string;
  value: number;
}

export interface ProfileEvent {
  id: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  /** ISO date-time. */
  at: string;
}

export interface ProfileProject {
  id: string;
  name: string;
  summary: string;
  /** Chart token that tints the tile, 1–5. */
  tone: 1 | 2 | 3 | 4 | 5;
  stars: number;
  status: "active" | "archived" | "draft";
  /** ISO date of the last change. */
  updated: string;
}

export interface UserProfileProps {
  person?: ProfilePerson;
  stats?: ProfileStat[];
  /** Contributions per day, oldest first; the strip shows the last `weeks × 7`. */
  contributions?: number[];
  /** ISO date of the LAST cell in the strip. */
  contributionsEnd?: string;
  /** Weeks of the heat strip to draw. */
  weeks?: number;
  events?: ProfileEvent[];
  projects?: ProfileProject[];
  /** Whether the viewer already follows this person. */
  defaultFollowing?: boolean;
  onFollowChange?: (following: boolean) => void;
  onMessage?: () => void;
  locale?: string;
  className?: string;
}

const DEFAULT_PERSON: ProfilePerson = {
  name: "Priya Raman",
  handle: "priya",
  role: "Staff engineer",
  team: "Platform",
  location: "Berlin, Germany",
  joined: "2022-03-14",
  website: { label: "priya.dev", href: "#priya-dev" },
  about:
    "I look after the build system and the release train at Atlas. Before that I spent six years on payments infrastructure and still get called when a settlement file looks odd. I write about reproducible builds, review more than I merge, and keep a list of every flaky test I have ever met.",
  skills: [
    "TypeScript",
    "Rust",
    "Bazel",
    "Kubernetes",
    "Postgres",
    "Observability",
    "Release engineering",
    "Mentoring",
  ],
};

const DEFAULT_STATS: ProfileStat[] = [
  { label: "Projects", value: 24 },
  { label: "Followers", value: 1284 },
  { label: "Following", value: 312 },
  { label: "Contributions", value: 3406 },
];

/** 26 weeks of deterministic, weekday-heavy contribution counts. */
const DEFAULT_CONTRIBUTIONS: number[] = Array.from({ length: 26 * 7 }, (_, i) => {
  const weekday = i % 7;
  if (weekday === 0 || weekday === 6) return i % 11 === 0 ? 2 : 0;
  const wave = Math.sin(i / 9) * 4 + Math.cos(i / 23) * 3;
  const noise = ((i * 7919) % 13) - 5;
  return Math.max(0, Math.round(6 + wave + noise / 2));
});

const DEFAULT_EVENTS: ProfileEvent[] = [
  {
    id: "1",
    icon: GitMerge,
    title: "Merged “Hermetic toolchain for the web bundle”",
    description: "atlas/build · 41 files · reviewed by Jonas and Mei",
    at: "2026-09-24T15:12:00Z",
  },
  {
    id: "2",
    icon: MessageSquareText,
    title: "Reviewed 6 changes in atlas/release",
    description: "Approved 5, requested changes on the rollback script.",
    at: "2026-09-23T09:40:00Z",
  },
  {
    id: "3",
    icon: Rocket,
    title: "Shipped release 2026.38 to all regions",
    description: "Zero rollbacks. Median deploy 6 min 12 s.",
    at: "2026-09-19T17:05:00Z",
  },
  {
    id: "4",
    icon: Star,
    title: "Starred “flaky-hunter”",
    at: "2026-09-16T11:22:00Z",
  },
  {
    id: "5",
    icon: FolderKanban,
    title: "Created the project “Build cache v2”",
    description: "Remote cache with content-addressed artifacts across CI and laptops.",
    at: "2026-09-10T08:30:00Z",
  },
];

const DEFAULT_PROJECTS: ProfileProject[] = [
  {
    id: "build-cache",
    name: "Build cache v2",
    summary: "Content-addressed remote cache shared by CI and every laptop.",
    tone: 1,
    stars: 148,
    status: "active",
    updated: "2026-09-24",
  },
  {
    id: "flaky-hunter",
    name: "flaky-hunter",
    summary: "Finds tests that pass on retry and opens the issue for you.",
    tone: 2,
    stars: 412,
    status: "active",
    updated: "2026-09-21",
  },
  {
    id: "release-train",
    name: "Release train",
    summary: "The weekly cut, canary and rollout, as code.",
    tone: 3,
    stars: 96,
    status: "active",
    updated: "2026-09-19",
  },
  {
    id: "settle",
    name: "settle",
    summary: "Parses settlement files from eleven acquirers into one ledger.",
    tone: 4,
    stars: 233,
    status: "archived",
    updated: "2025-11-02",
  },
  {
    id: "sbom",
    name: "SBOM everywhere",
    summary: "A bill of materials for every artifact, signed at build time.",
    tone: 5,
    stars: 61,
    status: "draft",
    updated: "2026-09-08",
  },
  {
    id: "docs-lint",
    name: "docs-lint",
    summary: "Fails the build when a public function loses its docstring.",
    tone: 1,
    stars: 187,
    status: "active",
    updated: "2026-08-30",
  },
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/** Heat level 0–4 for a day’s count; the legend uses the same rungs. */
const level = (count: number, max: number) => {
  if (count === 0) return 0;
  const share = count / Math.max(max, 1);
  return share > 0.75 ? 4 : share > 0.5 ? 3 : share > 0.25 ? 2 : 1;
};

const LEVEL_CLASS = [
  "bg-muted",
  "bg-primary/25",
  "bg-primary/50",
  "bg-primary/75",
  "bg-primary",
] as const;

const LEVEL_LABEL = ["None", "Few", "Some", "Many", "Most"] as const;

const PROJECT_STATUS: Record<
  ProfileProject["status"],
  { label: string; variant: "success" | "secondary" | "outline" }
> = {
  active: { label: "Active", variant: "success" },
  archived: { label: "Archived", variant: "secondary" },
  draft: { label: "Draft", variant: "outline" },
};

/**
 * A public profile — cover, avatar and the facts a colleague looks for first, then four
 * stat tiles and three tabs: an overview with the bio, skills and a contribution heat
 * strip; recent activity as a timeline; projects as a card grid. Follow toggles in place.
 */
export function UserProfile({
  person = DEFAULT_PERSON,
  stats = DEFAULT_STATS,
  contributions = DEFAULT_CONTRIBUTIONS,
  contributionsEnd = "2026-09-25",
  weeks = 26,
  events = DEFAULT_EVENTS,
  projects = DEFAULT_PROJECTS,
  defaultFollowing = false,
  onFollowChange,
  onMessage,
  locale = "en-US",
  className,
}: UserProfileProps) {
  const [following, setFollowing] = useState(defaultFollowing);
  const number = new Intl.NumberFormat(locale);
  const monthYear = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const dayMonth = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const dateTime = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const cells = contributions.slice(-weeks * 7);
  const max = Math.max(...cells, 1);
  const total = cells.reduce((sum, n) => sum + n, 0);
  const end = new Date(contributionsEnd);
  const dateOf = (index: number) => {
    const d = new Date(end);
    d.setDate(end.getDate() - (cells.length - 1 - index));
    return d;
  };
  const columns = Array.from({ length: Math.ceil(cells.length / 7) }, (_, w) =>
    cells.slice(w * 7, w * 7 + 7),
  );

  const timeline: TimelineEntry[] = events.map((event) => {
    const Icon = event.icon;
    return {
      title: (
        <span className="inline-flex items-center gap-2">
          <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          {event.title}
        </span>
      ),
      description: event.description,
      status: "done",
      timestamp: dateTime.format(new Date(event.at)),
    };
  });

  return (
    <article
      className={cn("@container mx-auto w-full max-w-5xl", className)}
      data-slot="user-profile"
    >
      <div
        aria-hidden="true"
        className="h-36 rounded-t-xl bg-linear-to-r from-primary/25 via-chart-2/20 to-chart-3/25 @3xl:h-44"
        data-slot="user-profile-cover"
      />
      <header
        className="flex flex-col gap-4 px-5 pb-6 @3xl:flex-row @3xl:items-end @3xl:gap-6"
        data-slot="user-profile-header"
      >
        <Avatar className="-mt-12 size-24 ring-4 ring-background @3xl:-mt-14 @3xl:size-28">
          <AvatarFallback className="bg-primary text-title font-semibold text-primary-foreground">
            {initials(person.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 @3xl:pb-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h1 className="text-title font-semibold">{person.name}</h1>
            <span className="text-body text-muted-foreground">@{person.handle}</span>
          </div>
          <p className="text-body">
            {person.role}
            {person.team ? <span className="text-muted-foreground"> · {person.team}</span> : null}
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
            <li className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden="true" className="size-3.5" />
              {person.location}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="size-3.5" />
              Joined {monthYear.format(new Date(person.joined))}
            </li>
            {person.website ? (
              <li className="inline-flex items-center gap-1.5">
                <Link2 aria-hidden="true" className="size-3.5" />
                <a
                  className="focus-ring rounded-sm text-link underline underline-offset-4"
                  href={person.website.href}
                >
                  {person.website.label}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
        <div className="flex gap-2 @3xl:pb-1" data-slot="user-profile-actions">
          <Button
            aria-pressed={following}
            onClick={() => {
              const next = !following;
              setFollowing(next);
              onFollowChange?.(next);
            }}
            variant={following ? "outline" : "default"}
          >
            {following ? <Check aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
            {following ? "Following" : "Follow"}
          </Button>
          <Button onClick={onMessage} variant="outline">
            <MessageSquare aria-hidden="true" />
            Message
          </Button>
        </div>
      </header>

      <dl
        className="grid grid-cols-2 gap-3 px-5 pb-6 @2xl:grid-cols-4"
        data-slot="user-profile-stats"
      >
        {stats.map((stat) => (
          <div
            className="flex flex-col gap-0.5 rounded-lg bg-surface-muted px-4 py-3"
            key={stat.label}
          >
            <dt className="text-caption text-muted-foreground">{stat.label}</dt>
            <dd className="text-kpi font-semibold tabular-nums">{number.format(stat.value)}</dd>
          </div>
        ))}
      </dl>

      <Tabs className="px-5 pb-8" defaultValue="overview">
        <TabsList aria-label="Profile sections" variant="underline">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="projects">
            Projects <span className="text-muted-foreground tabular-nums">{projects.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent className="flex flex-col gap-4 pt-5" value="overview">
          <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card>
              <CardHeader>
                <CardTitle>About</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-body text-pretty">{person.about}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Skills</CardTitle>
                <CardDescription>
                  What colleagues ask {person.name.split(" ")[0]} about.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-wrap gap-1.5">
                  {person.skills.map((skill) => (
                    <li key={skill}>
                      <Badge variant="secondary">{skill}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
          <Card data-slot="user-profile-contributions">
            <CardHeader className="flex flex-row flex-wrap items-baseline justify-between gap-2">
              <div className="flex flex-col gap-1">
                <CardTitle>Contributions</CardTitle>
                <CardDescription>
                  <span className="font-medium text-foreground tabular-nums">
                    {number.format(total)}
                  </span>{" "}
                  in the last {weeks} weeks · busiest day {number.format(max)}
                </CardDescription>
              </div>
              <ol
                aria-label="Legend, fewest to most contributions per day"
                className="flex items-center gap-1 text-meta text-muted-foreground"
              >
                <li className="me-1">Less</li>
                {LEVEL_CLASS.map((cls, i) => (
                  <li
                    className={cn("size-3 rounded-sm", cls)}
                    key={cls}
                    title={`${LEVEL_LABEL[i]}${i === 0 ? "" : ` (up to ${Math.ceil((max * i) / 4)})`}`}
                  >
                    <span className="sr-only">{LEVEL_LABEL[i]}</span>
                  </li>
                ))}
                <li className="ms-1">More</li>
              </ol>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div
                  aria-label={`${number.format(total)} contributions in the last ${weeks} weeks, day by day`}
                  className="grid w-max grid-flow-col gap-1"
                  role="img"
                  style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}
                >
                  {columns.map((week, w) =>
                    week.map((count, d) => {
                      const day = dateOf(w * 7 + d);
                      return (
                        <span
                          className={cn("size-3 rounded-sm", LEVEL_CLASS[level(count, max)])}
                          key={day.toISOString()}
                          title={`${number.format(count)} on ${dayMonth.format(day)}`}
                        />
                      );
                    }),
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="pt-5" value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>
                The last {events.length} things {person.name.split(" ")[0]} did.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Timeline items={timeline} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent className="pt-5" value="projects">
          <ul className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @4xl:grid-cols-3">
            {projects.map((project) => {
              const status = PROJECT_STATUS[project.status];
              return (
                <li key={project.id}>
                  <Card className="h-full overflow-hidden p-0">
                    <div
                      aria-hidden="true"
                      className="h-2"
                      style={{ background: `var(--chart-${project.tone})` }}
                    />
                    <CardContent className="flex h-full flex-col gap-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-body font-semibold">{project.name}</h3>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <p className="flex-1 text-caption text-muted-foreground text-pretty">
                        {project.summary}
                      </p>
                      <div className="flex items-center justify-between gap-2 text-meta text-muted-foreground">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Star aria-hidden="true" className="size-3.5" />
                          {number.format(project.stars)}
                          <span className="sr-only"> stars</span>
                        </span>
                        <span>Updated {dayMonth.format(new Date(project.updated))}</span>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        </TabsContent>
      </Tabs>
    </article>
  );
}
