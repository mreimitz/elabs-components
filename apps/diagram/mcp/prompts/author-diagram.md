---
name: author-diagram
description: Draw an architecture diagram in Atlas from a prose description — validate, write, look in the open tab, fix.
arguments:
  - name: description
    description: What to draw, in plain words (systems, who owns them, what flows where).
    required: true
  - name: path
    description: Workspace path for the new file, e.g. "acme/landscape.yaml". Optional.
    required: false
---

You are drawing an architecture diagram in Atlas, a local diagram workspace. Diagrams are YAML
files (dialect v0); Atlas lays them out and draws them — never write positions.

What to draw:

{{description}}

Target path (if empty, choose a short kebab-case path under a folder named after the customer or
topic): {{path}}

## Loop

1. `workspace_tree` — see what exists; do not overwrite someone else's diagram.
2. Find icons: every node's `icon:` is `vendor/name` from the icon packs (aws, azure, gcp, k8s,
   qlik, snowflake, databricks, clickhouse, salesforce, sap, microsoft, oracle) or a generic
   `lucide/<name>` (server, database, users, user, globe, cloud, lock, shield, network, …). Use
   `catalog_search` when it is listed; otherwise guess and let validation suggest the nearest name.
3. Write the YAML, then `spec_validate`. Fix every error; read the warnings (an `unknown-icon`
   warning may carry a `suggestion`: the nearest known name).
4. `diagram_create` (new file) or `diagram_write` (existing file — pass `base`, the mtime from
   `diagram_read`).
5. Ask the user to look at the diagram in the open Atlas tab: a new file opens at
   `#d/<path>` (e.g. `http://localhost:5180/#d/acme/landscape.yaml`), and the tab redraws
   the open file on every write. Fix what they say reads badly (crowded zone, missing flow,
   wrong owner) with `compose_set` / `compose_add_nodes` / `compose_add_flows` or a full
   `diagram_write`; the tab shows each fix as it lands.

## Dialect v0 cheat-sheet

```yaml
diagram: "0" # required, a string
title: Qlik Cloud with a customer-hosted Data Gateway
direction: LR # LR | TB
nodeStyle: icon # icon | card
legend: auto # auto | none | [owners, providers, edges]

zones: # boundaries; nest with children:
  - id: customer # ids: a letter, then letters, digits, _ or -; unique across zones and nodes
    owner: customer # customer | saas | hosted | partner — top-level zones need one
    title: Customer managed
    children:
      - id: dc
        kind: on-prem # cloud-account | region | vnet | subnet | cluster | on-prem | datacenter | trust-boundary | generic
        title: On-premises data center
        children:
          - id: erp # a node: anything without children
            icon: sap/s4hana
            title: SAP S/4HANA
            subtitle: ERP
          - id: mssql
            type: datastore # service (default) | actor | datastore | queue | external | note
            icon: microsoft/sql-server
            title: SQL Server 2022
            badges: [pii]
  - id: qlik
    owner: saas
    provider: qlik # an icon pack: the zone shows its logo
    title: Qlik Cloud (EU)
    children:
      - id: qca
        icon: qlik/cloud
        title: Qlik Cloud Analytics

flows: # from -> to, by id; <-> both ways
  - erp -> qca: CDC # string form, label after the colon
  - mssql -> qca
  - qca -> erp: { label: Write-back, kind: data, protocol: HTTPS 443, secure: tls, step: 2 }
  # kind: data | request | access | control | network · style: solid | dashed | dotted
  # secure: tls | vpn | private-link | sso | none · animated: true · schedule: hourly
  # step: 1, 2, … orders a walk-through (the presenter steps through flows in this order)

styles: # reusable classes: class: [pii] on nodes, zones or flows
  pii: { tone: warning, badge: PII }

notes:
  - at: qca
    text: One short sentence the reader needs.
```

Rules: one idea per zone; 5–25 nodes; every node inside the zone that owns it; `type: external`
nodes sit outside every zone; label flows with what moves (data, protocol), not with verbs only.
