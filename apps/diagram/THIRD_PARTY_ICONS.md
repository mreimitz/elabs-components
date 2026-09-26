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

## Dark-background variants

Added 2026-09-26 for wave-2 review finding M6 (vendor marks vanish in a dark theme).
Each file is a vendor's own dark-background logo, downloaded from the vendor's domain or
its official architecture-icon package. They live in `public/icons/<vendor>/dark/`, which
`scripts/build-icon-index.mjs` does not read (it indexes only `*.svg` directly inside a
vendor folder), so they are never listed as icons of their own and `index.json` is
unchanged. `src/icons/register-packs.ts` picks them for `brand` marks while the theme's
`color-scheme` is dark. The standing rules above apply to them unchanged.

| File                             | Used for (in dark themes)                                                                 | Source                                                                                                                                                                                                                                                        | Notes                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `aws/dark/aws.svg`               | `aws/aws`                                                                                 | The AWS Architecture Icons package linked from `https://aws.amazon.com/architecture/icons/` (`Icon-package_07312026.5846e92413caa21490223536cc97f1269e44fa92.zip` on `d1.awsstatic.com`), file `Architecture-Group-Icons_07312026/AWS-Cloud-logo_32_Dark.svg` | Unmodified. The pack's dark-background version of the AWS logo group icon: the AWS logo on a white tile.                                                                                                                                                                                                                         |
| `clickhouse/dark/clickhouse.svg` | `clickhouse/clickhouse`, `clickhouse/clickpipes`                                          | `https://clickhouse.design/images/brand/logos/logomark-white.svg`, the "Logomark — on dark backgrounds" file on ClickHouse's logo-usage page `https://clickhouse.design/brand/logo-usage` (linked from `clickhouse.com/media`)                                | `viewBox` trimmed from `0 0 150 150` to the artwork bounds `27 24.5 100.1 100.1`, so the mark fills its slot like the light `clickhouse.svg`; paths unchanged. Their guidelines ask for: "ClickHouse, the ClickHouse logo, and related marks are trademarks or registered trademarks of ClickHouse, Inc. or its affiliates."     |
| `databricks/dark/databricks.svg` | `databricks/databricks`, `workspace`, `unity-catalog`, `delta`                            | `https://docs.databricks.com/aws/en/img/logo-dark.svg`, the dark-mode logo of Databricks' own documentation site                                                                                                                                              | Unmodified. A light wordmark (`#F2F2F2`) with the red icon.                                                                                                                                                                                                                                                                      |
| `qlik/dark/qlik.svg`             | `qlik/qlik`, `cloud`, `data-gateway`, `sense-enterprise`, `answers`, `automate`, `automl` | `https://qlik.dev/logo-footer.svg`, the reversed Qlik logo in the footer of Qlik's developer portal                                                                                                                                                           | Unmodified. White lettering with the green arch. It is the current (2024) Qlik logo, while the light `qlik/qlik.svg` from `@iconify-json/logos` is the older one — a pack refresh should bring the light mark up to date (positive version: `https://assets.qlik.com/image/upload/v1713297745/qlik/logos/logo-qlik_d49uek.svg`). |
| `snowflake/dark/snowflake.svg`   | `snowflake/snowflake`, `snowflake/warehouse`                                              | `https://www.snowflake.com/wp-content/themes/snowflake/assets/img/brand-guidelines/logo-white.svg`, the "White Logo" on `https://www.snowflake.com/brand-guidelines/`                                                                                         | Unmodified. All-white logo.                                                                                                                                                                                                                                                                                                      |

No dark variant, by design:

- `qlik/talend-cloud` — the Talend brand is retired into Qlik (`talend.com` redirects to
  `qlik.com`) and no dark Talend mark was found, so in dark themes its `brand` mark
  falls back to the `mono` mask in the surrounding text colour.
- `azure/azure` — no dark variant was found from Microsoft, and the Azure blue already
  clears 3:1 in the dark legends (3.9:1 in `dark`, 3.0:1 in `qlik-dark`), so `brand` keeps
  the light file; only `mono` changed.
- `microsoft/microsoft`, `microsoft/sql-server` — no dark variant was vendored; the grey
  wordmark measures 1.9–2.9:1 on the dark nodes, so in dark themes `brand` falls back to
  the `mono` mask.

## Symbol-only crops (Databricks, Snowflake)

Added 2026-09-26 at the maintainer's acceptance of the wave-2 examples: the Databricks
and Snowflake files are horizontal wordmarks, which a square mark slot shrinks to text a
few pixels tall. Every diagram slot is small, so these files show the vendor's symbol
only. The `viewBox` is cropped to the symbol's measured bounds (squared, centred); paths,
fills and every other byte are unchanged, so the wordmark text is still in the file,
outside the visible box.

| Files                                                       | `viewBox` before → after                                                            |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `databricks/{databricks,workspace,unity-catalog,delta}.svg` | `0 0 512 81` → `-2.9 0 81 81`                                                       |
| `databricks/dark/databricks.svg`                            | `0 0 712.8 113` → `-4.25 0 113 113` (and its `enable-background` to match)          |
| `snowflake/{snowflake,warehouse}.svg`                       | `0 0 512 116` → `0 0 116.3 116`                                                     |
| `snowflake/dark/snowflake.svg`                              | `0 0 261 61` → `-0.85 0 61 61` (and `width`/`height` from `261px`/`61px` to `61px`) |

A pack refresh must re-apply these crops (or vendor the symbol-only files, where the
vendor publishes them).

Safety: all five files were checked with
`grep -ciE '<script|on[a-z]+=|href=|<foreignObject|@import|url\(' public/icons/*/dark/*.svg`
— zero matches in each. The ClickHouse file carries only an internal `<style>` rule that
sets the fill.
