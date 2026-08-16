/**
 * @elabs-ai/components-eslint-config — local rules that enforce the brand-ui TAXONOMY at the
 * CONSUMER's point of action (the apps coding-agents build), where the repo's
 * internal ratchets (scripts/check-text-scale.mjs, scripts/check-raw-palette.mjs)
 * do NOT reach. They run in the edit→lint loop, so an agent sees the violation
 * immediately and self-corrects.
 *
 * Two rules, both pointed at the system you already ship:
 *   - `no-raw-font-size` — "type is a role, not a size": flags raw `text-2xl` /
 *     `text-[18px]` and names the `text-<role>` utility (display / title /
 *     subtitle / body / caption / meta / kpi / code) or the <Heading>/<Text>
 *     components to use instead. Kills the "no sense for font sizes" chaos.
 *   - `no-raw-color` — "colour is a token, not a palette": flags raw Tailwind
 *     palette (`text-gray-500`, `bg-red-500`) and arbitrary colour values
 *     (`text-[#fff]`, `bg-[oklch(...)]`) and points at the semantic tokens
 *     (`text-foreground`, `text-muted-foreground`, `bg-primary` +
 *     `text-primary-foreground`, `bg-success/10`, …). Raw colour bypasses every
 *     theme (light, dark) and breaks contrast.
 *
 * Detection mirrors scripts/check-raw-palette.mjs (RAW_PALETTE_RE) so the two
 * surfaces agree. Inspects `className`/`class` attributes and class-utility
 * calls (`cn` / `clsx` / `cx` / `cva` / `twMerge`). Messages only (no autofix)
 * — the right role/token is context-dependent; the agent applies it.
 */

// ── Patterns ────────────────────────────────────────────────────────────────

/** Named Tailwind font-size: text-xs|sm|base|lg|xl|2xl…9xl (NOT text-<role>, not colours). */
const FONT_SIZE_NAMED_RE = /^-?text-(?:xs|sm|base|lg|xl|[0-9]+xl)$/;
/** Arbitrary font-size: text-[18px] / text-[1.25rem] (a length inside the brackets). */
const FONT_SIZE_ARBITRARY_RE =
  /^-?text-\[[^\]]*(?:px|rem|em|ex|ch|vw|vh|vmin|vmax|pt|pc)\b[^\]]*\]$/;

/** Raw Tailwind PALETTE colour (aligned with scripts/check-raw-palette.mjs). */
const PALETTE_RE =
  /^-?(?:text|bg|border|fill|stroke|ring|from|via|to|outline|decoration|accent|caret|shadow|divide|placeholder)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d{1,3})?$/;
