import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShieldAlert } from "lucide-react";
import {
  STATUSES,
  STATUS_LABELS,
  StatusBadge,
  StatusIcon,
  fromTimelineStatus,
  isCustomStatus,
  type Status,
} from "./status-badge";

describe("StatusBadge", () => {
  it("renders the default label for every canonical status", () => {
    render(
      <div>
        {STATUSES.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </div>,
    );
    for (const status of STATUSES) {
      expect(screen.getByText(STATUS_LABELS[status])).toBeInTheDocument();
    }
  });

  it("children override the default label", () => {
    render(<StatusBadge status="complete">12 passed</StatusBadge>);
    expect(screen.getByText("12 passed")).toBeInTheDocument();
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
  });

  it("hides the decorative icon from AT and exposes data-status", () => {
    const { container } = render(<StatusBadge status="failed" />);
    const badge = container.querySelector('[data-status="failed"]');
    expect(badge).not.toBeNull();
    const icon = badge?.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("only the two attention states get the solid fill (hybrid visual)", () => {
    const { container } = render(
      <div>
        {STATUSES.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </div>,
    );
    const classesFor = (status: string) =>
      container.querySelector(`[data-status="${status}"]`)?.className ?? "";
    expect(classesFor("awaiting-approval")).toContain("bg-warning");
    expect(classesFor("failed")).toContain("bg-destructive");
    // calm states: wash or neutral, never the solid status fill
    expect(classesFor("complete")).toContain("bg-success/10");
    expect(classesFor("running")).toContain("bg-info/10");
    expect(classesFor("pending")).toContain("bg-secondary");
  });

  it("running spins with a motion-reduce neutralizer", () => {
    const { container } = render(<StatusBadge status="running" />);
    const icon = container.querySelector("svg");
    expect(icon?.getAttribute("class")).toContain("animate-spin");
    expect(icon?.getAttribute("class")).toContain("motion-reduce:animate-none");
  });

  it("merges className last and spreads props", () => {
    const { container } = render(
      <StatusBadge className="bg-muted" data-testid="badge" status="pending" />,
    );
    const badge = container.querySelector('[data-testid="badge"]');
    expect(badge?.className).toContain("bg-muted");
    expect(badge?.className).not.toContain("bg-secondary");
  });
});

describe("StatusIcon", () => {
  it("is decorative (aria-hidden) and status-colored", () => {
    const { container } = render(<StatusIcon status="complete" />);
    const icon = container.querySelector("svg");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(icon?.getAttribute("class")).toContain("text-success-text");
  });
});

describe("fromTimelineStatus", () => {
  it("maps the timeline 3-state vocabulary losslessly", () => {
    expect(fromTimelineStatus("done")).toBe("complete");
    expect(fromTimelineStatus("active")).toBe("running");
    expect(fromTimelineStatus("pending")).toBe("pending");
  });
});

// ---------------------------------------------------------------------------
// Canonical class regression lock (#363) — the tone axis must never restyle a
// shipped calm/loud hybrid status.
// ---------------------------------------------------------------------------

describe("StatusBadge — canonical class regression lock (#363)", () => {
  // Copied verbatim from statusBadgeVariants' `status` variant recipes.
  const EXPECTED_STATUS_RECIPE: Record<Status, string> = {
    pending: "border-transparent bg-secondary text-secondary-foreground",
    running: "border-info/40 bg-info/10 text-info-text",
    complete: "border-success/40 bg-success/10 text-success-text",
    "awaiting-approval": "border-transparent bg-warning text-warning-foreground",
    denied: "border-transparent bg-muted text-muted-foreground",
    failed: "border-transparent bg-destructive text-destructive-foreground",
    skipped: "border-transparent bg-secondary text-muted-foreground",
  };

  it("every canonical status still renders its exact, unchanged recipe classes", () => {
    const { container } = render(
      <div>
        {STATUSES.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </div>,
    );
    for (const status of STATUSES) {
      const badge = container.querySelector(`[data-status="${status}"]`);
      expect(badge).not.toBeNull();
      for (const cls of EXPECTED_STATUS_RECIPE[status].split(" ")) {
        expect(badge?.classList.contains(cls)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Custom-status escape hatch (#363)
// ---------------------------------------------------------------------------

describe("StatusBadge — custom status escape hatch (#363)", () => {
  it("renders a custom {label, tone, icon} status with the calm tone wash, not a canonical fill", () => {
    render(
      <StatusBadge status={{ label: "Stopped (guardrail)", tone: "warning", icon: ShieldAlert }} />,
    );
    const badge = screen.getByText("Stopped (guardrail)").closest("[data-slot='status-badge']");
    expect(badge).not.toBeNull();
    expect(badge).toHaveAttribute("data-status", "custom");
    expect(badge).toHaveAttribute("data-tone", "warning");
    // calm alpha-wash, matching the canonical `running`/`complete` recipe shape
    expect(badge?.classList.contains("bg-warning/10")).toBe(true);
    expect(badge?.classList.contains("text-warning-text")).toBe(true);
    // NOT the solid `awaiting-approval` attention fill
    expect(badge?.classList.contains("bg-warning")).toBe(false);
    // the icon rendered and is decorative
    const icon = badge?.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("a custom status with no icon renders label-only", () => {
    render(<StatusBadge status={{ label: "Aborted", tone: "neutral" }} />);
    const badge = screen.getByText("Aborted").closest("[data-slot='status-badge']");
    expect(badge?.querySelector("svg")).toBeNull();
  });

  it("hideIcon suppresses the icon on a custom status that has one", () => {
    render(
      <StatusBadge status={{ label: "Stopped", tone: "warning", icon: ShieldAlert }} hideIcon />,
    );
    const badge = screen.getByText("Stopped").closest("[data-slot='status-badge']");
    expect(badge?.querySelector("svg")).toBeNull();
  });

  it("children override a custom status's label too", () => {
    render(<StatusBadge status={{ label: "Aborted", tone: "neutral" }}>Custom text</StatusBadge>);
    expect(screen.getByText("Custom text")).toBeInTheDocument();
    expect(screen.queryByText("Aborted")).not.toBeInTheDocument();
  });

  it("isCustomStatus narrows correctly for both branches (runtime)", () => {
    expect(isCustomStatus("complete")).toBe(false);
    expect(isCustomStatus({ label: "Aborted", tone: "neutral" })).toBe(true);
  });

  it("TYPE LOCK: a canonical status cannot also carry a tone prop (integrity constraint 1)", () => {
    // `tone` is reachable ONLY through the CustomStatus object form — never as
    // an independent prop — so a canonical status can never be recolored.
    const typeOnlyRecolorAttempt = () => (
      // @ts-expect-error — `tone` is not a public StatusBadge prop; passing it
      // alongside a canonical `status` string must fail to compile (#363).
      <StatusBadge status="failed" tone="success" />
    );
    expect(typeof typeOnlyRecolorAttempt).toBe("function");
  });
});
