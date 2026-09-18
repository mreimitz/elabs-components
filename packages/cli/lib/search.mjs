/**
 * Ranked export search — the ONE implementation behind `brand-ui search` (CLI)
 * and the MCP `search` tool.
 *
 * It replaces a plain `name.includes(query)` filter, which failed the way an
 * agent actually asks:
 *   - "date range picker" found nothing although `DateRangePicker` exists
 *     (a spaced phrase is never a substring of a PascalCase identifier);
 *   - "dashboard" listed six ALL_CAPS constants before the first component;
 *   - "toast" / "command palette" / "stepper" found nothing although `Toaster`,
 *     `CommandDialog` and `Wizard` ship — the vocabulary differs, the part exists.
 * An agent that gets "(none)" hand-rolls the component, which is the
 * inconsistency this library exists to prevent. So: identifiers are split into
 * words, results are ranked, a small vocabulary table bridges the common names
 * from other libraries, and an empty result always carries the nearest matches.
 *
 * Pure functions over the manifest; no I/O.
 */
import { flat } from "./core.mjs";

/** `DateRangePicker` → [date, range, picker]; `DASHBOARD_SPEC_SCHEMA` → [dashboard, spec, schema];
 *  `InputOTP` → [input, otp]; `A2uiSurface` → [a2ui, surface]. */
