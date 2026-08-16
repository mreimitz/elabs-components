import type { Meta, StoryObj } from "@storybook/react-vite";
import { DownloadIcon } from "lucide-react";
import {
  Artifact,
  ArtifactAction,
  ArtifactActions,
  ArtifactClose,
  ArtifactContent,
  ArtifactDescription,
  ArtifactHeader,
  ArtifactTitle,
} from "./artifact";

const meta = {
  title: "AI/Artifact",
  component: Artifact,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Artifact>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Artifact className="max-w-lg">
      <ArtifactHeader>
        <div>
          <ArtifactTitle>Q3 retention cohort</ArtifactTitle>
          <ArtifactDescription>Generated report</ArtifactDescription>
        </div>
        <ArtifactActions>
          <ArtifactAction icon={DownloadIcon} tooltip="Download" />
          <ArtifactClose />
        </ArtifactActions>
      </ArtifactHeader>
      <ArtifactContent>
        Enterprise churn fell 0.4pp to 1.8% this quarter, driven by the renewal-desk rollout.
      </ArtifactContent>
    </Artifact>
  ),
};

// LOADING — the body hasn't arrived yet (loading-states.md `loading`).
// `ArtifactContent` renders a layout-shaped skeleton while `ArtifactHeader` /
// `ArtifactTitle` keep rendering normally, so the artifact's identity stays
// visible while its content streams in.
export const Loading: Story = {
  render: () => (
    <Artifact className="max-w-lg" loading>
      <ArtifactHeader>
        <div>
          <ArtifactTitle>Q3 retention cohort</ArtifactTitle>
          <ArtifactDescription>Generating report…</ArtifactDescription>
        </div>
        <ArtifactActions>
          <ArtifactAction icon={DownloadIcon} tooltip="Download" disabled />
          <ArtifactClose />
        </ArtifactActions>
      </ArtifactHeader>
      <ArtifactContent>This content is not shown while loading.</ArtifactContent>
    </Artifact>
  ),
};
