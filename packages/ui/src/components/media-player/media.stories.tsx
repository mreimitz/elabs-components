import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import { useState, type ReactNode } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Media, type MediaTrack } from "./media";
import {
  synthPeaks,
  synthPosterSvgDataUrl,
  synthVttDataUrl,
  synthWavDataUrl,
} from "./media-player.fixtures";

// A silent WAV is the sound file; with no picture it plays as sound by
// detection. The `VideoFile` story forces `kind="video"` on the same file to
// show the picture chrome (no binary video fixture, no network origin).
const WAV = synthWavDataUrl(20);
const POSTER = synthPosterSvgDataUrl();
const COVER = synthPosterSvgDataUrl("Cover art");
const PEAKS = synthPeaks();
const TRACKS: MediaTrack[] = [
  {
    src: synthVttDataUrl([
      ["00:00.000", "00:06.000", "Welcome back to the weekly review."],
      ["00:06.000", "00:20.000", "First up: what shipped this week."],
    ]),
    kind: "captions",
    srclang: "en",
    label: "English",
  },
];

const meta = {
  title: "Display/Media",
  component: Media,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "One player for any file. A file with a picture plays as video; a sound-only file " +
          "draws its waveform where the picture would be (along the bottom of a `poster`, kept " +
          "as cover art), and the waveform is the scrubber — bars fill as it plays and pulse at " +
          "the playhead, never under reduced motion. Detection waits for the metadata; `kind` " +
          "skips it. `peaks` (0–1, from the app) draws the real shape; without it a stand-in " +
          "shape is drawn from `src`. `Video` is this component; `Audio` is the compact row.",
      },
    },
  },
  argTypes: {
    kind: {
      description: "What the file holds. Omit to detect it from the metadata.",
      control: { type: "radio" },
      options: [undefined, "audio", "video"],
      table: { category: "Behavior" },
    },
    controls: {
      description: "Render the default control bar.",
      control: "boolean",
      table: { category: "Behavior" },
    },
    controlsPlacement: {
      description: "`docked` under the viewport, or `overlay` (video only; sound always docks).",
      control: { type: "radio" },
      options: ["docked", "overlay"],
      table: { category: "Appearance" },
    },
    aspectRatio: {
      description: "Width ÷ height of the viewport.",
      control: "number",
      table: { category: "Appearance" },
    },
    peaks: {
      description: "The recording's shape, 0–1 — supplied by the app, never fetched.",
      control: false,
      table: { category: "Content" },
    },
  },
} satisfies Meta<typeof Media>;

export default meta;
type Story = StoryObj<typeof meta>;

const frame = "w-full max-w-2xl";

/** A sound file: the waveform takes the viewport, and the bar drops the picture controls. */
export const AudioFile: Story = {
  // Muted: a scripted click is no user activation, and the browser only autoplays muted media.
  args: { src: WAV, preload: "metadata", muted: true, className: frame },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = await waitFor(() => canvas.getByRole("region", { name: "Audio player" }), {
      timeout: 5000,
    });
    await expect(root).toHaveAttribute("data-picture", "false");
    const [seek, ...others] = canvas.getAllByRole("slider", { name: "Seek" });
    await expect(others).toHaveLength(0);
    await waitFor(() => expect(seek).toHaveAttribute("aria-valuetext", "0:00 of 0:20"));
    await expect(canvas.queryByRole("button", { name: "Enter full screen" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(root).toHaveAttribute("data-paused", "false"));
    // The pulse at the playhead is unit-tested: this runner plays every story under reduced motion.
    await userEvent.click(canvas.getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(root).toHaveAttribute("data-paused", "true"));
  },
};

/** The same file forced to play as video — the picture chrome a real video gets by detection. */
export const VideoFile: Story = {
  args: {
    src: WAV,
    kind: "video",
    poster: POSTER,
    aspectRatio: 16 / 9,
    muted: true,
    tracks: TRACKS,
    className: frame,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("region", { name: "Video player" })).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-slot="media-player-waveform"]')).toBeNull();
    await expect(
      canvasElement.querySelector('[data-slot="media-player-time-slider"]'),
    ).not.toBeNull();
  },
};

/** A podcast episode: the poster stays as cover art, the waveform runs along its bottom. */
export const CoverArt: Story = {
  args: { src: WAV, poster: COVER, preload: "metadata", peaks: PEAKS, className: frame },
  play: async ({ canvasElement }) => {
    await waitFor(
      () =>
        expect(canvasElement.querySelector('[data-slot="media-player-waveform"]')).toHaveAttribute(
          "data-placement",
          "strip",
        ),
      { timeout: 5000 },
    );
  },
};

/** The app decoded the file and passed its `peaks`: the bars draw the real recording. */
export const RealPeaks: Story = {
  args: { src: WAV, preload: "metadata", peaks: PEAKS, className: frame },
};

/** Captions still render for sound — a transcript track is the text alternative. */
export const WithCaptions: Story = {
  args: { src: WAV, preload: "metadata", tracks: TRACKS, peaks: PEAKS, className: frame },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvas.getByRole("button", { name: /captions/i })).toBeInTheDocument(),
      { timeout: 5000 },
    );
  },
};

/** `kind="audio"` skips detection: the waveform shows before the file loads. */
export const ForcedKind: Story = {
  args: { src: WAV, kind: "audio", preload: "none", className: frame },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("region", { name: "Audio player" })).toBeInTheDocument();
    await expect(canvasElement.querySelector('[data-slot="media-player-waveform"]')).not.toBeNull();
  },
};

/** A provider scoped to its own wrapper, so it never fights the toolbar's theme globals. */
function ReducedMotion({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const theme = target?.ownerDocument.documentElement.getAttribute("data-theme") ?? "light";
  return (
    <div ref={setTarget}>
      {target ? (
        <ThemeProvider
          attributeTarget={target}
          defaultTheme={theme}
          defaultMotionPreference="reduced"
          storageKey={null}
          motionStorageKey={null}
          decorationStorageKey={null}
          densityStorageKey={null}
          registerStorageKey={null}
        >
          {children}
        </ThemeProvider>
      ) : null}
    </div>
  );
}

/** Under reduced motion the bars still fill as it plays, but nothing pulses. */
export const ReducedMotionPreference: Story = {
  name: "Reduced motion",
  args: { src: WAV, preload: "metadata", muted: true, peaks: PEAKS, className: frame },
  render: (args) => (
    <ReducedMotion>
      <Media {...args} />
    </ReducedMotion>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = await waitFor(() => canvas.getByRole("region", { name: "Audio player" }), {
      timeout: 5000,
    });
    await userEvent.click(canvas.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(root).toHaveAttribute("data-paused", "false"));
    await expect(canvasElement.querySelector("[data-active]")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Pause" }));
  },
};
