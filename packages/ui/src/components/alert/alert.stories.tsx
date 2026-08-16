import type { Meta, StoryObj } from "@storybook/react-vite";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { expect } from "storybook/test";
import { Alert, AlertDescription, AlertTitle } from "./alert";
const meta = {
  title: "States/Alert",
  component: Alert,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      description: "Visual tone of the alert banner.",
      control: { type: "select" },
      options: ["default", "info", "success", "warning", "destructive"],
      table: { category: "Appearance" },
    },
    role: {
      description:
        'ARIA role. Use "alert" for assertive announcements or "group" for panels with focusable controls.',
      control: { type: "select" },
      options: ["alert", "group", "status"],
      table: { category: "Accessibility" },
    },
    className: {
      description: "Additional CSS classes applied to the alert container.",
      control: "text",
      table: { category: "Styling" },
    },
    children: {
      description: "Compose AlertTitle and AlertDescription inside.",
      control: false,
      table: { category: "Content" },
    },
  },
} satisfies Meta<typeof Alert>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Info_: Story = {
  name: "Info",
  render: () => (
    <Alert variant="info" className="max-w-md">
      <Info />
      <AlertTitle>Heads up</AlertTitle>
      <AlertDescription>This deploy includes a schema migration.</AlertDescription>
    </Alert>
  ),
};
export const Destructive: Story = {
  render: () => (
    <Alert variant="destructive" className="max-w-md">
      <AlertTriangle />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>Your session has expired.</AlertDescription>
    </Alert>
  ),
};

/**
 * `default` and `success` were selectable in the controls panel
 * (`argTypes.variant.options`) but never actually rendered by any story
 * (#388) — so neither one ever reached the blocking interaction + axe job.
 * This renders them alongside `info`/`warning` to close that gap.
 *
 * `destructive` is intentionally NOT repeated here: it already has its own
 * dedicated `Destructive` story above, with a known, separately-tracked
 * contrast exemption (`states-alert--destructive` in
 * scripts/a11y-baseline.json, #381) — folding it into this new story id would
 * launder that pre-existing violation onto a brand-new, unbaselined surface.
 */
export const AllVariants: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      <Alert variant="default">
        <AlertTitle>Default</AlertTitle>
        <AlertDescription>Neutral tone — no semantic status implied.</AlertDescription>
      </Alert>
      <Alert variant="info">
        <Info />
        <AlertTitle>Info</AlertTitle>
        <AlertDescription>This deploy includes a schema migration.</AlertDescription>
      </Alert>
      <Alert variant="success">
        <CheckCircle2 />
        <AlertTitle>Success</AlertTitle>
        <AlertDescription>Your changes were saved.</AlertDescription>
      </Alert>
      <Alert variant="warning">
        <AlertTriangle />
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>Double-check before continuing.</AlertDescription>
      </Alert>
    </div>
  ),
};

/**
 * `AlertTitle` defaults to `<h5>` (unchanged) but accepts `as` to render at a
 * different heading level, avoiding a skipped-level jump when the alert sits
 * inline in a form under an `<h2>`/`<h3>` (#329).
 *
 * Uses `variant="warning"`, not `"destructive"` — the destructive variant's
 * text-on-tint contrast is a pre-existing, separately tracked issue
 * (`states-alert--destructive` in scripts/a11y-baseline.json) unrelated to
 * this fix; reusing it here would launder a second, avoidable a11y violation
 * into a brand-new story.
 */
export const InlineFormError: Story = {
  render: () => (
    <div className="flex max-w-md flex-col gap-3">
      <h2 className="text-title font-semibold text-foreground">Payment details</h2>
      <Alert variant="warning">
        <AlertTriangle />
        <AlertTitle as="h3">Card declined</AlertTitle>
        <AlertDescription>Your card was declined — try another payment method.</AlertDescription>
      </Alert>
    </div>
  ),
  play: async ({ canvas }) => {
    const heading = canvas.getByRole("heading", { level: 3, name: "Card declined" });
    await expect(heading.tagName).toBe("H3");
  },
};

/**
 * `AlertDescription` gains an opt-in `measure` prop that caps genuine prose to
 * a readable line length (`max-w-prose`, ~65ch) instead of running edge to
 * edge in a wide alert (#339). Off by default.
 */
export const DescriptionMeasure: Story = {
  render: () => (
    <div className="flex w-[900px] flex-col gap-4">
      <Alert variant="info" className="w-full">
        <Info />
        <AlertTitle>Uncapped (default)</AlertTitle>
        <AlertDescription>
          This migration note runs the full width of a very wide alert banner, which makes it
          materially harder to scan once the line gets long enough for the eye to lose its place
          between lines.
        </AlertDescription>
      </Alert>
      <Alert variant="info" className="w-full">
        <Info />
        <AlertTitle>Capped via `measure`</AlertTitle>
        <AlertDescription measure>
          This migration note is capped to a readable prose measure even inside a very wide banner,
          so each line stays short enough to read comfortably.
        </AlertDescription>
      </Alert>
    </div>
  ),
  play: async ({ canvas }) => {
    const capped = canvas.getByText(/capped to a readable prose measure/);
    await expect(capped).toHaveClass("max-w-prose");
    const uncapped = canvas.getByText(/runs the full width/);
    await expect(uncapped).not.toHaveClass("max-w-prose");
  },
};
