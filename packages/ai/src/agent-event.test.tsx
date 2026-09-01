import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentEvent } from "./agent-event";
import { AgentStep, AgentTimeline } from "./agent-timeline";

describe("AgentEvent (#109)", () => {
  it("renders on the same <ol> rail as an AgentStep — no second spine", () => {
    render(
      <AgentTimeline data-testid="timeline">
        <AgentStep name="Queried finance.revenue" status="complete" />
        <AgentEvent label="pre_tool_use" outcome="ok" />
      </AgentTimeline>,
    );
    expect(screen.getByTestId("timeline").tagName).toBe("OL");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    // The AgentEvent item carries the same data-slot as any other li in this
    // rail's list structure, and is reachable via getAllByRole("listitem")
    // exactly like AgentStep — i.e. one list, not a nested second rail.
    expect(items[1]).toHaveAttribute("data-slot", "agent-event");
  });

  it("maps outcome onto the existing closed Status — no new status value", () => {
    const { rerender } = render(
      <AgentTimeline>
        <AgentEvent label="stop" outcome="ok" />
      </AgentTimeline>,
    );
    expect(screen.getByRole("listitem")).toHaveAttribute("data-status", "complete");

    rerender(
      <AgentTimeline>
        <AgentEvent label="pre_tool_use" outcome="blocked" />
      </AgentTimeline>,
    );
    expect(screen.getByRole("listitem")).toHaveAttribute("data-status", "denied");

    rerender(
      <AgentTimeline>
        <AgentEvent label="post_tool_use" outcome="failed" />
      </AgentTimeline>,
    );
    expect(screen.getByRole("listitem")).toHaveAttribute("data-status", "failed");
  });

  it("renders the label and, when given, the event-level phase as visible text", () => {
    render(
      <AgentTimeline>
        <AgentEvent label="user_prompt_submit" phase="lifecycle" outcome="ok" />
      </AgentTimeline>,
    );
    expect(screen.getByText("user_prompt_submit")).toBeInTheDocument();
    // The phase renders as its own data-slot part, distinct from the
    // per-check `phase` field on CheckResult (never the same prop/slot), and
    // carries real, non-empty visible text.
    const phaseNode = document.querySelector('[data-slot="agent-event-phase"]');
    expect(phaseNode).not.toBeNull();
    expect(phaseNode?.textContent?.trim()).toBeTruthy();
  });

  it("renders no phase part when phase is omitted", () => {
    render(
      <AgentTimeline>
        <AgentEvent label="post_tool_use" outcome="ok" />
      </AgentTimeline>,
    );
    expect(document.querySelector('[data-slot="agent-event-phase"]')).toBeNull();
  });

  it("renders a failed check distinguishably from a passed one in ACCESSIBLE TEXT, not only a colour class", () => {
    render(
      <AgentTimeline>
        <AgentEvent
          label="post_tool_use"
          outcome="failed"
          checks={[
            { label: "eslint", ok: true },
            { label: "tsc", ok: false, detail: "2 errors" },
          ]}
        />
      </AgentTimeline>,
    );

    const passRow = screen.getByText("eslint").closest('[data-slot="agent-event-check"]');
    const failRow = screen.getByText("tsc").closest('[data-slot="agent-event-check"]');
    expect(passRow).not.toBeNull();
    expect(failRow).not.toBeNull();

    // data-ok is a machine attribute — not itself sufficient (invisible to AT).
    expect(passRow).toHaveAttribute("data-ok", "true");
    expect(failRow).toHaveAttribute("data-ok", "false");

    // The ACCESSIBLE TEXT differs between the two rows: the status-word node's
    // text content is not the same string for a pass vs a fail. This holds
    // whether `t()` resolves a registered translation or falls back to the
    // raw key, so the assertion does not hardcode "Passed"/"Failed" copy that
    // this package does not own.
    const passStatus = passRow?.querySelector('[data-slot="agent-event-check-status"]');
    const failStatus = failRow?.querySelector('[data-slot="agent-event-check-status"]');
    expect(passStatus?.textContent).toBeTruthy();
    expect(failStatus?.textContent).toBeTruthy();
    expect(passStatus?.textContent).not.toBe(failStatus?.textContent);

    // The failing check's detail line is also visible, real text (not only color).
    expect(screen.getByText("2 errors")).toBeInTheDocument();
  });

  it("renders a CheckSummary as passed/ran text instead of a row list", () => {
    // Numeric interpolation into the localized "passed/ran" copy is exercised
    // by the shared `t()`/messages machinery elsewhere (this package does not
    // own `messages.ts` — see the message keys reported alongside this
    // component). Here we assert the STRUCTURAL contract: a count summary
    // renders one text node in the summary slot, never the per-row list.
    render(
      <AgentTimeline>
        <AgentEvent label="pre_tool_use" outcome="ok" checks={{ ran: 4, passed: 3 }} />
      </AgentTimeline>,
    );
    const summary = document.querySelector('[data-slot="agent-event-checks-summary"]');
    expect(summary).not.toBeNull();
    expect(summary?.textContent?.trim()).toBeTruthy();
    expect(document.querySelector('[data-slot="agent-event-checks"]')).toBeNull();
  });

  it("renders duration via the shared formatElapsed, not a second formatter", () => {
    render(
      <AgentTimeline>
        <AgentEvent label="stop" outcome="ok" durationMs={8000} />
      </AgentTimeline>,
    );
    // formatElapsed(8000) === "8.0s" (packages/ui/src/lib/format-duration.ts)
    expect(screen.getByText("8.0s")).toBeInTheDocument();
  });

  it("merges className and spreads props on the underlying li, like AgentStep", () => {
    render(
      <AgentTimeline>
        <AgentEvent label="stop" className="custom-event" aria-label="event" />
      </AgentTimeline>,
    );
    const li = screen.getByRole("listitem");
    expect(li).toHaveClass("custom-event");
    expect(li).toHaveAttribute("aria-label", "event");
  });
});
