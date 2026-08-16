/**
 * @elabs/components-cli — the migration report renderer (VP-03 #124).
 *
 * Turns a `scan` + `map` result into the three markdown deliverables a brownfield
 * migration is planned from:
 *
 *   migration/repo-profile.md   what the project is today (stack + inventory + token debt)
 *   migration/analysis.md       what each component becomes (verdict, risk, effort, coverage)
 *   migration/plan.md           the phased strangler-fig route, with the components per phase
 *
 * HARD RULE — this module is **pure string generation**. It imports no `node:fs`,
 * so it structurally cannot write, move or touch a source file; the CLI's
 * `--out <dir>` flag is the only writer, and it only ever creates the three files
 * named above. That is what keeps `scan`/`map` honest about being read-only.
 *
 * Deterministic: same input → byte-identical output (no clock, no randomness, no
 * absolute paths beyond what the scan itself recorded).
 */

/** The file names this module renders, in the order a reader should meet them. */
export const MIGRATION_DOCS = ["repo-profile.md", "analysis.md", "plan.md"];

/**
 * The strangler-fig phases. Each phase names the mapping classes it consumes, so
 * `plan.md` can list the actual components a team touches in that phase rather
 * than generic advice.
 *
 * @type {{ name:string, goal:string, classes:string[], exit:string }[]}
 */
export const MIGRATION_PHASES = [
  {
    name: "Coexistence",
    goal: "Both design systems render side by side. Install the packages, import the tokens stylesheet, add one Tailwind `@source` line per installed package, and wrap the app root in `ThemeProvider`.",
    classes: [],
    exit: "The app builds and every existing screen still renders unchanged.",
  },
  {
    name: "Leaf components",
    goal: "Swap the one-to-one matches, lowest blast radius first. These are renames plus an import change, so each batch stays a reviewable diff.",
    classes: ["direct"],
    exit: "No leaf component from the old library remains in the migrated files.",
  },
  {
    name: "Composite surfaces",
    goal: "Handle the components whose API differs (rename the props) and the ones with no single equivalent (rebuild them by composing primitives). Show the composition before writing it.",
    classes: ["props", "compose"],
    exit: "Every screen in scope renders from brand-ui primitives.",
  },
  {
    name: "App shells",
    goal: "Move the frame itself — navigation, header, page scaffold — onto the brand-ui app shell, so chrome and canvas get the correct surface elevation.",
    classes: [],
    exit: "The shell is brand-ui; the old layout components are unreferenced.",
  },
  {
    name: "Theming cutover",
    goal: "Replace the remaining raw colour, spacing and font values with semantic tokens, then verify every migrated screen in light and dark.",
    classes: [],
    exit: "No raw hex outside a theme file, and every screen reads correctly in all three themes.",
  },
  {
    name: "Remove the old library",
    goal: "Delete the dead dependency and the compatibility shims. Anything still classified as a gap stays yours on purpose — record why.",
    classes: ["gap", "drop"],
    exit: "The old UI dependency is gone from package.json, or the remaining gaps are documented.",
  },
];

// ---- small markdown helpers (no dependencies) ------------------------------

/** Escape the pipe character so a value can sit inside a markdown table cell. */
const cell = (v) => String(v ?? "—").replace(/\|/g, "\\|");

