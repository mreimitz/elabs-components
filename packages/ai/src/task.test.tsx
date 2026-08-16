import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Task, TaskContent, TaskItem, TaskItemFile, TaskTrigger } from "./task";

describe("Task (#192, research 10 §B.6)", () => {
  it("is collapsed by default (defaultOpen flipped true → false)", () => {
    render(
      <Task>
        <TaskTrigger title="Compiled the board note" />
        <TaskContent>
          <TaskItem>Reconciled 8 rows</TaskItem>
        </TaskContent>
      </Task>,
    );
    expect(screen.getByText("Compiled the board note")).toBeInTheDocument();
    expect(screen.queryByText("Reconciled 8 rows")).not.toBeInTheDocument();
  });

  it("renders items on the canonical rail with unbordered file chips when open", () => {
    render(
      <Task defaultOpen>
        <TaskTrigger title="Compiled the board note" />
        <TaskContent>
          <TaskItem>
            Wrote <TaskItemFile data-testid="chip">board-note.md</TaskItemFile>
          </TaskItem>
        </TaskContent>
      </Task>,
    );
    const li = screen.getByRole("listitem");
    expect(li).toHaveAttribute("data-status", "complete");
    const chip = screen.getByTestId("chip");
    expect(chip.tagName).toBe("SPAN");
    expect(chip.className.split(" ")).not.toContain("border");
  });
});
