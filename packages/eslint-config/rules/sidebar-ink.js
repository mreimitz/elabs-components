/**
 * @elabs-ai/components-eslint-config — the sidebar chrome/canvas ink rule (#66, #50).
 *
 * Both issues were the SAME bug class: a `<Sidebar>`-family subtree (or any
 * element whose own `className` carries `bg-sidebar`) is a deliberately dark
 * CHROME ground (`--sidebar`, tuned separately from `--background`/`--card`),
 * but the text inside reached for a CANVAS ink token
 * (`text-foreground` / `text-muted-foreground` / `text-card-foreground`) that
 * is tuned against `--background`/`--card` instead. #66's heading was
 * `text-foreground` on `--sidebar` in `light` — 1.00:1 (`--foreground` and
 * `--sidebar` happen to share the same literal there), effectively invisible.
 * #50's description text was `text-muted-foreground` on `--sidebar` — ~2.29:1,
 * short of the 4.5:1 AA floor. Both fixes swap to the chrome-tuned
 * `text-sidebar-foreground` / `text-sidebar-muted-foreground`, which
 * `themes-contrast.test.ts` already asserts clear 4.5:1 against `--sidebar`.
 *
 * This rule catches the CLASS of bug, not just the two instances: any
 * canvas-ink class inside the Sidebar family (`<Sidebar>`, `<SidebarHeader>`,
 * `<SidebarContent>`, `<SidebarFooter>`, `<SidebarMenu*>`), or on any element
 * whose own `className` carries `bg-sidebar`, is flagged with the
 * `text-sidebar-*` replacement to reach for instead.
 *
 * "warn", not "error" — the same severity `brand/no-raw-font-size` and
 * `brand/no-raw-color` ship at in ./brand-tokens.js (see base.js): it is
 * non-breaking and surfaces the fix in the edit→lint loop for coding agents to
 * self-correct, without turning an unrelated PR's `pnpm lint` red the moment a
 * new violation is discovered elsewhere in the repo. See
 * .claude/rules/quality-gates.md "Enforcement over reminders" and
 * .claude/rules/styling-and-tokens.md "Surface separation".
 */

/** Canvas ink classes that must not appear inside sidebar chrome. */
const FORBIDDEN_INK = new Set(["text-foreground", "text-muted-foreground", "text-card-foreground"]);

/** The chrome-tuned replacement for each forbidden canvas-ink class. */
const REPLACEMENT = {
  "text-foreground": "text-sidebar-foreground",
  "text-muted-foreground": "text-sidebar-muted-foreground",
  "text-card-foreground": "text-sidebar-foreground",
};

/**
 * The `<Sidebar>` JSX component family: `Sidebar` itself, and
 * `SidebarHeader`/`SidebarContent`/`SidebarFooter`/`SidebarMenu*` (covers
 * `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuAction`,
 * `SidebarMenuBadge`, `SidebarMenuSub`, `SidebarMenuSubItem`,
 * `SidebarMenuSubButton`, and any future `SidebarMenu*` sibling).
 * Deliberately excludes `SidebarInset` (the canvas, not chrome) and
 * `SidebarGroup*` (structural — always nested inside one of the above, so the
 * ancestor walk below still reaches it).
 */
const SIDEBAR_FAMILY_RE = /^Sidebar(?:Header|Content|Footer|Menu\w*)?$/;

/**
 * Radix `*Content` components that render through a `Portal` (verified via
 * `grep -rl "Primitive.Portal" packages/ui/src/components`): at RUNTIME these
 * mount at `document.body`, painted on their own `bg-popover`/`bg-card`-style
 * surface, not on whatever `bg-sidebar` ancestor wraps them in the AUTHORED
 * JSX tree (e.g. a `TeamSwitcher`'s `<DropdownMenuContent>` nested inside
 * `<SidebarMenu>`). The ancestor walk below stops climbing the instant it
 * crosses one of these, so canvas ink legitimately used inside a portaled
 * menu/dialog/tooltip is not misflagged as sidebar-chrome ink.
 */
const PORTAL_BOUNDARY = new Set([
  "DrawerContent",
  "TooltipContent",
  "MenubarContent",
  "MenubarSubContent",
  "AlertDialogContent",
  "DropdownMenuContent",
  "DropdownMenuSubContent",
  "ContextMenuContent",
  "ContextMenuSubContent",
  "DialogContent",
  "PopoverContent",
  "SelectContent",
  "SheetContent",
]);

/** Class-utility calls whose string arguments are class lists (mirrors brand-tokens.js). */
const CLASS_FNS = new Set(["cn", "clsx", "cx", "classNames", "twMerge", "tw", "cva"]);

