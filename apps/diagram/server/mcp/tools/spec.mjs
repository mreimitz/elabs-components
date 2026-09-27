/**
 * DG-35 — spec tools, run by the app's own parser, validator and compiler through
 * `spec-bridge.mjs` (the same code the browser runs).
 */
const TEXT = { type: "string", description: "The whole YAML document." };

export const specTools = [
  {
    name: "spec_validate",
    description:
      "Check a diagram's YAML without writing it. Returns { ok, issues: [{ severity, code, " +
      "path, message, line, col, suggestion? }] }; ok is false when any issue is an error. " +
      "Use it before diagram_write or diagram_create.",
    inputSchema: {
      type: "object",
      properties: { text: TEXT },
      required: ["text"],
      additionalProperties: false,
    },
    handler: ({ text }, ctx) => ctx.bridge.validate(text),
  },
  {
    name: "spec_compile",
    description:
      "The resolved model of a diagram's YAML as JSON: { ok, issues, diagram: { title, " +
      "zones[], nodes[], flows[], notes[] } } with every zone flattened (parent = its zone id), " +
      "every flow as { from, to, label, kind, step }. Use it to answer 'what talks to what?' " +
      "and to find ids for compose_set.",
    inputSchema: {
      type: "object",
      properties: { text: TEXT },
      required: ["text"],
      additionalProperties: false,
    },
    handler: async ({ text }, ctx) => {
      const { ok, issues } = await ctx.bridge.validate(text);
      const { ast } = (await ctx.bridge.load()).checkDiagram(text);
      return { ok, issues, diagram: ast };
    },
  },
  {
    name: "spec_schema",
    description:
      "The diagram dialect's JSON Schema (v0): every key a diagram may use. Read it once " +
      "when unsure of a key.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: async (_args, ctx) => (await ctx.bridge.load()).buildArchSchema(),
  },
];