export function splitIdentifier(name) {
  return String(name || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

/** An exported constant (`CALENDAR_ROWS`), not something an agent renders. */
export function isConstantName(name) {
  return /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(name) || /^[A-Z0-9]{4,}$/.test(name);
}

const STOPWORDS = new Set([
  "a", "an", "and", "as", "brand", "component", "components", "for", "in", "of", "on", "or",
  "the", "to", "ui", "use", "with",
]); // prettier-ignore

/**
 * What people call a thing elsewhere → the brand-ui export that does that job.
 * Keys are squashed (lowercase, no separators) so "command palette",
 * "CommandPalette" and "command-palette" all hit the same row. Every target
 * is checked against the manifest at query time — a row whose target does not
 * exist in the running manifest is ignored, so this table can never invent an
 * import (test: search-ranking.test.mjs "every vocabulary target exists").
 */
export const VOCABULARY = {
  toast: ["Toaster"],
  snackbar: ["Toaster"],
  notification: ["Toaster", "NavNotifications", "Alert"],
  notificationcenter: ["NavNotifications"],
  sonner: ["Toaster"],
  commandpalette: ["CommandDialog", "Command"],
  cmdk: ["CommandDialog", "Command"],
  spotlight: ["CommandDialog"],
  stepper: ["Wizard", "WizardSteps"],
  steps: ["Wizard", "WizardSteps"],
  multistepform: ["Wizard"],
  form: ["Form", "SchemaForm", "FieldRoot", "Wizard"],
  formfield: ["FieldRoot", "FieldLabel", "FieldError"],
  validation: ["FieldError", "SchemaForm"],
  modal: ["Dialog", "AlertDialog", "ConfirmDialog"],
  confirm: ["ConfirmDialog", "AlertDialog"],
  sidepanel: ["Sheet", "Drawer"],
  slideover: ["Sheet"],
  offcanvas: ["Sheet"],
  bottomsheet: ["Drawer"],
  dropdown: ["DropdownMenu", "Select"],
  autocomplete: ["Combobox"],
  typeahead: ["Combobox"],
  multiselect: ["Combobox", "TagInput", "Transfer", "TreeSelect"],
  chips: ["TagInput", "Badge"],
  chip: ["Badge", "TagInput"],
  tag: ["Badge", "TagInput"],
  pill: ["Badge", "StatusBadge"],
  treeview: ["Tree", "TreeSelect"],
  filetree: ["FileTree", "Tree"],
  otp: ["InputOTP"],
  pincode: ["InputOTP"],
  dropzone: ["FileUploadDropzone", "FileUpload"],
  upload: ["FileUpload"],
  loader: ["Spinner", "LoadingState", "Skeleton"],
  loading: ["LoadingState", "Skeleton", "Spinner"],
  placeholder: ["Skeleton", "EmptyState"],
  empty: ["EmptyState"],
  nodata: ["EmptyState"],
  error: ["ErrorState", "Alert"],
  notfound: ["ErrorState"],
  banner: ["Alert"],
  callout: ["Alert"],
  segmentedcontrol: ["SegmentedField", "ToggleGroup"],
  buttongroup: ["ButtonGroup", "ToggleGroup"],
  descriptionlist: ["Descriptions"],
  keyvalue: ["Descriptions", "KeyValueEditor"],
  splitter: ["SplitPanel", "ResizablePanelGroup"],
  splitpane: ["SplitPanel", "ResizablePanelGroup"],
  resizable: ["ResizablePanelGroup", "SplitPanel"],
  navbar: ["TopNav", "NavigationMenu"],
  header: ["TopNav", "SectionHeader", "PageShell"],
  layout: ["AppShell", "PageShell"],
  shell: ["AppShell", "PageShell", "ChatShell"],
  grid: ["DataTable", "BentoGrid", "MetricGrid"],
  datagrid: ["DataTable"],
  table: ["DataTable", "Table"],
  kpi: ["MetricCard", "MetricGrid"],
  stat: ["MetricCard", "MetricGrid"],
  statcard: ["MetricCard"],
  progressbar: ["Progress", "Meter"],
  gaugebar: ["Meter", "Gauge"],
  mention: ["MentionInput"],
  chat: ["ChatShell", "Conversation", "Message", "PromptInput"],
  chatinput: ["PromptInput", "Composer"],
  markdown: ["MarkdownView"],
  codeeditor: ["CodeEditor"],
  diff: ["DiffEditor", "DiffView"],
  map: ["MapCanvas"],
  graph: ["CanvasShell", "NetworkChart"],
  nodeeditor: ["CanvasShell", "FlowNode"],
  donut: ["PieChart", "RingChart"],
  donutchart: ["PieChart", "RingChart"],
  histogram: ["DistributionChart"],
  boxplot: ["DistributionChart"],
  timelinechart: ["Gantt"],
  darkmode: ["ThemeProvider", "ThemeSwitcher"],
  themetoggle: ["ThemeSwitcher"],
};

const squash = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

/** naive singular: "pickers" → "picker", "categories" → "category" */
const singular = (w) =>
  w.length > 4 && w.endsWith("ies")
    ? `${w.slice(0, -3)}y`
    : w.length > 3 && w.endsWith("s") && !w.endsWith("ss")
      ? w.slice(0, -1)
      : w;

export function queryTokens(query) {
  return [...new Set(splitIdentifier(query).map(singular))].filter(
    (t) => t.length >= 2 && !STOPWORDS.has(t),
  );
}

/** Levenshtein, early-exit above `max`. */
function editDistance(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** A query word matches a name word when it equals it, prefixes it (≥3 chars), or is one typo away (≥5 chars). */
function wordHit(q, w) {
  if (q === w || singular(w) === q) return 1;
  if (q.length >= 3 && w.startsWith(q)) return 0.8;
  if (q.length >= 5 && editDistance(q, w, 1) <= 1) return 0.6;
  return 0;
}

/** Where `qSquash` sits inside the identifier, judged on WORD boundaries: "dash" may
 *  prefix the word Dashboard, "daterange" may span Date+Range, but "charts" must not
 *  match Chart+S(tatFlow). Returns "prefix" | "substring" | null. */
function alignedMatch(words, nameSquash, qSquash) {
  if (qSquash.length < 3) return null;
  const starts = [];
  let off = 0;
  for (const w of words) {
    starts.push(off);
    off += w.length;
  }
  const ends = new Set(starts.map((st, i) => st + words[i].length));
  let from = 0;
  for (;;) {
    const at = nameSquash.indexOf(qSquash, from);
    if (at === -1) return null;
    const wi = starts.indexOf(at);
    if (wi !== -1) {
      const end = at + qSquash.length;
      if (ends.has(end) || end <= at + words[wi].length) return at === 0 ? "prefix" : "substring";
    }
    from = at + 1;
  }
}

function scoreRow(row, qSquash, qTokens, vocabTargets, wantsIcon) {
  const nameSquash = squash(row.name);
  const words = splitIdentifier(row.name);
  let score = 0;
  let why = "";
  const set = (points, reason) => {
    score = points;
    why = reason;
  };
  const aligned = nameSquash === qSquash ? null : alignedMatch(words, nameSquash, qSquash);
  if (nameSquash === qSquash) set(100, "exact");
  else if (aligned === "prefix") set(80, "prefix");
  else if (aligned === "substring") set(60, "substring");
  else if (qTokens.length) {
    const hits = qTokens.map((q) => Math.max(0, ...words.map((w) => wordHit(q, w))));
    const covered = hits.filter((h) => h > 0).length;
    const quality = hits.reduce((a, b) => a + b, 0) / qTokens.length;
    if (covered === qTokens.length) set(40 + 15 * quality, "words");
    else if (covered / qTokens.length >= 0.5 && qTokens.length > 1)
      set(15 + 15 * quality, "partial");
  }
  // one or two typos in a run-together name: "datepickr" → DatePicker
  if (!score && qSquash.length >= 6 && editDistance(qSquash, nameSquash, 2) <= 2) set(50, "typo");
  const vocabRank = vocabTargets.indexOf(row.name);
  if (vocabRank !== -1 && score < 70) set(70 - vocabRank, "also-known-as");
  // purpose / category text (only roots carry intent)
  if (!score && row.intent && qTokens.length) {
    const hay = new Set(
      splitIdentifier(`${row.intent.purpose || ""} ${row.intent.category || ""}`).map(singular),
    );
    const covered = qTokens.filter((q) => hay.has(q)).length;
    if (covered === qTokens.length) set(30, "purpose");
  }
  if (!score) {
    const pkgShort = String(row.pkg || "").replace(/^.*components-/, "");
    if (pkgShort === qSquash) set(10, "package");
  }
  if (!score) return null;
  // Roots before parts: a documented root gets a nudge; every extra word costs a little.
  if (row.intent) score += 4;
  score -= Math.min(words.length, 6) * 0.5;
  // A glyph is rarely what "dashboard" means — icons rank last unless asked for.
  if (!wantsIcon && why !== "exact" && /Icon$/.test(row.name) && /-icons$/.test(row.pkg || ""))
    score -= 45;
  return { score, why };
}

/**
 * @returns {{ rows: object[], typeRows: object[], nearest: object[], aka: string[] }}
 *   rows     ranked component/hook matches (constants excluded)
 *   typeRows types, value exports and constants that matched
 *   nearest  when `rows` is empty: the closest components by word overlap / typo
 *   aka      the vocabulary targets used (so the caller can say "toast → Toaster")
 */
export function searchExports(manifest, query) {
  const all = flat(manifest);
  const qSquash = squash(query);
  const qTokens = queryTokens(query);
  const names = new Set(all.map((r) => r.name));
  const aka = [
    ...new Set(
      [qSquash, ...qTokens.map(squash), squash(qTokens.join(""))]
        .flatMap((k) => VOCABULARY[k] || VOCABULARY[singular(k)] || [])
        .filter((n) => names.has(n)),
    ),
  ];
  const wantsIcon = qTokens.some((t) => t === "icon" || t === "glyph" || t === "logo");
  const seen = new Set();
  const scored = [];
  for (const row of all) {
    const key = `${row.pkg}:${row.importPath || ""}:${row.name}:${row.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const s = scoreRow(row, qSquash, qTokens, aka, wantsIcon);
    if (s) scored.push({ row, ...s });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.row.name.length - b.row.name.length ||
      a.row.name.localeCompare(b.row.name),
  );
  // Weak (partial / purpose-only) hits are padding once there are real ones.
  const strong = scored.filter((s) => s.score >= 40).length;
  if (strong >= 3)
    for (let i = scored.length - 1; i >= 0; i--) if (scored[i].score < 40) scored.splice(i, 1);
  const isRenderable = (r) =>
    (r.kind === "component" || r.kind === "hook") && !isConstantName(r.name);
  const decorate = ({ row, why }) => (why === "also-known-as" ? { ...row, aka: true } : row);
  const rows = scored.filter((s) => isRenderable(s.row)).map(decorate);
  const typeRows = scored
    .filter((s) => !isRenderable(s.row) && s.why !== "purpose")
    .map(({ row }) => (isConstantName(row.name) ? { ...row, kind: "constant" } : row));

  let nearest = [];
  if (!rows.length && qTokens.length) {
    const cand = [];
    for (const row of all) {
      if (!isRenderable(row)) continue;
      const words = splitIdentifier(row.name);
      let best = 0;
      for (const q of qTokens)
        for (const w of words) {
          if (wordHit(q, w)) best = Math.max(best, 2);
          else if (q.length >= 4 && editDistance(q, w, 2) <= 2) best = Math.max(best, 1);
        }
      if (row.intent) {
        const hay = splitIdentifier(row.intent.purpose || "").map(singular);
        if (qTokens.some((q) => hay.includes(q))) best = Math.max(best, 1.5);
      }
      if (best) cand.push({ row, best: best + (row.intent ? 0.5 : 0) - words.length * 0.05 });
    }
    cand.sort((a, b) => b.best - a.best || a.row.name.length - b.row.name.length);
    nearest = cand.slice(0, 8).map((c) => c.row);
  }
  return { rows, typeRows, nearest, aka };
}

/** The line an agent must read when nothing matched — never a bare "(none)". */
export const NO_MATCH_GUIDANCE =
  "No brand-ui export does this by that name. Do NOT invent an import. Try one noun " +
  '(e.g. "picker"), check the registry blocks and playbooks below, or compose it from ' +
  "primitives (Card, FieldRoot, Button, …) with semantic tokens only.";

/** Shared text rendering for the component arm (CLI + MCP print the same thing). */
export function renderComponentArm(query, result, cap = 30) {
  const lines = [`Components/hooks matching "${query}":`];
  for (const r of result.rows.slice(0, cap))
    lines.push(
      `  ${r.name}  (${r.pkg}${r.importPath ? ` → import from "${r.importPath}"` : ""} · ${r.kind})` +
        (r.aka ? "  ← brand-ui's name for this" : "") +
        (r.intent?.purpose ? `\n      ${r.intent.purpose}` : ""),
    );
  if (result.rows.length > cap)
    lines.push(`  … ${result.rows.length - cap} more — narrow the query`);
  if (!result.rows.length) {
    lines.push("  (none)");
    if (result.nearest.length) {
      lines.push("", "Nearest components (check these before building your own):");
      for (const r of result.nearest)
        lines.push(
          `  ${r.name}  (${r.pkg} · ${r.kind})` +
            (r.intent?.purpose ? `\n      ${r.intent.purpose}` : ""),
        );
    }
    lines.push("", NO_MATCH_GUIDANCE);
  }
  return lines;
}
