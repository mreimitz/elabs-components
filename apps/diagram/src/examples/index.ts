/**
 * DG-13 — the example gallery (plan D13 + §11 "Fourth example"). Each YAML file is the
 * source of truth; `?raw` imports it as text (typed by `src/vite-env.d.ts`, DG-09). The
 * `description` is what the sidebar shows as the entry's tooltip; the dialect has no
 * diagram-level `description` key yet (DG-13 findings: dialect v0.1 input).
 */
import clickhouseCloudStack from "./clickhouse-cloud-stack.yaml?raw";
import lakehouseAws from "./lakehouse-aws.yaml?raw";
import qlikCloudDataGateway from "./qlik-cloud-data-gateway.yaml?raw";
import qlikSenseEnterpriseOnprem from "./qlik-sense-enterprise-onprem.yaml?raw";

export interface DiagramExample {
  /** Stable id, the file's basename. */
  id: string;
  /** The sidebar label (short; the YAML `title` is the long form). */
  label: string;
  /** One sentence: what the picture shows. */
  description: string;
  /** The YAML text. */
  text: string;
}

export const EXAMPLES: readonly DiagramExample[] = [
  {
    id: "qlik-cloud-data-gateway",
    label: "Qlik Cloud + Data Gateway",
    description:
      "Qlik Cloud as SaaS; only the Data Gateway VM runs in the customer's Azure subscription, dialling out to Qlik Cloud and Snowflake.",
    text: qlikCloudDataGateway,
  },
  {
    id: "lakehouse-aws",
    label: "Lakehouse on AWS",
    description:
      "Sources land in S3 in the customer's AWS account; Databricks jobs in the VPC write to Snowflake over PrivateLink, and Qlik Cloud queries it.",
    text: lakehouseAws,
  },
  {
    id: "qlik-sense-enterprise-onprem",
    label: "Qlik Sense Enterprise on premises",
    description:
      "A multi-node Qlik Sense Enterprise on Windows site behind a DMZ, with shared persistence and partner support over VPN.",
    text: qlikSenseEnterpriseOnprem,
  },
  {
    id: "clickhouse-cloud-stack",
    label: "ClickHouse Cloud stack",
    description:
      "Postgres change events through Confluent Cloud and ClickPipes into ClickHouse Cloud, queried over PrivateLink.",
    text: clickhouseCloudStack,
  },
];
