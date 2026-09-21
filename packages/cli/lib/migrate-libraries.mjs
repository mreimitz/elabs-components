/**
 * migrate-libraries.mjs — the per-LIBRARY half of `brand-ui map`.
 *
 * `map` (lib/engine.mjs) classifies every JSX tag an existing app uses. Until
 * the 2026-09-21 migration-route audit it matched by NAME alone, so a source
 * library's `Grid` (layout) became the charts package's `Grid` (gridlines) and
 * its `List` the editor's markdown `List`, each reported as a "direct" swap.
 * This module is what makes the verdict per (name, library):
 *
 *   - `libraryOf(source)`         import specifier → library key
 *   - `MIGRATION_LIBRARY_ALIASES` curated rows keyed by that library (merged into
 *                                 `SOURCE_ALIASES` in engine.mjs)
 *   - `aliasFor(name, lib)`       the row for this library, else a library-less one
 *   - `plausibleDirect(lib, hit)` may a bare name match from `lib` land in `hit.pkg`?
 *
 * It lives in its own file because the source libraries have to be NAMED here
 * (that is the point of a migration table) and the reference-leakage rule
 * exempts `migrate*` modules for exactly that reason.
 */

export const MIGRATION_LIBRARY_ALIASES = [
  // — shell + layout of the same source library (2026-09-21 migration-route
  //   audit: these matched brand-ui names by COINCIDENCE — `Grid` is chart
  //   gridlines, `List` is the editor's markdown list — and the plan called
  //   them "direct"). —
  {
    from: "Grid",
    lib: "mui",
    class: "compose",
    compose: ["div + grid gap-* utilities"],
    note: "layout grid — brand-ui's `Grid` (charts) is chart gridlines, not layout",
  },
  {
    from: "List",
    lib: "mui",
    class: "compose",
    compose: ["ul + token utilities", "SidebarMenu (inside a shell)"],
    note: "brand-ui's `List` (editor) is a markdown block, not a nav list",
  },
  {
    from: "ListItem",
    lib: "mui",
    class: "compose",
    compose: ["li + token utilities", "SidebarMenuItem (inside a shell)"],
  },
  {
    from: "ListItemButton",
    lib: "mui",
    class: "compose",
    compose: ["SidebarMenuButton (inside a shell)", "Button variant=ghost"],
  },
  { from: "ListItemText", lib: "mui", class: "compose", compose: ["Text"] },
  {
    from: "AppBar",
    lib: "mui",
    class: "compose",
    compose: ["SidebarInset header (SidebarProvider + Sidebar + SidebarInset)", "AppShell"],
    note: "the frame moves in the App-shells phase, not one bar at a time",
  },
  {
    from: "Toolbar",
    lib: "mui",
    class: "compose",
    compose: ["Toolbar (ui) inside the shell header"],
    note: "same name, different job — the source Toolbar is the header row, brand-ui's is a control strip",
  },
  {
    from: "Drawer",
    lib: "mui",
    class: "compose",
    compose: ["Sidebar (variant=permanent)", "Sheet (temporary drawer)"],
    note: "a permanent source Drawer is the shell's Sidebar; brand-ui's `Drawer` is the bottom sheet",
  },
  {
    from: "CssBaseline",
    lib: "mui",
    class: "drop",
    note: "the tokens stylesheet (styles.css) is the baseline",
  },
  {
    from: "ThemeProvider",
    lib: "mui",
    class: "props",
    to: "ThemeProvider",
    props: { theme: "themes + defaultTheme" },
    note: "the source palette becomes a brand-ui THEME (themes/<family> or the brand-ui-create-theme skill) — never per-component colours",
  },
  {
    from: "Menu",
    lib: "mui",
    class: "props",
    to: "DropdownMenu",
    props: { anchorEl: "DropdownMenuTrigger", open: "open" },
  },
  {
    from: "Tabs",
    lib: "mui",
    class: "props",
    to: "Tabs",
    props: { value: "value", onChange: "onValueChange" },
  },
  {
    from: "Switch",
    lib: "mui",
    class: "props",
    to: "Switch",
    props: { checked: "checked", onChange: "onCheckedChange" },
  },
  {
    from: "Select",
    lib: "mui",
    class: "props",
    to: "Select",
    props: { value: "value", onChange: "onValueChange" },
  },
  { from: "Alert", lib: "mui", class: "props", to: "Alert", props: { severity: "variant" } },
  {
    from: "Avatar",
    lib: "mui",
    class: "props",
    to: "Avatar",
    props: { src: "AvatarImage src", alt: "AvatarFallback" },
  },
  // — recharts (the chart library most existing dashboards use) —
  {
    from: "ResponsiveContainer",
    lib: "recharts",
    class: "drop",
    note: "brand-ui charts size to their container (ChartFrame plotHeight)",
  },
  {
    from: "Tooltip",
    lib: "recharts",
    class: "props",
    to: "ChartTooltip",
    props: { content: "children", formatter: "ChartTooltipContent" },
    note: "the chart readout, not the ui Tooltip",
  },
  {
    from: "Legend",
    lib: "recharts",
    class: "props",
    to: "ChartLegend",
    props: { verticalAlign: "position" },
    note: "or the container's `legend` prop",
  },
  {
    from: "CartesianGrid",
    lib: "recharts",
    class: "props",
    to: "Grid",
    props: { horizontal: "rows", vertical: "columns" },
  },
  {
    from: "ReferenceLine",
    lib: "recharts",
    class: "props",
    to: "annotations",
    props: { y: "annotations[{kind:'line', y}]" },
    note: "a container `annotations` entry, not a child element",
  },
  {
    from: "Cell",
    lib: "recharts",
    class: "compose",
    compose: ["the series' colorBy / palette props"],
  },
  {
    from: "LabelList",
    lib: "recharts",
    class: "compose",
    compose: ["the series' label props", "annotations"],
  },
  { from: "Brush", lib: "recharts", class: "compose", compose: ["LineChart xDomain (brush zoom)"] },
  {
    from: "Pie",
    lib: "recharts",
    class: "compose",
    compose: ["PieChart"],
    note: "brand-ui's PieChart takes data directly",
  },
];

