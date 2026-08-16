import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { Card, CardContent } from "../card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "./carousel";
const meta = {
  title: "Display/Carousel",
  component: Carousel,
  parameters: { layout: "centered" },
  argTypes: {
    orientation: {
      description: "Scroll axis of the carousel.",
      control: { type: "radio" },
      options: ["horizontal", "vertical"],
      table: { category: "Appearance" },
    },
    opts: {
      description: "Embla Carousel options object (loop, align, etc.).",
      control: false,
      table: { category: "Behavior" },
    },
    plugins: {
      description: "Embla Carousel plugins (autoplay, etc.).",
      control: false,
      table: { category: "Behavior" },
    },
    setApi: {
      description: "Callback to receive the Embla API instance.",
      control: false,
      table: { category: "Behavior" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn().",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Carousel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: () => (
    <Carousel className="w-64">
      <CarouselContent>
        {[1, 2, 3, 4].map((n) => (
          <CarouselItem key={n}>
            <Card>
              <CardContent className="flex h-28 items-center justify-center p-6 text-display font-semibold">
                {n}
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
  play: async ({ canvas }) => {
    // The carousel region and navigation buttons are present and keyboard-labelled.
    const region = canvas.getByRole("region", { name: /carousel/i });
    await expect(region).toBeInTheDocument();
    const nextBtn = canvas.getByRole("button", { name: /next slide/i });
    await expect(nextBtn).toBeInTheDocument();
    const prevBtn = canvas.getByRole("button", { name: /previous slide/i });
    // First slide: Previous is disabled, Next is enabled. canScroll* flips on
    // Embla's async post-mount onSelect — waitFor rides out that init (#279).
    await waitFor(async () => {
      await expect(prevBtn).toBeDisabled();
      await expect(nextBtn).not.toBeDisabled();
    });
  },
};

/** A consumer-supplied `aria-label` overrides the default region name. */
export const CustomLabel: Story = {
  render: () => (
    <Carousel className="w-64" aria-label="Product photos">
      <CarouselContent>
        {[1, 2, 3].map((n) => (
          <CarouselItem key={n}>
            <Card>
              <CardContent className="flex h-28 items-center justify-center p-6 text-display font-semibold">
                {n}
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("region", { name: /product photos/i })).toBeInTheDocument();
  },
};