/** Arbitrary colour value: prefix-[#… | rgb(…) | hsl(…) | oklch(…) | …]. */
const COLOR_ARBITRARY_RE =
  /^-?(?:text|bg|border|fill|stroke|ring|from|via|to|outline|decoration|accent|caret|shadow|divide|placeholder)-\[\s*(?:#|rgb|hsl|hwb|oklch|oklab|lab|lch|color\b)/i;

/** Nearest type role to suggest for each named size (a hint, not a hard mapping). */
function roleForSize(cls) {
  const size = cls.replace(/^-?text-/, "");
  if (size === "xs") return "text-meta or text-caption";
  if (size === "sm") return "text-body";
  if (size === "base") return "text-subtitle";
  if (size === "lg" || size === "xl") return "text-title";
  return "text-display or text-kpi"; // 2xl and up
}

/** Class-utility calls whose string arguments are class lists. */
const CLASS_FNS = new Set(["cn", "clsx", "cx", "classNames", "twMerge", "tw", "cva"]);

// ── String extraction (className value / class-utility args) ─────────────────

/**
 * Yield { value, node } for every static class STRING reachable from `node`,
 * WITHOUT descending into CallExpressions (those are handled by the
 * CallExpression visitor, so a `className={cn("…")}` is reported once).
 */
function* eachString(node) {
  if (!node) return;
  switch (node.type) {
    case "Literal":
      if (typeof node.value === "string") yield { value: node.value, node };
      return;
    case "TemplateLiteral":
      for (const q of node.quasis) yield { value: q.value.cooked ?? q.value.raw, node: q };
      for (const e of node.expressions) yield* eachString(e);
      return;
    case "ConditionalExpression":
      yield* eachString(node.consequent);
      yield* eachString(node.alternate);
      return;
    case "LogicalExpression":
      yield* eachString(node.left);
      yield* eachString(node.right);
      return;
    case "ArrayExpression":
      for (const el of node.elements) yield* eachString(el);
      return;
    case "ObjectExpression":
      // clsx({ "text-sm": cond }) → key is the class; cva variants → value is the class.
      for (const p of node.properties) {
        if (p.type === "Property") {
          yield* eachString(p.key);
          yield* eachString(p.value);
        }
      }
      return;
    default:
      return;
  }
}

// ── Rule factory ─────────────────────────────────────────────────────────────

function makeRule({ messageId, messages, test }) {
  return {
    meta: { type: "suggestion", docs: { recommended: false }, schema: [], messages },
    create(context) {
      function checkNode(strNode) {
        for (const { value, node } of eachString(strNode)) {
          for (const cls of value.split(/\s+/)) {
            if (!cls) continue;
            const data = test(cls);
            if (data) context.report({ node, messageId, data });
          }
        }
      }
      return {
        JSXAttribute(node) {
          const name = node.name && node.name.name;
          if (name !== "className" && name !== "class") return;
          const v = node.value;
          if (!v) return;
          if (v.type === "Literal") checkNode(v);
          else if (v.type === "JSXExpressionContainer") checkNode(v.expression);
        },
        CallExpression(node) {
          const callee = node.callee;
          const fn =
            callee.type === "Identifier"
              ? callee.name
              : callee.type === "MemberExpression" && callee.property.type === "Identifier"
                ? callee.property.name
                : null;
          if (!fn || !CLASS_FNS.has(fn)) return;
          for (const arg of node.arguments) checkNode(arg);
        },
      };
    },
  };
}

const noRawFontSize = makeRule({
  messageId: "rawFontSize",
  messages: {
    rawFontSize:
      'Type is a role, not a size — "{{cls}}" is a raw font size. Use a text-<role> utility ({{role}}) or a <Heading>/<Text> component. Raw sizes break the hierarchy and aren\'t theme-aware. See .claude/rules/styling-and-tokens.md (Typography scale).',
  },
  test: (cls) =>
    FONT_SIZE_NAMED_RE.test(cls) || FONT_SIZE_ARBITRARY_RE.test(cls)
      ? { cls, role: FONT_SIZE_NAMED_RE.test(cls) ? roleForSize(cls) : "a text-<role> utility" }
      : null,
});

const noRawColor = makeRule({
  messageId: "rawColor",
  messages: {
    rawColor:
      'Colour is a token, not a palette — "{{cls}}" is a raw colour. Use a semantic token (text-foreground, text-muted-foreground, bg-card, bg-primary + text-primary-foreground, bg-success/10, border-border, …). Raw palette/hex bypasses every theme (light, dark) and breaks contrast. See .claude/rules/styling-and-tokens.md.',
  },
  test: (cls) => (PALETTE_RE.test(cls) || COLOR_ARBITRARY_RE.test(cls) ? { cls } : null),
});

/** The flat-config plugin object. */
const plugin = {
  meta: { name: "@elabs-ai/components-eslint-config/brand", version: "0.1.0" },
  rules: {
    "no-raw-font-size": noRawFontSize,
    "no-raw-color": noRawColor,
  },
};

export default plugin;
// Named exports for the self-test.
export {
  FONT_SIZE_NAMED_RE,
  FONT_SIZE_ARBITRARY_RE,
  PALETTE_RE,
  COLOR_ARBITRARY_RE,
  noRawFontSize,
  noRawColor,
};
