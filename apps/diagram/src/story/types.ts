import type { ArchIssue } from "../spec/dialect/issues";

export interface ResolvedStoryStep {
  id: string;
  title: string;
  text?: string;
  duration: number;
  camera: "fit" | "follow";
  nodeIds: string[];
  edgeIds: string[];
  /** Diagram instance ids to reveal temporarily, never authored mutations. */
  expand: string[];
  callouts: { at: string; text: string }[];
  /** Flow targets in written order; reverse follows a back arrow from target to source. */
  follow: { edgeId: string; reverse: boolean }[];
}
export interface ResolvedStory {
  explicit: boolean;
  steps: ResolvedStoryStep[];
  issues: ArchIssue[];
}
