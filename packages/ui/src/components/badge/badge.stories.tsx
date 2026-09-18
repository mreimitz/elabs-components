import type { CSSProperties } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./badge";

const meta = {
  title: "Core/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A neutral label or count. The closed seven-state execution-status vocabulary — each state carrying its own glyph, so it survives greyscale — is `Core/StatusBadge`; see [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs). Reach for `Badge` when the text IS the meaning and the tone is decoration.",
      },
    },
  },
  args: { children: "Badge" },
  argTypes: {
    variant: {
      description: "Visual style / semantic tone of the badge.",
      control: { type: "select" },
      options: ["default", "secondary", "outline", "success", "warning", "destructive", "info"],
      table: { category: "Appearance" },
    },
    appearance: {
      description:
        "Explicit fill/border/ink treatment override. Unset (default) renders no " +
        "`data-appearance` attribute, so the ancestor `--badge-appearance` token decides " +
        "(`auto` = today's look). Meaningful only on the colour-bearing variants.",
      control: { type: "select" },
      options: [undefined, "tint", "solid", "outline", "neutral"],
      table: { category: "Appearance" },
    },
    children: {
      description: "Badge label content.",
      control: "text",
      table: { category: "Content" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn().",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Statuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="destructive">Error</Badge>
      <Badge variant="info">Info</Badge>
    </div>
  ),
};

/**
 * The four explicit `appearance` overrides (`tint`/`solid`/`outline`/`neutral`)
 * on every colour-bearing variant — each renders a `data-appearance` attribute
 * and a fixed fill/border/ink recipe regardless of the ancestor
 * `--badge-appearance` token. `secondary`/`outline` are already a neutral pill
 * and an outline respectively, so `appearance` has no additional effect there.
 */
export const Appearances: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(["tint", "solid", "outline", "neutral"] as const).map((appearance) => (
        <div key={appearance} className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-caption text-muted-foreground">{appearance}</span>
          <Badge appearance={appearance}>Default</Badge>
          <Badge appearance={appearance} variant="success">
            Success
          </Badge>
          <Badge appearance={appearance} variant="warning">
            Warning
          </Badge>
          <Badge appearance={appearance} variant="destructive">
            Error
          </Badge>
          <Badge appearance={appearance} variant="info">
            Info
          </Badge>
        </div>
      ))}
    </div>
  ),
};

/**
 * With no explicit `appearance` prop, an ancestor's `--badge-appearance`
 * token (a theme, or a region wrapper) drives the treatment instead — the
 * badges below carry no `data-appearance` attribute at all.
 */
export const TokenDrivenAppearance: Story = {
  render: () => (
    <div
      className="flex flex-wrap gap-2"
      style={{ "--badge-appearance": "solid" } as CSSProperties}
    >
      <Badge>Default</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="destructive">Error</Badge>
      <Badge variant="info">Info</Badge>
    </div>
  ),
};
