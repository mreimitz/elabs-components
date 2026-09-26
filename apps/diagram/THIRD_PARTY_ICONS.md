# Third-party icons

`public/icons/**` vendors brand, trademark and vendor artwork **for this app only** —
architecture-diagram service icons and vendor/product logos referenced by name
(`vendor/name`) from the YAML dialect (plan D4).

**Standing rules (do not remove):**

1. **Maintainer ruling, 2026-09-26:** inside `apps/diagram`, and only there, every
   brand, trademark and vendor asset may be used freely. No licensing stops apply
   in this folder.
2. Nothing under `apps/diagram/public` ever reaches `packages/`, `registry/` or any
   other publishable path, and nothing from this file is ever added to the repo's
   `ATTRIBUTION.md`. This is not a licence file — it exists only so a pack can be
   refreshed later (source + version + date, below).

## Packs

| Pack         | Source                                                                                                                                          | Version / commit                                     | Downloaded | Notes                                                                                                                                                                                                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws`        | npm `aws-svg-icons` (the official AWS "Architecture-Service-Icons" SVG set)                                                                     | `3.0.0-2021-07-30`                                   | 2026-09-26 | One file per service, flattened from the 64px size folder of every category; `Arch_`/size-suffix/`AWS-`/`Amazon-` stripped from filenames.                                                                                                                                                              |
| `azure`      | GitHub `benc-uk/icon-collection`, `azure-icons/` (a mirror of the official Azure Architecture Icons)                                            | commit `e33ee714d05a24a81cf6ccd967ef34b22cb77e65`    | 2026-09-26 | Flat set, `Azure-` prefix stripped, lowercase-hyphenated.                                                                                                                                                                                                                                               |
| `gcp`        | npm `gcp-icons` ("official SVG set, unmodified")                                                                                                | `1.0.6`                                              | 2026-09-26 | Category-level Google Cloud icons; `-512-color(-rgb)` suffix stripped. `labels.json` overrides the mashed-together filenames (e.g. `cloudsql` → "Cloud SQL").                                                                                                                                           |
| `k8s`        | GitHub `kubernetes/community`, `icons/svg/resources/unlabeled/` (the official Kubernetes icon set)                                              | commit `a0b641801c6099de5886621cf8d667d6b75615b4`    | 2026-09-26 | Unlabeled resource glyphs; `labels.json` expands the abbreviated filenames (`svc` → "Service", `cm` → "ConfigMap", …).                                                                                                                                                                                  |
| `qlik`       | npm `@iconify-json/logos` (`qlik`, the Qlik logo) + npm `simple-icons` (`talend`, the Talend logo — Talend is a Qlik product since acquisition) | `@iconify-json/logos@1.2.14`, `simple-icons@16.32.0` | 2026-09-26 | Only `qlik` and `talend-cloud` are real, distinct marks. No official artwork exists for the other five products (`cloud`, `data-gateway`, `sense-enterprise`, `answers`, `automate`, `automl`) in either source — each is the Qlik vendor logo copied under the product name, per the item's stop rule. |
| `snowflake`  | npm `@iconify-json/logos` (`snowflake`)                                                                                                         | `1.2.14`                                             | 2026-09-26 | No separate warehouse/database glyph exists in the source; `warehouse` is the vendor logo copied under that name.                                                                                                                                                                                       |
| `databricks` | npm `@iconify-json/logos` (`databricks`)                                                                                                        | `1.2.14`                                             | 2026-09-26 | No separate Workspace/Unity Catalog/Delta marks exist in the source; `workspace`, `unity-catalog`, `delta` are the vendor logo copied under those names.                                                                                                                                                |
| `clickhouse` | npm `simple-icons` (`clickhouse`)                                                                                                               | `16.32.0`                                            | 2026-09-26 | No separate ClickPipes mark exists in the source; `clickpipes` is the vendor logo copied under that name.                                                                                                                                                                                               |
| `salesforce` | npm `@iconify-json/logos` (`salesforce`)                                                                                                        | `1.2.14`                                             | 2026-09-26 | No separate Data Cloud/MuleSoft marks exist in the source; `data-cloud`, `mulesoft` are the vendor logo copied under those names.                                                                                                                                                                       |
| `sap`        | npm `@iconify-json/logos` (`sap`)                                                                                                               | `1.2.14`                                             | 2026-09-26 | No separate S/4HANA/BTP marks exist in the source; `s4hana`, `btp` are the vendor logo copied under those names.                                                                                                                                                                                        |
| `oracle`     | npm `@iconify-json/logos` (`oracle`)                                                                                                            | `1.2.14`                                             | 2026-09-26 | No separate database-product mark exists in the source; `db` is the vendor logo copied under that name.                                                                                                                                                                                                 |
| `microsoft`  | npm `@iconify-json/logos` (`microsoft`)                                                                                                         | `1.2.14`                                             | 2026-09-26 | No SQL Server mark exists in the source; `sql-server` is the vendor logo copied under that name (referenced from the dialect example as `microsoft/sql-server`).                                                                                                                                        |

`aws`, `azure`, `gcp` and `k8s` also gained a `<vendor>/<vendor>.svg` vendor
logo pulled from `@iconify-json/logos` (`aws`, `azure-icon`, `google-cloud`,
`kubernetes`) — DG-06/DG-08 key every provider zone off `<vendor>/<vendor>`.

## Refreshing a pack

Re-download the source at the URL/package above, re-run the same rename
transform (strip vendor prefixes and size suffixes, lowercase-hyphenate), and
`pnpm --filter @elabs-ai/diagram icons:index` to regenerate
`public/icons/index.json`.

## Safety

Every SVG in `public/icons/**` was checked for embedded `<script>` tags and
external `href`/`xlink:href` references (`http://`/`https://`, excluding
`xmlns` namespace declarations) — zero found (see the DG-04 report for the
exact grep commands and output).
