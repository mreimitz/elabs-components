import { createContext, useContext } from "react";
import type { Node } from "@elabs-ai/components-flow";

/** Canvas-local actions; a pure live picture deliberately has no provider. */
export interface CompositeActions {
  toggle(id: string): void;
  drill(id: string): void;
  disabledReason?: string;
  viewerOnly: boolean;
}
export const CompositeActionContext = createContext<CompositeActions | null>(null);
export const useCompositeActions = () => useContext(CompositeActionContext);
export const isComposite = (node: Node): boolean => typeof node.data.component === "string";
export const COMPOSITE_UI = {
  expand: (title: string) => `Expand ${title} inline`,
  collapse: (title: string) => `Collapse ${title}`,
  inspect: (title: string) => `Inspect ${title}`,
  viewer: "Only this view",
  component: "Diagram reference",
  count: (count: number) => `${count} ${count === 1 ? "node" : "nodes"}`,
  manual: "Inline expansion needs automatic layout. Open the diagram to inspect it.",
  unavailable: "This reference cannot be expanded until its diagram is available.",
};
