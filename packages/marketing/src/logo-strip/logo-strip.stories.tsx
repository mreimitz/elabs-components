import type { Meta, StoryObj } from "@storybook/react-vite";
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
