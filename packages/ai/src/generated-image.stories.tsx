import type { Meta, StoryObj } from "@storybook/react-vite";
import { GeneratedImage } from "./generated-image";

// A tiny 1x1 solid-red PNG — enough to exercise decode + skeleton timing
// without shipping a real asset in the story.
const RED_DOT =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

const meta = {
  title: "AI/GeneratedImage",
  component: GeneratedImage,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "An AI-SDK generated image (`Experimental_GeneratedImage`) rendered through the ui `Image` primitive as a base64 data URL.\n\n" +
          "**`Image` from `@elabs-ai/components-ai` is @deprecated** — it is now an alias of `GeneratedImage` (and `ImageProps` of `GeneratedImageProps`), kept for one minor and removed in the next major. `Image` is the ui primitive; import `GeneratedImage` here.",
      },
    },
  },
} satisfies Meta<typeof GeneratedImage>;
export default meta;
type Story = StoryObj<typeof meta>;

// `showSkeleton` (default `Boolean(width && height)` — true here) covers the
// reserved box with a `Skeleton` until the payload decodes. The window is
// real-decode-timed, so it is exercised deterministically in
// generated-image.test.tsx rather than frozen here.
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

// BROKEN — an undecodable payload settles into the ui `Image` fallback (an
// `ImageOff` glyph on a muted box) instead of a native broken-image glyph.
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

// Opt out for a context that already has its own placeholder.
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
