#!/usr/bin/env node
/**
 * Sanitizer-passthrough gate (#36, hardened by #75).
 *
 * WHY. `MarkdownView`/`MessageResponse` wrap Streamdown, which installs its
 * sanitiser chain (`rehype-raw` → `rehype-sanitize` → `rehype-harden`) as the
 * DEFAULT VALUE of its `rehypePlugins` prop — a plain JS default parameter, not
 * a merge. A wrapper that re-exports `ComponentProps<typeof Streamdown>` (or
 * `Omit`s everything EXCEPT `rehypePlugins`) hands every consumer a full XSS
 * bypass: pass that prop and Streamdown's sanitiser is gone, letting
 * model-authored markdown execute script in the host page. Every other repo
 * gate (`typecheck`, `lint`, `test`, `build`) was green over exactly that shape
 * — a type surface is not a security control. This gate is.
 *
 * SCOPE (narrowed by the PR #74 review, round 1). `dangerousProps` lists only
 * props that REPLACE the sanitiser itself. `remarkPlugins` is deliberately NOT
 * one: the remark stage runs upstream of the rehype chain, Streamdown derives
 * that chain without reading `remarkPlugins`, and everything a remark plugin
 * injects is still sanitised downstream (measured — see
 * `packages/ai/src/_streamdown-safety.ts`). Listing it here would gate a
 * capability, not a hazard.
 *
 * NOT MODELLED HERE — the `plugins` prop's trust boundary (#76). Streamdown
 * APPENDS `plugins.math.rehypePlugin` to the end of its rehype pipeline (it
 * runs AFTER the sanitiser) and never routes `plugins.mermaid` through the
 * pipeline at all (`dangerouslySetInnerHTML`). Those slots stay reachable ON
 * PURPOSE — they are a documented trusted-code seam, not a passthrough to
 * close — so they are defended by a runtime dev-warning
 * (`warnOnTrustedPluginSlots`), by `docs/CSP-AND-NETWORK.md`, and by tests that
 * pin the slot OPEN. They are a different concept from `dangerousProps`: a
 * *trust boundary* rather than a *forbidden prop*. If a future renderer needs
 * that concept enforced mechanically, add it as a separate `trustBoundaryProps`
 * field with its own channel — do not fold it into `dangerousProps`, which
 * means "strip this, always".
 *
 * WHAT IT CHECKS. Five channels, plus two whole-repo invariants.
 *
 *   0. BINDING RESOLUTION (fail-closed, #75 item 1 — the load-bearing one).
 *      Every module that references the renderer's module specifier at all —
 *      named, aliased, default, namespace or dynamic `import()` — must yield a
 *      resolvable local binding for the renderer. A module that references it,
 *      contains JSX, and yields NO binding is itself a finding: silence is not
 *      evidence of safety. Grandfathered cases live in `UNRESOLVED_BASELINE`
 *      (a ratchet: it may only shrink).
 *   1. TYPE LEVEL — every props expression for the renderer must sit inside an
 *      `Omit<…, …>` naming every `dangerousProps` key. The expressions are
 *      `ComponentProps<typeof <any resolved binding>>`,
 *      `ComponentProps<<namespace alias>["<Component>"]>`, AND the renderer's
 *      own exported props type alias (`StreamdownProps`) — the last one is
 *      evasion A, which the pre-#75 literal-string match could not see. A
 *      single-property indexed access (`…>["components"]`) is exempt.
 *   2. RUNTIME LEVEL — a `<Renderer … {...anything}>` spread must be preceded
 *      by `stripSanitizerOverrides(<that identifier>)` (or an inline delete of
 *      every dangerous key off it). The identifier is whatever the code
 *      actually spreads, not the literal `props` (evasion B). The search window
 *      is bounded to the nearest preceding declaration of that identifier —
 *      i.e. roughly the enclosing function — so a compliant wrapper earlier in
 *      the file cannot vouch for a non-compliant one later (channel G).
 *   3. EXPLICIT PROP — a literal `rehypePlugins={…}` attribute on a renderer
 *      tag, outside the named `explicitPropAllowlist`. This is the channel that
 *      catches "I never spread anything, I just set the prop".
 *   4. KEY-LIST PARITY — this table's `dangerousProps` must equal the runtime
 *      helper's own `SANITIZER_OVERRIDE_KEYS`, in BOTH directions. Removing a
 *      key from either side fails. If the array literal cannot be located at
 *      all, that is a finding too (the gate refuses rather than assuming).
 *   5. ALIAS REALITY — every `propsTypeAliases` entry must actually be exported
 *      by the installed renderer's `.d.ts`. A rename upstream would otherwise
 *      quietly widen channel 1's blind spot back open.
 *
 * ADDING A FUTURE SAFE-BY-DEFAULT RENDERER: add a row to SAFE_RENDERERS — and
 * then check the row's assumptions, because a row is NOT self-sufficient. It
 * needs `propsTypeAliases` that really exist in that package's `.d.ts`, a
 * `runtimeGuard` pointing at the module whose key list must stay in parity, and
 * an `explicitPropAllowlist` (possibly empty). Channel 0's binding resolver is
 * generic, but it recognises a fixed set of import forms; a renderer reached
 * some other way will surface as `unresolved-renderer-binding`, which is the
 * intended failure mode, not a bug to route around.
 *
 * HONEST LIMITS. This is a text scan, not a type checker or an AST walk.
 *   - It resolves the import forms enumerated in `resolveRendererBindings`
 *     (named / aliased / default / namespace / dynamic-import + a member or
 *     destructured binding off one of those). Anything else is reported as
 *     unresolved rather than skipped — that is the #75 fix — but "reported"
 *     is not "understood".
 *   - Channel 2's window is heuristic (nearest preceding declaration of the
 *     spread identifier). It cannot see through a helper function that does the
 *     stripping on the caller's behalf, and it will accept a strip call that is
 *     in the window but on an unreachable branch.
 *   - Channel 0 fires only on a module that NAMES the specifier somewhere it can
 *     see (`from "streamdown"`, `import("streamdown")`, `require("streamdown")`).
 *     A module that reaches the package through a computed string, or through a
 *     local re-export barrel that itself passes this gate, is invisible to it.
 *   - Comments and import statements are masked before scanning, by regex, not
 *     by a tokenizer.
 *   - It proves the shipped wrappers close both halves of the passthrough and
 *     that no in-tree module reaches the renderer through an indirection this
 *     script cannot follow. It does not prove every conceivable indirection is
 *     understood.
 *
 * Usage: node scripts/check-sanitizer-passthrough.mjs [root]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { distributablePackages, REPO_ROOT } from "./lib/distributables.mjs";

/**
 * Renderers this repo wraps that ship a sanitiser as a DELETABLE prop default.
 *
 * `dangerousProps` — props that REPLACE the sanitiser; they are stripped at
 * runtime and `Omit`ed from the wrapper's public type.
 * `propsTypeAliases` — the package's own exported props type. A wrapper can
 * re-export the whole surface through this alias without ever writing
 * `ComponentProps<typeof …>` (evasion A).
 * `runtimeGuard` — the module whose key list must stay equal to
 * `dangerousProps`, in both directions.
 * `explicitPropAllowlist` — reviewed call sites that legitimately set a
 * dangerous prop. Each entry carries a written reason and a site ceiling.
 */
