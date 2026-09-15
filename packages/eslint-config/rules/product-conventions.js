/**
 * @elabs-ai/components-eslint-config — product-convention rules (plugin prefix `conventions`).
 *
 * Each rule encodes one line of `.claude/rules/conventions.md` so humans and coding agents get
 * the fix in the editor. They ship at "warn" in base.js/react.js; the `check` runner
 * (`scripts/check/rules/<id>.mjs`) runs them at error level against a per-file ratcheting
 * baseline. Messages only, no autofix — the right replacement is context-dependent.
 *
 * Class-string rules read `className` attributes and `cn`/`clsx`/`cva`/… calls (see
 * ./_class-units.js); the rest are JSX/AST rules.
 */
import { calleeName, classUnitVisitor, elementClassTokens, jsxName } from "./_class-units.js";

const meta = (messages) => ({
  type: "suggestion",
  docs: { recommended: false },
  schema: [],
  messages,
});

/** A rule that reports each offending token of every class unit. */
function tokenRule(messages, test) {
  return {
    meta: meta(messages),
    create(context) {
      return classUnitVisitor(context, (tokens) => {
        for (const t of tokens) {
          const hit = test(t);
          if (hit) context.report({ node: t.node, ...hit });
        }
      });
    },
  };
}

// ── 1. type-roles ────────────────────────────────────────────────────────────

const TYPE_NAMED_RE = /^-?text-(?:xs|sm|base|lg|xl|[0-9]+xl)(?:\/.+)?$/;
const TYPE_ARBITRARY_RE = /^-?text-\[[^\]]*\d(?:px|rem|em|pt)\][^\s]*$/;

export const typeRoles = tokenRule(
  {
    rawSize:
      '"{{cls}}" is a raw font size — type is a role: use text-display|title|subtitle|body|caption|meta|kpi|code (or <Heading>/<Text>).',
  },
  ({ cls, base }) =>
    TYPE_NAMED_RE.test(base) || TYPE_ARBITRARY_RE.test(base)
      ? { messageId: "rawSize", data: { cls } }
      : null,
);

// ── 2. radius-rungs ──────────────────────────────────────────────────────────

const RADIUS_ARBITRARY_RE = /^rounded(?:-(?:t|r|b|l|s|e|tl|tr|bl|br|ss|se|es|ee))?-\[(.+)\]$/;

