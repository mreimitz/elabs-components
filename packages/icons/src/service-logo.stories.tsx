/**
 * ServiceLogo — a consistently-sized slot for a THIRD-PARTY SERVICE's own mark
 * (an SSO provider, a chat platform, a customer's own brand), where this package
 * never vendors the trademark-bearing asset itself (issue #25). `@elabs-ai/components-icons`
 * ships the MACHINERY — `registerServiceLogos`, a themable render contract, and
 * an accessible monogram fallback for anything not yet registered — and the
 * CONSUMING APP supplies the real marks it is licensed to display.
 *
 * A registered mark is allowed to paint itself with the service's OWN brand
 * colour as a raw literal (see docs/TOKEN_GUIDELINES.md) — a deliberate, narrow
 * exception carved out of `brand-ui audit`'s raw-color rules by the
 * `data-service-logo` marker used below. If your registered marks are borrowed
 * from another project's assets rather than drawn fresh, credit them via
 * `AttributionPanel` (`@elabs-ai/components-ui`) / `scripts/attributions.sources.json` —
 * see `.claude/rules/attribution.md`. This story registers a DEMO mark only
 * ("Northwind", a placeholder shape drawn for this story) — no real trademark ships
 * with brand-ui.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";

import { ServiceLogo, registerServiceLogos } from "./service-logo";

// Registered once, at module scope — exactly how a consuming app would call it
// at startup. "northwind" is a placeholder shape for this story, not a real service.
registerServiceLogos({
  northwind: {
    label: "Northwind",
    render: ({ size, variant }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        {variant === "brand" ? (
          <>
            <rect data-service-logo width="24" height="24" rx="6" fill="#6E56CF" />
            <text
              data-service-logo
              x="12"
              y="16"
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="#FFFFFF"
            >
              A
            </text>
          </>
        ) : (
          <>
            <rect width="24" height="24" rx="6" fill="currentColor" opacity="0.12" />
            <text
              x="12"
              y="16"
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="currentColor"
            >
              A
            </text>
          </>
        )}
      </svg>
    ),
  },
});

const meta = {
  title: "Icons/ServiceLogo",
  component: ServiceLogo,
  parameters: { layout: "centered" },
  argTypes: {
    variant: { control: "inline-radio", options: ["brand", "mono"] },
    size: { control: { type: "range", min: 16, max: 64, step: 2 } },
  },
  args: { name: "northwind", size: 24, variant: "brand" },
  tags: ["autodocs"],
} satisfies Meta<typeof ServiceLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A registered mark — the consumer-supplied "Northwind" demo shape. */
export const Default: Story = {};

/**
 * `variant="mono"` for dense lists (a filter chip row, a compact combobox) — a
 * well-behaved registered mark draws via `currentColor` when asked; brand-ui
 * can't force that on an arbitrary consumer asset, only offer the seam.
 */
export const Mono: Story = { args: { variant: "mono" } };

/**
 * An unregistered name — the app hasn't called `registerServiceLogos` for it
 * yet (or never will). ServiceLogo never renders broken/blank output: it falls
 * back to an accessible monogram tile, `currentColor` only.
 */
export const UnregisteredFallback: Story = { args: { name: "not-yet-registered" } };

/** Adjacent visible text already names the service, so the mark is `decorative`
 *  and hidden from assistive tech instead of announcing a duplicate name. */
export const DecorativeBesideLabel: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      <ServiceLogo {...args} decorative />
      <span className="text-body font-medium">Northwind</span>
    </div>
  ),
};

/** Scales with `size`, same convention as `Icon`'s default of 24. */
export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-end gap-4">
      {[16, 20, 24, 32, 48].map((size) => (
        <ServiceLogo key={size} {...args} size={size} />
      ))}
    </div>
  ),
};