/** Normalise an import source to the library key `SOURCE_ALIASES` rows use. */
export function libraryOf(source) {
  const s = String(source ?? "");
  if (/^\.{1,2}\//.test(s) || /^[@~]\//.test(s)) return "local";
  if (/^@mui\//.test(s)) return "mui";
  if (/^antd(\/|$)/.test(s) || /^@ant-design\//.test(s)) return "antd";
  if (/^@chakra-ui\//.test(s)) return "chakra";
  if (/^@mantine\//.test(s)) return "mantine";
  if (/^recharts(\/|$)/.test(s)) return "recharts";
  if (/^@visx\//.test(s)) return "visx";
  if (/^@nivo\//.test(s)) return "nivo";
  if (/^(@xyflow\/react|reactflow)(\/|$)/.test(s)) return "flow";
  if (/^react-router/.test(s)) return "router";
  if (/^react(-dom)?(\/|$)/.test(s)) return "react";
  if (/^@elabs-ai\/components-/.test(s)) return "brand-ui";
  return s.split("/")[0] || null;
}

const CHART_LIBS = new Set([
  "recharts",
  "visx",
  "nivo",
  "chart.js",
  "react-chartjs-2",
  "victory",
  "plotly.js",
  "react-plotly.js",
  "echarts",
  "echarts-for-react",
  "@tremor",
]);
const FLOW_LIBS = new Set(["flow"]);
const pkgShort = (pkg) => String(pkg ?? "").replace(/^@elabs-ai\/components-/, "");

/**
 * Is a bare name match a believable drop-in for a tag from `lib`? App-UI
 * packages (ui, data, icons) are believable for any UI library; the charts
 * package only for a chart library; flow only for a flow library; everything
 * else (editor, terminal, viewer, process, maps, marketing, tokens, ai) is a
 * different domain and a same-name export is a coincidence.
 */
export function plausibleDirect(lib, hit) {
  const pkg = pkgShort(hit.pkg);
  if (lib === "brand-ui") return true;
  if (["ui", "data", "icons"].includes(pkg)) return !CHART_LIBS.has(lib) && !FLOW_LIBS.has(lib);
  if (pkg === "charts") return CHART_LIBS.has(lib);
  if (pkg === "flow") return FLOW_LIBS.has(lib);
  return false;
}

/** The alias row for (name, lib) among `rows` (engine's SOURCE_ALIASES): this library's row, else a library-less one. */
export function aliasFor(name, lib, rows) {
  rows = rows.filter((a) => a.from.toLowerCase() === name.toLowerCase());
  return (
    rows.find((a) => a.lib && a.lib === lib) ??
    rows.find((a) => !a.lib) ??
    (lib ? null : rows[0]) ??
    null
  );
}
