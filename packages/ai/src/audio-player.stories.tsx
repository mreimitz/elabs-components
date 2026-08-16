import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";

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
          "A token-themed **media-chrome** audio player for spoken agent replies. Every " +
          "control is a media-chrome custom element re-skinned through the `--media-*` " +
          "custom properties, so it tracks the active theme. The engine is loaded through " +
          "a dynamic `import()` (ADR 0019) — it is not in any consumer's entry chunk — so " +
          "the player renders a layout-shaped `Skeleton` for the first frame.",
      },
    },
  },
} satisfies Meta<typeof AudioPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A ~1.5 s silent 8-bit mono WAV, synthesized at module scope so the story needs
 * no network origin (see `docs/CSP-AND-NETWORK.md`) and no binary fixture.
 */
function silentWavSrc(seconds = 1.5, sampleRate = 8000): string {
  const samples = Math.floor(seconds * sampleRate);
  const bytes = new Uint8Array(44 + samples).fill(128); // 128 == silence, 8-bit unsigned
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true); // PCM header size
  view.setUint16(20, 1, true); // format: PCM
  view.setUint16(22, 1, true); // channels: mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, samples, true);

  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

const SILENT_WAV = silentWavSrc();

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
    // media-chrome arrives in a lazy chunk (#313): the controls are absent for
    // the first frame, so this also locks in that the chunk actually resolves.
    await waitFor(
      () => {
        expect(canvasElement.querySelector("media-controller")).not.toBeNull();
        expect(canvasElement.querySelector("media-play-button")).not.toBeNull();
        expect(canvasElement.querySelector("media-time-range")).not.toBeNull();
      },
      { timeout: 10000 },
    );
  },
};
