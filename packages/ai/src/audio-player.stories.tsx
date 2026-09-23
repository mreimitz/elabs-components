import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";

import { silentWavDataUrl } from "./_media-fixtures";
import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerDurationDisplay,
  AudioPlayerElement,
  AudioPlayerMuteButton,
  AudioPlayerPlayButton,
  AudioPlayerSeekBackwardButton,
  AudioPlayerSeekForwardButton,
  AudioPlayerTimeDisplay,
  AudioPlayerTimeRange,
  AudioPlayerVolumeRange,
} from "./audio-player";

const meta = {
  title: "AI/AudioPlayer",
  component: AudioPlayer,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "An audio player for spoken agent replies — thin presets over ui's " +
          "`MediaPlayer*` parts, so the controls are real buttons and sliders themed " +
          "through tokens. Keyboard: Space/k play·pause, ←/→ seek, ↑/↓ volume, m mute. " +
          "The root is transparent; the bubble or card around it is the surface.",
      },
    },
  },
} satisfies Meta<typeof AudioPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

const SILENT_WAV = silentWavDataUrl();

export const Default: Story = {
  render: () => (
    <AudioPlayer className="block w-full max-w-lg rounded-md border">
      <AudioPlayerElement src={SILENT_WAV} />
      <AudioPlayerControlBar>
        <AudioPlayerSeekBackwardButton />
        <AudioPlayerPlayButton />
        <AudioPlayerSeekForwardButton />
        <AudioPlayerTimeDisplay />
        <AudioPlayerTimeRange />
        <AudioPlayerDurationDisplay />
        <AudioPlayerMuteButton />
        <AudioPlayerVolumeRange />
      </AudioPlayerControlBar>
    </AudioPlayer>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-slot="media-player-play-button"]')).not.toBeNull();
      expect(canvasElement.querySelector('[data-slot="media-player-time-slider"]')).not.toBeNull();
    });
  },
};
