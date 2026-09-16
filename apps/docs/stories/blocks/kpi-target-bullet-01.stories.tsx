import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  costPerShipment,
  onTimeDelivery,
  revenue,
} from "@/components/kpi-card-parts/data/acme-quarter";
import { KpiTargetBullet } from "@/components/kpi-target-bullet-01/kpi-target-bullet";

/**
 * Renders the SHIPPED registry block, not a copy of it. `@/components/…` is the
 * consumer-side alias `npx shadcn add` writes against; `apps/docs/.storybook/main.ts`
 * maps it to `registry/blocks`, so what you see here is byte-for-byte what a
 * consumer installs. See `.claude/rules/registry.md`.
 */
const meta = {
  title: "Patterns/Blocks/KPI Cards/On Target (Bullet)",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Answers “am I on target?” — a BulletChart per KPI: the actual value against its target (tick), last year (notch), inside 2–3 qualitative bands. A lower-is-better KPI states that the same ascending bands read best-to-worst in reverse. Semantic tokens only; reads in both themes.\n\nCopy-own it: `npx shadcn add kpi-target-bullet-01` (pulls `kpi-card-parts`).",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof KpiTargetBullet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <KpiTargetBullet /> };

export const OffTarget: Story = {
  render: () => (
    <KpiTargetBullet
      metrics={[
        { ...revenue, actual: 2_180_000 },
        { ...onTimeDelivery, actual: 79.5 },
        { ...costPerShipment, actual: 9.6 },
      ]}
    />
  ),
};

export const Loading: Story = { render: () => <KpiTargetBullet loading /> };

export const Compact: Story = {
  render: () => (
    <div className="w-[280px]">
      <KpiTargetBullet metrics={[revenue]} />
    </div>
  ),
};
