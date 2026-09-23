import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import {
  MediaPlayerControls,
  MediaPlayerFullscreenButton,
  MediaPlayerMuteButton,
  MediaPlayerPlaybackRateMenu,
  MediaPlayerPlayButton,
  MediaPlayerSeekButton,
  MediaPlayerTime,
  MediaPlayerTimeSlider,
  MediaPlayerVolumeSlider,
} from "./media-player";
import { synthPosterSvgDataUrl, synthVttDataUrl, synthWavDataUrl } from "./media-player.fixtures";
import { Video, type VideoTrack } from "./video";

// A silent WAV stands in for a video file (no network origin, no binary
// fixture); the poster is what shows, and the controls behave for real.
const SRC = synthWavDataUrl(20);
const POSTER = synthPosterSvgDataUrl();
const TRACKS: VideoTrack[] = [
  { src: synthVttDataUrl(), kind: "captions", srclang: "en", label: "English" },
];

const meta = {
  title: "Display/Video",
  component: Video,
  tags: ["autodocs"],
  // The stand-in file is sound: `kind` keeps the video chrome a real video gets by detection.
  args: { kind: "video" },
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A video player with its own controls, composed from ui primitives — no media " +
          "engine. A bordered, rounded frame; the `bg-muted` letterbox; an opaque control bar " +
          'docked beneath (`controlsPlacement="overlay"` floats it over the video and hides ' +
          "it while playing). Give every non-decorative video a captions `tracks` entry. " +
          "Keyboard (root focused): Space/`k` play/pause · `j`/`l` ±10 s · ←/→ ±5 s · ↑/↓ " +
          "volume · `m` mute · `f` full screen · `0`–`9` jump.",
      },
    },
  },
  argTypes: {
    controls: {
      description: "Render the default control bar.",
      control: "boolean",
      table: { category: "Behavior" },
    },
    controlsPlacement: {
      description: "`docked` under the video, or `overlay` (auto-hides while playing).",
      control: { type: "radio" },
      options: ["docked", "overlay"],
      table: { category: "Appearance" },
    },
    fit: {
      description: "How the video fills the viewport.",
      control: { type: "radio" },
      options: ["contain", "cover"],
      table: { category: "Appearance" },
    },
    aspectRatio: {
      description: "Width ÷ height of the viewport.",
      control: "number",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Video>;

export default meta;
type Story = StoryObj<typeof meta>;

const frame = "w-full max-w-2xl";

export const Default: Story = {
  args: {
    src: SRC,
    poster: POSTER,
    aspectRatio: 16 / 9,
    muted: true,
    tracks: TRACKS,
    className: frame,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByRole("region", { name: "Video player" });
    await waitFor(
      () =>
        expect(canvas.getByRole("slider", { name: "Seek" })).toHaveAttribute(
          "aria-valuetext",
          "0:00 of 0:20",
        ),
      { timeout: 5000 },
    );
    await userEvent.click(canvas.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(root).toHaveAttribute("data-paused", "false"));
    await userEvent.click(canvas.getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(root).toHaveAttribute("data-paused", "true"));
  },
};

/** Recipe: play and the clock — nothing else. */
export const Basic: Story = {
  args: { src: SRC, poster: POSTER, aspectRatio: 16 / 9, muted: true, tracks: TRACKS },
  render: (args) => (
    <Video {...args} className={frame}>
      <MediaPlayerControls>
        <MediaPlayerPlayButton />
        <MediaPlayerTime mode="current" />
        <MediaPlayerTime mode="duration" className="ps-0 before:me-1 before:content-['/']" />
      </MediaPlayerControls>
    </Video>
  ),
};

/** Recipe: the full bar — seek, duration, mute and volume (the default composition). */
export const FullBar: Story = {
  args: {
    src: SRC,
    poster: POSTER,
    aspectRatio: 16 / 9,
    muted: true,
    tracks: TRACKS,
    className: frame,
  },
};

/** Recipe: a hero embed — muted, autoplaying, looping, no controls, not focusable. */
export const MutedAutoplayLoop: Story = {
  args: {
    src: SRC,
    poster: POSTER,
    aspectRatio: 16 / 9,
    muted: true,
    autoPlay: true,
    loop: true,
    playsInline: true,
    controls: false,
    fit: "cover",
    tracks: TRACKS,
    label: "Product loop",
    className: frame,
  },
  play: async ({ canvasElement }) => {
    const video = canvasElement.querySelector("video")!;
    await expect(video).toHaveAttribute("loop");
    await expect(video.muted).toBe(true);
    await expect(canvasElement.querySelector('[data-slot="media-player-controls"]')).toBeNull();
  },
};

/** Recipe: poster frame plus a full-screen button. */
export const PosterFullscreen: Story = {
  args: { src: SRC, poster: POSTER, aspectRatio: 16 / 9, muted: true, tracks: TRACKS },
  render: (args) => (
    <Video {...args} className={frame}>
      <MediaPlayerControls>
        <MediaPlayerPlayButton />
        <MediaPlayerTimeSlider />
        <MediaPlayerTime mode="remaining" />
        <MediaPlayerFullscreenButton />
      </MediaPlayerControls>
    </Video>
  ),
};

/** Recipe: a playback-speed menu. */
export const PlaybackRate: Story = {
  args: { src: SRC, poster: POSTER, aspectRatio: 16 / 9, muted: true, tracks: TRACKS },
  render: (args) => (
    <Video {...args} className={frame}>
      <MediaPlayerControls>
        <MediaPlayerPlayButton />
        <MediaPlayerTimeSlider />
        <MediaPlayerTime mode="current" />
        <MediaPlayerPlaybackRateMenu rates={[0.75, 1, 1.5, 2]} />
      </MediaPlayerControls>
    </Video>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Playback speed: 1×" }));
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => expect(body.getAllByRole("menuitemradio")).toHaveLength(4));
    await userEvent.keyboard("{Escape}");
  },
};

/** Recipe: a poster frame before playback, no aspect ratio — the video sizes the box. */
export const Poster: Story = {
  args: {
    src: SRC,
    poster: POSTER,
    preload: "none",
    muted: true,
    tracks: TRACKS,
    className: frame,
  },
};

/** Recipe: seek backward / forward buttons around play. */
export const SeekControls: Story = {
  args: { src: SRC, poster: POSTER, aspectRatio: 16 / 9, muted: true, tracks: TRACKS },
  render: (args) => (
    <Video {...args} className={frame}>
      <MediaPlayerControls className="justify-center">
        <MediaPlayerSeekButton offset={-10} />
        <MediaPlayerPlayButton />
        <MediaPlayerSeekButton offset={10} />
        <MediaPlayerTime mode="current" />
      </MediaPlayerControls>
    </Video>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(
      () => expect(canvasElement.querySelector("video")!.readyState).toBeGreaterThan(0),
      { timeout: 5000 },
    );
    await userEvent.click(canvas.getByRole("button", { name: "Forward 10 seconds" }));
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-mode="current"]')).toHaveTextContent("0:10"),
    );
  },
};

