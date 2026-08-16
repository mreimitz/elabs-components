import type { Meta, StoryObj } from "@storybook/react-vite";
import { Image } from "./image";

// A tiny 1x1 solid-red PNG — enough to exercise decode + skeleton timing
// without shipping a real asset in the story.
const RED_DOT =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

const meta = {
  title: "AI/Image",
  component: Image,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Image>;
export default meta;
type Story = StoryObj<typeof meta>;

// `showSkeleton` (default `Boolean(width && height)` — true here, since both
// are given) covers the box with a `Skeleton` until the `<img>` finishes
// decoding, reserving the `width`/`height` box so there is no layout shift
// (loading-states.md, interaction-guidelines.md 'Images'). Without both
// dimensions there is no box to reserve, so the skeleton defaults off in that
// case rather than collapsing to nothing (see the `NoSkeleton` story). The
// Skeleton window is real-decode-timed (there is no consumer `loading` prop
// like Gallery's — see image.tsx), so it is too fast/racy to freeze reliably
// in a real-browser Storybook snapshot; it is instead exercised
// deterministically in image.test.tsx (jsdom never auto-resolves `<img>`
// loads, so the pending state holds until the test fires `load` itself).
export const Default: Story = {
  args: {
    base64: RED_DOT,
    mediaType: "image/png",
    uint8Array: new Uint8Array(),
    alt: "A generated red square",
    width: 128,
    height: 128,
  },
};

// BROKEN — a genuinely undecodable payload settles into the `onError`
// fallback (an `ImageOff` glyph on a muted box, sized to `width`/`height`)
// instead of leaving the browser's native broken-image glyph bleeding through
// a perpetually-pulsing Skeleton.
export const Broken: Story = {
  args: {
    base64: "not-a-real-image",
    mediaType: "image/png",
    uint8Array: new Uint8Array(),
    alt: "A generated image",
    width: 128,
    height: 128,
  },
};

// Disabling `showSkeleton` opts out for a context that already has its own
// placeholder (e.g. a Gallery tile).
export const NoSkeleton: Story = {
  name: "showSkeleton=false",
  args: {
    base64: RED_DOT,
    mediaType: "image/png",
    uint8Array: new Uint8Array(),
    alt: "A generated red square",
    width: 128,
    height: 128,
    showSkeleton: false,
  },
};
