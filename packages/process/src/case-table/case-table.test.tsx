import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaseTable } from "./case-table";
import { casesFromLog } from "../core/cases-from-log";
import fixture from "../core/fixtures/order-to-cash-small.json";
import type { EventLog } from "../core/types";
import type { CaseRow } from "../core/cases-from-log";

afterEach(cleanup);

const orderToCash = fixture as EventLog;

const CASES: CaseRow[] = [
  {
    caseId: "case-1",
    start: "2026-01-05T09:00:00.000Z",
    end: "2026-01-05T14:00:00.000Z",
    durationMs: 18_000_000,
    eventCount: 6,
    variantId: "v1",
    conformance: "conforming",
  },
  {
    caseId: "case-2",
    start: "2026-01-06T09:00:00.000Z",
    end: "2026-01-06T14:00:00.000Z",
    durationMs: 18_000_000,
    eventCount: 6,
    variantId: "v1",
    conformance: "nonConforming",
  },
];

describe("CaseTable — rendering", () => {
  it("renders the default column headers", () => {
    render(<CaseTable cases={CASES} />);
    expect(screen.getByText("Case")).toBeInTheDocument();
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("End")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("Events")).toBeInTheDocument();
    expect(screen.getByText("Variant")).toBeInTheDocument();
    expect(screen.getByText("Conformance")).toBeInTheDocument();
  });

  it("prints every case row's id", () => {
    render(<CaseTable cases={CASES} />);
    expect(screen.getByText("case-1")).toBeInTheDocument();
    expect(screen.getByText("case-2")).toBeInTheDocument();
  });

  it("renders the conformance badge with a non-colour (text) channel", () => {
    render(<CaseTable cases={CASES} />);
    expect(screen.getByText("Conforming")).toBeInTheDocument();
    expect(screen.getByText("Non-conforming")).toBeInTheDocument();
  });

  it("renders an empty state and not the table body when cases is empty", () => {
    render(<CaseTable cases={[]} />);
    expect(screen.getByText("No cases to display.")).toBeInTheDocument();
  });

  it("shows a loading state when loading", () => {
    render(<CaseTable cases={[]} loading />);
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
  });
});

describe("CaseTable — row activation (#204 acceptance)", () => {
  it("calls onCaseOpen with the row's caseId on click", async () => {
    const onCaseOpen = vi.fn();
    const user = userEvent.setup();
    render(<CaseTable cases={CASES} onCaseOpen={onCaseOpen} />);
    // The first cell renders both the visible "case-2" text AND the row's sr-only
    // activation button, which is also named "case-2" (#337) — take the visible one.
    const [visibleCell] = screen.getAllByText("case-2");
    await user.click(visibleCell as HTMLElement);
    expect(onCaseOpen).toHaveBeenCalledWith("case-2");
  });

  it("calls onCaseOpen on keyboard activation (Tab to the row, Enter)", async () => {
    const onCaseOpen = vi.fn();
    render(<CaseTable cases={CASES} onCaseOpen={onCaseOpen} />);

    // DataTable's row-activation button is the row's own tab stop, named after the
    // row's first cell (#337) — focus it directly rather than counting Tab stops
    // (sortable column headers are also tab stops ahead of it in DOM order).
    const rowAction = screen.getByRole("button", { name: "case-1" });
    rowAction.focus();
    await userEvent.keyboard("{Enter}");
    expect(onCaseOpen).toHaveBeenCalledWith("case-1");
  });

  it("does not add a row activation target when onCaseOpen is omitted", () => {
    render(<CaseTable cases={CASES} />);
    expect(screen.queryByRole("button", { name: "case-1" })).not.toBeInTheDocument();
  });
});

describe("CaseTable — CSV export (#204 acceptance: column order matches the configured columns)", () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;
  // jsdom's `Blob` doesn't implement `.text()`; stub the constructor so the export
  // handler's `new Blob([csv], {...})` hands back the raw CSV string directly.
  class RecordingBlob {
    parts: BlobPart[];
    constructor(parts: BlobPart[]) {
      this.parts = parts;
    }
  }

  beforeEach(() => {
    vi.stubGlobal("Blob", RecordingBlob);
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exports the visible column set, in the configured order, attribute columns included", async () => {
    const user = userEvent.setup();
    const rows = casesFromLog(orderToCash);
    render(
      <CaseTable
        cases={rows}
        columns={[
          { accessorKey: "variantId", header: "Variant" },
          { accessorKey: "caseId", header: "Case" },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(clickSpy).toHaveBeenCalled();
    const created = (global.URL.createObjectURL as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as RecordingBlob;
    const csv = created.parts[0] as string;
    const [header] = csv.split("\r\n");
    expect(header).toBe("Variant,Case");
  });

  it("is disabled with nothing to export", () => {
    render(<CaseTable cases={[]} />);
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
  });
});