export const SAFE_RENDERERS = [
  {
    module: "streamdown",
    component: "Streamdown",
    dangerousProps: ["rehypePlugins"],
    propsTypeAliases: ["StreamdownProps"],
    runtimeGuard: {
      file: "packages/ai/src/_streamdown-safety.ts",
      constName: "SANITIZER_OVERRIDE_KEYS",
    },
    explicitPropAllowlist: [
      {
        file: "packages/editor/src/markdown-preview/markdown-preview.tsx",
        prop: "rehypePlugins",
        sites: 2,
        // REASON (reviewed): `MarkdownPreview` renders AUTHOR-owned repo files,
        // not model output, and its array is Streamdown's OWN chain rebuilt
        // from the package's exported `defaultRehypePlugins` —
        // `[defaults.raw, <extended sanitize>, defaults.harden]`. The sanitiser
        // is extended (extra `src` protocols for `data:`/`blob:` repo assets,
        // plus the brand-directive tag/attribute allowances a custom
        // `rehypePlugins` array bypasses the `allowedTags` merge for), never
        // removed. If this file ever stops spreading `defaultRehypePlugins`'
        // `raw`/`sanitize`/`harden` members, this allowance is void.
        reason:
          "rebuilds streamdown's own raw → sanitize → harden chain from " +
          "defaultRehypePlugins, extending the sanitize schema rather than " +
          "replacing the pipeline (see the block comment at its definition)",
      },
    ],
  },
];

