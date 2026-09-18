/**
 * The five-step pipeline the flow-canvas tab draws (RM-095, concept §4.2). Every node label
 * names a real table this same fixture set produces — `orders` (`orders.ts`), `accounts`
 * (the account pool `orders.ts` and `churn.ts` share) and `kpis` (`kpis.ts`) — so the canvas
 * reads as this company's actual pipeline rather than a generic "step 1 / step 2" diagram.
 *
 * Types only, per `home-imports` — no runtime import of `@elabs-ai/components-flow`
 * (React Flow is one of the "heavy packages [that] load per section", `.claude/rules/home.md`).
 */
import type { Edge, Node } from "@elabs-ai/components-flow";

export interface PipelineNodeData extends Record<string, unknown> {
  label: string;
  description: string;
}

export const FLOW_NODES: Node<PipelineNodeData>[] = [
  {
    id: "ingest",
    type: "default",
    position: { x: 0, y: 0 },
    data: { label: "Ingest", description: "Raw orders + accounts feeds land in the warehouse." },
  },
  {
    id: "dedupe",
    type: "default",
    position: { x: 240, y: 0 },
    data: {
      label: "Dedupe",
      description: "orders deduplicated on order id; late retries dropped.",
    },
  },
  {
    id: "enrich",
    type: "default",
    position: { x: 480, y: 0 },
    data: { label: "Enrich", description: "orders joined to accounts for region and owner." },
  },
  {
    id: "score",
    type: "default",
    position: { x: 720, y: 0 },
    data: {
      label: "Score",
      description: "Each account's MRR change, from orders, scored against the churn model.",
    },
  },
  {
    id: "publish",
    type: "default",
    position: { x: 960, y: 0 },
    data: { label: "Publish", description: "Scored rows published to kpis for the dashboard tab." },
  },
];

export const FLOW_EDGES: Edge[] = [
  { id: "ingest-dedupe", source: "ingest", target: "dedupe" },
  { id: "dedupe-enrich", source: "dedupe", target: "enrich" },
  { id: "enrich-score", source: "enrich", target: "score" },
  { id: "score-publish", source: "score", target: "publish" },
];
