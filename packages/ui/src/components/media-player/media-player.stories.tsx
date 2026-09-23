import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "../button";
import {
  MediaPlayer,
  MediaPlayerCaptionsButton,
  MediaPlayerControls,
  MediaPlayerElement,
  MediaPlayerError,
  MediaPlayerFullscreenButton,
  MediaPlayerLoading,
  MediaPlayerMuteButton,
  MediaPlayerPlayButton,
  MediaPlayerTime,
  MediaPlayerTimeSlider,
  MediaPlayerViewport,
} from "./media-player";
import {
  synthPeaks,
  synthPosterSvgDataUrl,
  synthVttDataUrl,
  synthWavDataUrl,
} from "./media-player.fixtures";
import { MediaPlayerWaveform } from "./media-player-waveform";
import { useMediaState } from "./use-media-state";
import { useState } from "react";
import { formatMediaTime } from "../../lib/format-media-time";

const WAV = synthWavDataUrl(20);
const POSTER = synthPosterSvgDataUrl();
const VTT = synthVttDataUrl();
const PEAKS = synthPeaks();

const meta = {
  title: "Display/MediaPlayer",
  component: MediaPlayer,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The compound player behind `Audio` and `Video`. The root owns the element " +
          "subscription (`useMediaState`), the keyboard map and overlay autohide, shared as " +
          "`{ state, actions, meta }` through `useMediaPlayer()`. `MediaPlayerElement` carries " +
          "`src`; every part emits `data-slot` before its props, so a wrapper can rename it.",
      },
    },
  },
  argTypes: {
    kind: {
      description: "Which element `MediaPlayerElement` renders.",
      control: { type: "radio" },
      options: ["audio", "video"],
      table: { category: "Behavior" },
    },
    keyboardShortcuts: {
      description: "Handle the player keyboard map.",
      control: "boolean",
      table: { category: "Behavior" },
    },
  },
} satisfies Meta<typeof MediaPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    kind: "audio",
    className: "w-full max-w-lg",
    children: (
      <>
        <MediaPlayerElement src={WAV} preload="metadata" />
        <MediaPlayerControls>
          <MediaPlayerPlayButton />
          <MediaPlayerTime mode="current" />
          <MediaPlayerTimeSlider />
          <MediaPlayerTime mode="duration" />
          <MediaPlayerMuteButton />
        </MediaPlayerControls>
      </>
    ),
  },
};

/** A custom video layout: title row above, overlay controls, captions toggle. */
export const CustomVideoLayout: Story = {
  args: { kind: "video", label: "Onboarding walkthrough", className: "w-full max-w-2xl" },
  render: (args) => (
    <MediaPlayer {...args}>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-subtitle">Onboarding walkthrough</span>
        <span className="text-meta text-muted-foreground">
          <MediaPlayerTime mode="remaining" className="px-0" />
        </span>
      </div>
      <MediaPlayerViewport aspectRatio={16 / 9}>
        <MediaPlayerElement src={WAV} poster={POSTER} muted fit="cover">
          <track src={VTT} kind="captions" srcLang="en" label="English" default />
        </MediaPlayerElement>
        <MediaPlayerLoading />
        <MediaPlayerError />
        <MediaPlayerControls placement="overlay">
          <MediaPlayerPlayButton />
          <MediaPlayerTimeSlider />
          <MediaPlayerCaptionsButton />
          <MediaPlayerFullscreenButton />
        </MediaPlayerControls>
      </MediaPlayerViewport>
    </MediaPlayer>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("region", { name: "Onboarding walkthrough" })).toHaveAttribute(
      "data-kind",
      "video",
    );
    await expect(canvasElement.querySelector('[data-placement="overlay"]')).not.toBeNull();
  },
};

