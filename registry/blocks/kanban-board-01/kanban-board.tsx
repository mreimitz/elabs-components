"use client";

import { useState, type DragEvent } from "react";
import { ArrowRightLeft, ChevronsUp, ChevronUp, Equal, ChevronDown } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  Badge,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  IconButton,
} from "@elabs-ai/components-ui";
import {
  boardColumns,
  issues as seedIssues,
  type BoardColumn,
  type Issue,
  type IssuePriority,
  type IssueStatus,
} from "./data/issues";

export interface KanbanBoardProps {
  columns?: BoardColumn[];
  defaultIssues?: Issue[];
  onMove?: (issue: Issue, to: IssueStatus) => void;
  onOpen?: (issue: Issue) => void;
  className?: string;
}

const PRIORITY: Record<IssuePriority, { label: string; icon: typeof Equal; className: string }> = {
  urgent: { label: "Urgent", icon: ChevronsUp, className: "text-destructive-text" },
  high: { label: "High", icon: ChevronUp, className: "text-warning-text" },
  normal: { label: "Normal", icon: Equal, className: "text-muted-foreground" },
  low: { label: "Low", icon: ChevronDown, className: "text-muted-foreground" },
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);

/**
 * A kanban board — drag a card between columns, or use its Move menu: the same move for a
 * keyboard, a screen reader or a touch screen. Columns show their points and warn, in
 * words, when they hold more cards than the team agreed to.
 */
export function KanbanBoard({
  columns = boardColumns,
  defaultIssues = seedIssues,
  onMove,
  onOpen,
  className,
}: KanbanBoardProps) {
  const [issues, setIssues] = useState(defaultIssues);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<IssueStatus | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const move = (id: string, to: IssueStatus) => {
    const issue = issues.find((item) => item.id === id);
    if (!issue || issue.status === to) return;
    setIssues((prev) => prev.map((item) => (item.id === id ? { ...item, status: to } : item)));
    setAnnouncement(
      `${issue.id} moved to ${columns.find((column) => column.id === to)?.label ?? to}.`,
    );
    onMove?.(issue, to);
  };

  const drop = (event: DragEvent, to: IssueStatus) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain") || dragging;
    if (id) move(id, to);
    setDragging(null);
    setOver(null);
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)} data-slot="kanban-board">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((column) => {
          const cards = issues.filter((issue) => issue.status === column.id);
          const points = cards.reduce((sum, issue) => sum + issue.points, 0);
          const overLimit = column.limit !== undefined && cards.length > column.limit;
          return (
            <section
              aria-label={`${column.label}, ${cards.length} issues`}
              className={cn(
                "flex w-72 shrink-0 flex-col gap-3 rounded-lg border border-border bg-surface-muted p-3 transition-colors duration-fast",
                over === column.id && "border-primary bg-accent",
              )}
              key={column.id}
              onDragLeave={() => setOver((current) => (current === column.id ? null : current))}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(column.id);
              }}
              onDrop={(event) => drop(event, column.id)}
            >
              <header className="flex items-center justify-between gap-2 px-1">
                <h2 className="flex items-center gap-2 text-body font-semibold">
                  {column.label}
                  <span className="text-meta font-normal text-muted-foreground tabular-nums">
                    {cards.length}
                    {column.limit !== undefined ? ` / ${column.limit}` : ""}
                  </span>
                </h2>
                <span className="text-caption text-muted-foreground tabular-nums">
                  {points} pts
                </span>
              </header>
              {overLimit ? (
                <p className="rounded-md bg-warning/10 px-2 py-1 text-caption text-warning-text">
                  {cards.length - (column.limit ?? 0)} over the limit of {column.limit} — finish
                  something before starting more.
                </p>
              ) : null}
              <ul className="flex min-h-16 flex-col gap-2">
                {cards.map((issue) => {
                  const priority = PRIORITY[issue.priority];
                  const PriorityIcon = priority.icon;
                  return (
                    <li
                      className={cn(
                        "flex cursor-grab flex-col gap-2.5 rounded-md border border-border bg-card p-3 text-card-foreground shadow-sm active:cursor-grabbing",
                        dragging === issue.id && "opacity-50",
                      )}
                      draggable
                      key={issue.id}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", issue.id);
                        event.dataTransfer.effectAllowed = "move";
                        setDragging(issue.id);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          className="rounded-sm text-start text-body font-medium text-pretty hover:underline focus-ring"
                          onClick={() => onOpen?.(issue)}
                          type="button"
                        >
                          {issue.title}
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton
                              className="-me-1 -mt-1 shrink-0"
                              icon={<ArrowRightLeft />}
                              label={`Move ${issue.id}`}
                              size="icon-sm"
                              variant="ghost"
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Move to</DropdownMenuLabel>
                            {columns
                              .filter((target) => target.id !== issue.status)
                              .map((target) => (
                                <DropdownMenuItem
                                  key={target.id}
                                  onSelect={() => move(issue.id, target.id)}
                                >
                                  {target.label}
                                </DropdownMenuItem>
                              ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {issue.labels.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {issue.labels.map((label) => (
                            <Badge key={label} variant="secondary">
                              {label}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between gap-2 text-caption text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <span className="text-code">{issue.id}</span>
                          <span className={cn("flex items-center gap-0.5", priority.className)}>
                            <PriorityIcon aria-hidden="true" className="size-3.5" />
                            {priority.label}
                          </span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="tabular-nums">{issue.points} pts</span>
                          <Avatar className="size-6" title={issue.assignee}>
                            <AvatarFallback className="text-caption">
                              {initials(issue.assignee)}
                            </AvatarFallback>
                          </Avatar>
                        </span>
                      </div>
                    </li>
                  );
                })}
                {cards.length === 0 ? (
                  <li className="rounded-md border border-dashed border-border-strong p-4 text-center text-caption text-muted-foreground">
                    Nothing here. Drop a card, or use a card's Move menu.
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
