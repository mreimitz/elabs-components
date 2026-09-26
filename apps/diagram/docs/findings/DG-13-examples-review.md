# DG-13 — examples review: domain facts, layout tuning, acceptance screenshots

Built on `diagram/dg-13-examples`, which starts from `diagram/integrate` at de58eeb6 (DG-09 …
DG-12 merged). Checked in Chromium through agent-browser against the app's Vite dev server
(port 5187), at 1920×1080 and 1440×900, in `light`, `dark` and `qlik-light`. Evidence lives
in `apps/diagram/.evidence/DG-13/` (repo-root-relative, git-ignored — the links below resolve
in the checkout the screenshots were written to).

**Status: in-progress.** The maintainer has not yet reviewed the screenshot set; each example
needs his explicit acceptance (item step 9).

Short file names below: `qlik-cloud`, `lakehouse`, `qlik-sense`, `clickhouse` stand for
`src/examples/qlik-cloud-data-gateway.yaml`, `lakehouse-aws.yaml`,
`qlik-sense-enterprise-onprem.yaml` and `clickhouse-cloud-stack.yaml`.

## Screenshots (step 9)

1920×1080, fitted, editor open. Each one was opened and looked at before it was listed.

| Example                           | Light                                                                 | Dark                                                                | Qlik light                                                                      | Greyscale                                                                     | Fit zoom (light) |
| --------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------- |
| Qlik Cloud + Data Gateway         | [light](../../.evidence/DG-13/qlik-cloud-data-gateway-light.png)      | [dark](../../.evidence/DG-13/qlik-cloud-data-gateway-dark.png)      | [qlik-light](../../.evidence/DG-13/qlik-cloud-data-gateway-qlik-light.png)      | [greyscale](../../.evidence/DG-13/qlik-cloud-data-gateway-greyscale.png)      | 0.760            |
| Lakehouse on AWS                  | [light](../../.evidence/DG-13/lakehouse-aws-light.png)                | [dark](../../.evidence/DG-13/lakehouse-aws-dark.png)                |                                                                                 | [greyscale](../../.evidence/DG-13/lakehouse-aws-greyscale.png)                | 0.424            |
| Qlik Sense Enterprise on premises | [light](../../.evidence/DG-13/qlik-sense-enterprise-onprem-light.png) | [dark](../../.evidence/DG-13/qlik-sense-enterprise-onprem-dark.png) | [qlik-light](../../.evidence/DG-13/qlik-sense-enterprise-onprem-qlik-light.png) | [greyscale](../../.evidence/DG-13/qlik-sense-enterprise-onprem-greyscale.png) | 0.411            |
| ClickHouse Cloud stack            | [light](../../.evidence/DG-13/clickhouse-cloud-stack-light.png)       | [dark](../../.evidence/DG-13/clickhouse-cloud-stack-dark.png)       |                                                                                 | [greyscale](../../.evidence/DG-13/clickhouse-cloud-stack-greyscale.png)       | 0.804            |

Other evidence:

- Direction toggle after tuning, LR and TB per example:
  [qlik-cloud LR](../../.evidence/DG-13/after-qlik-cloud-data-gateway-LR.png),
  [qlik-cloud TB](../../.evidence/DG-13/after-qlik-cloud-data-gateway-TB.png),
  [lakehouse LR](../../.evidence/DG-13/after-lakehouse-aws-LR.png),
  [lakehouse TB](../../.evidence/DG-13/after-lakehouse-aws-TB.png),
  [qlik-sense LR](../../.evidence/DG-13/after-qlik-sense-enterprise-onprem-LR.png),
  [qlik-sense TB](../../.evidence/DG-13/after-qlik-sense-enterprise-onprem-TB.png),
  [clickhouse LR](../../.evidence/DG-13/after-clickhouse-cloud-stack-LR.png),
  [clickhouse TB](../../.evidence/DG-13/after-clickhouse-cloud-stack-TB.png). The same set
  before tuning: `before-<id>-<dir>.png` in the same folder.
- Zone collapse (DG-11 step 6d), one per example:
  [qlik-cloud](../../.evidence/DG-13/7-collapse-qlik-cloud-data-gateway.png),
  [lakehouse](../../.evidence/DG-13/7-collapse-lakehouse-aws.png),
  [qlik-sense](../../.evidence/DG-13/7-collapse-qlik-sense-enterprise-onprem.png),
  [clickhouse](../../.evidence/DG-13/7-collapse-clickhouse-cloud-stack.png).
- Sidebar (step 5): [examples list, Lakehouse current](../../.evidence/DG-13/5a-examples-list-lakehouse-current.png),
  [ClickHouse loaded](../../.evidence/DG-13/5b-clickhouse-loaded.png),
  [confirm dialog open](../../.evidence/DG-13/5c-confirm-dialog-open.png),
  [Escape — focus back on the entry](../../.evidence/DG-13/5c-escape-focus-returned.png),
  [Replace — loaded, focus on the entry](../../.evidence/DG-13/5c-replace-loaded-focus-on-button.png),
  [Tab focus ring on an entry](../../.evidence/DG-13/5d-tab-focus-ring-lakehouse.png),
  [dialog: Keep editing focused](../../.evidence/DG-13/5d-dialog-tab-keep-focus-ring.png),
  [dialog: Replace focused](../../.evidence/DG-13/5d-dialog-tab-replace-focus-ring.png),
  [opening an example from `#icons` clears the hash](../../.evidence/DG-13/5-open-example-from-icons-route-clears-hash.png).

## Bounds check (DG-12 binding ruling)

A fresh page per theme and viewport; each example opened from the sidebar in turn; then, in
the page: every node rect inside the pane (`outside`), no node rect intersecting a
`.react-flow__panel` rect (`underPanel`), every child inside its zone (`escapes`), no console
error (`errs`). `title==heading` confirms the store and the visible title block agree (it
guards against a stale Vite module after an edit).

