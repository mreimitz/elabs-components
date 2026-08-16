# 02 · Typography

## Fonts

| Use                    | Stack                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------ |
| **UI** (everything)    | **"Source Sans Pro"**, HelveticaNeue, "Helvetica Neue", Helvetica, Arial, sans-serif |
| **Data / mono / code** | **"Source Code Pro"** (tabular numbers, data preview, script editor)                 |

Root `font-size: 16px` (rem-based). Source Sans Pro is a humanist sans — slightly narrower
and more "data-tool" than Inter. **Adopting Source Sans Pro + Source Code Pro is the single
biggest lever** for making brand-ui _read_ as Qlik.

## The four Sprout type scales

Qlik separates type into **four named roles**, each with its own size ramp, weight and
line-height. This is the hierarchy system.

### Heading — weight **600**, line-height **130%**

| Step | Size |
| ---- | ---- |
| xs   | 12px |
| s    | 16px |
| m    | 20px |
| l    | 24px |
| xl   | 32px |
| xxl  | 40px |

### Body — weight **400**, line-height **150%**

| Step | Size |
| ---- | ---- |
| xs   | 12px |
| s    | 14px |
| m    | 16px |
| l    | 20px |
| xl   | 24px |
| xxl  | 28px |

### Label — weight **400** (+ **600** "emphasized"), **fixed px** line-height

| Step | Size / line-height |
| ---- | ------------------ |
| xs   | 12 / 16            |
| s    | 14 / 16            |
| m    | 16 / 20            |
| l    | 20 / 24            |

Labels are the **UI workhorse**: tight px line-heights (no 150% leading), with the
**emphasized = 600** variant for buttons, active states, table headers, and key-value labels.

### Data / tabular — **Source Code Pro**, 400 (+ 600), line-height 150%

| Step | Size |
| ---- | ---- |
| xs   | 12px |
| s    | 14px |
| m    | 16px |

Used for numbers in tables, the data preview grid, KPI figures, and the script editor
(`--sprout-script-font-*`).

## Rendered hierarchy (what actually appears on screen)

The computed-style survey shows the page leans on a **very compact** set — **12 and 14px do
~90% of the work**, with 600 for emphasis:

| Rendered role            | Size / weight / line-height / colour                | Where                                                                           |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------- |
| Caption / meta label     | **12px / 400 / 16 / #8C8C8C**                       | field sublabels, "Distinct values", right-rail labels, timestamps (most common) |
| Body                     | **14px / 400 / 16 / #404040**                       | descriptions, cell values, list text                                            |
| Label / emphasis         | **14px / 600 / 16 / #404040**                       | button text, table headers, key-value labels, active tab                        |
| Secondary caption        | **12px / 400 / #80808­0 · rgba(0,0,0,.55)**         | helper text                                                                     |
| Section / object heading | **20px / 400 · 24px / 600 / #404040**               | card section titles, dataset title row                                          |
| Display number           | **24px / 400 / 36 / #404040** (+ large KPI figures) | "4.4/5" trust score, big % values                                               |
| On-primary button        | **14px / 600 / #fff**                               | green primary buttons                                                           |

### Takeaways for v2

- **Small by default.** Body is 14px, captions 12px. Headings rarely exceed 20–24px in app
  chrome. Density over drama.
- **600 is "bold".** Qlik never goes heavier than 600 (semibold) for UI; 700 is absent.
- **Weight, not size, carries emphasis** at the 12/14px tier (400 → 600), exactly like
  brand-ui's `label`/`*-emphasized` idea — but Qlik's steps are tighter.
- **Line-height splits by role:** 130% headings, 150% body/data, **fixed px** for labels.
- **Mono for data.** Numbers in grids/KPIs use Source Code Pro — a deliberate, legible,
  on-brand choice brand-ui currently doesn't make.
