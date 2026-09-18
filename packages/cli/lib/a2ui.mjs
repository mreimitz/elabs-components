/**
 * `brand-ui a2ui` (D2 — the generative-UI path) — agent tooling for A2UI surfaces v1:
 *
 *   catalog [<Type>] [--json]     the types an agent may emit: props, enums, events, children
 *   schema                        the surface JSON Schema (draft 2020-12)
 *   validate <file> [--json]      validate a surface; `path  code  message` per problem, exit 1
 *   example                       a small valid surface to start from
 *
 * The logic is NOT re-implemented here: it runs the esbuild bundle of the engine-free
 * core in `@elabs-ai/components-ai` (`a2ui.generated.mjs`, written by `pnpm gen`), so the
 * CLI, the hosted MCP and `<A2uiSurface>` can never disagree about what is valid.
 */
import {
  A2UI_CATALOG_SCHEMA,
  A2UI_CATALOG_VERSION,
  A2UI_COMMON_PROPS,
  A2UI_VERSION,
  buildA2uiSurfaceSchema,
  validateA2uiSurface,
} from "./a2ui.generated.mjs";

export const A2UI_VERB_DOCS = [
  {
    verb: "catalog",
    usage: "brand-ui a2ui catalog [<Type>] [--json]",
    does: "Lists every type an agent may emit in a surface — props with enums and defaults, required props, events (`on.click` → the host action), whether it takes children — or the full entry for one type.",
  },
  {
    verb: "schema",
    usage: "brand-ui a2ui schema",
    does: "Prints the A2UI surface v1 JSON Schema (draft 2020-12; also published as `@elabs-ai/components-ai/a2ui/schema.json`) — feed it to a structured-output mode.",
  },
  {
    verb: "validate",
    usage: "brand-ui a2ui validate <file> [--json]",
    does: "Runs `validateA2uiSurface`: one `path code message` line per problem (unknown type/prop/event, enum value, missing required prop, children on a leaf); exit 1 when invalid.",
  },
  {
    verb: "example",
    usage: "brand-ui a2ui example",
    does: "Prints a small valid surface (Card → Grid of MetricCards → Button with an `on.click` action) to start from.",
  },
];

export const A2UI_VERBS = A2UI_VERB_DOCS.map((d) => d.verb);

export const A2UI_USAGE =
  "usage: brand-ui a2ui <catalog [<Type>]|schema|validate <file>|example> [--json]\n" +
  "  Agent tooling for A2UI surfaces v1 — an agent-designed screen as data, rendered by <A2uiSurface>";

/** The generated SKILL.md region: the verb table an agent reads before emitting a surface. */
export function renderA2uiSkillTable() {
  const rows = A2UI_VERB_DOCS.map((d) => `| \`${d.usage.replaceAll("|", "\\|")}\` | ${d.does} |`);
  return [
    "> **Generated** by `pnpm gen` from the CLI's a2ui module — edit there, not here.",
    "",
    "| Command | What it does |",
    "| --- | --- |",
    ...rows,
    "",
  ].join("\n");
}

/** A small, valid surface — the shape an agent copies. */
export const A2UI_EXAMPLE = {
  a2ui: A2UI_VERSION,
  title: "Order 4711",
  root: {
    type: "Card",
    children: [
      {
        type: "CardHeader",
        children: [
          { type: "CardTitle", children: ["Order 4711"] },
          { type: "CardDescription", children: ["Placed today · awaiting approval"] },
          {
            type: "CardAction",
            children: [{ type: "StatusBadge", props: { status: "awaiting-approval" } }],
          },
        ],
      },
      {
        type: "CardContent",
        children: [
          {
            type: "Grid",
            props: { columns: 3 },
            children: [
              {
                type: "MetricCard",
                props: { label: "Total", value: 1240, valueFormat: "currency", currency: "EUR" },
              },
              { type: "MetricCard", props: { label: "Lines", value: 3 } },
              {
                type: "MetricCard",
                props: {
                  label: "Margin",
                  value: 0.31,
                  valueFormat: "percent",
                  delta: "+2.1 pts",
                  deltaDirection: "up",
                },
              },
            ],
          },
        ],
      },
      {
        type: "CardFooter",
        children: [
          {
            type: "Stack",
            props: { direction: "row", gap: "sm", justify: "end" },
            children: [
              {
                type: "Button",
                props: { variant: "outline" },
                on: { click: { name: "open-order", payload: { id: 4711 } } },
                children: ["Open"],
              },
              {
                type: "Button",
                on: { click: { name: "approve", payload: { id: 4711 } } },
                children: ["Approve"],
              },
            ],
          },
        ],
      },
    ],
  },
};

