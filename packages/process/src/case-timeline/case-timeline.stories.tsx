import type { Meta, StoryObj } from "@storybook/react-vite";
import { CaseTimeline } from "./case-timeline";
import type { EventRow } from "../core/types";

const CASE_ID = "case-1";

/** Three activities, back to back — no waiting time, no overlap. */
const SEQUENTIAL_EVENTS: EventRow[] = [
  { caseId: CASE_ID, activity: "Create Order", startTimestamp: 0, timestamp: 1_800_000 },
  {
    caseId: CASE_ID,
    activity: "Check Credit",
    startTimestamp: 1_800_000,
    timestamp: 3_600_000,
  },
  {
    caseId: CASE_ID,
    activity: "Approve Order",
    startTimestamp: 3_600_000,
    timestamp: 5_400_000,
  },
];

/** Two gaps: the case waits between every pair of activities. */
const WAITING_TIME_EVENTS: EventRow[] = [
  { caseId: CASE_ID, activity: "Create Order", startTimestamp: 0, timestamp: 1_800_000 },
  {
    caseId: CASE_ID,
    activity: "Check Credit",
    startTimestamp: 3_600_000,
    timestamp: 5_400_000,
  },
  {
    caseId: CASE_ID,
    activity: "Approve Order",
    startTimestamp: 9_000_000,
    timestamp: 10_800_000,
  },
];

/** "Check Credit" and "Check Inventory" run at the same time — both flag parallel. */
const PARALLEL_EVENTS: EventRow[] = [
  { caseId: CASE_ID, activity: "Check Credit", startTimestamp: 0, timestamp: 3_600_000 },
  {
    caseId: CASE_ID,
    activity: "Check Inventory",
    startTimestamp: 1_800_000,
    timestamp: 5_400_000,
  },
  {
    caseId: CASE_ID,
    activity: "Approve Order",
    startTimestamp: 7_200_000,
    timestamp: 9_000_000,
  },
];

const meta = {
  title: "Process/CaseTimeline",
  component: CaseTimeline,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A thin wrapper over `@elabs-ai/components-charts`'s `Gantt` (§4 R12): one row per " +
          "activity instance, waiting time as RM-047 gap bands, overlapping instances flagged " +
          "parallel with an existing `Gantt` tone plus a visible, non-colour text tag.",
      },
    },
  },
} satisfies Meta<typeof CaseTimeline>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No waiting time, no overlap — the plain case. */
export const Sequential: Story = {
  args: { caseId: CASE_ID, events: SEQUENTIAL_EVENTS },
};

/** Two hatched gap bands render the idle time between activities (RM-047). */
export const WithWaitingTime: Story = {
  args: { caseId: CASE_ID, events: WAITING_TIME_EVENTS },
};

/** "Check Credit" and "Check Inventory" overlap — both render the parallel tag. */
export const ParallelActivities: Story = {
  args: { caseId: CASE_ID, events: PARALLEL_EVENTS },
};

/** No events for this case yet — `Gantt`'s own built-in empty state. */
export const Empty: Story = {
  args: { caseId: CASE_ID, events: [] },
};
