/**
 * chart-default-prose — a default that a chart prop's TSDoc states matches the definition's
 * default (ADR 0042 §11, RM-190).
 *
 * Why: review F36 found seven documented defaults that contradicted the code (Candlestick's
 * `animationDuration` documented as 1500 against 1100, a loading stroke naming the wrong token,
 * …). The definitions now hold the real defaults and the committed snapshot
 * (`packages/cli/lib/definitions.generated.json`) records them, so the prose can be held to them
 * mechanically. When the two disagree the prose is what is wrong: fix the TSDoc, never the
 * default — changing a default changes behaviour and has its own review.
 *
 * What is compared, and nothing else — the narrowest form that parses without noise:
 *   - every default of a charts entry in the snapshot (`fields[prop].default` and
 *     `codeOnlyDefaults`). A context default (`{ defaultFrom: "context" }`) has no literal and is
 *     skipped;
 *   - against that prop's TSDoc where the component's own module (`entry.module`) declares it:
 *     the `<Id>Props` interface with all its merged declarations, plus the interfaces of the same
 *     module it extends (directly or through `Omit` / `Pick` / `Partial` / `Required` /
 *     `Readonly`);
 *   - reading the first statement in that TSDoc that states a literal, in either spelling:
 *       - leading: `Default:` / `Default` / `Defaults to` / `@default`, then a backticked JS
 *         literal (`` `1100` ``, `` `"none"` ``, `` `[4, 22]` ``, `` `{ start: "hollow" }` ``) or
 *         a bare number, `true` / `false` / `null`, quoted string, `[…]` array or
 *         `var(--token)` that ends the clause (`.`, `,`, `;`, `:`, `)`, ` (`, ` —`, or the end
 *         of the comment). A leading statement that names no literal ("Default: solid line")
 *         is passed over and the next one is read;
 *       - marked: a backticked or quoted literal right before `(default)` / `(default, …)`
 *         (`` `"outside"` (default) ``), or inside `(default `true`)`.
 *   - a charts entry whose module no longer declares `<Id>Props` is a finding — the rule could
 *     not read that component's TSDoc at all, and saying so beats a silent pass.
 * Not compared (declared gaps): a prose default ("the family's own default", "Rows (default)"),
 * a constant's name (`CHART_HAIRLINE_WIDTH`, `{@link DEFAULT_HEATMAP_STEPS}`), an expression
 * (`-PI/2`), and a prop whose TSDoc lives in another module — a shared group or commons
 * interface documents one default for many kinds, and a kind may override it on purpose.
 * Measured on 2026-09-27: on the `<Id>Props` interfaces alone, 244 literal defaults read (214
 * `Default` statements, 30 `(default)` marks); 1 drift (Area `loadingStroke`, fixed in RM-190).
 * One TypeScript parse per definition module (~40 files).
 */
import ts from "typescript";

import { chartsSnapshot, missingSnapshot } from "./charts-deprecated-usage.mjs";

const CONTAINERS = /^(Omit|Pick|Partial|Required|Readonly)$/;
/** The statement's tail is a lookahead, so a later statement in the same doc is still matched. */
const DEFAULT_STATEMENT = /(?:\bDefault(?:s to)?\b:?|@default\b)\s*(?=(.{0,120}))/g;
const BARE_LITERAL =
  /^(-?\d+(?:\.\d+)?(?!\.?\d)|true|false|null|"[^"]*"|'[^']*'|\[[^\]]*\]|var\(--[\w-]+\))(?=$|[.,;:)]|\s[(—–-])/;
