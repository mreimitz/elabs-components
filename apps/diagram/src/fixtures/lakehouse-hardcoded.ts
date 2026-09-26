import type { Edge, Node } from "@elabs-ai/components-flow";

/**
 * DG-03: one hard-coded diagram — a Snowflake + Databricks lakehouse on AWS (plan
 * §2 D13's first example), laid out by nested `layoutFlowElk` (`../layout/run-elk`).
 *
 * Three levels of `type: "group"` nesting: `aws` ⊃ `vpc` ⊃ `private`. Every group and
 * leaf carries `position: { x: 0, y: 0 }` — `runElk` is the only thing that ever moves
 * them. A node with a `parentId` also carries `extent: "parent"` (`FlowGroupNode`'s own
 * contract, verified-apis.md) so React Flow clips it to its group; `parentId` doubles as
 * the input `runElk` reads to build `layoutFlowElk`'s `groups` option. Groups precede
 * every leaf in this array, and a nested group (`vpc`, `private`) precedes its own
 * children — `parentId` resolution does not otherwise require this order, but
 * `FlowGroupNode`/React Flow's own contract does.
 */

const origin = { x: 0, y: 0 };

export const lakehouseNodes: Node[] = [
  // --- groups: aws ⊃ vpc ⊃ private; databricks and snowflake are top-level SaaS zones ---
  { id: "aws", type: "group", position: origin, data: { title: "AWS account" } },
  {
    id: "vpc",
    type: "group",
    position: origin,
    parentId: "aws",
    extent: "parent",
    data: { title: "VPC 10.0.0.0/16" },
  },
  {
    id: "private",
    type: "group",
    position: origin,
    parentId: "vpc",
    extent: "parent",
    data: { title: "Private subnet" },
  },
  { id: "databricks", type: "group", position: origin, data: { title: "Databricks (SaaS)" } },
  { id: "snowflake", type: "group", position: origin, data: { title: "Snowflake (SaaS)" } },

  // --- leaves inside `private`, ordered along the edge flow that crosses it ---
  {
    id: "postgres-rds",
    type: "brand",
    position: origin,
    parentId: "private",
    extent: "parent",
    data: { title: "Postgres (RDS)", subtitle: "OLTP source" },
  },
  {
    id: "msk",
    type: "brand",
    position: origin,
    parentId: "private",
    extent: "parent",
    data: { title: "Amazon MSK", subtitle: "Kafka" },
  },
  {
    id: "s3-landing",
    type: "brand",
    position: origin,
    parentId: "private",
    extent: "parent",
    data: { title: "S3 — landing", subtitle: "Object storage" },
  },
  {
    id: "glue",
    type: "brand",
    position: origin,
    parentId: "private",
    extent: "parent",
    data: { title: "AWS Glue", subtitle: "ETL" },
  },
  {
    id: "s3-curated",
    type: "brand",
    position: origin,
    parentId: "private",
    extent: "parent",
    data: { title: "S3 — curated", subtitle: "Object storage" },
  },

  // --- leaf directly inside `vpc` (outside `private`) ---
  {
    id: "nat",
    type: "brand",
    position: origin,
    parentId: "vpc",
    extent: "parent",
    data: { title: "NAT gateway", subtitle: "Egress" },
  },

  // --- leaf directly inside `aws` (outside `vpc`) ---
  {
    id: "iam",
    type: "brand",
    position: origin,
    parentId: "aws",
    extent: "parent",
    data: { title: "IAM", subtitle: "Identity" },
  },

  // --- leaves inside `databricks` ---
  {
    id: "dbx-jobs",
    type: "brand",
    position: origin,
    parentId: "databricks",
    extent: "parent",
    data: { title: "Databricks jobs", subtitle: "ETL" },
  },
  {
    id: "dbx-workspace",
    type: "brand",
    position: origin,
    parentId: "databricks",
    extent: "parent",
    data: { title: "Databricks workspace" },
  },

  // --- leaves inside `snowflake` ---
  {
    id: "snow-db",
    type: "brand",
    position: origin,
    parentId: "snowflake",
    extent: "parent",
    data: { title: "Snowflake DB", subtitle: "Storage" },
  },
  {
    id: "snow-wh",
    type: "brand",
    position: origin,
    parentId: "snowflake",
    extent: "parent",
    data: { title: "Snowflake warehouse", subtitle: "Compute" },
  },

  // --- top-level leaves (outside every group) ---
  { id: "okta", type: "brand", position: origin, data: { title: "Okta", subtitle: "SSO" } },
  {
    id: "qlik-cloud",
    type: "brand",
    position: origin,
    data: { title: "Qlik Cloud", subtitle: "SaaS" },
  },
  {
    id: "salesforce",
    type: "brand",
    position: origin,
    data: { title: "Salesforce", subtitle: "SaaS", tone: "info" },
  },
];