/**
 * Yield { value, node } for every static class STRING reachable from `node`
 * (className literal, template literal, conditional/logical branches, array/
 * object entries, and known class-utility calls) — a superset of
 * brand-tokens.js's `eachString` that also descends into CallExpressions,
 * since this rule reports per-attribute rather than per-string-literal.
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
      for (const p of node.properties) {
        if (p.type === "Property") {
          yield* eachString(p.key);
          yield* eachString(p.value);
        }
      }
      return;
    case "CallExpression": {
      const callee = node.callee;
      const fn =
        callee.type === "Identifier"
          ? callee.name
          : callee.type === "MemberExpression" && callee.property.type === "Identifier"
            ? callee.property.name
            : null;
      if (fn && CLASS_FNS.has(fn)) {
        for (const arg of node.arguments) yield* eachString(arg);
      }
      return;
    }
    default:
      return;
  }
}

/** The static class-list string(s) of a JSXOpeningElement's own className/class attribute. */
function ownClassNames(openingElement) {
  const attr = openingElement.attributes.find(
    (a) => a.type === "JSXAttribute" && (a.name?.name === "className" || a.name?.name === "class"),
  );
  if (!attr || !attr.value) return [];
  const valueNode =
    attr.value.type === "JSXExpressionContainer" ? attr.value.expression : attr.value;
  return [...eachString(valueNode)].map((s) => s.value);
}

/** The JSX tag name of an opening element, or null for a member/namespace name. */
function tagName(openingElement) {
  return openingElement.name?.type === "JSXIdentifier" ? openingElement.name.name : null;
}

/** Is this opening element itself sidebar chrome — family name, or own `bg-sidebar`? */
function isChromeElement(openingElement) {
  const name = tagName(openingElement);
  if (name && SIDEBAR_FAMILY_RE.test(name)) return true;
  return ownClassNames(openingElement).some((cls) => cls.split(/\s+/).includes("bg-sidebar"));
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      recommended: false,
      description:
        "Forbid canvas ink (text-foreground/text-muted-foreground/text-card-foreground) inside sidebar chrome (bg-sidebar).",
    },
    schema: [],
    messages: {
      canvasInkInChrome:
        '"{{cls}}" is canvas ink on the sidebar CHROME ground (bg-sidebar) — use "{{replacement}}" instead. Canvas ink is tuned against --background/--card, not --sidebar, and can fail contrast there (#66: 1.00:1, #50: ~2.29:1). See .claude/rules/styling-and-tokens.md "Surface separation".',
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        const name = node.name && node.name.name;
        if (name !== "className" && name !== "class") return;
        const opening = node.parent;
        if (!opening || opening.type !== "JSXOpeningElement") return;

        // Chrome if THIS element is chrome, or any ancestor JSXElement is.
        // NOTE: a JSXOpeningElement is a PROPERTY of its JSXElement
        // (`.openingElement`), not an ancestor node of that element's
        // children in the AST — so the ancestor walk matches on JSXElement
        // and reads `.openingElement` off it, rather than looking for
        // JSXOpeningElement nodes directly in the ancestor chain (which
        // would never match). Walk from the NEAREST ancestor outward
        // (getAncestors() returns outermost-first) and stop the instant a
        // PORTAL_BOUNDARY component is crossed — anything further out is
        // authored-tree-only, not runtime-DOM chrome.
        const ancestors = context.sourceCode?.getAncestors?.(node) ?? context.getAncestors();
        let chromeAncestor = false;
        for (let i = ancestors.length - 1; i >= 0; i--) {
          const a = ancestors[i];
          if (a.type !== "JSXElement") continue;
          const name = tagName(a.openingElement);
          if (name && PORTAL_BOUNDARY.has(name)) break;
          if (isChromeElement(a.openingElement)) {
            chromeAncestor = true;
            break;
          }
        }
        if (!chromeAncestor && !isChromeElement(opening)) return;

        const v = node.value;
        if (!v) return;
        const valueNode = v.type === "JSXExpressionContainer" ? v.expression : v;
        for (const { value, node: strNode } of eachString(valueNode)) {
          for (const cls of value.split(/\s+/)) {
            if (!FORBIDDEN_INK.has(cls)) continue;
            context.report({
              node: strNode,
              messageId: "canvasInkInChrome",
              data: { cls, replacement: REPLACEMENT[cls] },
            });
          }
        }
      },
    };
  },
};

/** The flat-config plugin object. */
const plugin = {
  meta: { name: "@elabs-ai/components-eslint-config/sidebar-a11y", version: "0.1.0" },
  rules: {
    "no-canvas-ink-in-sidebar": rule,
  },
};

export default plugin;
// Named exports for the self-test.
export { FORBIDDEN_INK, REPLACEMENT, SIDEBAR_FAMILY_RE, rule as noCanvasInkInSidebar };