/**
 * Modules that reference a safe renderer but whose binding this script cannot
 * resolve, grandfathered so channel 0 could be turned on fail-closed without a
 * flag day. **A ratchet: entries may only be removed.**
 *
 * It is EMPTY, and that is the point — every in-tree `<Streamdown>` renderer
 * resolves today, including
 * `packages/viewer/src/adapters/markdown/markdown-adapter.tsx`, which reaches
 * the component through `import type * as …` plus a dynamic `import()` and was
 * silently skipped by every version of this gate before #75.
 *
 * Adding an entry means "this module reaches a renderer in a way the gate
 * cannot follow, and we accept that". It needs a written reason here AND the
 * self-test's emptiness assertion updated deliberately.
 */
export const UNRESOLVED_BASELINE = {
  // "packages/<pkg>/src/<file>.tsx": "why the binding cannot be resolved",
};

const isOurSource = (p) =>
  /\.(tsx?|jsx?)$/.test(p) && !/\.(test|stories)\.[jt]sx?$/.test(p) && !p.endsWith(".d.ts");

function walk(dir, test, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".turbo" || entry.name === "dist")
        continue;
      walk(p, test, out);
    } else if (test(p)) out.push(p);
  }
  return out;
}

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
/** Replace a matched span with same-length blanks so indices stay aligned. */
const blank = (s) => s.replace(/[^\n]/g, " ");
/** 1-based line number of a character offset. */
export const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/**
 * Blank out comments (index-preserving) so a prose mention of a props alias in
 * a TSDoc block cannot masquerade as a type passthrough. Regex, not a
 * tokenizer: the `[^:\\]` guard keeps `https://` inside a string from being
 * read as a line comment, which covers every case in this repo.
 */
