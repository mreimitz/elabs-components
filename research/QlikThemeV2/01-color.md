# 01 · Colour

Two sources are combined: **rendered (computed) values** from the live light theme (what you
actually see), and the **authored Sprout token families** (which give the semantic structure

- the dark-theme values). Where they differ, the rendered value is the truth for light.

## 1. Brand / primary (the Qlik green)

| Role                   | Light (rendered)            | Dark (Sprout authored)                             |
| ---------------------- | --------------------------- | -------------------------------------------------- |
| Primary action default | **#00873D** `rgb(0,135,61)` | `--sprout-brand-primary-color-default` **#4ec574** |
| Primary hover / focus  | (darker green, ~#0a7a3a)    | `-hover` / `-focus` **#71d190**                    |
| Primary pressed        | —                           | `-pressed` **#9cdfb1**                             |
| Primary toggled        | —                           | `-toggled` **#bae8c9**                             |
| Primary disabled       | —                           | `-disabled` `#ffffff26`                            |
| Primary weak (wash)    | —                           | `-weak` **#4ec5740d** (≈5%)                        |
| On-primary text        | **#ffffff**                 | inverse **#333**                                   |

Light primary is the **darker, saturated** green (#00873D) so it carries white text on white
surfaces; dark primary is the **lighter** green (#4ec574) for contrast on dark. The
"selected" green family mirrors this (`--sprout-selected-color-default #4ec574`, hover
`#419a5c`, pressed `#316a41`).

## 2. Text / foreground (neutral grey — NOT pure black)

| Role                     | Light (rendered)                                        | Notes                                      |
| ------------------------ | ------------------------------------------------------- | ------------------------------------------ |
| Body / default text      | **#404040** `rgb(64,64,64)`                             | the dominant text colour (442 occurrences) |
| High-emphasis / headings | **#000000** (sparingly) + #1a1a1a                       | used for some titles / big numbers         |
| Secondary / muted        | **#8C8C8C** `rgb(140,140,140)`                          | captions, labels (the 12px workhorse)      |
| Muted alt                | **#808080** `rgb(128,128,128)` · `rgba(0,0,0,0.55)`     | secondary captions                         |
| Disabled / placeholder   | **#9E9E9E** `rgb(158,158,158)` · **#BDBDBD** `rgb(189)` |                                            |
| On-dark / inverse text   | **#ffffff**                                             | Sprout `--foreground:#fff` (dark base)     |

Sprout foreground ramp (dark base): `--sprout-common-foreground-color-default #fff`,
`-weak #ffffffc2` (~76%), `-disabled #ffffff8c` (~55%). In light these resolve to the greys
above (default #404040, weak #8C8C8C, disabled #9E9E9E).

## 3. Surfaces / backgrounds

| Role                              | Light (rendered)                                                |
| --------------------------------- | --------------------------------------------------------------- |
| Card / content surface            | **#ffffff**                                                     |
| App / page background             | **#fafafa** `rgb(250)` and **#f2f2f2** `rgb(242)` (panel wells) |
| Recessed panel (e.g. Trust Score) | very light grey-green well (~#f2f5f3) holding white sub-cards   |
| Track / divider fill              | **#e0e0e0** `rgb(224)`                                          |
| Neutral icon/avatar fill          | **#9e9e9e** `rgb(158)`                                          |
| Hover wash                        | `rgba(0,0,0,0.04–0.1)`                                          |

Sprout surface ramp (dark base, for structure): `--sprout-common-background-color-default
#333`, `-weak #262626`, `-moderate #1a1a1a`, `-strong #0e0e0e`, `-floating #3c3c3c`,
`-hover #fff3`, `-pressed #ffffff1a`. Light theme inverts these to the white/greys above.

## 4. Status / semantic

| Status            | Light (rendered/derived)                      | Sprout dark default                              | `-weak` wash |
| ----------------- | --------------------------------------------- | ------------------------------------------------ | ------------ |
| Success           | **#00873D / #4ec574** (green check, progress) | `--sprout-success-color-default #4ec574`         | `#4ec5740d`  |
| Danger / negative | **#D7004B** `rgba(215,0,75,*)` (the ▼ deltas) | `--sprout-danger-color-default #f15a81`          | `#f15a810d`  |
| Warning           | **#ff9800**                                   | `--sprout-warning-color-default #ff9800`         | `#ff98000d`  |
| Info              | **#5daef1** (blue)                            | `--sprout-info-color-default #5daef1`            | `#5daef10d`  |
| Link              | blue family **#5daef1**                       | `--sprout-link-foreground-color-default #5daef1` | —            |
| Focus ring        | **#5daef1**, 2px                              | `--sprout-focus-color-default #5daef1`           | —            |
| Favorite (star)   | **#ffb84d** (amber)                           | `--sprout-favorite-color-default #ffb84d`        | —            |

Note the **`-weak` convention**: every status has a ~5% wash (`<hex>0d`) for subtle
backgrounds — directly analogous to brand-ui's `bg-<status>/10` pattern.

## 5. Data-visualisation palette (charts)

Fixed **12-colour categorical** palette (`--sprout-data-color-categorical-0-0..11`):

`#5daef1` · `#6694a8` · `#8bc5f5` · `#00b5aa` · `#00873d` · `#ffb84d` · `#ffcd80` · `#870063`
· `#f15a81` · `#e74096` · `#ae006d` · `#d92686`

Plus: null **#666**, others **#b3b3b3**, support **#a6a6a6**. Profile mini-distributions render
bars in a **muted blue-grey ≈#98BCCA** with light area fills. Sequential ramp starts amber
(`#ffcd80 → #ffb84d`).

> brand-ui maps `--chart-1..5`; Qlik uses up to 12. v2 should at minimum align `--chart-1..5`
> to the first Qlik categorical hues (blue/teal/green/amber/purple) for on-brand charts.

## 6. AI / special

`--sprout-ai-foreground-default #ebb1f3`, `--sprout-ai-background-default #5f3b66`,
`--sprout-ai-border-default #e390ee` + a magenta gradient — Qlik's AI surfaces use a
**purple/magenta** accent (distinct from the green brand). Script/code editor has its own
syntax palette (`--sprout-script-color-*`).
