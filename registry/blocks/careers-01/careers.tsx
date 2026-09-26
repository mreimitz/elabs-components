"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import {
  Badge,
  Button,
  cn,
  Label,
  SectionHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatePanel,
  Switch,
} from "@elabs-ai/components-ui";
import { FeatureGrid } from "@elabs-ai/components-marketing";
import { EmailCapture } from "@/components/marketing-parts/email-capture";
import { ArrowUpRight, Briefcase, Compass, Globe, MapPin, Search, Users } from "lucide-react";

export interface Role {
  id: string;
  title: string;
  team: string;
  location: string;
  remote: boolean;
  type: "Full-time" | "Part-time" | "Contract";
  /** ISO date the role opened; “New” within 14 days of `today`. */
  opened: string;
  href: string;
}

export interface ValueProp {
  icon: ReactNode;
  title: string;
  description: string;
}

export interface CareersProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  values?: ValueProp[];
  /** Screen-reader heading for the values grid (its tiles are `<h3>`s). */
  valuesHeading?: string;
  roles?: Role[];
  /** ISO date used to decide which roles are “New”. Defaults to the newest opening. */
  today?: string;
  /** Return a message to show it as the error; return nothing on success. */
  onLeaveDetails?: (email: string) => string | void | Promise<string | void>;
  /**
   * The heading level of the title. `"h1"` when the block is the careers page (the
   * default); `"h2"` under a page header that already carries the `<h1>`.
   */
  titleAs?: "h1" | "h2";
  className?: string;
}

const ALL = "all";

const DEFAULT_VALUES: ValueProp[] = [
  {
    icon: <Compass aria-hidden="true" />,
    title: "Ship to a port, not a roadmap",
    description:
      "Every team owns a real customer lane. You see your work move containers within weeks.",
  },
  {
    icon: <Globe aria-hidden="true" />,
    title: "Remote across four time zones",
    description:
      "Offices in Oslo, Rotterdam and Singapore; most of us work from home and meet each quarter.",
  },
  {
    icon: <Users aria-hidden="true" />,
    title: "Small teams, senior people",
    description:
      "Squads of five, one on-call rotation, no middle layer between you and the customer.",
  },
];

export const ROLES: Role[] = [
  {
    id: "eng-routing",
    title: "Senior Engineer, Routing",
    team: "Engineering",
    location: "Oslo",
    remote: true,
    type: "Full-time",
    opened: "2026-09-19",
    href: "#/careers/eng-routing",
  },
  {
    id: "eng-data",
    title: "Data Engineer, AIS ingestion",
    team: "Engineering",
    location: "Rotterdam",
    remote: true,
    type: "Full-time",
    opened: "2026-09-15",
    href: "#/careers/eng-data",
  },
  {
    id: "eng-frontend",
    title: "Frontend Engineer, Control Tower",
    team: "Engineering",
    location: "Remote (EU)",
    remote: true,
    type: "Full-time",
    opened: "2026-08-28",
    href: "#/careers/eng-frontend",
  },
  {
    id: "eng-sre",
    title: "Site Reliability Engineer",
    team: "Engineering",
    location: "Singapore",
    remote: false,
    type: "Full-time",
    opened: "2026-08-20",
    href: "#/careers/eng-sre",
  },
  {
    id: "design-product",
    title: "Product Designer, Customs Desk",
    team: "Design",
    location: "Oslo",
    remote: true,
    type: "Full-time",
    opened: "2026-09-21",
    href: "#/careers/design-product",
  },
  {
    id: "design-research",
    title: "User Researcher",
    team: "Design",
    location: "Remote (EU)",
    remote: true,
    type: "Part-time",
    opened: "2026-08-04",
    href: "#/careers/design-research",
  },
  {
    id: "customs-lead",
    title: "Customs Specialist, EU",
    team: "Customs",
    location: "Rotterdam",
    remote: false,
    type: "Full-time",
    opened: "2026-09-10",
    href: "#/careers/customs-lead",
  },
  {
    id: "customs-apac",
    title: "Customs Specialist, APAC",
    team: "Customs",
    location: "Singapore",
    remote: false,
    type: "Contract",
    opened: "2026-07-30",
    href: "#/careers/customs-apac",
  },
  {
    id: "sales-ae",
    title: "Account Executive, Nordics",
    team: "Sales",
    location: "Oslo",
    remote: true,
    type: "Full-time",
    opened: "2026-09-02",
    href: "#/careers/sales-ae",
  },
  {
    id: "sales-se",
    title: "Solutions Engineer",
    team: "Sales",
    location: "Remote (EU)",
    remote: true,
    type: "Full-time",
    opened: "2026-08-14",
    href: "#/careers/sales-se",
  },
  {
    id: "ops-support",
    title: "Support Engineer, follow-the-sun",
    team: "Operations",
    location: "Singapore",
    remote: true,
    type: "Full-time",
    opened: "2026-09-17",
    href: "#/careers/ops-support",
  },
];

const DAY = 24 * 60 * 60 * 1000;

/**
 * Open roles: three reasons to join, then filters — team, location and a remote switch —
 * that narrow the list, roles grouped by team as rows with a “New” badge and an apply link,
 * the count announced to assistive tech, and an empty state with a small form for when
 * nothing matches.
 */
