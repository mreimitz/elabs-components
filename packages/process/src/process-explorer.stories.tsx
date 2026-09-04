/**
 * Process Explorer — placeholder (RM-053).
 *
 * `@elabs-ai/components-process`'s barrel (`src/index.ts`) ships zero React
 * components on purpose (wave-1 scaffold, ADR 0034) — the real process map /
 * variant explorer / KPI strip views land with RM-051/RM-052/RM-054, composed
 * into the flagship "Process Explorer" screen by RM-057 (wave 2). This story
 * exists so the "Process" Storybook group is in the sidebar from wave 1
 * onward instead of appearing only once RM-057 lands — see
 * docs/STORYBOOK_GUIDELINES.md item 22 and .claude/rules/process-components.md.
 *
 * It is not a component story: it renders the package's already-shipped
 * framework-free core (`@elabs-ai/components-process/core`) against the
 * deterministic BPI-2012-shaped fixture generator to prove the
 * event-log → directly-follows-graph → variant pipeline end-to-end, inside a
 * `StatePanel kind="empty"` describing what is still to come.
 *
 * No per-package Storybook "intro page" mechanism exists anywhere in this repo today
 * (every existing `.mdx` doc page lives under the top-level `Docs` group, not scoped to a
 * package) — see the RM-053 result file for the full note. So this autodocs page's own
 * `parameters.docs.description.component` block below stands in as the section's intro:
 * package purpose, current state, and where the real views land.
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PackageOpen } from "lucide-react";
import { StatePanel } from "@elabs-ai/components-ui";
import { discoverGraph } from "./core/discover-graph";
import { extractVariants } from "./core/extract-variants";
import { generateBpi2012Subset } from "./core/fixtures/generate-bpi-2012-subset";

function ProcessExplorerPlaceholder() {
  const log = generateBpi2012Subset({ cases: 200, seed: 1 });
  const graph = discoverGraph(log);
  const variants = extractVariants(log);

  return (
    <StatePanel
      kind="empty"
      icon={<PackageOpen aria-hidden="true" />}
      title="Process Explorer lands in wave 2"
      description={`The event-log core already runs end to end: a 200-case sample of the BPI-2012-shaped fixture discovers ${graph.activities.length} activities across ${variants.length} variants. The process map, variant explorer and KPI strip views arrive with RM-057.`}
    />
  );
}

const meta = {
  title: "Process/ProcessExplorer",
  component: ProcessExplorerPlaceholder,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "@elabs-ai/components-process is the repo's one layer-3 package (ADR 0034): process-mining views — process map, variant explorer, case table/timeline, KPI strip, dotted chart, conformance overlay — composed from @elabs-ai/components-flow/-charts/-data/-ui primitives, never authoring a generic edge, mark, table or control of its own. This story is a placeholder for the flagship 'Process Explorer' composition; it registers the Process Storybook group ahead of the real views (RM-057, wave 2) and demonstrates the shipped event-log core (@elabs-ai/components-process/core) against a deterministic BPI-2012-shaped fixture.",
      },
    },
  },
} satisfies Meta<typeof ProcessExplorerPlaceholder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
