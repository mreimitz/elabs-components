import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { ButtonGroup } from "../button-group";
import { Card } from "../card";
import { Audio } from "./audio";
import {
  MediaPlayerControls,
  MediaPlayerMuteButton,
  MediaPlayerPlaybackRateMenu,
  MediaPlayerPlayButton,
  MediaPlayerSeekButton,
  MediaPlayerTime,
  MediaPlayerTimeSlider,
  MediaPlayerVolumeSlider,
} from "./media-player";
import { synthWavDataUrl } from "./media-player.fixtures";

const WAV = synthWavDataUrl(20);

const meta = {
  title: "Display/Audio",
  component: Audio,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "An audio player with its own controls, composed from ui primitives (`IconButton`, " +
          "`Slider`, `DropdownMenu`) — no media engine. The root is transparent: put it in " +
          "the bubble or card that is its surface. Native attributes (`src`, `preload`, " +
          "`crossOrigin`, `loop`, `muted`, `aria-label`, media events) land on the `<audio>`. " +
          "Keyboard: `k` play/pause · `j`/`l` ±10 s · ←/→ ±5 s · ↑/↓ volume · `m` mute · `0`–`9` jump.",
      },
    },
  },
  argTypes: {
    controls: {
      description: "Render the default control bar.",
      control: "boolean",
      table: { category: "Behavior" },
    },
    keyboardShortcuts: {
      description: "Handle the player keyboard map.",
      control: "boolean",
      table: { category: "Behavior" },
    },
    label: {
      description: "The region's accessible name.",
      control: "text",
      table: { category: "Accessibility" },
    },
  },
} satisfies Meta<typeof Audio>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { src: WAV, preload: "metadata", className: "w-full max-w-lg" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("region", { name: "Audio player" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Play" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Back 10 seconds" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Forward 10 seconds" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Mute" })).toBeInTheDocument();
    await waitFor(
      () =>
        expect(canvas.getByRole("slider", { name: "Seek" })).toHaveAttribute(
          "aria-valuetext",
          "0:00 of 0:20",
        ),
      { timeout: 5000 },
    );
  },
};

/** Play and the clock only — the smallest useful player, e.g. a voice note. */
export const Minimal: Story = {
  args: { src: WAV, className: "w-fit" },
  render: (args) => (
    <Audio {...args}>
      <MediaPlayerControls>
        <MediaPlayerPlayButton />
        <MediaPlayerTime mode="current" />
        <MediaPlayerTime mode="duration" className="ps-0 before:me-1 before:content-['/']" />
      </MediaPlayerControls>
    </Audio>
  ),
};

/** The look the ai `AudioPlayer` presets keep: outline buttons grouped, inside a card. */
export const CustomComposition: Story = {
  args: { src: WAV },
  render: (args) => (
    <Card className="w-full max-w-lg p-3">
      <Audio {...args}>
        <MediaPlayerControls className="gap-2">
          <ButtonGroup>
            <MediaPlayerSeekButton offset={-10} variant="outline" />
            <MediaPlayerPlayButton variant="outline" />
            <MediaPlayerSeekButton offset={10} variant="outline" />
          </ButtonGroup>
          <MediaPlayerTime mode="current" />
          <MediaPlayerTimeSlider />
          <MediaPlayerTime mode="remaining" />
          <MediaPlayerMuteButton variant="outline" />
          <MediaPlayerVolumeSlider />
        </MediaPlayerControls>
      </Audio>
    </Card>
  ),
};

export const PlaybackRate: Story = {
  args: { src: WAV, className: "w-full max-w-lg" },
  render: (args) => (
    <Audio {...args}>
      <MediaPlayerControls>
        <MediaPlayerPlayButton />
        <MediaPlayerTime mode="current" />
        <MediaPlayerTimeSlider />
        <MediaPlayerTime mode="duration" />
        <MediaPlayerPlaybackRateMenu />
      </MediaPlayerControls>
    </Audio>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Playback speed: 1×" }));
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getAllByRole("menuitemradio")).toHaveLength(6));
    await userEvent.click(body.getByRole("menuitemradio", { name: "1.5×" }));
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Playback speed: 1.5×" })).toBeInTheDocument(),
    );
  },
};

export const Keyboard: Story = {
  args: { src: WAV, preload: "metadata", className: "w-full max-w-lg" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const seek = canvas.getByRole("slider", { name: "Seek" });
    await waitFor(() => expect(seek).toHaveAttribute("aria-valuetext", "0:00 of 0:20"), {
      timeout: 5000,
    });
    canvas.getByRole("button", { name: "Play" }).focus();
    await userEvent.keyboard("m");
    await waitFor(() => expect(canvas.getByRole("button", { name: "Unmute" })).toBeInTheDocument());
    await userEvent.keyboard("l");
    await waitFor(() => expect(seek).toHaveAttribute("aria-valuetext", "0:10 of 0:20"));
  },
};

/** A source the browser cannot decode: the bar is replaced by the compact error panel. */
export const Error: Story = {
  args: { src: "data:audio/wav;base64,AAAA", className: "w-full max-w-lg" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole("alert")).toBeInTheDocument(), {
      timeout: 5000,
    });
    await expect(canvas.getByRole("alert")).toHaveTextContent("Can’t play this media");
  },
};
