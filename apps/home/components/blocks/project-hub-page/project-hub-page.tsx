// registry: project-hub-page — copied 2026-09-19
/**
 * Project hub — projects, the issue board, the team's load and the members, as one product.
 *
 * What it shows a copier: a multi-view app inside the workspace shell where the NAVIGATION
 * swaps the view in place (`onNavigate`), four registry blocks doing the work
 * (`project-cards-01`, `kanban-board-01`, `settings-members-01`, plus a team-load view built
 * on the same issues), and one dock that explains whatever was last opened — a project or
 * an issue — without leaving the view. Moving a card on the board changes the team's load
 * and the counts in the navigation, because every view reads the same issues.
 */
"use client";

import { useMemo, useState } from "react";
import { FolderKanban, LayoutDashboard, SquareKanban, UserCog, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  BarXAxis,
  ChartCard,
  ChartTooltip,
  Grid,
  MetricCard,
  MetricGrid,
} from "@elabs-ai/components-charts";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Descriptions,
  DescriptionsItem,
  Meter,
  Toaster,
  toast,
} from "@elabs-ai/components-ui";
import {
  issues as seedIssues,
  boardColumns,
  type Issue,
  type IssueStatus,
} from "../kanban-board-01/data/issues";
import { KanbanBoard } from "../kanban-board-01/kanban-board";
import { projects, type Project } from "../project-cards-01/data/projects";
import { ProjectCards, projectHealth } from "../project-cards-01/project-cards";
import { SettingsMembers } from "../settings-members-01/settings-members";
import { WorkspaceShell, type WorkspaceNavGroup } from "../workspace-shell/workspace-shell";

type View = "overview" | "projects" | "issues" | "team" | "members";

const TITLES: Record<View, { title: string; lead: string }> = {
  overview: { title: "This cycle", lead: "Where the work stands, in four numbers and one chart." },
  projects: {
    title: "Projects",
    lead: "Progress against the calendar. Open one to see who is on it and what is left.",
  },
  issues: {
    title: "Issues",
    lead: "Drag a card, or use its Move menu. Limits are the team's own.",
  },
  team: {
    title: "Team load",
    lead: "Points in progress and in review per person, from the same board.",
  },
  members: { title: "Members", lead: "Who has access to this workspace and what they can do." },
};

/** Points a person can carry at once before the view calls it out. */
const LOAD_LIMIT = 6;

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

export interface ProjectHubPageProps {
  /** `"container"` renders the whole app inside a box you give a height. */
  frame?: "viewport" | "container";
  /** Which view opens first. */
  defaultView?: View;
}