function HeadlessPlayer() {
  const [element, setElement] = useState<HTMLAudioElement | null>(null);
  const { state, actions } = useMediaState(element);
  return (
    <div className="flex items-center gap-3">
      {/* oxlint-disable-next-line eslint-plugin-jsx-a11y(media-has-caption) -- silent fixture */}
      <audio ref={setElement} src={WAV} preload="metadata" />
      <Button variant="outline" size="sm" onClick={actions.toggle}>
        {state.paused ? "Play" : "Pause"}
      </Button>
      <span className="text-meta tabular-nums text-muted-foreground" data-testid="clock">
        {formatMediaTime(state.currentTime)} / {formatMediaTime(state.duration)}
      </span>
      <Button variant="ghost" size="sm" onClick={() => actions.seekBy(5)}>
        +5 s
      </Button>
    </div>
  );
}

/** `useMediaState` alone drives an entirely custom UI — no `MediaPlayer` parts. */
export const HeadlessHook: Story = {
  args: { kind: "audio" },
  render: () => <HeadlessPlayer />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByTestId("clock")).toHaveTextContent("0:00 / 0:20"), {
      timeout: 5000,
    });
    await userEvent.click(canvas.getByRole("button", { name: "+5 s" }));
    await waitFor(() => expect(canvas.getByTestId("clock")).toHaveTextContent("0:05 / 0:20"));
  },
};

/**
 * `MediaPlayerWaveform` is the scrubber drawn as the recording: `inline` in a
 * control bar (the `Audio` row), `stage` where a picture would be, `strip`
 * along the bottom of cover art (both inside a `MediaPlayerViewport`). Use it
 * in place of `MediaPlayerTimeSlider`, never beside it.
 */
export const Waveform: Story = {
  args: { kind: "audio" },
  render: () => (
    <div className="flex w-full max-w-lg flex-col gap-6">
      <MediaPlayer kind="audio" label="Inline waveform">
        <MediaPlayerElement src={WAV} preload="metadata" />
        <MediaPlayerControls>
          <MediaPlayerPlayButton />
          <MediaPlayerWaveform placement="inline" peaks={PEAKS} />
          <MediaPlayerTime mode="remaining" />
        </MediaPlayerControls>
      </MediaPlayer>
      <MediaPlayer kind="video" label="Stage waveform">
        <MediaPlayerViewport className="h-40">
          <MediaPlayerElement src={WAV} preload="metadata" />
          <MediaPlayerWaveform placement="stage" peaks={PEAKS} />
        </MediaPlayerViewport>
        <MediaPlayerControls className="bg-background px-2 py-1.5">
          <MediaPlayerPlayButton />
          <MediaPlayerTime mode="current" />
          <MediaPlayerTime mode="duration" />
        </MediaPlayerControls>
      </MediaPlayer>
      <MediaPlayer kind="video" label="Strip waveform">
        <MediaPlayerViewport aspectRatio={16 / 9}>
          <MediaPlayerElement src={WAV} poster={POSTER} preload="metadata" />
          <MediaPlayerWaveform placement="strip" peaks={PEAKS} />
        </MediaPlayerViewport>
        <MediaPlayerControls className="bg-background px-2 py-1.5">
          <MediaPlayerPlayButton />
          <MediaPlayerTime mode="current" />
          <MediaPlayerTime mode="duration" />
        </MediaPlayerControls>
      </MediaPlayer>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const inline = canvas.getByRole("region", { name: "Inline waveform" });
    const seek = within(inline).getByRole("slider", { name: "Seek" });
    await waitFor(() => expect(seek).toHaveAttribute("aria-valuetext", "0:00 of 0:20"), {
      timeout: 5000,
    });
    seek.focus();
    await userEvent.keyboard("{End}");
    await waitFor(() => expect(seek).toHaveAttribute("aria-valuetext", "0:20 of 0:20"));
    for (const placement of ["inline", "stage", "strip"]) {
      await expect(
        canvasElement.querySelector(
          `[data-slot="media-player-waveform"][data-placement="${placement}"]`,
        ),
      ).not.toBeNull();
    }
  },
};
