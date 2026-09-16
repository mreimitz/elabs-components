import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn } from "storybook/test";
import { CaseTable } from "./case-table";
import { casesFromLog, type CaseRow } from "../core/cases-from-log";
import fixture from "../core/fixtures/order-to-cash-small.json";
import type { EventLog } from "../core/types";

const orderToCash = fixture as EventLog;
const CASES: CaseRow[] = casesFromLog(orderToCash);

// case-3 is rejected early (§4 R11's "conformance flag") — the other four follow one of
// the two happy-path variants. Attach conformance manually: `casesFromLog` never fabricates
// one (no conformance model lives in `/core`), same rule as `ProcessKpiStrip`'s own tile.
function conformanceFor(caseId: string): CaseRow["conformance"] {
  if (caseId === "case-3") return "nonConforming";
  if (caseId === "case-5") return "unknown";
  return "conforming";
}

const CASES_WITH_CONFORMANCE: CaseRow[] = CASES.map((row) => ({
  ...row,
  conformance: conformanceFor(row.caseId),
}));

const meta = {
  title: "Process/CaseTable",
  component: CaseTable,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A column configuration over `@elabs-ai/components-data`'s `DataTable` (§4 R11) — " +
          "case id, start/end, duration, event count, variant id and an optional conformance " +
          "flag. The CSV export mirrors the visible column set exactly, in the same order.",
      },
    },
  },
} satisfies Meta<typeof CaseTable>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Every case from a small order-to-cash log, no conformance model attached yet. */
export const Default: Story = {
  args: { cases: CASES },
};

/** Case-3 (rejected early) is flagged non-conforming; case-5 is unmeasured. */
export const WithConformance: Story = {
  args: { cases: CASES_WITH_CONFORMANCE },
};

/** No cases match the current filter — the export button disables with nothing to export. */
export const Empty: Story = {
  args: { cases: [] },
};

/** Cases are still loading — `DataTable`'s own skeleton rows, not a hand-rolled shimmer. */
export const Loading: Story = {
  args: { cases: [], loading: true },
};

const onCaseOpen = fn();

/**
 * Row activation (#204 acceptance): a click, or Tab + Enter on the row's own keyboard
 * activation target, opens the SAME case (RM-057 wires this to a `CaseTimeline` drawer).
 */
export const RowActivation: Story = {
  args: { cases: CASES_WITH_CONFORMANCE, onCaseOpen },
  play: async ({ canvas, userEvent }) => {
    onCaseOpen.mockClear();

    // The first cell renders both the visible "case-2" text AND the row's sr-only
    // activation button, which is also named "case-2" (#337) — take the visible one.
    const [visibleCell] = canvas.getAllByText("case-2");
    await userEvent.click(visibleCell as HTMLElement);
    await expect(onCaseOpen).toHaveBeenCalledWith("case-2");

    // Keyboard: DataTable's row-activation button is the row's own tab stop, named after
    // the row's first visible cell (#337) — Tab to it, Enter activates.
    const rowAction = canvas.getByRole("button", { name: "case-1" });
    rowAction.focus();
    await expect(rowAction).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect(onCaseOpen).toHaveBeenCalledWith("case-1");
    await expect(onCaseOpen).toHaveBeenCalledTimes(2);
  },
};
