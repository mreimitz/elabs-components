import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import {
  Attachment,
  AttachmentHoverCard,
  AttachmentHoverCardContent,
  AttachmentHoverCardTrigger,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
  type AttachmentData,
} from "./attachments";
import { silentWavDataUrl } from "./_media-fixtures";

/** Offline, deterministic placeholder (inline SVG data URL) — no network round-trip. */
function photo(label: string, bg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" fill="${bg}"/><text x="96" y="104" font-family="system-ui,sans-serif" font-size="20" fill="#ffffff" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const ITEMS: AttachmentData[] = [
  {
    id: "photo",
    type: "file",
    mediaType: "image/svg+xml",
    filename: "harbour-fog.svg",
    url: photo("Harbour", "#46618a"),
  },
  {
    id: "clip",
    type: "file",
    mediaType: "video/webm",
    filename: "product-demo.webm",
    url: silentWavDataUrl(1, 3000),
  },
  {
    id: "report",
    type: "file",
    mediaType: "application/pdf",
    filename: "q3-board-report.pdf",
    url: "",
  },
  {
    id: "source",
    type: "source-document",
    sourceId: "src-1",
    mediaType: "text/html",
    title: "Revenue recognition policy",
    filename: "policy.html",
  },
];

const noop = () => {};

const meta = {
  title: "AI/Attachments",
  component: Attachments,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Files attached to a message or a composer — image and video thumbnails through the ui `Image`/`Video` primitives, a typed icon for everything else — as a grid of tiles, an inline row of chips or a full-width list, each with an optional remove action.",
      },
    },
  },
} satisfies Meta<typeof Attachments>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Grid (the default) — 96 px tiles: image and video thumbnails, icons for the rest. */
export const Default: Story = {
  args: {
    variant: "grid",
    children: ITEMS.map((item) => (
      <Attachment key={item.id} data={item} onRemove={noop}>
        <AttachmentPreview />
        <AttachmentRemove />
      </Attachment>
    )),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("img", { name: "harbour-fog.svg" })).toBeInTheDocument();
    // The video thumbnail is decorative: hidden from AT, muted, no controls.
    const video = canvasElement.querySelector("video");
    await expect(video).not.toBeNull();
    await expect(video?.muted).toBe(true);
    await expect(video?.controls).toBe(false);
    await expect(video?.closest('[aria-hidden="true"]')).not.toBeNull();
  },
};

/** Inline — compact chips for a composer row. */
export const Inline: Story = {
  args: {
    variant: "inline",
    children: ITEMS.map((item) => (
      <Attachment key={item.id} data={item} onRemove={noop}>
        <AttachmentPreview />
        <AttachmentInfo />
        <AttachmentRemove />
      </Attachment>
    )),
  },
};

/** List — full-width rows with the media type. */
export const List: Story = {
  args: {
    variant: "list",
    className: "max-w-sm",
    children: ITEMS.map((item) => (
      <Attachment key={item.id} data={item} onRemove={noop}>
        <AttachmentPreview />
        <AttachmentInfo showMediaType />
        <AttachmentRemove />
      </Attachment>
    )),
  },
};

/** Preview — an inline chip that opens a larger preview on hover. */
export const Preview: Story = {
  args: {
    variant: "inline",
    children: ITEMS.slice(0, 2).map((item) => (
      <AttachmentHoverCard key={item.id}>
        <AttachmentHoverCardTrigger asChild>
          <Attachment data={item}>
            <AttachmentPreview />
            <AttachmentInfo />
          </Attachment>
        </AttachmentHoverCardTrigger>
        <AttachmentHoverCardContent>
          <Attachments variant="grid">
            <Attachment data={item}>
              <AttachmentPreview />
            </Attachment>
          </Attachments>
        </AttachmentHoverCardContent>
      </AttachmentHoverCard>
    )),
  },
};
