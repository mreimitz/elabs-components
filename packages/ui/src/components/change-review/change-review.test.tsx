import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ChangeReview,
  ChangeReviewHeader,
  ChangeReviewHunk,
  ChangeReviewList,
  ChangeReviewProvider,
  type ChangeHunk,
} from "./change-review";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const HUNKS: ChangeHunk[] = [
  { id: "h1", title: "config/a.json", status: "modified", before: "old", after: "new" },
  { id: "h2", title: "src/b.ts", status: "added", after: "added content" },
  { id: "h3", title: "src/c.ts", status: "removed", before: "removed content" },
];

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("ChangeReview — render", () => {
  it("renders the header and all hunks", () => {
    render(<ChangeReview hunks={HUNKS} />);
    expect(screen.getByText("Review changes")).toBeInTheDocument();
    expect(screen.getByText("0 of 3 approved")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("renders an empty state when no hunks are provided", () => {
    render(<ChangeReview hunks={[]} />);
    expect(screen.getByText("No changes to review")).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    // Bulk action buttons hidden when list is empty
    expect(screen.queryByRole("button", { name: /approve all/i })).not.toBeInTheDocument();
  });

  it("renders hunk titles", () => {
    render(<ChangeReview hunks={HUNKS} />);
    expect(screen.getByText("config/a.json")).toBeInTheDocument();
    expect(screen.getByText("src/b.ts")).toBeInTheDocument();
  });

  it("renders before/after content", () => {
    render(<ChangeReview hunks={[HUNKS[0]!]} />);
    expect(screen.getByText("old")).toBeInTheDocument();
    expect(screen.getByText("new")).toBeInTheDocument();
  });

  it("renders provenance as structured object", () => {
    render(
      <ChangeReview
        hunks={HUNKS}
        provenance={{ author: "Atlas Agent", model: "claude-sonnet-4-6", timestamp: "14:02" }}
      />,
    );
    expect(screen.getByText("Atlas Agent")).toBeInTheDocument();
    expect(screen.getByText("claude-sonnet-4-6")).toBeInTheDocument();
  });

  it("renders provenance as arbitrary ReactNode", () => {
    render(
      <ChangeReview hunks={HUNKS} provenance={<span data-testid="custom-prov">Custom</span>} />,
    );
    expect(screen.getByTestId("custom-prov")).toBeInTheDocument();
  });
});

// ─── Initial state with controlled approved set ───────────────────────────────

describe("ChangeReview — controlled approved prop", () => {
  it("shows correct count when pre-approved hunks are passed", () => {
    render(<ChangeReview hunks={HUNKS} approved={new Set(["h1", "h2"])} />);
    expect(screen.getByText("2 of 3 approved")).toBeInTheDocument();
  });

  it("accepts an array as the approved prop", () => {
    render(<ChangeReview hunks={HUNKS} approved={["h1"]} />);
    expect(screen.getByText("1 of 3 approved")).toBeInTheDocument();
  });

  it("shows Approved badge on approved hunks", () => {
    render(<ChangeReview hunks={HUNKS} approved={new Set(["h1"])} />);
    const badges = screen.getAllByText("Approved");
    expect(badges).toHaveLength(1);
  });

  it("disables Approve all when all are already approved", () => {
    render(<ChangeReview hunks={HUNKS} approved={new Set(["h1", "h2", "h3"])} />);
    expect(screen.getByRole("button", { name: /approve all/i })).toBeDisabled();
  });

  it("disables Reject all when none are approved", () => {
    render(<ChangeReview hunks={HUNKS} approved={new Set()} />);
    expect(screen.getByRole("button", { name: /reject all/i })).toBeDisabled();
  });
});

// ─── Toggle (uncontrolled) ────────────────────────────────────────────────────

describe("ChangeReview — uncontrolled toggle", () => {
  it("approves a hunk when the approve button is clicked", async () => {
    const user = userEvent.setup();
    render(<ChangeReview hunks={HUNKS} />);

    const btn = screen.getByRole("button", { name: /approve hunk: config\/a\.json/i });
    await user.click(btn);

    expect(screen.getByText("1 of 3 approved")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  it("toggles back to un-approved on second click", async () => {
    const user = userEvent.setup();
    render(<ChangeReview hunks={HUNKS} />);

    const btn = screen.getByRole("button", { name: /approve hunk: config\/a\.json/i });
    await user.click(btn); // approve
    await user.click(screen.getByRole("button", { name: /reject hunk: config\/a\.json/i })); // reject

    expect(screen.getByText("0 of 3 approved")).toBeInTheDocument();
    expect(screen.queryByText("Approved")).not.toBeInTheDocument();
  });
});

// ─── Bulk actions (uncontrolled) ──────────────────────────────────────────────

describe("ChangeReview — bulk actions", () => {
  it("approves all hunks on Approve all click", async () => {
    const user = userEvent.setup();
    render(<ChangeReview hunks={HUNKS} />);

    await user.click(screen.getByRole("button", { name: /approve all/i }));

    expect(screen.getByText("3 of 3 approved")).toBeInTheDocument();
    expect(screen.getAllByText("Approved")).toHaveLength(3);
  });

  it("rejects all hunks on Reject all click (uncontrolled)", async () => {
    const user = userEvent.setup();
    render(<ChangeReview hunks={HUNKS} />);

    // First approve all, then reject all
    await user.click(screen.getByRole("button", { name: /approve all/i }));
    expect(screen.getByText("3 of 3 approved")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /reject all/i }));
    expect(screen.getByText("0 of 3 approved")).toBeInTheDocument();
  });
});

// ─── Controlled callbacks ─────────────────────────────────────────────────────

describe("ChangeReview — controlled callbacks", () => {
  it("calls onToggle with the hunk id and next state", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<ChangeReview hunks={HUNKS} approved={new Set()} onToggle={onToggle} />);

    await user.click(screen.getByRole("button", { name: /approve hunk: config\/a\.json/i }));

    expect(onToggle).toHaveBeenCalledWith("h1", true);
  });

  it("calls onApproveAll when Approve all is clicked", async () => {
    const user = userEvent.setup();
    const onApproveAll = vi.fn();
    render(<ChangeReview hunks={HUNKS} approved={new Set()} onApproveAll={onApproveAll} />);

    await user.click(screen.getByRole("button", { name: /approve all/i }));

    expect(onApproveAll).toHaveBeenCalledOnce();
  });

  it("calls onRejectAll when Reject all is clicked", async () => {
    const user = userEvent.setup();
    const onRejectAll = vi.fn();
    render(<ChangeReview hunks={HUNKS} approved={new Set(["h1"])} onRejectAll={onRejectAll} />);

    await user.click(screen.getByRole("button", { name: /reject all/i }));

    expect(onRejectAll).toHaveBeenCalledOnce();
  });
});

// ─── Custom renderHunk ────────────────────────────────────────────────────────

describe("ChangeReview — renderHunk", () => {
  it("uses the custom renderHunk prop when provided", () => {
    render(
      <ChangeReview
        hunks={HUNKS}
        renderHunk={(hunk) => <span data-testid="custom">{hunk.id}</span>}
      />,
    );
    const customs = screen.getAllByTestId("custom");
    expect(customs).toHaveLength(3);
    expect(customs[0]!.textContent).toBe("h1");
  });
});

// ─── Accessibility ────────────────────────────────────────────────────────────

describe("ChangeReview — accessibility", () => {
  it("hunk approve button has an accessible aria-label", () => {
    render(<ChangeReview hunks={HUNKS} />);
    expect(
      screen.getByRole("button", { name: /approve hunk: config\/a\.json/i }),
    ).toBeInTheDocument();
  });

  it("toggle button aria-pressed reflects approval state", async () => {
    const user = userEvent.setup();
    render(<ChangeReview hunks={HUNKS} />);

    const btn = screen.getByRole("button", { name: /approve hunk: config\/a\.json/i });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await user.click(btn);
    // After click the button becomes "reject" (aria-pressed=true)
    const afterBtn = screen.getByRole("button", { name: /reject hunk: config\/a\.json/i });
    expect(afterBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("hunk list is an <ol> with aria-labelledby pointing to the heading", () => {
    render(<ChangeReview hunks={HUNKS} />);
    const list = screen.getByRole("list");
    const labelledBy = list.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    const heading = document.getElementById(labelledBy!);
    expect(heading?.textContent).toBe("Review changes");
  });
});

// ─── Compound usage ───────────────────────────────────────────────────────────

describe("ChangeReview — compound component parts", () => {
  it("throws when a sub-component is used outside a Provider", () => {
    // Suppress console.error from React during error boundary test
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ChangeReviewHeader />)).toThrow(
      "ChangeReview sub-components must be rendered inside ChangeReview.Provider",
    );
    spy.mockRestore();
  });

  it("renders via compound parts with the same output as the root", () => {
    render(
      <ChangeReviewProvider hunks={HUNKS}>
        <ChangeReviewHeader />
        <ChangeReviewList>
          {HUNKS.map((h) => (
            <ChangeReviewHunk key={h.id} hunk={h} />
          ))}
        </ChangeReviewList>
      </ChangeReviewProvider>,
    );
    expect(screen.getByText("Review changes")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