/** Render a markdown table; returns "" when there are no rows. */
function table(headers, rows) {
  if (!rows.length) return "";
  const head = `| ${headers.join(" | ")} |`;
  const rule = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map(cell).join(" | ")} |`).join("\n");
  return [head, rule, body].join("\n");
}

/** A short human label for a project, falling back to its scanned path. */
function projectName(scan) {
  return scan?.project || scan?.path || "this project";
}

/** Section text, or a plain "nothing found" line so no section renders empty. */
function orNone(text, none) {
  return text || `_${none}_`;
}

// ---- repo-profile.md -------------------------------------------------------

function renderRepoProfile(scan) {
  const c = scan.components ?? {};
  const name = projectName(scan);
  const stack = table(
    ["Field", "Value"],
    [
      ["Project", name],
      ["Framework", scan.framework ?? "unknown"],
      [
        "UI library",
        `${scan.uiLibrary?.primary ?? "unknown"}${
          scan.uiLibrary?.detected?.length > 1
            ? ` (also: ${scan.uiLibrary.detected.slice(1).join(", ")})`
            : ""
        }`,
      ],
      [
        "Styling",
        `${scan.styling?.primary ?? "unknown"}${
          scan.styling?.detected?.length > 1
            ? ` (also: ${scan.styling.detected.slice(1).join(", ")})`
            : ""
        }`,
      ],
      ["Source files scanned", c.filesScanned ?? 0],
      ["Distinct components used", c.distinct ?? 0],
      ["Total component usages", c.usages ?? 0],
    ],
  );

  const usage = table(
    ["Component", "Usages", "Files", "Props seen"],
    (c.top ?? [])
      .slice(0, 30)
      .map((t) => [t.name, t.count, t.files ?? "—", (t.props ?? []).join(", ") || "—"]),
  );

  const perFile = table(
    ["File", "Component", "Usages"],
    (c.byFile ?? []).slice(0, 30).map((r) => [r.file, r.tag, r.count]),
  );

  const imports = table(
    ["Module", "Imported names", "Files"],
    (scan.imports?.sources ?? [])
      .slice(0, 25)
      .map((i) => [i.source, i.specifiers.join(", ") || "—", i.files]),
  );

  const tok = scan.tokens ?? {};
  const debt = table(
    ["Raw value", "Occurrences"],
    [
      ["Colour literals (hex / rgb / arbitrary)", tok.hardcodedColors ?? 0],
      ["Spacing literals (p-[12px] and friends)", tok.hardcodedSpacing ?? 0],
      ["Font-size literals", tok.fontSizes ?? 0],
    ],
  );

  return `# Repo profile — ${name}

Generated by \`brand-ui scan\`. Read-only: producing this file changed nothing in
the project it describes.

## Stack

${stack}

## Most-used components

${orNone(usage, "no JSX components were found")}

## Where they are used

${orNone(perFile, "no per-file usage was recorded")}

## Import graph

${orNone(imports, "no imports were found")}

## Token debt

Every count below is a value a migration replaces with a semantic token. They are
line-level heuristics, so treat them as a size signal, not an exact worklist.

${debt}

## How this was measured

The inventory is a heuristic source scan, not an AST parse: a \`<Tag\` inside a
comment or a string counts, and a member tag (\`<Card.Header>\`) is attributed to
its root (\`Card\`). It is accurate enough to rank work by blast radius, which is
what the plan needs.
`;
}

// ---- analysis.md -----------------------------------------------------------

function verdictRows(map, cls) {
  return (map.mappings ?? [])
    .filter((m) => m.class === cls)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.source.localeCompare(b.source));
}

