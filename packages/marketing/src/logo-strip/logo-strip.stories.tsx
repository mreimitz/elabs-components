import type { Meta, StoryObj } from "@storybook/react-vite";
import { ThemeProvider } from "@elabs-ai/components-tokens";
import { expect, userEvent, within } from "storybook/test";
import { LogoStrip } from "./logo-strip";

const meta = {
  title: "Marketing/LogoStrip",
  component: LogoStrip,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof LogoStrip>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Placeholder SVG wordmark — replace with real brand SVGs in production. */
function WordmarkPlaceholder({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 80 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={name}
      role="img"
    >
      <rect width="80" height="28" rx="4" fill="currentColor" fillOpacity={0.15} />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="10"
        fontFamily="sans-serif"
        fill="currentColor"
      >
        {name}
      </text>
    </svg>
  );
}

const sampleLogos = [
  <WordmarkPlaceholder key="acme" name="Acme Corp" />,
  <WordmarkPlaceholder key="globex" name="Globex" />,
  <WordmarkPlaceholder key="initech" name="Initech" />,
  <WordmarkPlaceholder key="umbrella" name="Umbrella" />,
  <WordmarkPlaceholder key="veridian" name="Veridian" />,
  <WordmarkPlaceholder key="wayne" name="Wayne Ent." />,
];

export const Default: Story = {
  args: {
    logos: sampleLogos,
    caption: "Trusted by teams everywhere",
    animate: false,
  },
};

export const CustomCaption: Story = {
  args: {
    logos: sampleLogos,
    caption: "Powering data apps at leading enterprises",
    animate: false,
  },
};

export const NoCaption: Story = {
  args: {
    logos: sampleLogos,
    caption: undefined,
    animate: false,
  },
};

export const FewLogos: Story = {
  args: {
    logos: sampleLogos.slice(0, 3),
    caption: "Built for the world's most data-driven teams",
    animate: false,
  },
};

/** Scrolls in a loop; the button pauses it, hovering pauses it too. Static under reduced motion. */
export const Marquee: Story = {
  // The test runner is a reduced-motion user, under whom the marquee stands still on purpose;
  // the JS hook reads the provider, so the story opts back into full motion there.
  decorators: [
    (Story) => (
      <ThemeProvider
        decorationStorageKey={null}
        defaultMotionPreference="full"
        densityStorageKey={null}
        motionStorageKey={null}
        storageKey={null}
      >
        <Story />
      </ThemeProvider>
    ),
  ],
  args: {
    logos: sampleLogos,
    layout: "marquee",
    marqueeSeconds: 20,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pause = canvas.getByRole("button", { name: "Pause scrolling" });
    await expect(pause).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(pause);
    await expect(canvas.getByRole("button", { name: "Resume scrolling" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  },
};

/** Text wordmarks that carry their own colour keep it: `muted={false}`. */
export const Unmuted: Story = {
  args: {
    logos: sampleLogos,
    muted: false,
    animate: false,
  },
};