export const radiusRungs = tokenRule(
  {
    arbitraryRadius:
      '"{{cls}}" is an ad-hoc radius — use the rounded-* scale (rounded-sm|md|lg|xl|full, rounded-control), which is backed by --radius.',
  },
  ({ cls, base }) => {
    const m = RADIUS_ARBITRARY_RE.exec(base);
    if (!m) return null;
    // `inherit` and token references have no scale equivalent and do not hardcode a value.
    if (/^(?:inherit|var\()/.test(m[1])) return null;
    return { messageId: "arbitraryRadius", data: { cls } };
  },
);

// ── 3. focus-ring-only ───────────────────────────────────────────────────────

const lastVariant = (t) => t.variants[t.variants.length - 1];

export const focusRingOnly = {
  meta: meta({
    handRolled:
      '"{{cls}}" hand-rolls the focus indicator — use focus-ring (focus-ring-within for a compound control, focus-ring-inset when clipped by overflow, focus-ring-static when focus is proxied).',
  }),
  create(context) {
    return classUnitVisitor(context, (tokens) => {
      const hasUtility = tokens.some((t) => /^focus-ring(?:-within|-inset|-static)?$/.test(t.base));
      for (const t of tokens) {
        const v = lastVariant(t);
        if (v !== "focus-visible" && v !== "focus") continue;
        const ringStack = /^ring-(?:ring|\d+)$/.test(t.base);
        const outlineOff = t.base === "outline-none" && !hasUtility;
        if (ringStack || outlineOff) {
          context.report({ node: t.node, messageId: "handRolled", data: { cls: t.cls } });
          return; // one report per class unit
        }
      }
    });
  },
};

// ── 4. disabled-recipe ───────────────────────────────────────────────────────
// House recipe (packages/ui/src/components): Button `disabled:pointer-events-none
// disabled:opacity-50`; Input `disabled:cursor-not-allowed disabled:opacity-50`. A dimmed
// disabled state must also stop interaction (pointer-events-none) or signal it
// (cursor-not-allowed). `disabled:opacity-100` is a reset inside a variant, not a dimming.

export const disabledRecipe = {
  meta: meta({
    unpaired:
      '"{{cls}}" dims a disabled control without the house recipe — pair it with disabled:pointer-events-none (Button) or disabled:cursor-not-allowed (Input).',
  }),
  create(context) {
    return classUnitVisitor(context, (tokens) => {
      const disabled = tokens.filter((t) => lastVariant(t) === "disabled");
      const dim = disabled.find((t) => /^opacity-(\d+)$/.test(t.base) && t.base !== "opacity-100");
      if (!dim) return;
      if (disabled.some((t) => t.base === "pointer-events-none" || t.base === "cursor-not-allowed"))
        return;
      context.report({ node: dim.node, messageId: "unpaired", data: { cls: dim.cls } });
    });
  },
};

// ── 5. no-fixed-trigger-width ────────────────────────────────────────────────

function fixedWidth(base) {
  let m = /^w-(\d+(?:\.\d+)?)$/.exec(base);
  if (m) return Number(m[1]) >= 24;
  m = /^w-\[(\d+(?:\.\d+)?)(px|rem)\]$/.exec(base);
  if (m) return m[2] === "px" ? Number(m[1]) >= 96 : Number(m[1]) >= 6;
  return false;
}

export const noFixedTriggerWidth = {
  meta: meta({
    fixedTrigger:
      '"{{cls}}" fixes a trigger\'s width — labels vary by locale and content; use min-w-* or w-full instead.',
  }),
  create(context) {
    return {
      JSXOpeningElement(node) {
        const slot = node.attributes.find(
          (a) => a.type === "JSXAttribute" && a.name?.name === "data-slot",
        );
        const slotValue =
          slot?.value?.type === "Literal"
            ? slot.value.value
            : slot?.value?.expression?.type === "Literal"
              ? slot.value.expression.value
              : "";
        const isTrigger =
          /Trigger$/.test(jsxName(node.name)) ||
          (typeof slotValue === "string" && slotValue.endsWith("-trigger"));
        if (!isTrigger) return;
        for (const t of elementClassTokens(node)) {
          if (fixedWidth(t.base))
            context.report({ node: t.node, messageId: "fixedTrigger", data: { cls: t.cls } });
        }
      },
    };
  },
};

// ── 6. logical-props ─────────────────────────────────────────────────────────

const LOGICAL = [
  [/^(-?)ml-(.+)$/, (m) => `${m[1]}ms-${m[2]}`],
  [/^(-?)mr-(.+)$/, (m) => `${m[1]}me-${m[2]}`],
  [/^pl-(.+)$/, (m) => `ps-${m[1]}`],
  [/^pr-(.+)$/, (m) => `pe-${m[1]}`],
  [/^(-?)left-(.+)$/, (m) => `${m[1]}start-${m[2]}`],
  [/^(-?)right-(.+)$/, (m) => `${m[1]}end-${m[2]}`],
  [/^border-l(-.+)?$/, (m) => `border-s${m[1] ?? ""}`],
  [/^border-r(-.+)?$/, (m) => `border-e${m[1] ?? ""}`],
  [/^rounded-l(-.+)?$/, (m) => `rounded-s${m[1] ?? ""}`],
  [/^rounded-r(-.+)?$/, (m) => `rounded-e${m[1] ?? ""}`],
  [/^rounded-tl(-.+)?$/, (m) => `rounded-ss${m[1] ?? ""}`],
  [/^rounded-tr(-.+)?$/, (m) => `rounded-se${m[1] ?? ""}`],
  [/^rounded-bl(-.+)?$/, (m) => `rounded-es${m[1] ?? ""}`],
  [/^rounded-br(-.+)?$/, (m) => `rounded-ee${m[1] ?? ""}`],
  [/^text-left$/, () => "text-start"],
  [/^text-right$/, () => "text-end"],
];

export const logicalProps = tokenRule(
  {
    physical:
      '"{{cls}}" is a physical direction — use the logical "{{fix}}" so the layout mirrors in RTL.',
  },
  ({ cls, base }) => {
    for (const [re, fix] of LOGICAL) {
      const m = re.exec(base);
      if (m) return { messageId: "physical", data: { cls, fix: fix(m) } };
    }
    return null;
  },
);

// ── 7. locale-formatting ─────────────────────────────────────────────────────

const LOCALE_METHODS = new Set(["toLocaleString", "toLocaleDateString", "toLocaleTimeString"]);
const DATE_STRING_METHODS = new Set(["toString", "toDateString", "toTimeString"]);

export const localeFormatting = {
  meta: meta({
    noLocale:
      "{{method}}() without a locale formats in the runtime's locale — use Intl.NumberFormat/DateTimeFormat with a locale prop (or pass the locale).",
    dateString:
      "new Date(…).{{method}}() renders an engine-specific, English-only string — use Intl.DateTimeFormat with a locale prop.",
  }),
  create(context) {
    const ancestorsOf = (node) =>
      context.sourceCode?.getAncestors?.(node) ?? context.getAncestors();
    return {
      CallExpression(node) {
        const method = calleeName(node.callee);
        if (node.callee.type !== "MemberExpression" || !method) return;
        if (LOCALE_METHODS.has(method)) {
          const first = node.arguments[0];
          if (!first || (first.type === "Identifier" && first.name === "undefined"))
            context.report({ node, messageId: "noLocale", data: { method } });
          return;
        }
        if (
          DATE_STRING_METHODS.has(method) &&
          node.callee.object.type === "NewExpression" &&
          node.callee.object.callee.type === "Identifier" &&
          node.callee.object.callee.name === "Date" &&
          ancestorsOf(node).some((a) => a.type === "JSXExpressionContainer")
        )
          context.report({ node, messageId: "dateString", data: { method } });
      },
    };
  },
};

// ── 8. i18n-strings ──────────────────────────────────────────────────────────

const TEXT_ATTRS = new Set(["aria-label", "title", "placeholder"]);
/** Worth translating: at least two consecutive letters (skips punctuation, numbers, "…", "x"). */
const hasWords = (s) => /\p{L}{2,}/u.test(s);

export const i18nStrings = {
  meta: meta({
    text: 'Hardcoded UI text "{{text}}" — take it from a prop/labels object so apps can localize it.',
    attr: 'Hardcoded {{attr}}="{{text}}" — take it from a prop/labels object so apps can localize it.',
  }),
  create(context) {
    const clip = (s) => (s.length > 40 ? `${s.slice(0, 39)}…` : s);
    return {
      JSXText(node) {
        const text = node.value.replace(/\s+/g, " ").trim();
        if (text && hasWords(text))
          context.report({ node, messageId: "text", data: { text: clip(text) } });
      },
      JSXAttribute(node) {
        const attr = node.name?.name;
        if (typeof attr !== "string" || !TEXT_ATTRS.has(attr) || !node.value) return;
        let text = null;
        const v = node.value;
        if (v.type === "Literal" && typeof v.value === "string") text = v.value;
        else if (v.type === "JSXExpressionContainer") {
          const e = v.expression;
          if (e.type === "Literal" && typeof e.value === "string") text = e.value;
          else if (e.type === "TemplateLiteral" && e.expressions.length === 0)
            text = e.quasis.map((q) => q.value.cooked).join("");
        }
        if (text && hasWords(text))
          context.report({ node, messageId: "attr", data: { attr, text: clip(text.trim()) } });
      },
    };
  },
};

// ── 9. forward-ref-required ──────────────────────────────────────────────────

const isFn = (n) =>
  n &&
  (n.type === "FunctionDeclaration" ||
    n.type === "FunctionExpression" ||
    n.type === "ArrowFunctionExpression");

/** `{ name, propsName }` when `fn` is a PascalCase component declared at module level. */
function componentInfo(fn) {
  let name = null;
  let exportedDirect = false;
  if (fn.type === "FunctionDeclaration" && fn.id) {
    name = fn.id.name;
    exportedDirect =
      fn.parent?.type === "ExportNamedDeclaration" ||
      fn.parent?.type === "ExportDefaultDeclaration";
  } else if (fn.parent?.type === "VariableDeclarator" && fn.parent.id.type === "Identifier") {
    name = fn.parent.id.name;
    exportedDirect = fn.parent.parent?.parent?.type === "ExportNamedDeclaration";
  }
  if (!name || !/^[A-Z]/.test(name)) return null;
  const p = fn.params[0];
  let propsName = null;
  let takesRef = false;
  if (p?.type === "Identifier") propsName = p.name;
  else if (p?.type === "ObjectPattern") {
    for (const prop of p.properties) {
      if (prop.type === "RestElement" && prop.argument.type === "Identifier")
        propsName = prop.argument.name;
      else if (
        prop.type === "Property" &&
        prop.key.type === "Identifier" &&
        prop.key.name === "ref"
      )
        takesRef = true;
    }
  }
  if (!propsName || takesRef) return null;
  return { name, exportedDirect, propsName };
}

export const forwardRefRequired = {
  meta: meta({
    wrap: "{{name}} spreads ...{{props}} onto a DOM element but is not wrapped in forwardRef — wrap it so callers can reach the DOM node.",
  }),
  create(context) {
    const ancestorsOf = (node) =>
      context.sourceCode?.getAncestors?.(node) ?? context.getAncestors();
    const exported = new Set();
    const reported = new Set();
    return {
      Program(program) {
        for (const stmt of program.body) {
          if (stmt.type === "ExportNamedDeclaration" && !stmt.declaration)
            for (const s of stmt.specifiers) if (s.local?.name) exported.add(s.local.name);
          if (stmt.type === "ExportDefaultDeclaration" && stmt.declaration.type === "Identifier")
            exported.add(stmt.declaration.name);
        }
      },
      JSXSpreadAttribute(node) {
        const opening = node.parent;
        if (opening?.type !== "JSXOpeningElement" || opening.name.type !== "JSXIdentifier") return;
        if (!/^[a-z]/.test(opening.name.name)) return; // DOM intrinsic only
        if (node.argument.type !== "Identifier") return;
        const ancestors = ancestorsOf(node);
        // Outermost function = the component candidate (inner functions are callbacks).
        const fn = ancestors.find(isFn);
        if (!fn || reported.has(fn)) return;
        const info = componentInfo(fn);
        if (!info || info.propsName !== node.argument.name) return;
        if (!info.exportedDirect && !exported.has(info.name)) return;
        reported.add(fn);
        context.report({
          node: fn.id ?? fn.parent.id ?? fn,
          messageId: "wrap",
          data: { name: info.name, props: info.propsName },
        });
      },
    };
  },
};

// ── 10. no-index-key-reorderable ─────────────────────────────────────────────

const MAP_METHODS = new Set(["map", "flatMap"]);

/** Is `callee object` a fixed-length placeholder list (`Array.from({length})`, `Array(n)`)? */
function isPlaceholderList(obj) {
  if (!obj) return false;
  if (obj.type === "ArrayExpression")
    return obj.elements.length === 1 && obj.elements[0]?.type === "SpreadElement"
      ? isPlaceholderList(obj.elements[0].argument)
      : false;
  const callee = obj.type === "CallExpression" || obj.type === "NewExpression" ? obj.callee : null;
  if (!callee) return false;
  if (callee.type === "Identifier" && callee.name === "Array") return true;
  return (
    callee.type === "MemberExpression" &&
    callee.object.type === "Identifier" &&
    callee.object.name === "Array" &&
    calleeName(callee) === "from"
  );
}

/** The map-callback index parameter an identifier resolves to, or null. */
function indexParamOf(context, ident) {
  const scope = context.sourceCode?.getScope?.(ident) ?? context.getScope();
  let s = scope;
  let variable = null;
  while (s && !variable) {
    variable = s.set.get(ident.name) ?? null;
    s = s.upper;
  }
  const def = variable?.defs[0];
  if (def?.type !== "Parameter" || !isFn(def.node)) return null;
  const fn = def.node;
  if (fn.params[1] !== def.name) return null;
  const call = fn.parent;
  if (call?.type !== "CallExpression" || call.arguments[0] !== fn) return null;
  if (!MAP_METHODS.has(calleeName(call.callee)) || call.callee.type !== "MemberExpression")
    return null;
  // `(_, i)` — the item is unused, so there is no stable identity to use instead.
  const item = fn.params[0];
  if (!item || (item.type === "Identifier" && item.name.startsWith("_"))) return null;
  if (isPlaceholderList(call.callee.object)) return null;
  return fn.params[1];
}

export const noIndexKeyReorderable = {
  meta: meta({
    indexKey:
      'key uses the map index "{{name}}" — reordering, inserting or removing items remounts the wrong rows; use a stable id from the item.',
  }),
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name?.name !== "key" || node.value?.type !== "JSXExpressionContainer") return;
        const e = node.value.expression;
        let idents = [];
        if (e.type === "Identifier") idents = [e];
        else if (e.type === "TemplateLiteral" && e.expressions.length > 0)
          idents = e.expressions.every((x) => x.type === "Identifier") ? e.expressions : [];
        else if (
          e.type === "CallExpression" &&
          e.callee.type === "Identifier" &&
          e.callee.name === "String" &&
          e.arguments[0]?.type === "Identifier"
        )
          idents = [e.arguments[0]];
        if (idents.length === 0) return;
        // Every interpolated identifier must be the index (a `${item.id}-${i}` key is stable).
        const resolved = idents.map((i) => indexParamOf(context, i));
        if (resolved.every(Boolean))
          context.report({ node, messageId: "indexKey", data: { name: idents[0].name } });
      },
    };
  },
};

// ── Plugin ───────────────────────────────────────────────────────────────────

const plugin = {
  meta: { name: "@elabs-ai/components-eslint-config/conventions", version: "0.1.0" },
  rules: {
    "type-roles": typeRoles,
    "radius-rungs": radiusRungs,
    "focus-ring-only": focusRingOnly,
    "disabled-recipe": disabledRecipe,
    "no-fixed-trigger-width": noFixedTriggerWidth,
    "logical-props": logicalProps,
    "locale-formatting": localeFormatting,
    "i18n-strings": i18nStrings,
    "forward-ref-required": forwardRefRequired,
    "no-index-key-reorderable": noIndexKeyReorderable,
  },
};

export default plugin;