/** The JSON Schema object (identical to `@elabs-ai/components-ai/a2ui/schema.json`). */
export function a2uiSchema() {
  return buildA2uiSurfaceSchema(A2UI_CATALOG_SCHEMA);
}

/** The catalog schema (per type), or one type's entry (`null` when unknown). */
export function a2uiCatalog(type) {
  if (!type) return A2UI_CATALOG_SCHEMA;
  return A2UI_CATALOG_SCHEMA[type] ?? null;
}

/** `validateA2uiSurface` over a parsed value: `{ ok, errors }`. */
export function validateSurface(input) {
  const result = validateA2uiSurface(input, A2UI_CATALOG_SCHEMA);
  return { ok: result.ok, errors: result.errors };
}

const propLine = (name, p) => {
  const shape = p.enum ? p.enum.map((v) => JSON.stringify(v)).join(" | ") : p.type;
  const bits = [shape];
  if (p.default !== undefined) bits.push(`default ${JSON.stringify(p.default)}`);
  return `      ${name}${p.required ? "" : "?"}: ${bits.join(" · ")}${p.description ? ` — ${p.description}` : ""}`;
};

/** One line per type, or the full entry for one type. */
export function renderCatalogText(catalog, type) {
  if (type) {
    const entry = catalog[type];
    if (!entry) {
      return `a2ui: unknown type "${type}". Types: ${Object.keys(A2UI_CATALOG_SCHEMA).join(", ")}`;
    }
    const lines = [`${type}  (${entry.source}${entry.children ? " · takes children" : ""})`];
    if (entry.summary) lines.push(`  ${entry.summary}`);
    const props = Object.entries(entry.props);
    lines.push(`  props${props.length ? ":" : ": none beyond the common DOM props"}`);
    for (const [name, p] of props) lines.push(propLine(name, p));
    if (!entry.builtin) {
      lines.push(`  also: ${Object.keys(A2UI_COMMON_PROPS).join(", ")}`);
    }
    const events = Object.entries(entry.events);
    if (events.length) {
      lines.push(
        `  events (bind with "on": { "<event>": { "name": "<host action>", "payload"?: … } }):`,
      );
      for (const [ev, handler] of events) lines.push(`      ${ev} → ${handler}`);
    }
    return lines.join("\n");
  }
  const width = Math.max(...Object.keys(catalog).map((t) => t.length));
  const rows = Object.entries(catalog).map(([t, e]) => {
    const props = Object.keys(e.props);
    const marks = [e.children ? "children" : "", ...Object.keys(e.events).map((ev) => `on.${ev}`)]
      .filter(Boolean)
      .join(", ");
    const shown = props.slice(0, 6).join(", ") + (props.length > 6 ? `, +${props.length - 6}` : "");
    return `  ${t.padEnd(width)}  ${(marks || "—").padEnd(18)}  ${shown || "—"}`;
  });
  return [
    `A2UI catalog v${A2UI_CATALOG_VERSION} — ${Object.keys(catalog).length} types an agent may emit (protocol "a2ui": "${A2UI_VERSION}").`,
    `A surface is { "a2ui": "1", "title"?, "root": <node> }; a node is a string or { "type", "id"?, "props"?, "children"?, "on"? }.`,
    `Interaction: "on": { "click": { "name": "approve", "payload": { … } } } → the host's onAction. No code, no className, no style.`,
    "",
    `  ${"type".padEnd(width)}  ${"accepts".padEnd(18)}  props (first six)`,
    ...rows,
    "",
    "Details: brand-ui a2ui catalog <Type> · schema: brand-ui a2ui schema · start: brand-ui a2ui example",
  ].join("\n");
}

/** One line per error, aligned: `root.children[1].props.variant  invalid-value  …`. */
export function renderValidationText(file, result) {
  if (result.ok) return `${file}: valid A2UI surface v${A2UI_VERSION}`;
  const width = Math.max(...result.errors.map((e) => e.path.length));
  const codeWidth = Math.max(...result.errors.map((e) => e.code.length));
  const rows = result.errors.map(
    (e) => `  ${e.path.padEnd(width)}  ${e.code.padEnd(codeWidth)}  ${e.message}`,
  );
  const noun = result.errors.length === 1 ? "error" : "errors";
  return [`${file}: ${result.errors.length} ${noun}`, ...rows].join("\n");
}