// P4: library gap — every edge below carries a `data.label`, but `FlowEdge`
// (packages/flow/src/flow-edge/flow-edge.tsx) never reads `data` at all: no label, no
// `EdgeLabelPill`. None of these render on canvas. See DG-03-elk-nested.md gap 4.
export const lakehouseEdges: Edge[] = [
  {
    id: "e-salesforce-s3-landing",
    type: "brand",
    source: "salesforce",
    target: "s3-landing",
    data: { label: "Data export" },
  },
  {
    id: "e-postgres-msk",
    type: "brand",
    source: "postgres-rds",
    target: "msk",
    data: { label: "CDC" },
  },
  {
    id: "e-msk-s3-landing",
    type: "brand",
    source: "msk",
    target: "s3-landing",
    data: { label: "Stream" },
  },
  {
    id: "e-s3-landing-glue",
    type: "brand",
    source: "s3-landing",
    target: "glue",
    data: { label: "Catalog" },
  },
  {
    id: "e-glue-s3-curated",
    type: "brand",
    source: "glue",
    target: "s3-curated",
    data: { label: "ETL" },
  },
  // crosses aws → databricks
  {
    id: "e-s3-curated-dbx-jobs",
    type: "brand",
    source: "s3-curated",
    target: "dbx-jobs",
    data: { label: "Load" },
  },
  {
    id: "e-dbx-jobs-dbx-workspace",
    type: "brand",
    source: "dbx-jobs",
    target: "dbx-workspace",
    data: { label: "Run" },
  },
  // crosses databricks → snowflake
  {
    id: "e-dbx-workspace-snow-db",
    type: "brand",
    source: "dbx-workspace",
    target: "snow-db",
    data: { label: "Write" },
  },
  {
    id: "e-snow-db-snow-wh",
    type: "brand",
    source: "snow-db",
    target: "snow-wh",
    data: { label: "Query" },
  },
  {
    id: "e-snow-wh-qlik-cloud",
    type: "brand",
    source: "snow-wh",
    target: "qlik-cloud",
    data: { label: "Direct Query" },
  },
  {
    id: "e-okta-qlik-cloud",
    type: "brand",
    source: "okta",
    target: "qlik-cloud",
    data: { label: "SSO" },
  },
  { id: "e-iam-glue", type: "brand", source: "iam", target: "glue", data: { label: "IAM role" } },
  // crosses two levels: aws/vpc → databricks
  {
    id: "e-nat-dbx-workspace",
    type: "brand",
    source: "nat",
    target: "dbx-workspace",
    data: { label: "Egress" },
  },
  // P4: library gap — the group-to-group edge. `FlowGroupNode` hardcodes its ports at
  // Position.Top/Bottom regardless of layout direction, so in this LR fixture the edge
  // leaves `vpc`'s bottom and re-enters `snowflake`'s top instead of side-to-side.
  // Measured coordinates + root cause: DG-03-elk-nested.md gap 1.
  {
    id: "e-vpc-snowflake",
    type: "brand",
    source: "vpc",
    target: "snowflake",
    data: { label: "PrivateLink" },
  },
];
