// registry: todo-list-01 — copied 2026-09-19
"use client";

import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  cn,
  IconButton,
  Input,
  ToggleGroup,
  ToggleGroupItem,
} from "@elabs-ai/components-ui";

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  due?: "today" | "overdue" | "later";
}

export interface TodoListProps {
  defaultTodos?: Todo[];
  onChange?: (todos: Todo[]) => void;
}

const DEFAULT_TODOS: Todo[] = [
  { id: "1", title: "Give Leila a fix date for the Depot 2 ticket", done: false, due: "overdue" },
  { id: "2", title: "Confirm the Oakland diversion with Atlas Cargo", done: false, due: "today" },
  { id: "3", title: "Send the August overage breakdown to Pieter", done: false, due: "today" },
  { id: "4", title: "Review next week's cut-off times", done: false, due: "later" },
  { id: "5", title: "Book the quarterly review with Northwind", done: true },
];

const DUE_BADGE = { overdue: "destructive", today: "warning", later: "secondary" } as const;

/**
 * A task list — add with Enter, tick to complete, filter by what is left, clear what is done.
 * The header counts what is open and calls out what is overdue; the empty filter says so.
 */
export function TodoList({ defaultTodos = DEFAULT_TODOS, onChange }: TodoListProps) {
  const [todos, setTodos] = useState(defaultTodos);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [draft, setDraft] = useState("");
  const update = (next: Todo[]) => {
    setTodos(next);
    onChange?.(next);
  };

  const open = todos.filter((todo) => !todo.done);
  const overdue = open.filter((todo) => todo.due === "overdue").length;
  const shown = todos.filter((todo) =>
    filter === "all" ? true : filter === "done" ? todo.done : !todo.done,
  );

  function add(event: FormEvent) {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    update([{ id: `${Date.now()}`, title, done: false, due: "today" }, ...todos]);
    setDraft("");
    if (filter === "done") setFilter("open");
  }

  return (
    <Card className="mx-auto w-full max-w-xl" data-slot="todo-list">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>
          {open.length === 0 ? "Nothing left to do" : `${open.length} to do`}
          {overdue > 0 ? <span className="text-destructive-text">, {overdue} overdue</span> : null}
        </CardTitle>
        <ToggleGroup
          aria-label="Show"
          onValueChange={(value) => value && setFilter(value as typeof filter)}
          size="sm"
          type="single"
          value={filter}
          variant="segmented"
        >
          <ToggleGroupItem value="open">Open</ToggleGroupItem>
          <ToggleGroupItem value="done">Done</ToggleGroupItem>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="flex gap-2" onSubmit={add}>
          <Input
            aria-label="New task"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Add a task and press Enter"
            value={draft}
          />
          <Button disabled={!draft.trim()} type="submit">
            <Plus aria-hidden="true" />
            Add
          </Button>
        </form>
        {shown.length === 0 ? (
          <p className="py-6 text-center text-body text-muted-foreground">
            {filter === "done" ? "Nothing completed yet." : "All clear. Add a task above."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {shown.map((todo) => (
              <li className="group flex items-center gap-3 py-2.5" key={todo.id}>
                <Checkbox
                  aria-label={todo.done ? `Reopen: ${todo.title}` : `Complete: ${todo.title}`}
                  checked={todo.done}
                  onCheckedChange={(checked) =>
                    update(
                      todos.map((t) => (t.id === todo.id ? { ...t, done: checked === true } : t)),
                    )
                  }
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 text-body",
                    todo.done && "text-muted-foreground line-through",
                  )}
                >
                  {todo.title}
                </span>
                {todo.due && !todo.done ? (
                  <Badge variant={DUE_BADGE[todo.due]}>{todo.due}</Badge>
                ) : null}
                <IconButton
                  icon={<Trash2 />}
                  label={`Delete: ${todo.title}`}
                  onClick={() => update(todos.filter((t) => t.id !== todo.id))}
                  size="icon-sm"
                  variant="ghost"
                />
              </li>
            ))}
          </ul>
        )}
        {todos.some((todo) => todo.done) ? (
          <Button className="self-start" onClick={() => update(open)} size="sm" variant="ghost">
            Clear completed
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
