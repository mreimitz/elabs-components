import type { Meta, StoryObj } from "@storybook/react-vite";
import "@xyflow/react/dist/style.css";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { discoverGraph } from "../core/discover-graph";
import fixture from "../core/fixtures/order-to-cash-small.json";
import type { EventLog } from "../core/types";
import { processEdgeId } from "../process-map/map-model";
import { ProcessReplay } from "./process-replay";

const log = fixture as EventLog;
const graph = discoverGraph(log);
const HOUR = 3_600_000;

const tokenEls = (root: HTMLElement) => [
  ...root.querySelectorAll<SVGCircleElement>('[data-slot="flow-edge-tokens-token"]'),
];

const readout = (root: HTMLElement) =>
  root.querySelector<HTMLElement>('[data-slot="replay-controls-readout"]');

const meta = {
  title: "Process/ProcessReplay",
  component: ProcessReplay,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Cases replayed as tokens moving along the process map’s own transitions, with a " +
          "time slider, play/pause, a speed select and a live in-flight case count. " +
          "Congestion is never colour alone: a busy transition carries more tokens, each " +
          "drawn larger, and a ranked list beside the map names the busiest transitions " +
          "and when they peaked. Under reduced motion nothing starts on its own.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="h-[40rem] w-full bg-background p-4">
        <Story />
      </div>
    ),
  ],
  args: { graph, log, synchronizedStart: true, defaultTime: 1.5 * HOUR },
} satisfies Meta<typeof ProcessReplay>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Paused at 1.5 h after each case’s start: one token per in-flight case, and the busiest
 * transition (two cases on Check Credit → Approve Order) draws the largest tokens.
 */
export const Paused: Story = {
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(tokenEls(canvasElement)).toHaveLength(5), { timeout: 5000 });
    const radii = tokenEls(canvasElement).map((token) => Number(token.getAttribute("r")));
    const busiestId = processEdgeId("Check Credit", "Approve Order");
    const busiest = [...canvasElement.querySelectorAll(".react-flow__edge")].find(
      (edge) => edge.getAttribute("data-id") === busiestId,
    );
    const busiestTokens = [
      ...(busiest?.querySelectorAll('[data-slot="flow-edge-tokens-token"]') ?? []),
    ];
    await expect(busiestTokens).toHaveLength(2);
    const busiestRadius = Math.max(
      ...busiestTokens.map((token) => Number(token.getAttribute("r"))),
    );
    await expect(busiestRadius).toBe(Math.max(...radii));
    await expect(Math.min(...radii)).toBeLessThan(busiestRadius);
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Play replay" })).toBeVisible();
    await expect(readout(canvasElement)).toHaveTextContent("+1.5 h · 5 in flight");
  },
};

/**
 * Playing from the start: the playhead advances and tokens move along edges. The test browser
 * runs with reduced motion, where `defaultPlaying` is held, so the play function presses play
 * the way a reader would.
 */
export const Playing: Story = {
  args: { defaultTime: 0, defaultPlaying: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const play = canvas.queryByRole("button", { name: "Play replay" });
    if (play) await userEvent.click(play);
    const slider = canvas.getByRole("slider", { name: "Replay time" });
    await waitFor(() => expect(Number(slider.getAttribute("aria-valuenow"))).toBeGreaterThan(0), {
      timeout: 5000,
    });
    await expect(canvas.getByRole("button", { name: "Pause replay" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Pause replay" }));
    await expect(canvas.getByRole("button", { name: "Play replay" })).toBeVisible();
  },
};

/** Synchronized start: every case begins at t = 0, so all five tokens share the first edge. */
export const SynchronizedStart: Story = {
  args: { defaultTime: 0 },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(tokenEls(canvasElement)).toHaveLength(5), { timeout: 5000 });
    await expect(readout(canvasElement)).toHaveTextContent("+0 s · 5 in flight");
  },
};

/** Wall-clock time: cases start on different days, so the readout shows dates. */
export const WallClock: Story = {
  args: { synchronizedStart: false, defaultTime: 0 },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(tokenEls(canvasElement)).toHaveLength(1), { timeout: 5000 });
  },
};

/** The speed select and the time slider, driven from the keyboard. */
export const SpeedControl: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const speed = canvas.getByRole("combobox", { name: "Playback speed" });
    speed.focus();
    await userEvent.keyboard("{Enter}");
    const option = await within(canvasElement.ownerDocument.body).findByRole("option", {
      name: "4×",
    });
    await userEvent.click(option);
    await waitFor(() => expect(speed).toHaveTextContent("4×"));

    const slider = canvas.getByRole("slider", { name: "Replay time" });
    slider.focus();
    await userEvent.keyboard("{Home}");
    await expect(slider).toHaveAttribute("aria-valuetext", "+0 s");
    await expect(readout(canvasElement)).toHaveTextContent("+0 s · 5 in flight");
  },
};

/**
 * Reduced motion: `defaultPlaying` is ignored — nothing moves until the reader presses play —
 * and the ranked congestion list carries the whole reading in text.
 */
export const ReducedMotion: Story = {
  args: { defaultPlaying: true },
  globals: { motionPref: "reduced" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Play replay" })).toBeVisible();
    await expect(canvasElement.querySelectorAll("animateMotion")).toHaveLength(0);
    const heat = canvas.getByRole("region", { name: "Most congested transitions" });
    await expect(heat).toHaveTextContent(/Busiest: Create Order → Check Credit, 5 cases/);
    await expect(within(heat).getAllByRole("listitem").length).toBeGreaterThan(0);
  },
};

/** A log with no cases. */
export const Empty: Story = {
  args: { log: { events: [] } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot="process-replay"]')).toHaveAttribute(
      "data-state",
      "empty",
    );
    await expect(within(canvasElement).getByText("No cases to replay")).toBeInTheDocument();
  },
};

/** No log yet. */
export const Loading: Story = {
  args: { loading: true },
};