export function Careers({
  eyebrow = "Careers",
  title = "Build the ops desk every port runs on",
  description = "Harbourline is 84 people across Oslo, Rotterdam and Singapore. We are hiring in engineering, design, customs and sales.",
  values = DEFAULT_VALUES,
  valuesHeading = "How we work",
  roles = ROLES,
  today,
  onLeaveDetails,
  titleAs = "h1",
  className,
}: CareersProps) {
  const [team, setTeam] = useState(ALL);
  const [location, setLocation] = useState(ALL);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const id = useId();

  const teams = useMemo(() => [...new Set(roles.map((r) => r.team))], [roles]);
  const locations = useMemo(() => [...new Set(roles.map((r) => r.location))].sort(), [roles]);
  const newest = useMemo(
    () =>
      today ??
      roles
        .map((r) => r.opened)
        .sort()
        .at(-1) ??
      "1970-01-01",
    [roles, today],
  );
  const isNew = (role: Role) =>
    Date.parse(`${newest}T00:00:00Z`) - Date.parse(`${role.opened}T00:00:00Z`) <= 14 * DAY;

  const shown = roles.filter(
    (r) =>
      (team === ALL || r.team === team) &&
      (location === ALL || r.location === location) &&
      (!remoteOnly || r.remote),
  );
  const grouped = teams
    .map((name) => ({ name, roles: shown.filter((r) => r.team === name) }))
    .filter((group) => group.roles.length > 0);

  const reset = () => {
    setTeam(ALL);
    setLocation(ALL);
    setRemoteOnly(false);
  };

  return (
    <section
      className={cn(
        "@container mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 py-16",
        className,
      )}
      data-slot="careers"
    >
      <SectionHeader
        as={titleAs}
        description={description}
        eyebrow={eyebrow}
        size="lg"
        title={title}
      />

      <div data-slot="careers-values">
        {/* FeatureGrid titles are <h3>; this keeps the outline h1 → h2 → h3 without a visible heading. */}
        <h2 className="sr-only">{valuesHeading}</h2>
        <FeatureGrid columns={3} features={values} />
      </div>

      <div className="flex flex-col gap-6" data-slot="careers-roles">
        <div className="flex flex-col gap-4 @2xl:flex-row @2xl:items-end @2xl:justify-between">
          <h2 className="text-title font-semibold">
            Open roles <span className="text-muted-foreground tabular-nums">({roles.length})</span>
          </h2>
          <div className="flex flex-wrap items-end gap-3" data-slot="careers-filters">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-team`}>Team</Label>
              <Select onValueChange={setTeam} value={team}>
                <SelectTrigger className="min-w-40" id={`${id}-team`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All teams</SelectItem>
                  {teams.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${id}-location`}>Location</Label>
              <Select onValueChange={setLocation} value={location}>
                <SelectTrigger className="min-w-40" id={`${id}-location`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Anywhere</SelectItem>
                  {locations.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex h-control items-center gap-2">
              <Switch checked={remoteOnly} id={`${id}-remote`} onCheckedChange={setRemoteOnly} />
              <Label htmlFor={`${id}-remote`}>Remote only</Label>
            </div>
          </div>
        </div>

        <p aria-live="polite" className="text-meta text-muted-foreground tabular-nums">
          {shown.length === 0
            ? "No roles match."
            : `${shown.length} ${shown.length === 1 ? "role" : "roles"} shown${
                shown.length === roles.length ? "" : ` of ${roles.length}`
              }.`}
        </p>

        {grouped.length > 0 ? (
          <div className="flex flex-col gap-8">
            {grouped.map((group) => (
              <section
                aria-labelledby={`${id}-${group.name}`}
                className="flex flex-col gap-3"
                key={group.name}
              >
                <h3
                  className="flex items-center gap-2 text-subtitle font-semibold"
                  id={`${id}-${group.name}`}
                >
                  {group.name}
                  <span className="text-meta font-normal text-muted-foreground tabular-nums">
                    {group.roles.length}
                  </span>
                </h3>
                <ul className="divide-y divide-border-strong rounded-lg border">
                  {group.roles.map((role) => (
                    <li className="min-w-0" key={role.id}>
                      <a
                        className="group/role grid items-center gap-x-4 gap-y-1 p-4 focus-ring-inset @xl:grid-cols-[1fr_auto_auto_auto] hover:bg-surface-muted"
                        href={role.href}
                      >
                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate text-body font-medium group-hover/role:underline">
                            {role.title}
                          </span>
                          {isNew(role) ? <Badge variant="success">New</Badge> : null}
                        </span>
                        <span className="flex items-center gap-1.5 text-meta text-muted-foreground">
                          <MapPin aria-hidden="true" className="size-3.5" />
                          {role.location}
                          {role.remote ? " · Remote OK" : ""}
                        </span>
                        <span className="flex items-center gap-1.5 text-meta text-muted-foreground">
                          <Briefcase aria-hidden="true" className="size-3.5" />
                          {role.type}
                        </span>
                        <span className="flex items-center gap-1 text-body font-medium text-link @xl:justify-self-end">
                          Apply
                          <ArrowUpRight aria-hidden="true" className="size-4" />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <StatePanel
            actions={
              <div className="flex w-full max-w-md flex-col items-start gap-3">
                <EmailCapture
                  action="Leave your details"
                  className="w-full"
                  confirmation={(address) => (
                    <>
                      Thanks — we will write to <strong>{address}</strong> when a role opens.
                    </>
                  )}
                  onSubmit={onLeaveDetails}
                  pendingAction="Sending…"
                />
                <Button onClick={reset} type="button" variant="link">
                  Clear the filters
                </Button>
              </div>
            }
            description="Nothing open for that team and location right now. Leave your email and we will tell you first when there is."
            icon={<Search aria-hidden="true" />}
            kind="empty"
            title="No roles match"
            titleAs="h3"
          />
        )}
      </div>
    </section>
  );
}
