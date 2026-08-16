import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Badge } from "@qlik-coe-emea/qlabs-components-ui";
import { Gallery, type GalleryImage } from "./gallery";

/**
 * Offline, deterministic placeholder image (inline SVG data URI) so stories
 * render identically in CI / visual review without a network round-trip.
 */
function photo(label: string, bg: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="${bg}"/><text x="300" y="312" font-family="system-ui,sans-serif" font-size="44" fill="#ffffff" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const CONCEPTS = [
  {
    title: "Fjord at dawn",
    color: "#1f6f78",
    alt: "Aurora reflected over a glacial fjord at dawn",
  },
  { title: "Desert monolith", color: "#8a5a44", alt: "A lone sandstone monolith under a noon sun" },
  { title: "Neon arcade", color: "#3b4a6b", alt: "Rain-soaked arcade alley lit by neon signage" },
  { title: "Coral shelf", color: "#2f7d6b", alt: "Sunlit coral shelf teeming with fish" },
  { title: "Pine cathedral", color: "#4a6b3b", alt: "Tall pines forming a cathedral of light" },
  { title: "Brass orrery", color: "#b08949", alt: "A brass orrery modelling the inner planets" },
  { title: "Salt flats", color: "#6b6f78", alt: "Mirror-still salt flats after rain" },
  { title: "Harbour fog", color: "#46618a", alt: "Fishing boats fading into harbour fog" },
  { title: "Terraced rice", color: "#6b7d3b", alt: "Terraced rice paddies at golden hour" },
  { title: "Obsidian cave", color: "#3a3550", alt: "Glassy obsidian cave with a shaft of light" },
  { title: "Lavender rows", color: "#7d5a8a", alt: "Endless rows of lavender under a wide sky" },
  { title: "Dune ridge", color: "#915b3c", alt: "Wind-carved dune ridge at sunset" },
] as const;

function makeImage(i: number): GalleryImage {
  const c = CONCEPTS[i % CONCEPTS.length];
  return {
    src: photo(c.title, c.color),
    alt: c.alt,
    title: c.title,
    description: `${c.alt}. Rendered with the diffusion-xl model from a single text prompt.`,
    meta: [
      { label: "Model", value: "diffusion-xl" },
      { label: "Dimensions", value: "1024 × 1024" },
      { label: "Seed", value: String(40000 + i * 137) },
      { label: "Steps", value: "40" },
    ],
    downloadName: `${c.title.toLowerCase().replace(/\s+/g, "-")}.png`,
  };
}

const IMAGES: GalleryImage[] = Array.from({ length: 12 }, (_, i) => makeImage(i));

const meta = {
  title: "AI/Gallery",
  component: Gallery,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [(Story) => <div className="mx-auto max-w-2xl">{Story()}</div>],
} satisfies Meta<typeof Gallery>;
export default meta;

type Story = StoryObj<typeof meta>;

/** A single result renders as one framed image with an always-on expand button. */
export const SingleImage: Story = {
  args: { images: IMAGES.slice(0, 1) },
};

/** A handful of results render as a thumbnail grid (no overflow yet). */
export const SmallGrid: Story = {
  name: "Small grid (3)",
  args: { images: IMAGES.slice(0, 3) },
};

/** Exactly `maxVisible` images fill the grid with no "+N more" tile. */
export const FullGrid: Story = {
  name: "Full grid (exactly 5)",
  args: { images: IMAGES.slice(0, 5) },
};

/** Beyond the cap, the last cell collapses into "+N more" and opens the carousel. */
export const Overflow: Story = {
  name: "Overflow (+N more)",
  args: { images: IMAGES },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const overflow = canvas.getByRole("button", { name: /show all 12 images/i });
    await expect(canvas.getByText(/\+7 more/)).toBeInTheDocument();
    await userEvent.click(overflow);
    const dialog = await within(document.body).findByRole("dialog");
    await expect(dialog).toBeInTheDocument();
    await expect(within(dialog).getByRole("button", { name: /next slide/i })).toBeInTheDocument();
  },
};

/** Images with only `alt` — the detail panel shows a graceful "No details". */
export const NoMetadata: Story = {
  name: "No metadata",
  args: {
    images: CONCEPTS.slice(0, 4).map((c) => ({ src: photo(c.title, c.color), alt: c.alt })),
  },
};

/** Long copy + many fields scroll inside the panel; the image stays put. */
export const LongContent: Story = {
  name: "Long description + many fields",
  args: {
    images: [
      {
        ...makeImage(0),
        description:
          "A long-exposure render of a green aurora mirrored in glass-still fjord water at first light. The prompt asked for a low camera angle, a faint mist clinging to the waterline, and distant snow-capped peaks catching the earliest sun. Generated, upscaled, then colour-graded toward cool teal shadows and warm highlights.",
        meta: [
          { label: "Model", value: "diffusion-xl" },
          { label: "Sampler", value: "DPM++ 2M Karras" },
          { label: "Dimensions", value: "1024 × 1024" },
          { label: "Upscaled to", value: "4096 × 4096" },
          { label: "Seed", value: "40000" },
          { label: "Steps", value: "40" },
          { label: "Guidance", value: "7.5" },
          { label: "Created", value: "2026-06-22" },
        ],
      },
    ],
  },
};

/** `renderMeta` replaces the default panel body with custom content. */
export const CustomMeta: Story = {
  name: "Custom metadata (renderMeta)",
  args: {
    images: IMAGES.slice(0, 1),
    renderMeta: (image) => (
      <div className="flex flex-col gap-3">
        <Badge>diffusion-xl</Badge>
        <p className="text-body text-muted-foreground">{image.description}</p>
      </div>
    ),
  },
};

/** `hideDownload` removes every download affordance (rights-restricted assets). */
export const HideDownload: Story = {
  name: "Download hidden",
  args: { images: IMAGES.slice(0, 3), hideDownload: true },
};

/**
 * LOADING — the set is still being generated. `loading` renders skeleton tiles in
 * the grid footprint (a status live region for AT) instead of the empty state, so
 * the panel reserves its space and reads as "working" rather than "nothing here"
 * (loading-states.md).
 */
export const Loading: Story = {
  name: "Loading (from empty)",
  args: { images: [], loading: true, expectedCount: 6 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The live-region label is populated one tick after mount (ARIA22 —
    // gallery.tsx mounts the region empty, then sets its text so AT announces
    // the change), so wait for it with a retrying query (#288).
    await expect(await canvas.findByText(/loading images/i)).toBeInTheDocument();
  },
};

/**
 * PARTIAL SET — images stream in one at a time. With `expectedCount`, the arrived
 * tiles render alongside skeleton tiles for the ones still coming, so the grid
 * fills in place with no reflow and no premature "+N more" collapse.
 */
export const PartialSet: Story = {
  name: "Partial set (arriving)",
  args: { images: IMAGES.slice(0, 2), expectedCount: 6 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("button", { name: /fjord|desert/i }).length).toBeGreaterThan(
      0,
    );
    // Still arriving → no overflow collapse yet.
    await expect(canvas.queryByText(/more/i)).not.toBeInTheDocument();
  },
};