```text
1920x1080 light qlik-cloud-data-gateway dir=TB nodes=13 zoom=0.760 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1920x1080 light lakehouse-aws dir=LR nodes=19 zoom=0.424 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1920x1080 light qlik-sense-enterprise-onprem dir=TB nodes=21 zoom=0.411 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1920x1080 light clickhouse-cloud-stack dir=TB nodes=14 zoom=0.804 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1440x900 light qlik-cloud-data-gateway dir=TB nodes=13 zoom=0.529 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1440x900 light lakehouse-aws dir=LR nodes=19 zoom=0.297 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1440x900 light qlik-sense-enterprise-onprem dir=TB nodes=21 zoom=0.259 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1440x900 light clickhouse-cloud-stack dir=TB nodes=14 zoom=0.591 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1920x1080 dark qlik-cloud-data-gateway dir=TB nodes=13 zoom=0.760 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1920x1080 dark lakehouse-aws dir=LR nodes=19 zoom=0.424 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1920x1080 dark qlik-sense-enterprise-onprem dir=TB nodes=21 zoom=0.411 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1920x1080 dark clickhouse-cloud-stack dir=TB nodes=14 zoom=0.804 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1440x900 dark qlik-cloud-data-gateway dir=TB nodes=13 zoom=0.529 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1440x900 dark lakehouse-aws dir=LR nodes=19 zoom=0.297 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1440x900 dark qlik-sense-enterprise-onprem dir=TB nodes=21 zoom=0.259 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1440x900 dark clickhouse-cloud-stack dir=TB nodes=14 zoom=0.591 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1920x1080 qlik-light qlik-cloud-data-gateway dir=TB nodes=13 zoom=0.782 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1920x1080 qlik-light lakehouse-aws dir=LR nodes=19 zoom=0.424 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1920x1080 qlik-light qlik-sense-enterprise-onprem dir=TB nodes=21 zoom=0.418 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1920x1080 qlik-light clickhouse-cloud-stack dir=TB nodes=14 zoom=0.820 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1440x900 qlik-light qlik-cloud-data-gateway dir=TB nodes=13 zoom=0.544 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1440x900 qlik-light lakehouse-aws dir=LR nodes=19 zoom=0.297 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1440x900 qlik-light qlik-sense-enterprise-onprem dir=TB nodes=21 zoom=0.266 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
1440x900 qlik-light clickhouse-cloud-stack dir=TB nodes=14 zoom=0.606 title==heading:True outside=[] underPanel=[] escapes=[] errs=[]
```

The LR/TB toggle on every example (1920×1080, light) also gave `outside: []`,
`underPanel: []`, `escapes: []`; fit zoom LR / TB: qlik-cloud 0.582 / 0.760, lakehouse
0.424 / 0.512, qlik-sense 0.374 / 0.411, clickhouse 0.635 / 0.804.

Collapse (DG-11 step 6d): the nested zone shrinks to a 220 × 48 chip, its parent shrinks
with it, nothing leaves the pane, expanding restores the size.

| Example    | Zone      | Expanded  | Collapsed | Parent, expanded → collapsed | `outside` |
| ---------- | --------- | --------- | --------- | ---------------------------- | --------- |
| qlik-cloud | `dc`      | 336 × 192 | 220 × 48  | `customer` 469×720 → 464×571 | `[]`      |
| lakehouse  | `private` | 408 × 332 | 220 × 48  | `vpc` 445×554 → 252×270      | `[]`      |
| qlik-sense | `site`    | 560 × 362 | 220 × 48  | `corp` 1776×1087 → 1776×763  | `[]`      |
| clickhouse | `region`  | 512 × 372 | 220 × 48  | `aws` 544×448 → 252×124      | `[]`      |

**Collapse chevron under an edge** (the DG-12 known issue): seen once. In the ClickHouse
example the `endpoint -> clickhouse` PrivateLink edge's interaction path covers the
"Collapse Confluent Cloud" chevron (`elementFromPoint` at the chevron's centre returns the
edge). The other three examples: `[]`. Not fixed here — the edge path is drawn without ELK's
bend points (see library gaps), so any fix belongs to the edge routing, not to this example.

## Domain facts (step 6)

Every claim the pictures make was checked against the vendor's own public documentation
(pages fetched on 2026-09-26). "Fixed" rows changed the YAML; the old value is named. Line
numbers are the current file's.

### Qlik Cloud + Data Gateway (`qlik-cloud`)

