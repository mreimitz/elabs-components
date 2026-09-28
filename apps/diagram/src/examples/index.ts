/**
 * DG-13 — the example gallery (plan D13 + §11 "Fourth example"). DG-21 moved the YAML files
 * into the workspace (`apps/diagram/workspace/examples/`), where they are ordinary documents:
 * opened, autosaved and versioned like any diagram. This is now a thin list of their workspace
 * paths (the "New from template" flow, DG-23). The `description` is the sidebar's tooltip.
 */

export interface DiagramExample {
  /** Stable id, the file's basename. */
  id: string;
  /** The file's path in the workspace (`GET /api/workspace/file?path=`). */
  path: string;
  /** The sidebar label (short; the YAML `title` is the long form). */
  label: string;
  /** One sentence: what the picture shows. */
  description: string;
}

/** The example every fresh tab starts with (`state/diagram-store.ts`). */
export const SEED_EXAMPLE_PATH = "examples/lakehouse-aws.yaml";

export const EXAMPLES: readonly DiagramExample[] = [
  {
    id: "qlik-cloud-data-gateway",
    path: "examples/qlik-cloud-data-gateway.yaml",
    label: "Qlik Cloud + Data Gateway",
    description:
      "Qlik Cloud as SaaS; only the Data Gateway VM runs in the customer's Azure subscription, dialling out to Qlik Cloud and Snowflake.",
  },
  {
    id: "lakehouse-aws",
    path: SEED_EXAMPLE_PATH,
    label: "Lakehouse on AWS",
    description:
      "Sources land in S3 in the customer's AWS account; Databricks jobs in the VPC write to Snowflake over PrivateLink, and Qlik Cloud queries it.",
  },
  {
    id: "qlik-sense-enterprise-onprem",
    path: "examples/qlik-sense-enterprise-onprem.yaml",
    label: "Qlik Sense Enterprise on premises",
    description:
      "A multi-node Qlik Sense Enterprise on Windows site behind a DMZ, with shared persistence and partner support over VPN.",
  },
  {
    id: "clickhouse-cloud-stack",
    path: "examples/clickhouse-cloud-stack.yaml",
    label: "ClickHouse Cloud stack",
    description:
      "Postgres change events through Confluent Cloud and ClickPipes into ClickHouse Cloud, queried over PrivateLink.",
  },
];

/** The example at a workspace path, if it is one. */
export function exampleAt(path: string): DiagramExample | undefined {
  return EXAMPLES.find((example) => example.path === path);
}
