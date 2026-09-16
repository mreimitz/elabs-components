import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { liftHappyPath } from "../core/reference-model";
import { emptyDeviationCounts, tokenReplay } from "../core/token-replay";
import {
  CONFORMANCE_FIXTURE_LOG,
  CONFORMANCE_FIXTURE_PATH,
} from "../conformance-overlay/conformance-fixture";
import { ViolationList } from "./violation-list";

const conformance = tokenReplay(CONFORMANCE_FIXTURE_LOG, liftHappyPath(CONFORMANCE_FIXTURE_PATH));

const meta = {
  title: "Process/ViolationList",
  component: ViolationList,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Deviations from a token-replay result, grouped by type and ranked by count, with " +
          "each type’s share of cases and a final conforming row. Choosing a row emits a " +
          '`{ kind: "cases", ids }` filter intent for exactly the cases that deviated that ' +
          "way — the component never filters anything itself.",
      },
    },
  },
  args: { conformance, onFilterIntent: fn() },
} satisfies Meta<typeof ViolationList>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Ranked deviation types; a row click or Enter emits that row’s case ids. */
export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Skipped step/ }));
    await expect(args.onFilterIntent).toHaveBeenLastCalledWith({
      kind: "cases",
      ids: ["c07", "c08"],
    });
    canvas.getByRole("button", { name: /Undesired activity/ }).focus();
    await userEvent.keyboard("{Enter}");
    await expect(args.onFilterIntent).toHaveBeenLastCalledWith({ kind: "cases", ids: ["c09"] });
  },
};

/** Without `onFilterIntent` the rows are read-only — no buttons. */
export const ReadOnly: Story = {
  args: { onFilterIntent: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
  },
};

/** A replay over zero cases. */
export const Empty: Story = {
  args: {
    conformance: {
      overallFitness: 0,
      traces: [],
      deviationCounts: emptyDeviationCounts(),
      perActivity: {},
      perEdge: {},
    },
  },
};

/** Replay still running. */
export const Loading: Story = {
  args: { loading: true },
};