| Fact as drawn                                                       | Verdict                                                                                                                                                                 | Source                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gateway` is "Qlik Data Gateway – Data Movement" (l.41)             | Fixed (was "Direct Access"). Direct Access serves Qlik Cloud Analytics connections; the Data Movement gateway is the one for Qlik Talend Data Integration and CDC.      | [setting-up-gateways](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Gateways/setting-up-gateways.htm)                                                                                                                                                                                     |
| `gateway` subtitle "Linux VM, outbound only" (l.42)                 | Fixed (was "VM"). Data Movement is certified on Red Hat 8.x/9.x and Amazon Linux 2023; Direct Access is the Windows one.                                                | [dm-gateway-prerequisites](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Gateways/dm-gateway-prerequisites.htm)                                                                                                                                                                           |
| Outbound HTTPS 443 only, no inbound port (note l.86, edges l.72–74) | Confirmed: outbound TCP 443 to the tenant; "strictly outbound, encrypted, and mutually authenticated".                                                                  | [dm-gateway-prerequisites](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Gateways/dm-gateway-prerequisites.htm)                                                                                                                                                                           |
| `gateway -> wh` "Land changes", data (l.72)                         | Fixed (was `gateway -> qtdi` as data plus `qtdi -> wh` "Load & transform"). The gateway pushes data straight to the target; nothing is stored in the Qlik Cloud tenant. | [replication-gateway](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Gateways/replication-gateway.htm), [data-movement](https://help.qlik.com/en-US/evaluation-guides/Content/data-integration/data-movement.htm)                                                                          |
| `gateway <-> qtdi` "Tasks and status", control (l.74)               | Fixed (was data, one way). Qlik Cloud sends task instructions; the gateway reports task status.                                                                         | [replication-gateway](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Gateways/replication-gateway.htm)                                                                                                                                                                                     |
| `wh <- qtdi` "Transform in Snowflake", control, hourly (l.76)       | Fixed (was data). Transformations are materialised as tables or views in the target.                                                                                    | [Transformations](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/DataIntegration/Transformation/Transformations.htm), [snowflake-target](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/DataIntegration/TargetConnections/snowflake-target.htm)               |
| `erp -> gateway` "CDC" from SAP S/4HANA (l.70)                      | Confirmed, with a condition: the SAP ODP connector (CDS views, extractors, SLT) needs the Data Movement gateway and a Qlik Talend Cloud Enterprise subscription.        | [sap-odp-properties](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/DataIntegration/SourcesConnections/SAP-ODP/sap-odp-properties.htm)                                                                                                                                                     |
| `mssql -> gateway` (l.71)                                           | Confirmed: "Microsoft SQL Server (log based)" reads the transaction log through the Data Movement gateway.                                                              | [sqlserver-source](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/DataIntegration/SourcesConnections/SQLServer/sqlserver-source.htm)                                                                                                                                                       |
| `wh -> qca` "Direct Query / reload", ODBC, TLS (l.77)               | Fixed (was JDBC). The Snowflake connector is part of the Qlik ODBC Connector Package; Direct Query lists Snowflake.                                                     | [Create-Snowflake-connection](https://help.qlik.com/en-US/cloud-services/Subsystems/ODBC_Connector_help/Content/Connectors_ODBC/Snowflake/Create-Snowflake-connection.htm), [direct-query](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/DirectQuery/direct-access-with-direct-query.htm) |
| `users -> qca` "SSO via Entra ID" (l.79)                            | Confirmed: Qlik Cloud takes OIDC and SAML IdPs; there is an Entra ID guide.                                                                                             | [configuring-idp-entraid](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Admin/configuring-idp-entraid.htm)                                                                                                                                                                                |
| `qtdi -> qca` "Publish to catalog" (l.80)                           | Fixed (was `qca <-> qtdi` "Catalog sync"). One catalog in one tenant, reached from both hubs; datasets arrive through "Publish to catalog".                             | [Understanding-data-catalog](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/DataIntegration/Catalog/Understanding-data-catalog.htm)                                                                                                                                                        |

### Qlik Sense Enterprise on premises (`qlik-sense`)

| Fact as drawn                                                                       | Verdict                                                                                                                                                | Source                                                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Central node and two rim nodes share one repository DB and one file share (l.31–61) | Confirmed: a multi-node cluster forms around a single repository database and file share.                                                              | [Persistence](https://help.qlik.com/en-US/sense-admin/May2026/Subsystems/DeployAdministerQSE/Content/Sense_DeployAdminister/QSEoW/Deploy_QSEoW/Persistence.htm)                                                                          |
| `central -> rim-engine` "Proxy to engine", QES 4747 (l.114)                         | Fixed (was "Sync", control). Nothing syncs between nodes; the engine listens on 4747 for the proxy.                                                    | [Ports](https://help.qlik.com/en-US/sense-admin/May2026/Subsystems/DeployAdministerQSE/Content/Sense_DeployAdminister/QSEoW/Deploy_QSEoW/Ports.htm)                                                                                      |
| `central -> rim-scheduler` "Reload tasks", QSS 5151 (l.115)                         | Fixed (was "Sync"). The worker scheduler listens on 5151, inbound from the central node only.                                                          | [Ports (Nov 2024)](https://help.qlik.com/en-US/sense-admin/November2024/Subsystems/DeployAdministerQSE/Content/Sense_DeployAdminister/QSEoW/Deploy_QSEoW/Ports.htm)                                                                      |
| `site -> repo-db` PostgreSQL 4432 (l.117)                                           | Fixed (was `central -> repo-db`). Port 4432 is used by all nodes in a site.                                                                            | [installing-configuring-postgresql](https://help.qlik.com/en-US/sense-admin/May2026/Subsystems/DeployAdministerQSE/Content/Sense_DeployAdminister/QSEoW/Deploy_QSEoW/Installing-configuring-postgresql.htm)                              |
| `site -> share` SMB 3 (l.118)                                                       | Confirmed: a Windows, Linux or NAS share supporting SMB 3.0, by UNC path.                                                                              | [Persistence](https://help.qlik.com/en-US/sense-admin/May2026/Subsystems/DeployAdministerQSE/Content/Sense_DeployAdminister/QSEoW/Deploy_QSEoW/Persistence.htm)                                                                          |
| Users and mobile → WAF → central over HTTPS 443 (l.111–113)                         | Confirmed: the proxy (QPS) takes inbound user web traffic on 443.                                                                                      | [Ports](https://help.qlik.com/en-US/sense-admin/May2026/Subsystems/DeployAdministerQSE/Content/Sense_DeployAdminister/QSEoW/Deploy_QSEoW/Ports.htm)                                                                                      |
| "WAF and reverse proxy" in the DMZ (l.27–30)                                        | Kept, unverified. Qlik's documented DMZ pattern is a Qlik proxy node; a third-party reverse proxy is a customer choice the Qlik pages do not describe. | [Ports](https://help.qlik.com/en-US/sense-admin/May2026/Subsystems/DeployAdministerQSE/Content/Sense_DeployAdminister/QSEoW/Deploy_QSEoW/Ports.htm)                                                                                      |
| `central -> ad` "User sync", LDAPS (l.116)                                          | Confirmed: the AD user directory connector takes `LDAPS` for SSL. Port 636 is the protocol's standard, not stated by Qlik.                             | [AD connector properties](https://help.qlik.com/en-US/sense-admin/May2026/Subsystems/DeployAdministerQSE/Content/Sense_DeployAdminister/QSEoW/Administer_QSEoW/Managing_QSEoW/user-directory-connectors-Active-Directory-properties.htm) |
| `central -> licensing` HTTPS 443 to license.qlikcloud.com (l.104–108, 124)          | Confirmed: open 443 outbound to license.qlikcloud.com; a proxy is supported.                                                                           | [system-requirements](https://help.qlik.com/en-US/sense-admin/May2026/Subsystems/DeployAdministerQSE/Content/Sense_DeployAdminister/Common/system-requirements.htm)                                                                      |
| `mobile` subtitle "Qlik Sense Client-Managed Mobile" (l.103)                        | Fixed (was "Qlik Sense Mobile"). That is the product's name; it connects to the virtual proxy's URL.                                                   | [Deploying Qlik Sense mobile](https://help.qlik.com/en-US/sense-admin/February2024/Subsystems/DeployAdministerQSE/Content/Sense_DeployAdminister/SenseMobile/Deploying-Qlik-Sense-mobile-with-Intune.htm)                                |
| Central subtitle "Repository, proxy, manager scheduler" (l.38)                      | Fixed (was "scheduler master"). The ports page now says Manager QSS and Worker QSS.                                                                    | [Ports (Nov 2024)](https://help.qlik.com/en-US/sense-admin/November2024/Subsystems/DeployAdministerQSE/Content/Sense_DeployAdminister/QSEoW/Deploy_QSEoW/Ports.htm)                                                                      |
| `rim-scheduler <- s4` SAP RFC (l.122)                                               | Fixed (was "SAP connector"). The Qlik SAP NetWeaver connector needs the SAP NW RFC SDK on the Qlik nodes.                                              | [Installing the SAP connectors](https://help.qlik.com/en-US/connectors/Subsystems/SAP_Connectors_Help/Content/Connectors_SAP/Installation/Installing-the-connectors.htm)                                                                 |
| `rim-scheduler <- mssql` ODBC (l.121)                                               | Confirmed: the Qlik ODBC Connector Package lists Microsoft SQL Server.                                                                                 | [ODBC connector](https://help.qlik.com/en-US/connectors/Subsystems/ODBC_connector_help/Content/Connectors_ODBC/Introduction/ODBC-connector.htm)                                                                                          |
| `rim-scheduler <- files` FTP, no TLS (l.123)                                        | Confirmed: a web file data connection loads from FTP, HTTP or HTTPS.                                                                                   | [load-data-from-files](https://help.qlik.com/en-US/sense/November2024/Subsystems/Hub/Content/Sense_Hub/DataSource/load-data-from-files.htm)                                                                                              |

### ClickHouse Cloud stack (`clickhouse`)

| Fact as drawn                                                       | Verdict                                                                                                                                                                                                    | Source                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cdc` "PostgreSQL CDC / Source V2 (Debezium)" (l.53–56)             | Fixed (was "Postgres CDC connector / Debezium"). The product is the fully managed PostgreSQL CDC Source V2 (Debezium) connector.                                                                           | [cc-postgresql-cdc-source-v2-debezium](https://docs.confluent.io/cloud/current/connectors/cc-postgresql-cdc-source-v2-debezium/cc-postgresql-cdc-source-v2-debezium.html)                                                                                                                                                                                                                  |
| `orders-db -> cdc` "Logical replication" (l.88)                     | Confirmed: pgoutput logical replication; RDS needs `rds.logical_replication=1`.                                                                                                                            | [cc-postgresql-cdc-source-v2-debezium](https://docs.confluent.io/cloud/current/connectors/cc-postgresql-cdc-source-v2-debezium/cc-postgresql-cdc-source-v2-debezium.html)                                                                                                                                                                                                                  |
| `topics -> clickpipes` Kafka SASL_SSL (l.90)                        | Confirmed: Confluent Cloud is a supported ClickPipes source; SASL/PLAIN over TLS or SCRAM.                                                                                                                 | [clickpipes kafka reference](https://clickhouse.com/docs/integrations/clickpipes/kafka/reference)                                                                                                                                                                                                                                                                                          |
| `endpoint` and `endpoint -> clickhouse` PrivateLink (l.37–40, 96)   | Confirmed: the customer creates an interface VPC endpoint; eu-central-1 is listed; Scale and Enterprise plans; inbound only.                                                                               | [aws-privatelink](https://clickhouse.com/docs/manage/security/aws-privatelink)                                                                                                                                                                                                                                                                                                             |
| `grafana -> endpoint`, `superset -> endpoint`, HTTPS 8443 (l.93–95) | Port confirmed (8443 is the secure HTTP default; Superset uses clickhouse-connect). Retargeted from `ch` to `endpoint` so the dashboards visibly take the PrivateLink path the file's paragraph describes. | [grafana config](https://clickhouse.com/docs/integrations/grafana/config), [superset](https://clickhouse.com/docs/integrations/superset), [aws-privatelink](https://clickhouse.com/docs/manage/security/aws-privatelink)                                                                                                                                                                   |
| Qlik Cloud node and `qlik -> ch` "Direct Query" (removed)           | Removed. Qlik's Direct Query list has no ClickHouse, Direct Access connections cannot be used in Direct Query, and ClickHouse's BI list has no Qlik.                                                       | [direct-query databases](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/DirectQuery/direct-access-with-direct-query.htm), [direct-query limitations](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/DirectQuery/limitations-direct-query.htm), [data-visualization](https://clickhouse.com/docs/integrations/data-visualization) |
| `okta -> clickhouse` "SAML SSO (console)" (l.98)                    | Fixed (was `okta -> ch` "SAML"). SAML signs users in to the Cloud console, not to database connections; Enterprise plan.                                                                                   | [saml-setup](https://clickhouse.com/docs/cloud/security/saml-setup)                                                                                                                                                                                                                                                                                                                        |
| `archive <- ch` "Export", S3 API, TLS, daily (l.97)                 | Confirmed: `INSERT INTO FUNCTION s3(…)` with an IAM role through `extra_credentials`. The daily schedule is the example's assumption (unverified).                                                         | [s3 table function](https://clickhouse.com/docs/reference/functions/table-functions/s3), [secure-s3](https://clickhouse.com/docs/en/cloud/security/secure-s3)                                                                                                                                                                                                                              |
| `confluent` owner `hosted`, "Dedicated cluster" (l.46–50)           | Confirmed (defensible): Dedicated is provisioned capacity that Confluent runs.                                                                                                                             | [cluster-types](https://docs.confluent.io/cloud/current/clusters/cluster-types.html)                                                                                                                                                                                                                                                                                                       |

### Lakehouse on AWS (`lakehouse`)

| Fact as drawn                                                                       | Verdict                                                                                                                                   | Source                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `s3-landing`, `s3-curated` directly under `aws` (l.41–54)                           | Fixed (were inside the private subnet). S3 is a regional service reached from a VPC through gateway endpoints.                            | [vpc-endpoints-s3](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints-s3.html)                                                                                                                                                                                                            |
| `glue` directly under `aws` (l.46–49)                                               | Fixed (was inside the subnet). An S3-to-S3 job needs no VPC configuration.                                                                | [start-connecting](https://docs.aws.amazon.com/glue/latest/dg/start-connecting.html)                                                                                                                                                                                                                    |
| `postgres-rds`, `msk` in the private subnet (l.23–32)                               | Confirmed: DB subnet groups are typically private; MSK spreads brokers over the subnets given.                                            | [RDS in a VPC](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.WorkingWithRDSInstanceinaVPC.html), [msk-create-cluster](https://docs.aws.amazon.com/msk/latest/developerguide/msk-create-cluster.html)                                                                                  |
| `postgres-rds -> msk` "CDC" (l.104)                                                 | Confirmed, with a condition: CDC needs a connector (Debezium on MSK Connect). The label stays short.                                      | [MSK Connect Debezium](https://docs.aws.amazon.com/msk/latest/developerguide/msk-connect-debeziumsource-connector-example-steps.html)                                                                                                                                                                   |
| `msk -> s3-landing` "Stream" (l.105)                                                | Confirmed: Amazon Data Firehose reads MSK topics and writes to S3.                                                                        | [Firehose integration](https://docs.aws.amazon.com/msk/latest/developerguide/integrations-kinesis-data-firehose.html)                                                                                                                                                                                   |
| `salesforce -> s3-landing` "AppFlow export" (l.103)                                 | Fixed (was "Data export"). Amazon AppFlow has S3 as a Salesforce destination, scheduled or on change events.                              | [AppFlow Salesforce](https://docs.aws.amazon.com/appflow/latest/userguide/salesforce.html)                                                                                                                                                                                                              |
| `dbx-jobs` "Classic compute" in the private subnet (l.33–36)                        | Fixed (was in the Databricks SaaS zone). Classic compute runs in the customer's AWS account; only serverless runs in Databricks' account. | [Databricks overview](https://docs.databricks.com/aws/en/getting-started/overview)                                                                                                                                                                                                                      |
| `dbx-workspace` "Control plane", `dbx-workspace -> dbx-jobs` control (l.65–68, 111) | Fixed (was `dbx-jobs -> dbx-workspace` "Run"). The control plane schedules and runs jobs on the compute plane.                            | [Databricks overview](https://docs.databricks.com/aws/en/getting-started/overview)                                                                                                                                                                                                                      |
| `dbx-jobs -> snow-db` "Write" (l.112)                                               | Fixed (was from `dbx-workspace`). Writes come from compute through the Snowflake connector in the Databricks Runtime.                     | [Databricks + Snowflake](https://docs.databricks.com/aws/en/connect/external-systems/snowflake)                                                                                                                                                                                                         |
| `nat -> dbx-workspace` "Egress" (l.117)                                             | Confirmed for classic compute (the reason `dbx-jobs` moved into the VPC).                                                                 | [Databricks overview](https://docs.databricks.com/aws/en/getting-started/overview)                                                                                                                                                                                                                      |
| `vpc -> snowflake` "PrivateLink" (l.118)                                            | Confirmed, with a condition: Snowflake PrivateLink needs Business Critical or higher.                                                     | [Snowflake PrivateLink](https://docs.snowflake.com/en/user-guide/admin-security-privatelink)                                                                                                                                                                                                            |
| `snow-wh -> qlik-cloud` "Direct Query" (l.114)                                      | Confirmed: Snowflake is in the Direct Query list. It uses Snowflake's public endpoint; Qlik documents no private path.                    | [direct-query databases](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/DirectQuery/direct-access-with-direct-query.htm), [direct-query limitations](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/DirectQuery/limitations-direct-query.htm) |
| `okta -> qlik-cloud` "SSO" (l.115)                                                  | Confirmed: Qlik Cloud takes OIDC and SAML IdPs.                                                                                           | [mc-create-idp-configuration](https://help.qlik.com/en-US/cloud-services/Subsystems/Hub/Content/Sense_Hub/Admin/mc-create-idp-configuration.htm)                                                                                                                                                        |

### Judgement calls for the maintainer

The item's stop condition says a vendor doc that changes an example's story stops the work;
the orchestrator's note says to fix the YAML where a fact is wrong and never invent a
product. Three corrections are larger than a label. Each keeps the example's story (who runs
which zone, where the data comes from and ends up) and adds no product, so they were applied
and are listed here for acceptance:

1. **Qlik Cloud: Data Movement, not Direct Access.** The CDC-into-Snowflake story needs the
   Data Movement gateway (Linux), and its data goes from the gateway straight to Snowflake;
   Qlik Cloud only orchestrates. Plan §4's sample names Direct Access too, so the plan has
   the same error. If on-premises Analytics reloads are also wanted, that is a second gateway
   (Direct Access, Windows) — not drawn.
2. **ClickHouse: the Qlik Cloud node is gone.** Direct Query to ClickHouse does not exist.
   The documented alternative (a Direct Access gateway with the ClickHouse ODBC driver,
   reloading into Qlik) would add a product the story did not have, so the node and edge were
   removed rather than redrawn.
3. **Lakehouse: classic Databricks compute.** The file mixed serverless (jobs in the SaaS
   zone) with classic (NAT egress, VPC PrivateLink to Snowflake). Classic keeps every edge
   the file had; serverless would have dropped the NAT egress edge and left the PrivateLink
   edge carrying nothing from Databricks.

Not modelled (would add detail the slide does not need; candidates for a later pass):
Confluent private networking to the private RDS instance; the plan tiers PrivateLink and SAML
need (Snowflake Business Critical; ClickHouse Scale/Enterprise and Enterprise); a Glue
interface endpoint.

Unverified: port 636 for LDAPS (the standard port, not stated by Qlik); a third-party WAF in
front of Qlik Sense; a ClickHouse Cloud scheduler for the daily export; whether ClickPipes
reaches a Confluent Dedicated cluster that is private-only; "no private path from Qlik Cloud
to Snowflake" means only that Qlik's docs describe none. Several quotes were extracted by the
page fetcher, not copied by hand.

## Feature coverage

The checklist from the item's **Finding**, recomputed on the final files. All four owners, all
nine zone kinds, all five flow kinds and all five `secure` values are covered.

| Feature                         | Covered by (file:line)                                                                                                 |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| owner `customer`                | clickhouse:16, lakehouse:11, qlik-cloud:18, qlik-sense:20                                                              |
| owner `saas`                    | clickhouse:64, lakehouse:61, lakehouse:71, qlik-cloud:48, qlik-cloud:60                                                |
| owner `hosted`                  | clickhouse:48                                                                                                          |
| owner `partner`                 | qlik-sense:86                                                                                                          |
| zone kind `cloud-account`       | clickhouse:15, lakehouse:10, qlik-cloud:35                                                                             |
| zone kind `region`              | clickhouse:21, clickhouse:63                                                                                           |
| zone kind `vnet`                | lakehouse:16                                                                                                           |
| zone kind `subnet`              | lakehouse:20                                                                                                           |
| zone kind `cluster`             | qlik-sense:32                                                                                                          |
| zone kind `on-prem`             | qlik-cloud:22                                                                                                          |
| zone kind `datacenter`          | qlik-sense:19                                                                                                          |
| zone kind `trust-boundary`      | qlik-sense:24                                                                                                          |
| zone kind `generic`             | qlik-sense:49, qlik-sense:63, qlik-sense:85                                                                            |
| flow kind `data`                | clickhouse:88, qlik-cloud:73, qlik-sense:117                                                                           |
| flow kind `request`             | clickhouse:95, qlik-sense:111                                                                                          |
| flow kind `network`             | clickhouse:96, lakehouse:117, qlik-sense:126                                                                           |
| flow kind `access`              | clickhouse:98, lakehouse:116, qlik-cloud:79                                                                            |
| flow kind `control`             | lakehouse:111, qlik-cloud:74, qlik-sense:115                                                                           |
| `secure: tls`                   | clickhouse:91, qlik-cloud:73, qlik-sense:111                                                                           |
| `secure: private-link`          | clickhouse:96, lakehouse:118                                                                                           |
| `secure: sso`                   | clickhouse:98, lakehouse:115, qlik-cloud:79                                                                            |
| `secure: none`                  | qlik-sense:123                                                                                                         |
| `secure: vpn`                   | qlik-sense:126                                                                                                         |
| `protocol` (19 flows)           | qlik-sense (12: l.111–118, 121–123, 125), clickhouse (4: l.91, 94, 95, 97), qlik-cloud (3: l.73, 74, 78)               |
| `schedule` (4)                  | clickhouse:97, qlik-cloud:76, qlik-sense:121, qlik-sense:122                                                           |
| `step` (6)                      | clickhouse:88, 89, 91, 92, 94 (the walkthrough 1–5); qlik-cloud:80                                                     |
| `styles` (2 files) and `class:` | qlik-cloud:82 used at l.33; qlik-sense:14 used at l.39                                                                 |
| notes (2)                       | qlik-cloud:86 (at `gateway`), qlik-sense:129 (at `share`)                                                              |
| zone-targeted flows (5)         | clickhouse:96, clickhouse:98, lakehouse:118, qlik-sense:117, qlik-sense:118                                            |
| `nodeStyle: card`               | qlik-sense:11                                                                                                          |
| `nodeStyle: icon`               | clickhouse:10, lakehouse:5, qlik-cloud:12                                                                              |
| arrow `<->`                     | qlik-cloud:74                                                                                                          |
| arrow `<-`                      | clickhouse:97, lakehouse:110, qlik-cloud:76, qlik-sense:121–123                                                        |
| per-zone `direction`            | clickhouse:51, clickhouse:68, qlik-cloud:51                                                                            |
| zone `subtitle`                 | clickhouse:50, clickhouse:67                                                                                           |
| zone `provider`                 | clickhouse:17, clickhouse:65, lakehouse:12, lakehouse:62, lakehouse:72, qlik-cloud:36, qlik-cloud:49, qlik-cloud:61    |
| `animated`                      | qlik-cloud:73                                                                                                          |
| `style: dashed`                 | qlik-cloud:78, qlik-sense:126                                                                                          |
| node `tone`                     | lakehouse:100                                                                                                          |
| node types                      | actor qlik-cloud:44, qlik-sense:95; datastore qlik-cloud:30; queue clickhouse:58, lakehouse:29; external clickhouse:82 |
| `theme:`                        | qlik-cloud:13                                                                                                          |

Against the item's Finding: `protocol` rose from 16 to 19 flows and zone-targeted flows from
3 to 5 (domain fixes); everything else is unchanged.

## Layout tuning (step 7) — every change and why

YAML first, as the orchestrator asked; code only where YAML could not reach.

1. **`run-elk.ts`: cycle breaking `GREEDY_MODEL_ORDER`.** Flow's `layoutFlowElk` sets
   `MODEL_ORDER`, which reverses every edge whose target was emitted earlier — cycle or not.
   The compiler emits zones before top-level `nodes:`, so every outside source (users, Okta,
   Salesforce) was laid out after the zone it feeds, with its arrow pointing backwards. No
   YAML order fixes that. `GREEDY_MODEL_ORDER` reverses only what a real cycle needs and still
   prefers the input order. Applied at the root and on every separately laid-out zone.
2. **`run-elk.ts`: spacing on every zone, by the zone's own direction.** ELK reads inner
   spacing from each compound node, and flow sets it on the root only, so zones fell back to
   ELK's 20 px and a label covered its nodes' titles (the ClickHouse Confluent zone). Every
   zone now gets `nodeNode` 48 and a layer gap of 120 (LR — a label sits across the gap) or
   72 (TB — flow's default; label plus protocol line fits). The root uses the same values.
   Side effect: fit zoom drops on the two big examples (Lakehouse 0.424, Qlik Sense 0.411 at
   1920×1080).
3. **ClickHouse** (started here, question 44): root `direction: TB` (was LR), Confluent and
   ClickHouse zones `direction: LR`, so the pipeline reads as three bands; zone titles
   shortened with the region and cluster type moved to `subtitle:`; "(customer)" dropped from
   the AWS title (the owner badge already says it); dashboards go to `endpoint` (also a
   domain fix, above), so their two edges end inside the AWS zone instead of crossing the
   Confluent band to the service; `archive <- ch` written reversed, which breaks the
   AWS → Confluent → ClickHouse → AWS cycle at the zone level (the same problem as item 5).
4. **Qlik Cloud**: root `direction: TB` (was LR), Qlik zone `direction: LR`; "(customer)"
   dropped from the Azure title; `wh <- qtdi` written reversed so Snowflake sits between the
   customer side and Qlik Cloud instead of below it.
5. **Lakehouse**: `dbx-jobs <- s3-curated` written reversed. With `dbx-jobs` in the VPC
   (domain fix), the forward edge made a VPC → S3 → VPC cycle at the compound level and ELK
   flipped the "Catalog" step instead.
6. **Qlik Sense**: the three reloads written reversed (`rim-scheduler <- …`), so the sources
   lay out as the bottom tier beside the shared persistence rather than above the site.

A reversed arrow draws the same picture and reads the same to assistive technology: `a <- b`
puts the arrowhead at `a` and names the edge "from b to a" (`edges/edge-style.ts:137`, `:153`;
`spec/dialect/ids.ts:14`). It only changes the order ELK sees.

Before settling, other YAML variants were loaded and screenshotted in the browser (five for
ClickHouse, ten for Lakehouse, five for Qlik Cloud, one for Qlik Sense) and compared by eye
with the committed version; none is kept in the repo.

## What still looks wrong, per example

Seen in the step 9 screenshots; none is under the chrome or outside the pane.

- **Qlik Cloud + Data Gateway:** "Transform in Snowflake" is cut off where it meets "Direct
  Query / reload"; "SSO via Entra ID" sits on the Snowflake zone; "Land changes / HTTPS 443"
  sits on the Azure zone's bottom border; the dashed "Tasks and status" edge is long. Dark:
  the Qlik wordmarks and the Talend "t" have low contrast.
- **Lakehouse on AWS:** fit zoom 0.42 makes text small (0.30 at 1440×900); the IAM node
  overlaps the "Load" label; Write, Load and PrivateLink cross the S3/Glue area; the
  Databricks zone header truncates to "Databric…". Dark: the Databricks jobs icon and the
  Databricks and AWS legend swatches are hard to see.
- **Qlik Sense Enterprise on premises:** fit zoom 0.41 makes card text small (0.26 at
  1440×900); "User sync" covers the scheduler rim node's title; "Signed license key" sits on
  the repository database's title; the licensing node sits far bottom-right. Qlik light: the
  partner owner badge truncates to "PAR…".
- **ClickHouse Cloud stack:** the PrivateLink edge runs through the Confluent zone, its label
  sits on the Kafka topics icon, and it covers the Confluent collapse chevron; the Export edge
  crosses the Confluent zone. Dark: the ClickHouse bar logos and the AWS header logo have low
  contrast. Collapsed: the AWS owner badge truncates to "CUS…" and the Confluent labels
  collide.
- **All:** greyscale keeps owners (solid, dotted for hosted, hatched for SaaS), edge kinds
  (dash pattern plus glyph) and badges apart. Most of the label and crossing defects come
  from edges drawn without ELK's bend points (library gap 3 below).

Sidebar: "Qlik Sense Enterprise on premises" truncates to "Qlik Sense Enterprise on pr…" in
the expanded sidebar, and its tooltip (the example's description) only shows while the
sidebar is collapsed (question 37). The editor flags the en dash in "Gateway – Data Movement"
as an ambiguous character (an orange box); harmless, but visible.

## Dialect v0.1 input

- **No diagram-level `description:`.** Each file carries its paragraph as a YAML comment and
  `index.ts` repeats one sentence for the sidebar; a `description:` key would let the title
  block, the sidebar and a later export share one text.
- **`theme:` is accepted but not applied to the canvas** (question 43): `theme: qlik` in the
  Qlik Cloud file changes nothing; the `qlik-light` screenshots were taken with the app theme
  set by hand. Product call held for acceptance.
- **Zone `description` is dropped by the compiler** (question 12). The examples do not use it
  for that reason.
- **Node `provider` is not derived from the icon** (question 13): the step 4 icon check
  counts 0 providers in the Qlik Sense file although its nodes use `qlik/*` and
  `microsoft/*` icons; only a zone's explicit `provider:` counts.
- **`class: [pii]` versus a `badges:` key** (question 38): the PII badge needs a `styles:`
  class (`qlik-cloud:83`, used at l.33) where a plain `badges: [PII]` would do.
- **New: a layering hint.** Four flows are written reversed only to steer ELK (layout
  change 3–6). A per-node or per-flow hint (for example a `rank:` or `layer:` key, or a flow
  flag that ELK should ignore for layering) would let authors keep the reading direction.

## Library gaps hit

| Gap                                                                                                       | Where the app works around it                                                    | Evidence                                                                                                     | Proposed API                                                                           |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| 1. ui `ConfirmDialog` has no trigger (`confirm-dialog.tsx:19`, `:91`), so Radix returns focus to `<body>` | `src/shell/sidebar-nav.tsx:48` — the clicked entry is refocused by hand on close | [Escape](../../.evidence/DG-13/5c-escape-focus-returned.png): focus on the "Qlik Cloud + Data Gateway" entry | a `returnFocusTo` ref prop, or pass `onCloseAutoFocus` through to `AlertDialogContent` |
| 2. flow `layoutFlowElk` hard-codes `MODEL_ORDER` cycle breaking (`layout-flow-elk.ts:194`)                | `src/layout/run-elk.ts:26` — overridden in the graph decoration                  | outside sources laid out after the zone they feed (before-\*.png predate the change)                         | a `cycleBreaking` option                                                               |
| 3. flow edges ignore ELK's bend points (DG-03-elk-nested gap 2)                                           | `src/layout/run-elk.ts:161` — none; edges draw their own paths                   | the crossings listed per example above                                                                       | return ELK's sections as edge `data.points`, drawn by the edge                         |
| 4. flow sets `nodeSpacing`/`rankSpacing` on the root only (`layout-flow-elk.ts:189`)                      | `src/layout/run-elk.ts:93` — set on every zone in the graph decoration           | a label over node titles in the ClickHouse Confluent zone before the change                                  | apply both to every group                                                              |
| 5. flow takes one `direction` and no per-group options (from DG-11)                                       | `src/layout/run-elk.ts:50` — per-zone `direction` via the decoration             | ClickHouse and Qlik Cloud LR zones inside a TB root                                                          | `groups[].layoutOptions` or a `decorateGraph` hook                                     |
| 6. ui `SidebarMenuButton` shows `tooltip` only while the sidebar is collapsed (`sidebar.tsx:806`)         | none; the long label truncates                                                   | [examples list](../../.evidence/DG-13/5a-examples-list-lakehouse-current.png)                                | product call at acceptance (question 37)                                               |

Outside this item's `touches` (follow-ups, not library gaps): the zone header has no minimum
width for its title and owner badge (`src/nodes/use-zone-autofit.ts`) — "Databric…", "CUS…",
"PAR…"; the dark-theme contrast of several vendor logo assets (`public/icons/`).

## Wave-2 review additions (2026-09-26)

### Library gap 7 — `CodeEditor` draws no focus indicator

- **What:** with keyboard focus in the editor (Monaco's `<textarea>`, which matches
  `:focus-visible` after a Tab from the Theme button), nothing marks the editor as focused
  beyond the caret (wave-2 review m2). `packages/editor`'s `CodeEditor` has no `focus-ring*`
  class.
- **Where the app works around it:** `src/panes/editor-pane.tsx` — the wrapper is `relative`
  and draws `focus-ring-static-inset` on an `::after` overlay while
  `:has(textarea:focus-visible)`, tagged `// P4: library gap`. Inset, because the resizable
  panel clips an outside ring; an overlay, because Monaco's opaque layers paint over the
  wrapper's own inset box-shadow and outline (measured: the computed ring was present on the
  wrapper, the edge pixels stayed the background colour).
- **Evidence:** `apps/diagram/.evidence/review-wave2-fixes-copy/10-editor-focus-ring-keyboard-light-1920.png`
  and `10a-editor-focus-ring-crop.png` — 2 px ring plus the 1 px contour on all four sides.
- **Proposed API:** `CodeEditor` draws the inset ring itself on its root (`focus-ring-within`
  semantics, painted above Monaco's layers), with a `focusRing?: boolean` opt-out for a host
  that frames it.

### Qlik Cloud example — what changed (wave-2 review m6)

- The walkthrough is numbered 1–5 instead of a lone `step: 3`: `erp -> gateway` "CDC" (1),
  `gateway -> wh` "Land changes" (2), `wh <- qtdi` "Transform in Snowflake" (3),
  `qtdi -> qca` "Publish to catalog" (4), `wh -> qca` "Direct Query / reload" (5). The CDC
  flow moved from the string shorthand to the object form to carry its step; the
  "Direct Query / reload" value became a block mapping (the flow mapping no longer fit in
  100 columns). No new issue code for step gaps.
- The top-level customer zone is titled "Customer estate" instead of "Customer managed",
  which repeated its own owner badge.
- Everything else (zones, ids, labels, layout hints) is unchanged. Evidence:
  `apps/diagram/.evidence/review-wave2-fixes-copy/07-qlik-cloud-light-1920.png`, `08-…-dark-…`,
  `09-…-qlik-light-…`.
