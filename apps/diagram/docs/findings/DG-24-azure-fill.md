# DG-24 Azure catalog metadata completion

The Azure fill meets the R1 bar: **186 of 206 product icons (90.29%)** have a name,
description, official documentation link and capability. None of the 85 excluded
portal glyphs is counted. All new metadata remains `curated: false` for maintainer review.

## Scope and provenance

Only `catalog/azure.yaml` changed. The actual Atlas MCP server on the isolated worktree
performed every YAML mutation through `catalog_update`; no direct file edit, model
API, API key, new dependency or application-code change was used. The existing
`virtual-networks` name, description, docs, tags and curated state were preserved;
its missing capability was added. The file header was preserved.

Research used the [Microsoft Azure documentation directory](https://learn.microsoft.com/en-us/azure/)
and individual Microsoft Learn product/concept pages. All **175 distinct selected
source pages** were fetched and their titles and descriptions inspected. Links
that redirected were resolved to their official destination before submission.
Descriptions and capabilities are original plain-language summaries, not copied
vendor sentences. Every description is at most 140 characters, every capability at
most 80, and every entry has one to four lowercase tags.

Current names include Microsoft Entra ID, Microsoft Defender for Cloud, Azure
Virtual Desktop and Foundry Tools. Old names remain searchable aliases where
renaming would otherwise hide a common product name. Foundry Tools is the current
name for the Cognitive Services icon, supported by Microsoft's
[migration terminology](https://learn.microsoft.com/en-us/azure/foundry/how-to/navigate-from-classic).
The Data Box Edge icon maps to its documented successor Azure Stack Edge. Classic
and retired resources explicitly say legacy or retired; they use Microsoft's
archived documentation and do not imply availability for new deployments.

Two candidate URLs were discarded before submission: the classic VM deprecation
URL entered a redirect loop, and a classic virtual-network migration path returned 404. Those entries use the verified
[Resource Manager and classic deployment documentation](https://learn.microsoft.com/en-us/previous-versions/azure/azure-resource-manager/management/deployment-models).
No knowingly failing or invented documentation URL was submitted.

## MCP and validation results

| Check                                           | Result                                                 |
| ----------------------------------------------- | ------------------------------------------------------ |
| Initial `catalog_missing` total                 | 291; the seed also lacked capability                   |
| `catalog_update` batches                        | 8 (7 × 25 entries, then 11)                            |
| Written                                         | 186; 185 new entries plus seed capability              |
| Rejected / skipped curated                      | 0 / 0                                                  |
| `docsUnverified` returned by updates            | 0                                                      |
| Total update request time                       | 2,527 ms; individual batches 186–360 ms                |
| Final `catalog_missing` total                   | 105 = 85 excluded glyphs + 20 unfilled product slugs   |
| Product coverage                                | 186 / 206 = 90.29%, above the required 90%             |
| Filled excluded glyphs                          | 0                                                      |
| `/api/catalog/all` parsing problems             | 0                                                      |
| Azure `docsUnverified`                          | 0                                                      |
| Browser `catalogService.stats().docsUnverified` | 0 in this isolated tree                                |
| Browser checks                                  | 24 entry cases: six entries × light/dark × 1440/390 px |
| Browser errors / write requests                 | 0 / 0                                                  |
| Original virtual-network fields preserved       | PASS                                                   |
| YAML schema/content assertions                  | PASS                                                   |
| Prettier check                                  | PASS                                                   |

The six browser entries were Entra ID, Foundry Tools, Virtual Network, Cosmos DB,
Service Bus and classic Virtual Machines. The checks covered names, unchecked
badges, official docs targets, valid `ref: catalog/azure/...` snippets, actual
clipboard copy and no page overflow. Catalog search found the renamed Entra
entries. Phone and desktop screenshots were inspected in both themes. The browser
opened no vendor page and performed no workspace or catalog write.

The isolated browser stats were 682 total entries, 479 without descriptions and
zero unverified docs; other vendors' parallel fills are not included in those
numbers. Reachability is not human curation. All 186 entries still await the
maintainer's content review, and this change makes no claim to fill every Azure
icon or to validate every Azure product's current commercial availability.

## Remaining product slugs

These **20** product slugs are left without metadata. They are conservatively
unfilled, not counted as glyphs and not replaced with guessed descriptions or
links. Most are old product families; this fill does not claim to have verified
a suitable documentation and icon-identity mapping for each. `abs-member` and
`hcp-cache` in particular are not expanded from their ambiguous filenames.

`abs-member`, `blockchain-service`, `container-services-deprecated`, `data-catalog`, `data-lake-store-gen1`, `database-mariadb-server`, `hcp-cache`, `internet-analyzer-profiles`, `media-service`, `mesh-applications`, `mobile-engagement`, `remote-rendering`, `rtos`, `scheduler`, `sql-server-stretch-databases`, `storsimple-data-managers`, `storsimple-device-managers`, `time-series-data-sets`, `time-series-insights-environments`, `time-series-insights-event-sources`.

## Excluded portal/UI glyphs

`all-resources`, `backlog`, `branch`, `browser`, `bug`, `builds`, `cache`, `capacity`, `code`, `commit`, `connections`, `consortium`, `controls`, `controls-horizontal`, `counter`, `cubes`, `detonation`, `dev-console`, `device-security-apple`, `device-security-google`, `device-security-windows`, `download`, `education`, `elixir-purple`, `error`, `file`, `files`, `folder-blank`, `folder-website`, `ftp`, `gear`, `globe`, `globe-error`, `globe-success`, `globe-warning`, `guide`, `heart`, `help-and-support`, `image`, `information`, `input-output`, `journey-hub`, `keys`, `launch-portal`, `learn`, `location`, `managed-database`, `media`, `media-file`, `mobile`, `module`, `multi-tenancy`, `my-customers`, `offers`, `operation-log-classic`, `outbound-connection`, `plans`, `power`, `power-up`, `preview`, `process-explorer`, `production-ready-database`, `recent`, `resource-group-list`, `resource-linked`, `scale`, `search`, `search-grid`, `server-farm`, `service-providers`, `software-as-a-service`, `solutions`, `ssd`, `token-service`, `toolbox`, `updates`, `user-privacy`, `user-subscriptions`, `users`, `versions`, `web-environment`, `website-power`, `website-staging`, `workflow`, `workspaces`.

## Documentation sample

Twenty source URLs sampled without replacement using seed `20260929`. These were
real GET requests that followed redirects; every final response was HTTP 200.
The table records the final URL submitted to MCP, not a HEAD-only claim.

| Official documentation                                                                                                                                                                                        | GET status | Elapsed ms |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------: | ---------: |
| [Azure App Testing documentation](https://learn.microsoft.com/en-us/azure/app-testing/)                                                                                                                       |        200 |        141 |
| [Use the Azure portal and Azure Resource Manager to Manage Resource Groups - Azure Resource Manager](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/manage-resource-groups-portal) |        200 |         69 |
| [Azure virtual machine extensions and features - Azure Virtual Machines](https://learn.microsoft.com/en-us/azure/virtual-machines/extensions/overview)                                                        |        200 |         81 |
| [Web Application Firewall documentation](https://learn.microsoft.com/en-us/azure/web-application-firewall/)                                                                                                   |        200 |         85 |
| [Azure Peering Service Documentation](https://learn.microsoft.com/en-us/azure/peering-service/)                                                                                                               |        200 |         86 |
| [Azure Container Instances documentation - serverless containers, on demand](https://learn.microsoft.com/en-us/azure/container-instances/)                                                                    |        200 |         75 |
| [Azure NetApp Files documentation](https://learn.microsoft.com/en-us/azure/azure-netapp-files/)                                                                                                               |        200 |         74 |
| [Azure Digital Twins documentation](https://learn.microsoft.com/en-us/azure/digital-twins/)                                                                                                                   |        200 |         69 |
| [Azure Files Documentation](https://learn.microsoft.com/en-us/azure/storage/files/)                                                                                                                           |        200 |         70 |
| [Azure Kubernetes Service (AKS) documentation](https://learn.microsoft.com/en-us/azure/aks/)                                                                                                                  |        200 |         82 |
| [What is Azure Private Link service?](https://learn.microsoft.com/en-us/azure/private-link/private-link-service-overview)                                                                                     |        200 |         85 |
| [Application Insights OpenTelemetry observability overview - Azure Monitor](https://learn.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview)                                                  |        200 |         93 |
| [Azure Relay documentation](https://learn.microsoft.com/en-us/azure/azure-relay/)                                                                                                                             |        200 |         71 |
| [Activity Log in Azure Monitor - Azure Monitor](https://learn.microsoft.com/en-us/azure/azure-monitor/fundamentals/activity-log)                                                                              |        200 |        407 |
| [Learn About Groups, Group Membership, and Access - Microsoft Entra](https://learn.microsoft.com/en-us/entra/fundamentals/concept-learn-about-groups)                                                         |        200 |         86 |
| [Overview of Recovery Services vaults - Azure Backup](https://learn.microsoft.com/en-us/azure/backup/backup-azure-recovery-services-vault-overview)                                                           |        200 |         99 |
| [SQL Server on Azure VM documentation - Azure SQL](https://learn.microsoft.com/en-us/azure/azure-sql/virtual-machines/?view=azuresql)                                                                         |        200 |        148 |
| [Azure Static Web Apps documentation](https://learn.microsoft.com/en-us/azure/static-web-apps/)                                                                                                               |        200 |         67 |
| [Azure Migrate documentation](https://learn.microsoft.com/en-us/azure/migrate/?view=migrate)                                                                                                                  |        200 |        158 |
| [Resource Manager and classic deployment - Azure Resource Manager](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/deployment-models)                                               |        200 |       3747 |

## Evidence

Local evidence is under `apps/diagram/.evidence/catalog-azure/` in the Azure
worktree: `official-sources.json` (all source URL/status/title records),
`submitted-entries.json`, `mcp-results.json`, `validation.json`, `browser.json`,
eight screenshots and the exact scratch validation/browser scripts. Evidence
artifacts are intentionally not shipped with the app. The committed YAML retains
each product's official documentation link.

## Independent review follow-up

The independent reviewer confirmed the 186-product count against the roadmap's exact
85-glyph exclusion list, field limits, original seed preservation and actual MCP
readbacks. The one wording finding was Azure Blueprints: its entry now explicitly
says Preview and describes the phased retirement ending January 31, 2027, linking
to the opened [official overview](https://learn.microsoft.com/en-us/azure/governance/blueprints/overview).
The correction was made by one additional actual `catalog_update` call, with no
rejection or unverified link. All other 185 entries remain identical, and the
post-fix content/MCP check still reports 186 products, 105 missing icons, zero
counted glyphs and zero catalog problems. `review-fix.json` preserves the separate
write receipt; the original eight-batch evidence remains unchanged.

Independent final MCP readback passed. The wording finding is closed; no findings remain.