function renderAnalysis(scan, map) {
  const name = projectName(scan);
  const s = map.summary ?? {};
  const pct = s.coveragePct ?? 0;
  const cov = s.coverage ?? {};

  const counts = table(
    ["Verdict", "Components", "What it means"],
    [
      ["direct", s.direct ?? 0, "A one-to-one brand-ui equivalent — rename plus imports"],
      ["props", s.props ?? 0, "Equivalent exists, prop names differ"],
      ["compose", s.compose ?? 0, "No single equivalent — compose two or more primitives"],
      ["gap", s.gap ?? 0, "Nothing matches — keep yours, or propose a new component"],
      ["drop", s.drop ?? 0, "Not UI (routing, document head, language constructs)"],
    ],
  );

  const section = (cls, headers, toRow) => {
    const rows = verdictRows(map, cls);
    return orNone(table(headers, rows.map(toRow)), `no \`${cls}\` mappings`);
  };

  const direct = section(
    "direct",
    ["Component", "Usages", "Files", "Target", "Package", "Risk", "Effort", "Props to check"],
    (m) => [
      m.source,
      m.count,
      m.files,
      m.target,
      m.pkg,
      m.risk,
      m.effort,
      (m.unknownProps ?? []).join(", ") || "—",
    ],
  );

  const props = section(
    "props",
    ["Component", "Usages", "Target", "Prop remap", "Risk", "Effort", "Note"],
    (m) => [
      m.source,
      m.count,
      m.target ?? "—",
      Object.entries(m.propRemap ?? {})
        .map(([from, to]) => `${from} → ${to}`)
        .join("; ") || "—",
      m.risk,
      m.effort,
      m.note ?? "—",
    ],
  );

  const compose = section(
    "compose",
    ["Component", "Usages", "Compose from", "Risk", "Effort", "Note"],
    (m) => [
      m.source,
      m.count,
      (m.compose ?? []).join(" + ") || "—",
      m.risk,
      m.effort,
      m.note ?? "—",
    ],
  );

  const gap = section("gap", ["Component", "Usages", "Files", "Risk", "Effort"], (m) => [
    m.source,
    m.count,
    m.files,
    m.risk,
    m.effort,
  ]);

  const drop = section("drop", ["Component", "Usages", "Why"], (m) => [
    m.source,
    m.count,
    m.note ?? "not UI",
  ]);

  return `# Migration analysis — ${name}

Generated by \`brand-ui map\` from the scan of ${projectName(scan)}. Read-only.

## Coverage

**${pct}%** of ${cov.totalUsages ?? 0} component usages are covered by a direct
match or a prop remap (${cov.mappedUsages ?? 0} usages). Coverage is measured in
usages, not component names: one tag used everywhere is most of the migration.

${counts}

## direct — rename and re-import

${direct}

## props — rename the component and its props

${props}

## compose — rebuild from primitives

${compose}

## gap — no equivalent

Do not force a bad fit. Either keep the component and record why, or propose it
as a new library component.

${gap}

## drop — not UI

${drop}

## Risk and effort

\`risk\` and \`effort\` are computed from the verdict and the blast radius
(usages × distinct files): under 10 is low, 10–39 medium, 40 and over high. A
rename never reads as high risk however often it appears; a rebuild never reads
as low, even for a single call site.
`;
}

// ---- plan.md ---------------------------------------------------------------

function renderPlan(scan, map) {
  const name = projectName(scan);
  const byClass = new Map();
  for (const m of map.mappings ?? []) {
    if (!byClass.has(m.class)) byClass.set(m.class, []);
    byClass.get(m.class).push(m);
  }

  const phases = MIGRATION_PHASES.map((p, i) => {
    const members = p.classes
      .flatMap((c) => byClass.get(c) ?? [])
      .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.source.localeCompare(b.source));
    const list = members.length
      ? table(
          ["Component", "Usages", "Verdict", "Target", "Risk", "Effort"],
          members
            .slice(0, 40)
            .map((m) => [m.source, m.count, m.class, m.target ?? "—", m.risk, m.effort]),
        )
      : "_No component work in this phase — it is a wiring step._";
    return `### Phase ${i + 1} — ${p.name}

${p.goal}

${list}

**Done when:** ${p.exit}
`;
  }).join("\n");

  return `# Migration plan — ${name}

A strangler-fig route: the new system grows inside the old one, and the old one
is removed only once nothing points at it. Stop for review between phases — each
phase is meant to be a diff a person can actually read.

${phases}
## Ground rules for every phase

- Semantic tokens only. No raw hex, ever.
- Read the real API before using a component (\`brand-ui docs <Name>\`); never
  guess a prop.
- Prefer composing the primitives that exist over writing a new component.
- Run the project's build and tests after each batch, not at the end.
- Check migrated screens in light and dark. A component
  that only works in one theme is not migrated.
`;
}

// ---- public entry point ----------------------------------------------------

/**
 * Render the migration deliverables from a `scan` (and optionally a `map`).
 *
 * @param {object} scan - a `scanRepo` result.
 * @param {object|null} [map] - a `mapComponents` result; omit for the profile only.
 * @returns {Record<string,string>} `{ "repo-profile.md": md, "analysis.md"?: md, "plan.md"?: md }`
 */
export function renderMigrationDocs(scan, map = null) {
  if (!scan || typeof scan !== "object") throw new TypeError("renderMigrationDocs: scan required");
  const out = { "repo-profile.md": renderRepoProfile(scan) };
  if (map && typeof map === "object") {
    out["analysis.md"] = renderAnalysis(scan, map);
    out["plan.md"] = renderPlan(scan, map);
  }
  return out;
}
