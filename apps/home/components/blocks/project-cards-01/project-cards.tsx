// registry: project-cards-01 — copied 2026-09-19
"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  CardContent,
  cn,
  Meter,
  ToggleGroup,
  ToggleGroupItem,
} from "@elabs-ai/components-ui";
import {
  BEHIND_BY,
  projects as seedProjects,
  type Project,
  type ProjectState,
} from "./data/projects";

export interface ProjectCardsProps {
  projects?: Project[];
  onOpen?: (project: Project) => void;
  className?: string;
}

export type ProjectHealth = "on track" | "behind" | "paused" | "shipped";

/** Tasks closed against time used: the one judgement this block makes, and it shows its work. */
export function projectHealth(project: Project): ProjectHealth {
  if (project.state === "done") return "shipped";
  if (project.state === "paused") return "paused";
  return project.closed / project.total + BEHIND_BY < project.day / project.days
    ? "behind"
    : "on track";
}

const HEALTH_BADGE: Record<ProjectHealth, "success" | "destructive" | "secondary" | "info"> = {
  "on track": "success",
  behind: "destructive",
  paused: "secondary",
  shipped: "info",
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

/**
 * Projects as cards — progress against time on one meter (the marker is where the calendar
 * says you should be), a health word derived from the two, the team, and the due date.
 * The filter counts what it hides.
 */
export function ProjectCards({ projects = seedProjects, onOpen, className }: ProjectCardsProps) {
  const [state, setState] = useState<ProjectState | "all">("active");
  const shown = useMemo(
    () => (state === "all" ? projects : projects.filter((project) => project.state === state)),
    [projects, state],
  );
  const count = (value: ProjectState) =>
    projects.filter((project) => project.state === value).length;
  const behind = projects.filter((project) => projectHealth(project) === "behind").length;

  return (
    <div className={cn("@container flex flex-col gap-4", className)} data-slot="project-cards">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body text-muted-foreground">
          {shown.length} of {projects.length} projects
          {behind > 0 ? ` · ${behind} behind the calendar` : " · all on track"}
        </p>
        <ToggleGroup
          aria-label="Project state"
          onValueChange={(value) => value && setState(value as typeof state)}
          size="sm"
          type="single"
          value={state}
          variant="segmented"
        >
          <ToggleGroupItem value="active">Active ({count("active")})</ToggleGroupItem>
          <ToggleGroupItem value="paused">Paused ({count("paused")})</ToggleGroupItem>
          <ToggleGroupItem value="done">Done ({count("done")})</ToggleGroupItem>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <ul className="grid grid-cols-1 gap-4 @2xl:grid-cols-2 @5xl:grid-cols-3">
        {shown.map((project) => {
          const health = projectHealth(project);
          const progress = Math.round((project.closed / project.total) * 100);
          const elapsed = Math.round((project.day / project.days) * 100);
          return (
            <li key={project.id}>
              <Card className="group relative h-full transition-shadow duration-fast hover:shadow-md">
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-caption text-muted-foreground">
                        <span className="text-code">{project.id}</span> · {project.kind}
                      </span>
                      <h2 className="text-subtitle font-semibold">
                        <button
                          className="rounded-sm text-start after:absolute after:inset-0 focus-ring"
                          onClick={() => onOpen?.(project)}
                          type="button"
                        >
                          {project.name}
                        </button>
                      </h2>
                    </div>
                    <Badge variant={HEALTH_BADGE[health]}>{health}</Badge>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Meter
                      aria-label={`${progress}% of tasks closed with ${elapsed}% of the time used`}
                      marker={project.state === "done" ? undefined : elapsed}
                      markerLabel="today"
                      size="sm"
                      value={progress}
                    />
                    <p className="flex justify-between text-caption text-muted-foreground tabular-nums">
                      <span>
                        {project.closed} of {project.total} tasks · {progress}%
                      </span>
                      <span>
                        day {project.day} of {project.days}
                      </span>
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <ul aria-label={`Team: ${project.team.join(", ")}`} className="flex -space-x-2">
                      {project.team.slice(0, 4).map((person) => (
                        <li key={person}>
                          <Avatar className="size-7 border-2 border-card" title={person}>
                            <AvatarFallback className="text-caption">
                              {initials(person)}
                            </AvatarFallback>
                          </Avatar>
                        </li>
                      ))}
                    </ul>
                    <span className="flex items-center gap-1.5 text-meta text-muted-foreground">
                      <CalendarDays aria-hidden="true" className="size-4" />
                      {project.due}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 ? (
        <p className="py-10 text-center text-body text-muted-foreground">No {state} projects.</p>
      ) : null}
    </div>
  );
}
