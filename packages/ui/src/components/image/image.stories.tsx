import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";
import { Image, type ImageFit, type ImageProps } from "./image";

/**
 * Offline, deterministic placeholder (inline SVG data URL) so stories render
 * identically in CI without a network round-trip.
 */
function placeholder(label: string, w = 320, h = 200): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#46618a"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 4}" fill="#b08949"/><text x="${w / 2}" y="${h - 12}" font-family="system-ui,sans-serif" font-size="${Math.max(8, Math.round(h / 12))}" fill="#ffffff" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const PHOTO = placeholder("320 × 200");
const TALL = placeholder("tall", 120, 240);
/** A payload no decoder accepts — fires a terminal `error` event. */
const BROKEN = "data:image/png;base64,broken";

const FITS: ImageFit[] = ["contain", "cover", "fill", "none", "scale-down"];

const meta = {
  title: "Display/Image",
  component: Image,
  tags: ["autodocs"],
  argTypes: {
    fit: {
      description: "CSS `object-fit` of the image inside its box. Emits `object-*` classes only.",
      control: "select",
      options: FITS,
      table: { category: "Appearance" },
    },
    aspectRatio: {
      description: "Reserve a box of this ratio (e.g. `16/9`); the image fills it.",
      control: "number",
      table: { category: "Layout" },
    },
    showSkeleton: {
      description:
        "Skeleton in a reserved box until the image decodes. Defaults on with `width`+`height` or `aspectRatio`.",
      control: "boolean",
      table: { category: "Behavior" },
    },
    alt: {
      description: 'Required. `""` marks the image decorative.',
      control: "text",
      table: { category: "Content" },
    },
    fallback: {
      description:
        "Replaces the default `ImageOff` box after a terminal error; `null` renders nothing.",
      control: false,
      table: { category: "Content" },
    },
  },
} satisfies Meta<typeof Image>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    src: PHOTO,
    alt: "A gold circle on a blue field",
    width: 320,
    height: 200,
  },
};

/** One labelled square per `fit` value — each value is spelled out so `variant-coverage` sees it. */
function FitFigure({ fit, ...args }: ImageProps) {
  return (
    <figure className="flex flex-col items-center gap-1">
      <Image
        {...args}
        fit={fit}
        alt={`Tall placeholder, fit ${fit}`}
        width={96}
        height={96}
        className="rounded-md bg-muted"
      />
      <figcaption className="text-caption text-muted-foreground">{fit}</figcaption>
    </figure>
  );
}

/** Every `fit` value on a tall source inside the same square box. */
export const Fit: Story = {
  args: { src: TALL, alt: "" },
  render: (args) => (
    <div className="flex flex-wrap gap-4">
      <FitFigure {...args} fit="contain" />
      <FitFigure {...args} fit="cover" />
      <FitFigure {...args} fit="fill" />
      <FitFigure {...args} fit="none" />
      <FitFigure {...args} fit="scale-down" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const fit of FITS) {
      const img = await canvas.findByRole("img", { name: `Tall placeholder, fit ${fit}` });
      await expect(img.className).toContain(`object-${fit}`);
    }
  },
};

/** `aspectRatio` reserves the box before decode; the image fills it (`fit="cover"`). */
export const WithAspectRatio: Story = {
  args: { src: PHOTO, alt: "Cover image in a 16:9 box", aspectRatio: 16 / 9, fit: "cover" },
  render: (args) => (
    <div className="w-72 overflow-hidden rounded-md">
      <Image {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const img = await within(canvasElement).findByRole("img", {
      name: "Cover image in a 16:9 box",
    });
    await waitFor(() => expect(img).toHaveAttribute("data-status", "loaded"));
    const frame = canvasElement.querySelector('[data-slot="image-frame"]') as HTMLElement;
    const { width, height } = frame.getBoundingClientRect();
    await expect(Math.round((width / height) * 9)).toBe(16);
  },
};

/** Small fixed sizes with no skeleton — the bare `<img>` is the root. */
export const Thumbnails: Story = {
  args: { src: PHOTO, alt: "" },
  render: (args) => (
    <div className="flex items-end gap-4">
      {[20, 32, 96].map((size) => (
        <Image
          key={size}
          {...args}
          alt={`Thumbnail ${size} px`}
          width={size}
          height={size}
          fit="cover"
          showSkeleton={false}
          className="rounded-sm"
        />
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot="image-frame"]')).toBeNull();
    await expect(canvasElement.querySelector('[data-slot="image-skeleton"]')).toBeNull();
  },
};

/** No size given: intrinsic size, native lazy loading, no reserved box. */
export const Intrinsic: Story = {
  args: { src: PHOTO, alt: "Intrinsically sized image", loading: "lazy" },
  play: async ({ canvasElement }) => {
    const img = await within(canvasElement).findByRole("img", {
      name: "Intrinsically sized image",
    });
    await expect(img).toHaveAttribute("loading", "lazy");
    await expect(img.parentElement?.getAttribute("data-slot")).not.toBe("image-frame");
  },
};

/** Terminal error: the `<img>` is replaced by a named `ImageOff` box. */
export const Broken: Story = {
  args: { src: BROKEN, alt: "Quarterly revenue chart", width: 240, height: 150 },
  play: async ({ canvasElement }) => {
    // The <img> itself carries the same name until the error fires — wait for it to go.
    await waitFor(() => expect(canvasElement.querySelector("img")).toBeNull());
    const fallback = within(canvasElement).getByRole("img", { name: "Quarterly revenue chart" });
    await expect(fallback).toHaveAttribute("data-slot", "image-fallback");
  },
};

/** A decorative image that fails stays hidden from assistive tech. */
export const DecorativeBroken: Story = {
  args: { src: BROKEN, alt: "", width: 120, height: 80 },
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-slot="image-fallback"]')).not.toBeNull(),
    );
    await expect(within(canvasElement).queryByRole("img")).toBeNull();
  },
};

/** `fallback` replaces the default box after an error. */
export const CustomFallback: Story = {
  args: {
    src: BROKEN,
    alt: "Team logo",
    width: 48,
    height: 48,
    fallback: (
      <span
        role="img"
        aria-label="Team logo"
        className="flex size-12 items-center justify-center rounded-full bg-primary text-body text-primary-foreground"
      >
        TL
      </span>
    ),
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector("img")).toBeNull());
    const fallback = within(canvasElement).getByRole("img", { name: "Team logo" });
    await expect(fallback).toHaveTextContent("TL");
    await expect(canvasElement.querySelector('[data-slot="image-fallback"]')).toBeNull();
  },
};