export function maskComments(text) {
  let out = text.replace(/\/\*[\s\S]*?\*\//g, blank);
  out = out.replace(/(^|[^:\\])\/\/[^\n]*/g, (m, p1) => p1 + blank(m.slice(p1.length)));
  return out;
}

/** Blank out import/export-from statements (index-preserving). */
export function maskImports(text) {
  return text
    .replace(/^[ \t]*(?:import|export)[ \t][^;]*?from[ \t]*["'][^"']+["'][ \t]*;?/gm, blank)
    .replace(/^[ \t]*import[ \t]*["'][^"']+["'][ \t]*;?/gm, blank);
}

/** Does this module reference `moduleName` at all — statically or dynamically? */
export function referencesModule(text, moduleName) {
  const m = esc(moduleName);
  return (
    new RegExp(`from\\s*["']${m}["']`).test(text) ||
    new RegExp(`import\\s*\\(\\s*["']${m}["']\\s*\\)`).test(text) ||
    new RegExp(`require\\s*\\(\\s*["']${m}["']\\s*\\)`).test(text) ||
    new RegExp(`^[ \\t]*import[ \\t]*["']${m}["']`, "m").test(text)
  );
}

/** Kept for callers/tests that only care about the plain named-import form. */
export function importsComponent(text, moduleName, component) {
  return resolveRendererBindings(text, { module: moduleName, component }).bindings.includes(
    component,
  );
}

/**
 * Does this module contain anything that could render an element?
 *
 * The JSX arm is gated on the file extension ON PURPOSE: `Partial<StreamdownTranslations>`
 * in a `.ts` file is a type argument, not an element, and TypeScript will not parse JSX
 * out of a `.ts` file at all. Without the gate, `_streamdown-i18n.ts` reads as "renders
 * elements" and channel 0 reports a module that cannot render anything.
 */
export function rendersElements(text, filePath = "") {
  const jsxCapable = /\.[jt]sx$/.test(filePath);
  return (
    (jsxCapable && /<[A-Z][\w$]*(?:\.[A-Z][\w$]*)?[\s/>]/.test(text)) ||
    /createElement\s*\(/.test(text)
  );
}

/**
 * Channel 0. Resolve every local name that refers to the renderer component,
 * plus the local names of its props type alias and of the module namespace.
 *
 * Recognised forms (this list IS the gate's resolution contract — anything
 * outside it is reported as unresolved, never skipped):
 *   `import { Streamdown } from "m"`            → binding `Streamdown`
 *   `import { Streamdown as SD } from "m"`      → binding `SD`
 *   `import Streamdown from "m"`                → binding `Streamdown`
 *   `import * as NS from "m"` (incl. `type`)    → namespace `NS`
 *   `x = await import("m")` / `x ??= …`         → namespace `x`
 *   `type M = typeof NS`                        → type namespace `M`
 *   `const X = NS.Streamdown` / `NS?.Streamdown`→ binding `X`
 *   `const { Streamdown: X } = NS`              → binding `X`
 *   `<NS.Streamdown …>`                         → binding `NS.Streamdown`
 */
export function resolveRendererBindings(text, renderer) {
  const { module: moduleName, component } = renderer;
  const aliases = toArray(renderer.propsTypeAliases);
  const bindings = new Set();
  const propsAliases = new Set();
  const namespaces = new Set();
  const typeNamespaces = new Set();

  // ── static imports ───────────────────────────────────────────────────────
  const importRe = new RegExp(
    `import\\s+(?:type\\s+)?([^;]*?)\\s*from\\s*["']${esc(moduleName)}["']`,
    "g",
  );
  let im;
  while ((im = importRe.exec(text))) {
    const clause = im[1];
    const nsMatch = clause.match(/(?:^|,)\s*(?:type\s+)?\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (nsMatch) namespaces.add(nsMatch[1]);

    const namedMatch = clause.match(/\{([\s\S]*)\}/);
    if (namedMatch) {
      for (const raw of namedMatch[1].split(",")) {
        const spec = raw.replace(/\btype\b/g, "").trim();
        if (!spec) continue;
        const [imported, local] = spec.split(/\s+as\s+/).map((s) => s.trim());
        if (!imported) continue;
        if (imported === component) bindings.add(local || imported);
        if (aliases.includes(imported)) propsAliases.add(local || imported);
      }
    }

    // Default import: the leading identifier before any `{` or `*`.
    const defaultMatch = clause.match(/^\s*(?:type\s+)?([A-Za-z_$][\w$]*)\s*(?:,|$)/);
    if (defaultMatch && !/^\s*\{/.test(clause)) bindings.add(defaultMatch[1]);
  }

  // ── dynamic imports assigned to an identifier ────────────────────────────
  const dynRe = new RegExp(
    `(?:const|let|var)?\\s*([A-Za-z_$][\\w$]*)\\s*(?:\\?\\?=|=)\\s*(?:await\\s+)?import\\s*\\(\\s*["']${esc(
      moduleName,
    )}["']\\s*\\)`,
    "g",
  );
  let dm;
  while ((dm = dynRe.exec(text))) namespaces.add(dm[1]);

  // `type M = typeof NS` — the type-level echo of a namespace.
  for (const ns of [...namespaces]) {
    const aliasRe = new RegExp(`type\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*typeof\\s+${esc(ns)}\\b`, "g");
    let am;
    while ((am = aliasRe.exec(text))) typeNamespaces.add(am[1]);
  }

  // ── bindings taken off a namespace ───────────────────────────────────────
  for (const ns of namespaces) {
    const memberRe = new RegExp(
      `(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*(?::[^=;]*)?=\\s*${esc(ns)}\\s*\\??\\.\\s*${esc(
        component,
      )}\\b`,
      "g",
    );
    let mm;
    while ((mm = memberRe.exec(text))) bindings.add(mm[1]);

    const destructureRe = new RegExp(
      `(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*(?:await\\s+)?${esc(ns)}\\b`,
      "g",
    );
    let dsm;
    while ((dsm = destructureRe.exec(text))) {
      for (const raw of dsm[1].split(",")) {
        const spec = raw.trim();
        if (!spec) continue;
        const [imported, local] = spec.split(":").map((s) => s.trim());
        if (imported === component) bindings.add(local || imported);
      }
    }

    // `const { Streamdown } = await import("m")` — destructured straight off
    // the dynamic import, with no intermediate namespace variable.
    if (new RegExp(`<${esc(ns)}\\s*\\.\\s*${esc(component)}\\b`).test(text))
      bindings.add(`${ns}.${component}`);
  }

  const inlineDestructureRe = new RegExp(
    `(?:const|let|var)\\s*\\{([^}]*)\\}\\s*=\\s*await\\s+import\\s*\\(\\s*["']${esc(
      moduleName,
    )}["']\\s*\\)`,
    "g",
  );
  let idm;
  while ((idm = inlineDestructureRe.exec(text))) {
    for (const raw of idm[1].split(",")) {
      const spec = raw.trim();
      if (!spec) continue;
      const [imported, local] = spec.split(":").map((s) => s.trim());
      if (imported === component) bindings.add(local || imported);
    }
  }

  return {
    referenced: referencesModule(text, moduleName),
    bindings: [...bindings],
    propsAliases: [...propsAliases],
    namespaces: [...namespaces],
    typeNamespaces: [...typeNamespaces],
  };
}

/** The regex alternatives that denote "the renderer's whole props surface". */
function propsExpressionSources({ bindings, propsAliases, typeNamespaces, component }) {
  const pats = [];
  for (const b of toArray(bindings))
    pats.push(`(?:React\\.)?ComponentProps<\\s*typeof\\s+${esc(b)}\\s*>`);
  for (const ns of toArray(typeNamespaces).concat(toArray(bindings).map((b) => b.split(".")[0])))
    if (component)
      pats.push(`(?:React\\.)?ComponentProps<\\s*${esc(ns)}\\[["']${esc(component)}["']\\]\\s*>`);
  for (const a of toArray(propsAliases)) pats.push(`\\b${esc(a)}\\b`);
  return [...new Set(pats)];
}

/**
 * Channel 1 (TYPE LEVEL). Every props expression for the renderer that is NOT
 * a single-property indexed access (`…>["foo"]` — safe, extracts one member's
 * type only) must sit inside an `Omit<…, keys>` naming every dangerous prop.
 *
 * `bindings` accepts a single name or a list. `propsAliases`/`typeNamespaces`
 * widen the same check to the two shapes the pre-#75 literal match missed: the
 * package's own exported props alias, and `ComponentProps<NS["Component"]>`.
 */
export function findTypePassthroughs(
  text,
  bindings,
  dangerousProps,
  propsAliases = [],
  typeNamespaces = [],
  component = "",
) {
  const scan = maskImports(maskComments(text));
  const pats = propsExpressionSources({ bindings, propsAliases, typeNamespaces, component });
  if (!pats.length) return [];
  const exprSrc = `(?:${pats.join("|")})`;
  const problems = [];

  const omitRe = new RegExp(`Omit<\\s*${exprSrc}\\s*,\\s*((?:"[^"]*"|'[^']*'|\\s|\\|)+)>`, "g");
  const coveredRanges = [];
  let om;
  while ((om = omitRe.exec(scan))) {
    coveredRanges.push([om.index, om.index + om[0].length]);
    const keyList = om[1];
    const missing = dangerousProps.filter((p) => !new RegExp(`["']${esc(p)}["']`).test(keyList));
    if (missing.length) {
      problems.push({
        kind: "incomplete-omit",
        index: om.index,
        line: lineOf(scan, om.index),
        detail: `Omit<> exists but does not exclude: ${missing.join(", ")}`,
      });
    }
  }

  const exprRe = new RegExp(exprSrc, "g");
  let cm;
  while ((cm = exprRe.exec(scan))) {
    if (coveredRanges.some(([s, e]) => cm.index >= s && cm.index < e)) continue;
    const after = scan.slice(cm.index + cm[0].length).trimStart();
    if (after.startsWith("[")) continue;
    problems.push({
      kind: "raw-passthrough",
      index: cm.index,
      line: lineOf(scan, cm.index),
      detail: `\`${cm[0]}\` used without an Omit<> excluding ${dangerousProps.join(", ")}`,
    });
  }
  return problems;
}

/** Index just past the `>` that closes the opening tag starting at `start`. */
function openingTagEnd(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return i + 1;
  }
  return text.length;
}

/**
 * Channel 2's window (#75 channel G). The nearest preceding DECLARATION of the
 * spread identifier, so a compliant wrapper earlier in the same module cannot
 * vouch for a non-compliant one later. Falls back to the start of the file only
 * when no declaration can be found — the honest "we don't know" position.
 */
export function spreadSearchWindowStart(text, ident, tagIndex) {
  const id = esc(ident);
  // Every alternative must be a BINDING SITE, never a use. `\(\s*ident\s*[,)]` on its
  // own also matched the call `stripSanitizerOverrides(props)` — which moved the window
  // start PAST the very strip call it exists to find, so the two compliant wrappers in
  // this repo both reported as violations. The lookbehind is what separates
  // `(props) =>` (a parameter list) from `fn(props)` (a call).
  const declRe = new RegExp(
    [
      `\\.\\.\\.\\s*${id}\\b`, // rest parameter / rest destructure
      `\\b(?:const|let|var)\\s+${id}\\b`, // local declaration
      `\\bfunction\\b[^()]*\\(\\s*${id}\\b`, // named function's first parameter
      `(?<![\\w$.])\\(\\s*${id}\\s*[,)]`, // arrow/function parameter list, not a call
      `,\\s*${id}\\s*[,)]\\s*=>`, // later positional parameter of an arrow
    ].join("|"),
    "g",
  );
  const before = text.slice(0, tagIndex);
  let start = 0;
  let m;
  while ((m = declRe.exec(before))) start = m.index;
  return start;
}

/**
 * Channel 2 (RUNTIME LEVEL). A `<Renderer … {...x}>` element must be preceded —
 * within the window above — by `stripSanitizerOverrides(x)` or an inline
 * `delete x.<key>` for every dangerous prop. `Omit` alone is erased at compile
 * time; a JS consumer, an `any`, or a wider spread object still reaches the
 * renderer unless the runtime strip is there too.
 *
 * The spread identifier is whatever the code actually spreads — NOT the literal
 * `props`. Assuming `props` was evasion B, and the claim that "every wrapper in
 * this repo already follows" that convention was never checked.
 */
export function findUnstrippedSpreads(text, bindings, dangerousProps) {
  const scan = maskComments(text);
  const problems = [];
  for (const tag of toArray(bindings)) {
    const tagRe = new RegExp(`<${esc(tag)}(?![\\w$])`, "g");
    let tm;
    while ((tm = tagRe.exec(scan))) {
      const body = scan.slice(tm.index, openingTagEnd(scan, tm.index));
      const spreadRe = /\{\s*\.\.\.\s*\(?\s*([A-Za-z_$][\w$]*)/g;
      let sm;
      const seen = new Set();
      while ((sm = spreadRe.exec(body))) {
        const ident = sm[1];
        if (seen.has(ident)) continue;
        seen.add(ident);
        const win = scan.slice(spreadSearchWindowStart(scan, ident, tm.index), tm.index);
        const hasHelperCall = new RegExp(
          `stripSanitizerOverrides\\s*\\(\\s*${esc(ident)}\\s*\\)`,
        ).test(win);
        const hasInlineDeletes = dangerousProps.every((p) =>
          new RegExp(`delete\\s+${esc(ident)}(?:\\.${esc(p)}\\b|\\[["']${esc(p)}["']\\])`).test(
            win,
          ),
        );
        if (!hasHelperCall && !hasInlineDeletes) {
          problems.push({
            kind: "unstripped-spread",
            index: tm.index,
            line: lineOf(scan, tm.index),
            detail:
              `<${tag}> spreads {...${ident}} without a preceding ` +
              `stripSanitizerOverrides(${ident}) call (or an inline delete of every ` +
              `dangerous prop) inside the enclosing scope`,
          });
        }
      }
    }
  }
  return problems;
}

/**
 * Channel 3 (EXPLICIT PROP). A literal `rehypePlugins={…}` attribute written
 * straight onto a renderer tag. No spread, no props type — the shape neither of
 * the other two channels can see.
 */
export function findExplicitDangerousProps(text, bindings, dangerousProps) {
  const scan = maskComments(text);
  const problems = [];
  for (const tag of toArray(bindings)) {
    const tagRe = new RegExp(`<${esc(tag)}(?![\\w$])`, "g");
    let tm;
    while ((tm = tagRe.exec(scan))) {
      const body = scan.slice(tm.index, openingTagEnd(scan, tm.index));
      for (const prop of dangerousProps) {
        if (new RegExp(`(?:^|[\\s{])${esc(prop)}\\s*=`).test(body)) {
          problems.push({
            kind: "explicit-dangerous-prop",
            index: tm.index,
            line: lineOf(scan, tm.index),
            prop,
            detail: `<${tag}> sets \`${prop}\` literally, replacing the renderer's sanitiser chain`,
          });
        }
      }
    }
  }
  return problems;
}

/**
 * Channel 4a. Read the runtime helper's own key list. Returns `null` when the
 * array literal cannot be located — the caller turns that into a finding rather
 * than assuming parity, because "I could not find it" and "it matches" are not
 * the same state.
 */
export function readSanitizerOverrideKeys(text, constName = "SANITIZER_OVERRIDE_KEYS") {
  const m = new RegExp(`\\b${esc(constName)}\\s*(?::[^=]*)?=\\s*\\[([^\\]]*)\\]`).exec(text);
  if (!m) return null;
  return [...m[1].matchAll(/["']([^"']+)["']/g)].map((x) => x[1]);
}

/** Channel 4b. Set equality, in both directions. */
export function findKeyListParityProblems(guardText, renderer) {
  const keys = readSanitizerOverrideKeys(guardText, renderer.runtimeGuard.constName);
  if (keys === null) {
    return [
      {
        kind: "unreadable-runtime-guard",
        line: 1,
        detail:
          `could not locate the \`${renderer.runtimeGuard.constName}\` array literal — the gate ` +
          "refuses rather than assume the runtime strip still covers every dangerous prop",
      },
    ];
  }
  const declared = new Set(renderer.dangerousProps);
  const runtime = new Set(keys);
  const problems = [];
  for (const k of declared)
    if (!runtime.has(k))
      problems.push({
        kind: "key-list-parity",
        line: 1,
        detail: `\`${k}\` is in SAFE_RENDERERS.dangerousProps but NOT in ${renderer.runtimeGuard.constName}`,
      });
  for (const k of runtime)
    if (!declared.has(k))
      problems.push({
        kind: "key-list-parity",
        line: 1,
        detail: `\`${k}\` is in ${renderer.runtimeGuard.constName} but NOT in SAFE_RENDERERS.dangerousProps`,
      });
  return problems;
}

/**
 * Is `alias` actually EXPORTED by these type declarations? A bare `type Foo = …`
 * further up the file is not enough — a consumer can only reach the name if it
 * leaves the module, and it is the reachable name channel 1 keys on.
 */
export function isExportedType(dtsText, alias) {
  const a = esc(alias);
  if (new RegExp(`export\\s+(?:declare\\s+)?type\\s+${a}\\b`).test(dtsText)) return true;
  for (const m of dtsText.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}/g)) {
    if (new RegExp(`(?:^|,)\\s*(?:type\\s+)?${a}\\s*(?:as\\s+[\\w$]+\\s*)?(?:,|$)`).test(m[1]))
      return true;
  }
  return false;
}

/** Channel 5. Does the installed `.d.ts` still export every props alias? */
export function findPropsAliasDrift(dtsText, renderer) {
  const problems = [];
  for (const alias of toArray(renderer.propsTypeAliases)) {
    if (!isExportedType(dtsText, alias)) {
      problems.push({
        kind: "props-alias-drift",
        line: 1,
        detail:
          `\`${alias}\` is no longer exported by \`${renderer.module}\`'s type declarations — ` +
          "the type-level channel's alias arm is now checking a name that does not exist",
      });
    }
  }
  return problems;
}

/** Locate the installed renderer package's `.d.ts`, searching `root` then the repo. */
export function resolveRendererTypes(root, moduleName) {
  const bases = [];
  for (const base of [root, REPO_ROOT]) {
    bases.push(join(base, "node_modules", moduleName));
    const pkgsDir = join(base, "packages");
    if (existsSync(pkgsDir))
      for (const name of readdirSync(pkgsDir))
        bases.push(join(base, "packages", name, "node_modules", moduleName));
  }
  for (const dir of bases) {
    const pj = join(dir, "package.json");
    if (!existsSync(pj)) continue;
    let json;
    try {
      json = JSON.parse(readFileSync(pj, "utf8"));
    } catch {
      continue;
    }
    const rel = json.types ?? json.typings ?? json?.exports?.["."]?.types;
    if (typeof rel !== "string") continue;
    const dts = join(dir, rel);
    if (existsSync(dts)) return dts;
  }
  return null;
}

/** Scan every distributable package's `src/` for a passthrough of a safe renderer. */
export function scanPackages(root = REPO_ROOT) {
  const findings = [];
  const rel = (p) => relative(root, p).split(sep).join("/");

  for (const renderer of SAFE_RENDERERS) {
    // Channel 4 — key-list parity with the runtime helper.
    const guardPath = join(root, renderer.runtimeGuard.file);
    if (!existsSync(guardPath)) {
      findings.push({
        file: guardPath,
        rel: renderer.runtimeGuard.file,
        renderer: renderer.component,
        kind: "missing-runtime-guard",
        line: 1,
        detail: `${renderer.runtimeGuard.file} is missing — the runtime half of the #36 fix cannot be verified`,
      });
    } else {
      for (const p of findKeyListParityProblems(readFileSync(guardPath, "utf8"), renderer))
        findings.push({
          file: guardPath,
          rel: renderer.runtimeGuard.file,
          renderer: renderer.component,
          ...p,
        });
    }

    // Channel 5 — the props alias still exists upstream.
    const dts = resolveRendererTypes(root, renderer.module);
    if (!dts) {
      findings.push({
        file: renderer.module,
        rel: renderer.module,
        renderer: renderer.component,
        kind: "renderer-types-unresolved",
        line: 1,
        detail: `could not locate \`${renderer.module}\`'s type declarations (run \`pnpm install\`); the alias arm of the type check cannot be verified`,
      });
    } else {
      for (const p of findPropsAliasDrift(readFileSync(dts, "utf8"), renderer))
        findings.push({ file: dts, rel: renderer.module, renderer: renderer.component, ...p });
    }
  }

  for (const pkg of distributablePackages(root)) {
    for (const file of walk(join(pkg.dir, "src"), isOurSource)) {
      const relPath = rel(file);
      const text = readFileSync(file, "utf8");
      for (const renderer of SAFE_RENDERERS) {
        if (!referencesModule(text, renderer.module)) continue;
        const resolved = resolveRendererBindings(text, renderer);

        if (resolved.bindings.length === 0) {
          // A type-only import of something OTHER than the component (e.g. a
          // translations type) in a module that renders nothing cannot reach
          // the renderer — not a finding, and not a blind spot either.
          if (!rendersElements(text, file)) continue;
          if (relPath in UNRESOLVED_BASELINE) continue;
          findings.push({
            file,
            rel: relPath,
            renderer: renderer.component,
            kind: "unresolved-renderer-binding",
            line: 1,
            detail:
              `references "${renderer.module}" and renders elements, but no local binding for ` +
              `\`${renderer.component}\` could be resolved — the gate cannot prove this module ` +
              "does not pass the sanitiser through (see resolveRendererBindings for the forms " +
              "it understands)",
          });
          continue;
        }

        const problems = [
          ...findTypePassthroughs(
            text,
            resolved.bindings,
            renderer.dangerousProps,
            resolved.propsAliases,
            resolved.typeNamespaces.concat(resolved.namespaces),
            renderer.component,
          ),
          ...findUnstrippedSpreads(text, resolved.bindings, renderer.dangerousProps),
          ...findExplicitDangerousProps(text, resolved.bindings, renderer.dangerousProps),
        ];

        const allowed = (renderer.explicitPropAllowlist ?? []).filter((a) => a.file === relPath);
        for (const problem of problems) {
          if (problem.kind === "explicit-dangerous-prop") {
            const entry = allowed.find((a) => a.prop === problem.prop);
            if (entry) {
              const count = problems.filter(
                (p) => p.kind === "explicit-dangerous-prop" && p.prop === problem.prop,
              ).length;
              if (count <= entry.sites) continue;
              problem.detail =
                `${problem.detail} — the allowlist permits ${entry.sites} site(s) in this file, ` +
                `found ${count}. A new call site needs its own review, not a bumped ceiling.`;
            }
          }
          findings.push({ file, rel: relPath, renderer: renderer.component, ...problem });
        }
      }
    }
  }
  return findings;
}

// ───────────────────────── CLI ─────────────────────────
function main(root = REPO_ROOT) {
  const findings = scanPackages(root);
  if (findings.length) {
    console.error(`\n✖ sanitizer-passthrough: ${findings.length} finding(s):\n`);
    for (const f of findings) {
      console.error(`  - ${f.rel}:${f.line ?? 1} (${f.renderer}, ${f.kind}): ${f.detail}`);
    }
    console.error(
      "\nA wrapper around a safe-by-default renderer (Streamdown today) must:\n" +
        "  1. resolve to a binding this gate can follow (an exotic import form is a\n" +
        "     finding, not a pass — silence is not evidence of safety),\n" +
        "  2. Omit<> every dangerous prop (rehypePlugins for Streamdown) off every\n" +
        "     props expression, including the package's own StreamdownProps alias,\n" +
        "  3. call stripSanitizerOverrides(x) before spreading {...x} onto the renderer,\n" +
        "     in the SAME scope, so a JS consumer / `any` / wider spread can't reach it,\n" +
        "  4. never set a dangerous prop literally outside the reviewed allowlist, and\n" +
        "  5. keep SAFE_RENDERERS.dangerousProps equal to the runtime helper's own key list.\n" +
        "See packages/ai/src/_streamdown-safety.ts and issues #36 / #75.\n",
    );
    process.exit(1);
  }
  console.log(
    "✔ sanitizer-passthrough: every safe-renderer binding resolved; type + runtime + explicit-prop " +
      "channels clean; key-list parity and props-alias reality hold.",
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv[2] ? resolve(process.argv[2]) : REPO_ROOT);
}