export default function ProjectHubPage({
  frame = "viewport",
  defaultView = "projects",
}: ProjectHubPageProps) {
  const [view, setView] = useState<View>(defaultView);
  const [issues, setIssues] = useState<Issue[]>(seedIssues);
  const [opened, setOpened] = useState<
    { kind: "project"; item: Project } | { kind: "issue"; item: Issue } | null
  >(null);

  const active = issues.filter((issue) => issue.status === "doing" || issue.status === "review");
  const open = issues.filter((issue) => issue.status !== "done");
  const behind = projects.filter((project) => projectHealth(project) === "behind");
  const donePoints = issues
    .filter((issue) => issue.status === "done")
    .reduce((sum, issue) => sum + issue.points, 0);
  const allPoints = issues.reduce((sum, issue) => sum + issue.points, 0);

  const load = useMemo(() => {
    const byPerson = new Map<string, { points: number; count: number }>();
    for (const issue of active) {
      const row = byPerson.get(issue.assignee) ?? { points: 0, count: 0 };
      row.points += issue.points;
      row.count += 1;
      byPerson.set(issue.assignee, row);
    }
    return [...byPerson.entries()]
      .map(([person, row]) => ({ person, ...row }))
      .sort((a, b) => b.points - a.points);
  }, [active]);
  const overloaded = load.filter((row) => row.points > LOAD_LIMIT);

  const byStatus = boardColumns.map((column) => ({
    status: column.label,
    points: issues
      .filter((issue) => issue.status === column.id)
      .reduce((sum, issue) => sum + issue.points, 0),
  }));

  const NAV: WorkspaceNavGroup[] = [
    {
      label: "Work",
      items: [
        { id: "overview", label: "Overview", href: "#overview", icon: LayoutDashboard },
        {
          id: "projects",
          label: "Projects",
          href: "#projects",
          icon: FolderKanban,
          badge: String(projects.filter((p) => p.state === "active").length),
        },
        {
          id: "issues",
          label: "Issues",
          href: "#issues",
          icon: SquareKanban,
          badge: String(open.length),
        },
      ],
    },
    {
      label: "People",
      items: [
        {
          id: "team",
          label: "Team load",
          href: "#team",
          icon: Users,
          badge: overloaded.length > 0 ? String(overloaded.length) : undefined,
        },
        { id: "members", label: "Members", href: "#members", icon: UserCog },
      ],
    },
  ];

  const move = (issue: Issue, to: IssueStatus) => {
    setIssues((prev) =>
      prev.map((item) => (item.id === issue.id ? { ...item, status: to } : item)),
    );
    if (to === "done")
      toast.success(`${issue.id} done`, { description: `${issue.points} points closed` });
  };

  return (
    <>
      <WorkspaceShell
        activeId={view}
        dock={{
          title: opened
            ? opened.kind === "project"
              ? opened.item.name
              : opened.item.id
            : "Details",
          description: opened
            ? opened.kind === "project"
              ? `${opened.item.id} · ${opened.item.kind}`
              : opened.item.title
            : "Open a project or an issue to see it here.",
          showLabel: "Show details",
          hideLabel: "Hide details",
          open: opened !== null,
          onOpenChange: (isOpen) => !isOpen && setOpened(null),
          defaultWidth: 380,
          children:
            opened?.kind === "project" ? (
              <div className="flex flex-col gap-6">
                <Badge className="self-start">{projectHealth(opened.item)}</Badge>
                <Descriptions columns={2}>
                  <DescriptionsItem label="Lead">{opened.item.lead}</DescriptionsItem>
                  <DescriptionsItem label="Due">{opened.item.due}</DescriptionsItem>
                  <DescriptionsItem label="Tasks" numeric>
                    {opened.item.closed} of {opened.item.total}
                  </DescriptionsItem>
                  <DescriptionsItem label="Cycle" numeric>
                    day {opened.item.day} of {opened.item.days}
                  </DescriptionsItem>
                </Descriptions>
                <section aria-labelledby="hub-team" className="flex flex-col gap-2">
                  <h3 className="text-body font-semibold" id="hub-team">
                    On it
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {opened.item.team.map((person) => (
                      <li className="flex items-center gap-2 text-body" key={person}>
                        <Avatar className="size-7">
                          <AvatarFallback className="text-caption">
                            {initials(person)}
                          </AvatarFallback>
                        </Avatar>
                        {person}
                        {person === opened.item.lead ? (
                          <Badge variant="secondary">lead</Badge>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            ) : opened?.kind === "issue" ? (
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap gap-1.5">
                  {opened.item.labels.map((label) => (
                    <Badge key={label} variant="secondary">
                      {label}
                    </Badge>
                  ))}
                </div>
                <Descriptions columns={2}>
                  <DescriptionsItem label="Status">
                    {
                      boardColumns.find(
                        (column) =>
                          column.id === issues.find((i) => i.id === opened.item.id)?.status,
                      )?.label
                    }
                  </DescriptionsItem>
                  <DescriptionsItem label="Priority">{opened.item.priority}</DescriptionsItem>
                  <DescriptionsItem label="Assignee">{opened.item.assignee}</DescriptionsItem>
                  <DescriptionsItem label="Estimate" numeric>
                    {opened.item.points} points
                  </DescriptionsItem>
                </Descriptions>
              </div>
            ) : (
              <p className="text-body text-muted-foreground">
                Open a project or an issue to see it here.
              </p>
            ),
        }}
        frame={frame}
        nav={NAV}
        onNavigate={(item) => setView(item.id as View)}
        orgName="Acme Logistics"
        productName="Projects"
        trail={[
          { href: "#work", label: "Product team" },
          { href: `#${view}`, label: TITLES[view].title },
        ]}
        user={{ name: "Mei Tanaka", email: "mei@acme-logistics.example" }}
      >
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-title font-semibold">{TITLES[view].title}</h1>
            <p className="text-body text-muted-foreground">{TITLES[view].lead}</p>
          </div>

          {view === "overview" ? (
            <>
              <MetricGrid columns={4}>
                <MetricCard
                  description="of this cycle's points"
                  label="Done"
                  value={`${Math.round((donePoints / allPoints) * 100)}%`}
                />
                <MetricCard
                  description="in progress or in review"
                  label="Active issues"
                  value={String(active.length)}
                />
                <MetricCard
                  description="tasks closed trail the calendar"
                  label="Projects behind"
                  value={String(behind.length)}
                />
                <MetricCard
                  description={`carrying more than ${LOAD_LIMIT} points`}
                  label="People overloaded"
                  value={String(overloaded.length)}
                />
              </MetricGrid>
              <ChartCard
                description="Story points per board column. Work piles up where the bar is tallest."
                height={300}
                title={`${byStatus.reduce((a, b) => (b.points > a.points ? b : a)).status} holds the most work`}
              >
                <BarChart
                  accessibleLabel="Story points per board column"
                  data={byStatus}
                  plotHeight={250}
                  xDataKey="status"
                >
                  <Grid horizontal />
                  <Bar dataKey="points" fill="var(--chart-1)" lineCap="round" />
                  <BarXAxis />
                  <ChartTooltip />
                </BarChart>
              </ChartCard>
            </>
          ) : null}

          {view === "projects" ? (
            <ProjectCards onOpen={(project) => setOpened({ kind: "project", item: project })} />
          ) : null}

          {view === "issues" ? (
            <KanbanBoard
              defaultIssues={issues}
              onMove={move}
              onOpen={(issue) => setOpened({ kind: "issue", item: issue })}
            />
          ) : null}

          {view === "team" ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {overloaded.length === 0
                    ? "Nobody is carrying too much"
                    : `${overloaded.map((row) => row.person.split(" ")[0]).join(" and ")} ${overloaded.length === 1 ? "is" : "are"} over ${LOAD_LIMIT} points`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col divide-y divide-border">
                  {load.map((row) => (
                    <li className="flex items-center gap-4 py-3" key={row.person}>
                      <Avatar className="size-9">
                        <AvatarFallback className="text-caption">
                          {initials(row.person)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                        <span className="flex items-center justify-between gap-2 text-body font-medium">
                          {row.person}
                          <span className="text-meta font-normal text-muted-foreground tabular-nums">
                            {row.points} pts · {row.count} {row.count === 1 ? "issue" : "issues"}
                          </span>
                        </span>
                        <Meter
                          aria-label={`${row.person}: ${row.points} points against a limit of ${LOAD_LIMIT}`}
                          marker={LOAD_LIMIT}
                          markerLabel="limit"
                          max={Math.max(LOAD_LIMIT * 1.5, row.points)}
                          size="sm"
                          value={row.points}
                        />
                      </div>
                      {row.points > LOAD_LIMIT ? <Badge variant="warning">over</Badge> : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {view === "members" ? <SettingsMembers /> : null}
        </div>
      </WorkspaceShell>
      <Toaster />
    </>
  );
}