/** `` `"outside"` (default) ``, `"center" (default)`, `` `"dumbbell"` (default, one track …) ``. */
const MARKED_BEFORE = /(?:`([^`]+)`|("[^"]*"))\s*\(default\b[,)]/g;
/** `` (default `true`) ``, `` (default: `"sm"`) ``. */
const MARKED_INSIDE = /\(default:?\s+`([^`]+)`\)/g;

/** A TSDoc block's text without the comment markers, whitespace collapsed. */
function docText(raw) {
  return raw
    .trim()
    .replace(/^\/\*\*|\*\/$/g, "")
    .replace(/^\s*\*/gm, "")
    .replace(/\\`/g, "`")
    .replace(/\s+/g, " ")
    .trim();
}

/** A JS literal written in prose → `{ value }`, or undefined when it is not one. */
export function parseLiteral(text) {
  const t = text.trim();
  if (/^var\(--[\w-]+\)$/.test(t)) return { value: t };
  const jsonish = t
    .replace(/'([^'\\]*)'/g, '"$1"')
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
  for (const candidate of [t, jsonish]) {
    try {
      return { value: JSON.parse(candidate) };
    } catch {
      // not this spelling
    }
  }
  return undefined;
}

/** The literal a statement names, `{ text, value }`, or undefined when it names none. */
function literalOf(text) {
  if (text === undefined) return undefined;
  const parsed = parseLiteral(text);
  return parsed && { text, value: parsed.value };
}

/**
 * The default a TSDoc text states, `{ text, value }`, or undefined (no statement, or prose only).
 * The first statement, in document order, that names a literal wins.
 */
export function statedDefault(doc) {
  const hits = [];
  for (const hit of doc.matchAll(DEFAULT_STATEMENT)) {
    const tick = /^`([^`]+)`/.exec(hit[1]);
    hits.push({ at: hit.index, text: tick ? tick[1] : BARE_LITERAL.exec(hit[1])?.[1] });
  }
  for (const hit of doc.matchAll(MARKED_BEFORE))
    hits.push({ at: hit.index, text: hit[1] ?? hit[2] });
  for (const hit of doc.matchAll(MARKED_INSIDE)) hits.push({ at: hit.index, text: hit[1] });
  for (const { text } of hits.sort((a, b) => a.at - b.at)) {
    const stated = literalOf(text);
    if (stated) return stated;
  }
  return undefined;
}

/** Order-independent JSON, so `{ a, b }` equals `{ b, a }`. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(value[k])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

const isContextDefault = (value) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  value.defaultFrom === "context";

/**
 * `prop → PropertySignature` of `<id>Props` and its same-module bases, first declaration wins;
 * null when the module declares no `<id>Props` interface, or when a `type` root alias resolves
 * to no members at all (an intersection whose every part is opaque — a finding, not silence:
 * review F7).
 *
 * RM-196: `<id>Props` may instead be a `type` intersection of same-module interfaces plus an
 * "either/or" pair like `HeatmapChartXProp` (a union of two object type literals — one branch
 * requires the new name, the other the deprecated one). Neither `x`/`xDataKey` carries a
 * `default` in the snapshot (a required data-key has none), so nothing here needs to pick the
 * "right" branch — reading the FIRST branch's member is enough to keep resolving the OTHER,
 * ordinary defaults declared alongside it. A bare object-literal `type` (no references to
 * resolve) still correctly falls through to the "no interface" finding below.
 *
 * `visitType` (review F7) unwraps a `Container<Inner, …>` (`Omit`/`Pick`/…) reference the same
 * way the interface-heritage path does, wherever it appears — including as one member of an
 * intersection, not only as a heritage clause — and reads a union's first member whether that
 * member is an inline object literal or a reference to another interface/alias.
 */
function propsMembers(sf, id) {
  const interfaces = new Map();
  const aliases = new Map();
  for (const statement of sf.statements) {
    if (ts.isInterfaceDeclaration(statement)) {
      const list = interfaces.get(statement.name.text) ?? [];
      list.push(statement);
      interfaces.set(statement.name.text, list);
    } else if (ts.isTypeAliasDeclaration(statement)) {
      aliases.set(statement.name.text, statement);
    }
  }
  const members = new Map();
  const seen = new Set();
  const addPropertySignatures = (typeMembers) => {
    for (const member of typeMembers)
      if (
        ts.isPropertySignature(member) &&
        ts.isIdentifier(member.name) &&
        !members.has(member.name.text)
      )
        members.set(member.name.text, member);
  };
  const visit = (name) => {
    if (seen.has(name)) return;
    const declarations = interfaces.get(name);
    if (declarations) {
      seen.add(name);
      for (const declaration of declarations) addPropertySignatures(declaration.members);
      for (const declaration of declarations)
        for (const clause of declaration.heritageClauses ?? [])
          for (const base of clause.types) {
            if (!ts.isIdentifier(base.expression)) continue;
            if (!CONTAINERS.test(base.expression.text)) {
              visit(base.expression.text);
              continue;
            }
            const inner = base.typeArguments?.[0];
            if (inner && ts.isTypeReferenceNode(inner) && ts.isIdentifier(inner.typeName))
              visit(inner.typeName.text);
          }
      return;
    }
    const alias = aliases.get(name);
    if (!alias) return;
    seen.add(name);
    visitType(alias.type);
  };
  /**
   * An intersection walks each member. A union reads its first branch, whether that branch is
   * an inline object literal or a reference to another interface/alias. A reference unwraps a
   * `Container<Inner, …>` (`Omit`/`Pick`/…) to its first type argument the same way the
   * interface-heritage path does, so `Omit<Base, "k">` resolves whether it appears as a heritage
   * clause or as one member of an intersection.
   */
  const visitType = (type) => {
    if (ts.isIntersectionTypeNode(type)) {
      for (const part of type.types) visitType(part);
    } else if (ts.isUnionTypeNode(type)) {
      const literal = type.types.find(ts.isTypeLiteralNode);
      if (literal) {
        addPropertySignatures(literal.members);
        return;
      }
      const reference = type.types.find(
        (branch) => ts.isTypeReferenceNode(branch) && ts.isIdentifier(branch.typeName),
      );
      if (reference) visitType(reference);
    } else if (ts.isTypeLiteralNode(type)) {
      addPropertySignatures(type.members);
    } else if (ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName)) {
      const name = type.typeName.text;
      if (CONTAINERS.test(name)) {
        const inner = type.typeArguments?.[0];
        if (inner) visitType(inner);
        return;
      }
      visit(name);
    }
  };
  if (interfaces.has(`${id}Props`)) {
    visit(`${id}Props`);
    return members;
  }
  const rootAlias = aliases.get(`${id}Props`);
  if (rootAlias && ts.isIntersectionTypeNode(rootAlias.type)) {
    seen.add(`${id}Props`);
    visitType(rootAlias.type);
    // An intersection every one of whose parts is opaque (an external type, a qualified name,
    // …) resolves to zero members — that is "cannot read this component's TSDoc", the same as
    // no `<id>Props` interface at all, and it gets the same finding rather than a silent pass.
    return members.size > 0 ? members : null;
  }
  return null;
}

/** The last `/** … *\/` block in a member's leading trivia (parsed without parent pointers). */
function leadingDoc(sf, member) {
  const trivia = sf.text.slice(member.pos, member.getStart(sf));
  const open = trivia.lastIndexOf("/**");
  return open === -1 ? null : trivia.slice(open);
}

/** Every documented default of one snapshot entry that contradicts it. */
export function proseDrift(id, entry, src) {
  const defaults = {};
  for (const [prop, field] of Object.entries(entry.fields ?? {}))
    if ("default" in field) defaults[prop] = field.default;
  Object.assign(defaults, entry.codeOnlyDefaults ?? {});
  const props = Object.keys(defaults).filter((prop) => !isContextDefault(defaults[prop]));
  if (props.length === 0) return [];
  const sf = ts.createSourceFile(
    entry.module,
    src,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX,
  );
  const members = propsMembers(sf, id);
  if (!members)
    return [
      {
        file: entry.module,
        line: 1,
        msg: `${id}: this module declares no \`${id}Props\` interface, so its documented defaults cannot be read — declare the props here, or point the definition's module at the file that does`,
      },
    ];
  const findings = [];
  for (const prop of props) {
    const member = members.get(prop);
    const doc = member && leadingDoc(sf, member);
    const stated = doc && statedDefault(docText(doc));
    if (!stated || stable(stated.value) === stable(defaults[prop])) continue;
    findings.push({
      file: entry.module,
      line: sf.getLineAndCharacterOfPosition(member.getStart(sf)).line + 1,
      msg: `${id}.${prop}: the TSDoc says the default is ${stated.text}, the definition says ${JSON.stringify(
        defaults[prop],
      )} — fix the prose (the definition is the source of truth)`,
    });
  }
  return findings;
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SNAPSHOT = "packages/cli/lib/definitions.generated.json";
const MODULE = "packages/charts/src/charts/candlestick-chart.tsx";
const snapshot = (fields, extra = {}) =>
  JSON.stringify({
    "@elabs-ai/components-charts": {
      CandlestickChart: { id: "CandlestickChart", module: MODULE, fields, ...extra },
    },
  });
const num = (value) => ({ kind: "number", default: value, group: null });
const props = (body) =>
  `interface CandlestickBase {\n  /** Wick colour. Default: \`"var(--chart-foreground)"\`. */\n  wick?: string;\n}\nexport interface CandlestickChartProps extends Omit<CandlestickBase, "x"> {\n${body}\n}`;

export default {
  id: "chart-default-prose",
  scope: "components",
  doc: "A default stated in a chart prop's TSDoc (`Default: 1100`, `` Default `\"none\"` ``, `@default false`) matches that prop's definition default in the snapshot — when they disagree, fix the prose, never the default.",
  baseline: "none",
  run(ctx) {
    const entries = chartsSnapshot(ctx);
    if (!entries) return [missingSnapshot()];
    const findings = [];
    for (const id of Object.keys(entries).sort()) {
      const entry = entries[id];
      if (!entry.module) continue;
      if (!ctx.exists(entry.module)) {
        findings.push({
          file: SNAPSHOT,
          line: 1,
          msg: `${id}: module ${entry.module} is gone — run \`pnpm gen\``,
        });
        continue;
      }
      findings.push(...proseDrift(id, entry, ctx.readFile(entry.module)));
    }
    return findings;
  },
  fixtures: {
    pass: [
      {
        files: {
          [SNAPSHOT]: snapshot({
            animationDuration: num(1100),
            wick: { kind: "color", default: "var(--chart-foreground)", group: null },
            align: { kind: "enum", default: "start", group: null },
            sizeRange: { kind: "array", default: [4, 22], group: null },
            markers: { kind: "object", default: { start: "hollow", end: "filled" }, group: null },
            reveal: { kind: "boolean", default: false, group: null },
          }),
          [MODULE]: props(
            '  /** Entry animation, ms. Default: 1100 */\n  animationDuration?: number;\n  /** Where it sits. Default `"start"` (the first rows). */\n  align?: "start" | "end";\n  /** Radius range. Default: `[4, 22]`. */\n  sizeRange?: [number, number];\n  /** Default `{ end: "filled", start: "hollow" }`. */\n  markers?: object;\n  /** @default false */\n  reveal?: boolean;',
          ),
        },
      }, // bare, backticked, array, object (key order ignored), @default, a base through Omit
      {
        files: {
          [SNAPSHOT]: snapshot({ animationDuration: num(1100) }),
          [MODULE]:
            "interface CandlestickBaseProps {\n  /** Entry animation, ms. Default: 1100 */\n  animationDuration?: number;\n}\ntype CandlestickXorProp =\n  | { xDataKey: string; x?: string }\n  | { xDataKey?: string; x: string };\nexport type CandlestickChartProps = CandlestickBaseProps & CandlestickXorProp;",
        },
      }, // RM-196: `<id>Props` as `type Base & XorPair` (Heatmap's `x`/`xDataKey` shape) still
      // reads the interface member's default through the intersection
      {
        files: {
          [SNAPSHOT]: snapshot({ animationDuration: num(1100) }),
          [MODULE]:
            "interface CandlestickCommonProps {\n  gap?: number;\n}\ninterface CandlestickBaseProps {\n  /** Entry animation, ms. Default: 1100 */\n  animationDuration?: number;\n}\ninterface CandlestickAltProps {\n  /** Entry animation, ms. Default: 1100 */\n  animationDuration?: number;\n}\ntype CandlestickXorProp = CandlestickBaseProps | CandlestickAltProps;\nexport type CandlestickChartProps = CandlestickCommonProps & CandlestickXorProp;",
        },
      }, // review F7: a union whose branches are INTERFACE REFERENCES (not inline object
      // literals), sitting inside an intersection like Heatmap's real shape — the first
      // branch's member is read, same as a union of type literals
      {
        files: {
          [SNAPSHOT]: snapshot({
            strokeWidth: num(0.65),
            steps: num(5),
            dash: { kind: "string", default: "0", group: null },
            density: { kind: "enum", default: { defaultFrom: "context" }, group: null },
          }),
          [MODULE]: props(
            '  /** Default: `CHART_HAIRLINE_WIDTH` — the one furniture weight. */\n  strokeWidth?: number;\n  /** Default {@link DEFAULT_STEPS}. */\n  steps?: number;\n  /** Default: solid line */\n  dash?: string;\n  /** Default: `"md"`, from the config. */\n  density?: string;',
          ),
        },
      }, // prose, a constant's name and a context default are not compared
      {
        files: {
          [SNAPSHOT]: snapshot({}, { codeOnlyDefaults: { children: null } }),
          [MODULE]:
            "export interface CandlestickChartProps {\n  /** Default: 1500 */\n  gap?: number;\n}",
        },
      }, // a documented default the definition does not hold is not this rule's business
      {
        files: {
          [SNAPSHOT]: snapshot({
            placement: { kind: "enum", default: "outside", group: null },
            labelAlign: { kind: "enum", default: "center", group: null },
            higherIsBetter: { kind: "boolean", default: true, group: null },
            variant: { kind: "enum", default: "dumbbell", group: null },
            width: num(80),
            steps: num(5),
          }),
          [MODULE]: props(
            '  /** `"outside"` (default) sits beyond the ticks; `"inside"` overlaps them. */\n  placement?: string;\n  /** - "center" (default), "start", "end" */\n  labelAlign?: string;\n  /** Higher reads better (default `true`). */\n  higherIsBetter?: boolean;\n  /** `"dumbbell"` (default, one track per row) or `"slope"`. */\n  variant?: string;\n  /** Pixel width when `fit="fixed"` (default). */\n  width?: number;\n  /** Default {@link DEFAULT_STEPS} for most data; the definition default is `5`. Default: `5`. */\n  steps?: number;',
          ),
        },
      }, // the "(default)" marks; a non-literal mark and a non-literal first statement are passed over
    ],
    fail: [
      {
        files: {
          [SNAPSHOT]: snapshot({ animationDuration: num(1100) }),
          [MODULE]: props(
            "  /** Entry animation, ms. Default: 1500 */\n  animationDuration?: number;",
          ),
        },
      }, // F36: Candlestick documented 1500 against 1100
      {
        files: {
          [SNAPSHOT]: snapshot({
            wick: { kind: "color", default: "var(--chart-foreground)", group: null },
          }),
          [MODULE]: props("  /** Body. */\n  body?: string;").replace(
            '`"var(--chart-foreground)"`',
            "var(--foreground)",
          ),
        },
      }, // F36: a loading stroke naming the wrong token, in a base the props interface extends
      {
        files: {
          [SNAPSHOT]: snapshot({}, { codeOnlyDefaults: { reveal: false } }),
          [MODULE]: props("  /** Defaults to true (dashboards opt out). */\n  reveal?: boolean;"),
        },
      }, // a code-only default
      {
        files: {
          [SNAPSHOT]: snapshot({ placement: { kind: "enum", default: "outside", group: null } }),
          [MODULE]: props(
            '  /** `"inside"` (default) overlaps the ticks; `"outside"` sits beyond them. */\n  placement?: string;',
          ),
        },
      }, // a literal marked "(default)" that is not the default
      {
        files: {
          [SNAPSHOT]: snapshot({ higherIsBetter: { kind: "boolean", default: true, group: null } }),
          [MODULE]: props(
            "  /** Higher reads better (default `false`). */\n  higherIsBetter?: boolean;",
          ),
        },
      }, // "(default `x`)" that is not the default
      {
        files: {
          [SNAPSHOT]: snapshot({ steps: num(5) }),
          [MODULE]: props(
            "  /** Default {@link DEFAULT_STEPS} for most data. Default: `7` when dense. */\n  steps?: number;",
          ),
        },
      }, // the first statement names no literal; the next one is read, and it drifts
      {
        files: {
          [SNAPSHOT]: snapshot({ animationDuration: num(1100) }),
          [MODULE]: "export type CandlestickChartProps = { animationDuration?: number };",
        },
      }, // the module no longer declares `CandlestickChartProps` as an interface: said, not skipped
      {
        files: {
          [SNAPSHOT]: snapshot({ animationDuration: num(1100) }),
          [MODULE]:
            "interface CandlestickBaseProps {\n  /** Entry animation, ms. Default: 1500 */\n  animationDuration?: number;\n}\ntype CandlestickXorProp =\n  | { xDataKey: string; x?: string }\n  | { xDataKey?: string; x: string };\nexport type CandlestickChartProps = CandlestickBaseProps & CandlestickXorProp;",
        },
      }, // review F7: drift through `Base & Pair` is still caught (1500 documented against 1100)
      {
        files: {
          [SNAPSHOT]: snapshot({ animationDuration: num(1100) }),
          [MODULE]:
            'interface CandlestickBaseProps {\n  /** Entry animation, ms. Default: 1500 */\n  animationDuration?: number;\n  k?: string;\n}\ntype CandlestickXorProp =\n  | { xDataKey: string; x?: string }\n  | { xDataKey?: string; x: string };\nexport type CandlestickChartProps = Omit<CandlestickBaseProps, "k"> & CandlestickXorProp;',
        },
      }, // review F7: `Omit<Base, "k">` unwraps inside an intersection member too, and the drift
      // underneath it is still caught
      {
        files: {
          [SNAPSHOT]: snapshot({ animationDuration: num(1100) }),
          [MODULE]:
            "export type CandlestickChartProps = CandlestickExternalA & CandlestickExternalB;",
        },
      }, // review F7: an intersection that resolves to no members at all (every part opaque) is
      // a finding — "this module's TSDoc could not be read" — never a silent pass
      {
        files: {
          [SNAPSHOT]: snapshot({ animationDuration: num(1100) }),
          [MODULE]:
            "interface CandlestickCommonProps {\n  gap?: number;\n}\ninterface CandlestickBaseProps {\n  /** Entry animation, ms. Default: 1500 */\n  animationDuration?: number;\n}\ninterface CandlestickAltProps {\n  /** Entry animation, ms. Default: 1100 */\n  animationDuration?: number;\n}\ntype CandlestickXorProp = CandlestickBaseProps | CandlestickAltProps;\nexport type CandlestickChartProps = CandlestickCommonProps & CandlestickXorProp;",
        },
      }, // RM-196 F2 review R2-6: the PASS fixture above (same union-of-INTERFACE-REFERENCES
      // shape) proves this path does not crash, but not that it is actually READ — with the
      // FIRST branch's `animationDuration` correctly matching 1100, skipping the whole
      // `visitType(reference)` call still gives `members.get("animationDuration") ===
      // undefined`, and the rule's own `if (!stated || …) continue;` guard treats a missing
      // member as nothing to check, so 0 findings either way. Documenting the first branch's
      // default as 1500 against a 1100 definition default breaks that: reading the branch is
      // now the ONLY way to catch the drift, so a "0 findings" wrong pass here can only come
      // from `visitType(reference)` being skipped — proven by mutation (comment out that
      // call and this fixture goes from `fail` to `pass`), not merely fixture coverage.
      { files: { [MODULE]: "export {};" } }, // no snapshot
    ],
  },
};