/** Recipe: mute plus a volume slider. */
export const VolumeRange: Story = {
  args: { src: SRC, poster: POSTER, aspectRatio: 16 / 9, muted: true, tracks: TRACKS },
  render: (args) => (
    <Video {...args} className={frame}>
      <MediaPlayerControls>
        <MediaPlayerPlayButton />
        <MediaPlayerTimeSlider />
        <MediaPlayerMuteButton />
        <MediaPlayerVolumeSlider />
      </MediaPlayerControls>
    </Video>
  ),
};

/** Controls float over the video and fade out while it plays and the pointer rests. */
export const Overlay: Story = {
  args: {
    src: SRC,
    poster: POSTER,
    aspectRatio: 16 / 9,
    muted: true,
    tracks: TRACKS,
    controlsPlacement: "overlay",
    className: frame,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByRole("region", { name: "Video player" });
    await expect(root).toHaveAttribute("data-controls", "visible");
    await userEvent.click(canvas.getByRole("button", { name: "Play" }));
    await waitFor(() => expect(root).toHaveAttribute("data-paused", "false"));
    // Release focus and the pointer; the 3 s idle timer then hides the bar.
    (canvasElement.ownerDocument.activeElement as HTMLElement | null)?.blur();
    fireEvent.pointerLeave(root);
    await waitFor(() => expect(root).toHaveAttribute("data-controls", "hidden"), {
      timeout: 5000,
    });
    fireEvent.pointerMove(root);
    await waitFor(() => expect(root).toHaveAttribute("data-controls", "visible"));
    await userEvent.click(canvas.getByRole("button", { name: "Pause" }));
  },
};

/** A decorative thumbnail (attachments): no controls, muted, cropped, hidden from AT. */
export const Thumbnail: Story = {
  args: {
    src: SRC,
    poster: POSTER,
    controls: false,
    muted: true,
    fit: "cover",
    preload: "metadata",
    "aria-hidden": true,
    className: "size-24",
  },
};

export const Keyboard: Story = {
  args: {
    src: SRC,
    poster: POSTER,
    aspectRatio: 16 / 9,
    muted: true,
    tracks: TRACKS,
    className: frame,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const root = canvas.getByRole("region", { name: "Video player" });
    const seek = canvas.getByRole("slider", { name: "Seek" });
    await waitFor(() => expect(seek).toHaveAttribute("aria-valuetext", "0:00 of 0:20"), {
      timeout: 5000,
    });
    root.focus();
    await userEvent.keyboard("l");
    await waitFor(() => expect(seek).toHaveAttribute("aria-valuetext", "0:10 of 0:20"));
    await userEvent.keyboard("5");
    await waitFor(() => expect(seek).toHaveAttribute("aria-valuetext", "0:10 of 0:20"));
    await userEvent.keyboard("0");
    await waitFor(() => expect(seek).toHaveAttribute("aria-valuetext", "0:00 of 0:20"));
    await userEvent.keyboard(" ");
    await waitFor(() => expect(root).toHaveAttribute("data-paused", "false"));
    await userEvent.keyboard("k");
    await waitFor(() => expect(root).toHaveAttribute("data-paused", "true"));
  },
};

/** A source the browser cannot decode: the error panel covers the viewport. */
export const Error: Story = {
  args: {
    src: "data:video/mp4;base64,AAAA",
    aspectRatio: 16 / 9,
    tracks: TRACKS,
    className: frame,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getByRole("alert")).toBeInTheDocument(), {
      timeout: 5000,
    });
  },
};
