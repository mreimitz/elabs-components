import type { Meta, StoryObj } from "@storybook/react-vite";
import { Ban, ShieldAlert } from "lucide-react";
import { STATUSES, StatusBadge, StatusIcon } from "./status-badge";

const meta = {
  title: "Core/StatusBadge",
  component: StatusBadge,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The closed seven-state execution-status vocabulary, each state carrying its own icon as well as its own tone so two states are still tellable apart in greyscale. A neutral label or count with no state semantics is `Core/Badge`; see [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs).",
      },
    },
  },
  args: { status: "complete" },
  argTypes: {
    status: {
      description:
        "The canonical 7-state execution status (closed enum), or a mapped " +
        "{label, tone, icon?} object for a domain the 7 don't cover (#363) — " +
        "see the CustomVocabulary story. The control below drives the canonical form only.",
      control: { type: "select" },
      options: [
        "pending",
        "running",
        "complete",
        "awaiting-approval",
        "denied",
        "failed",
        "skipped",
      ],
      table: { category: "State" },
    },
    size: {
      description: "`md` for inline use; `sm` for rail nodes / dense rows.",
      control: { type: "radio" },
      options: ["sm", "md"],
      table: { category: "Appearance" },
    },
    hideIcon: {
      description: "Render label-only — omits the status icon.",
      control: "boolean",
      table: { category: "Appearance" },
    },
    children: {
      description: "Override the default status label text.",
      control: "text",
      table: { category: "Content" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn().",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof StatusBadge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/**
 * The canonical 7-state vocabulary. Calm states (pending, running, complete,
 * denied, skipped) use the quiet wash/neutral treatment; only the two
 * attention states (awaiting-approval, failed) get the solid fill.
 */
export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <StatusBadge size="sm" status="running" />
      <StatusBadge size="md" status="running" />
    </div>
  ),
};

/** `children` override the default label; counts are a typical use. */
export const CustomLabels: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <StatusBadge status="complete">12 passed</StatusBadge>
      <StatusBadge status="failed">2 failed</StatusBadge>
      <StatusBadge status="skipped">1 skipped</StatusBadge>
      <StatusBadge hideIcon status="running">
        Reconciling…
      </StatusBadge>
    </div>
  ),
};

/**
 * The bounded out-of-vocabulary escape hatch (#363): a run engine whose real
 * states the 7 canonical values don't cover (`aborted`, `stopped_guardrail`, a
 * distinct "not run" dash state) maps them to `{label, tone, icon?}` — CALM
 * treatments only, so the calm/loud contrast against the canonical set below
 * stays meaningful (only `awaiting-approval`/`failed` ever get a solid fill).
 */
export const CustomVocabulary: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {STATUSES.map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
      <StatusBadge status={{ label: "Aborted", tone: "neutral" }} />
      <StatusBadge status={{ label: "Stopped (guardrail)", tone: "warning", icon: ShieldAlert }} />
      <StatusBadge
        status={{ label: "Not run", tone: "neutral", icon: Ban }}
        className="border-dashed"
      />
    </div>
  ),
};

/**
 * The `StatusIcon` atom for tight rows (test results, rail nodes) — the
 * adjacent row text must carry the status name for AT users.
 */
export const Icons: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      {STATUSES.map((status) => (
        <div key={status} className="flex items-center gap-2 text-body">
          <StatusIcon status={status} />
          <span>{status}</span>
        </div>
      ))}
    </div>
  ),
};
