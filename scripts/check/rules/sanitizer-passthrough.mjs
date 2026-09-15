/**
 * sanitizer-passthrough — a wrapper around a safe-by-default markdown renderer cannot
 * hand consumers a sanitiser bypass (#36, hardened by #75).
 * Ported from scripts/check-sanitizer-passthrough.mjs (detection verbatim; I/O via ctx).
 *
 * WHY. Streamdown installs its sanitiser chain (`rehype-raw` → `rehype-sanitize` →
 * `rehype-harden`) as the DEFAULT VALUE of `rehypePlugins`. A wrapper that re-exports
 * `ComponentProps<typeof Streamdown>` lets any caller pass that prop and execute
 * model-authored script. typecheck/lint/test/build were all green over that shape.
 * `remarkPlugins` is deliberately NOT dangerous (runs upstream of the rehype chain; see
 * `packages/ai/src/_streamdown-safety.ts`). The `plugins` math/mermaid slots are a
 * documented trusted-code seam (#76), not a forbidden prop — do not fold them in here.
 *
 * CHANNELS. 0 binding resolution (fail-closed: a module that references the renderer,
 * renders, and yields no binding is a finding) · 1 type level (`Omit<>` every dangerous
 * prop off every props expression, including the `StreamdownProps` alias) · 2 runtime
 * (`stripSanitizerOverrides(x)` before `{...x}` / `createElement(Tag, x)`, within the
 * nearest preceding declaration of `x`) · 3 explicit prop outside the reviewed allowlist ·
 * 4 key-list parity with `SANITIZER_OVERRIDE_KEYS`, both directions · 5 every props alias
 * is really exported by the installed `.d.ts` (reads node_modules: needs `pnpm install`).
 *
 * HONEST LIMITS. A text scan, not an AST walk: it resolves the import forms listed in
 * `resolveRendererBindings` and reports anything else as unresolved; channel 2's window is
 * heuristic and cannot see a helper stripping on the caller's behalf; renders via
 * `cloneElement`, an object/array lookup, or a factory are not followed; a module reaching
 * the package through a computed string or a local re-export barrel is invisible. It
 * proves the shipped wrappers close both halves of the passthrough — not that every
 * conceivable indirection is understood. Adding a renderer row: check its
 * `propsTypeAliases`, `runtimeGuard` and `explicitPropAllowlist` really hold.
 */
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

  // ── transitive local rebinding: `const S2 = Streamdown;` ─────────────────
  // Channel 0 resolved the IMPORT, so `bindings` is non-empty and the fail-closed
  // net never fires — but a one-line rebind moves the render site to a tag name
  // channels 1–3 were not looking for. Iterated to a fixed point so a chain
  // (`const A = Streamdown; const B = A;`) resolves too.
  for (let pass = 0; pass < 8; pass += 1) {
    const before = bindings.size;
    for (const b of [...bindings]) {
      const rebindRe = new RegExp(
        `(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*(?::[^=;]*)?=\\s*${esc(b)}\\s*[;,\\n]`,
        "g",
      );
      let rb;
      while ((rb = rebindRe.exec(text))) bindings.add(rb[1]);
    }
    if (bindings.size === before) break;
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

/** End of a `createElement(` argument list: the matching close paren. */
function callArgsEnd(text, openParen) {
  let depth = 0;
  for (let i = openParen; i < text.length; i++) {
    const c = text[i];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return text.length;
}

/**
 * Every place `tag` is RENDERED, in either form the codebase can write it.
 *
 * Channel 0 follows the IMPORT; channels 2 and 3 have to follow the RENDER, and
 * for a while they only understood `<Tag …>`. A `createElement(Tag, props)` call
 * resolved its binding cleanly (so the fail-closed net stayed quiet) and then
 * passed the whole props object through a site nothing scanned. Returns
 * `{ index, body, isCall }`, where `body` is the JSX opening tag or the call's
 * argument list.
 */
function renderSites(scan, tag) {
  const sites = [];
  const jsxRe = new RegExp(`<${esc(tag)}(?![\\w$])`, "g");
  let jm;
  while ((jm = jsxRe.exec(scan)))
    sites.push({
      index: jm.index,
      body: scan.slice(jm.index, openingTagEnd(scan, jm.index)),
      isCall: false,
    });

  const callRe = new RegExp(`createElement\\s*\\(\\s*${esc(tag)}\\s*,`, "g");
  let cm;
  while ((cm = callRe.exec(scan))) {
    const open = scan.indexOf("(", cm.index);
    sites.push({
      index: cm.index,
      body: scan.slice(cm.index, callArgsEnd(scan, open)),
      isCall: true,
    });
  }
  return sites.sort((a, b) => a.index - b.index);
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
    for (const site of renderSites(scan, tag)) {
      const { index: tagIndex, body, isCall } = site;
      const idents = [];
      const spreadRe = /\{\s*\.\.\.\s*\(?\s*([A-Za-z_$][\w$]*)/g;
      let sm;
      while ((sm = spreadRe.exec(body))) idents.push([sm[1], `{...${sm[1]}}`]);
      // `createElement(Tag, props)` hands the whole object over with no spread
      // syntax at all — the second argument IS the props bag.
      if (isCall) {
        const bare = new RegExp(
          `createElement\\s*\\(\\s*${esc(tag)}\\s*,\\s*([A-Za-z_$][\\w$]*)\\s*[,)]`,
        ).exec(body);
        if (bare) idents.push([bare[1], `the props argument \`${bare[1]}\``]);
      }
      const seen = new Set();
      for (const [ident, shown] of idents) {
        if (seen.has(ident)) continue;
        seen.add(ident);
        const win = scan.slice(spreadSearchWindowStart(scan, ident, tagIndex), tagIndex);
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
            index: tagIndex,
            line: lineOf(scan, tagIndex),
            detail:
              `${isCall ? `createElement(${tag}, …)` : `<${tag}>`} passes ${shown} without a ` +
              `preceding stripSanitizerOverrides(${ident}) call (or an inline delete of every ` +
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
    for (const { index: tagIndex, body, isCall } of renderSites(scan, tag)) {
      for (const prop of dangerousProps) {
        // JSX writes `prop={…}`; a createElement props object writes `prop: …`.
        const assign = isCall ? `\\s*[:=]` : `\\s*=`;
        if (new RegExp(`(?:^|[\\s{,])${esc(prop)}${assign}`).test(body)) {
          problems.push({
            kind: "explicit-dangerous-prop",
            index: tagIndex,
            line: lineOf(scan, tagIndex),
            prop,
            detail:
              `${isCall ? `createElement(${tag}, …)` : `<${tag}>`} sets \`${prop}\` literally, ` +
              "replacing the renderer's sanitiser chain",
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

/** Locate the installed renderer's `.d.ts` (root node_modules, then each package's). */
export function resolveRendererTypes(ctx, moduleName) {
  const bases = [
    `node_modules/${moduleName}`,
    ...ctx.packages().map((p) => `${p.dir}/node_modules/${moduleName}`),
  ];
  for (const dir of bases) {
    const pj = `${dir}/package.json`;
    if (!ctx.exists(pj)) continue;
    let json;
    try {
      json = ctx.json(pj);
    } catch {
      continue;
    }
    const rel = json.types ?? json.typings ?? json?.exports?.["."]?.types;
    if (typeof rel !== "string") continue;
    const dts = `${dir}/${rel.replace(/^\.\//, "")}`;
    if (ctx.exists(dts)) return dts;
  }
  return null;
}

const OUR_SOURCE = [
  "**/*.{test,stories}.{ts,tsx,js,jsx}",
  "**/*.d.ts",
  "**/{node_modules,dist,.turbo}/**",
];

/** Every finding `{ file, line, msg }` across the distributable packages. */
export function scan(ctx) {
  const findings = [];
  const push = (file, renderer, p) =>
    findings.push({
      file,
      line: p.line ?? 1,
      msg: `${p.kind} (${renderer.component}): ${p.detail}`,
    });

  for (const renderer of SAFE_RENDERERS) {
    const guard = renderer.runtimeGuard.file;
    if (!ctx.exists(guard))
      push(guard, renderer, {
        kind: "missing-runtime-guard",
        detail: `${guard} is missing — the runtime half of the #36 fix cannot be verified`,
      });
    else
      for (const p of findKeyListParityProblems(ctx.readFile(guard), renderer))
        push(guard, renderer, p);

    const dts = resolveRendererTypes(ctx, renderer.module);
    if (!dts)
      push("package.json", renderer, {
        kind: "renderer-types-unresolved",
        detail: `could not locate \`${renderer.module}\`'s type declarations (run \`pnpm install\`); the alias arm of the type check cannot be verified`,
      });
    else for (const p of findPropsAliasDrift(ctx.readFile(dts), renderer)) push(dts, renderer, p);
  }

  for (const pkg of ctx.packages().filter((p) => p.distributable)) {
    for (const file of ctx.glob(`${pkg.dir}/src/**/*.{ts,tsx,js,jsx}`, { ignore: OUR_SOURCE })) {
      const text = ctx.readFile(file);
      for (const renderer of SAFE_RENDERERS) {
        if (!referencesModule(text, renderer.module)) continue;
        const resolved = resolveRendererBindings(text, renderer);

        if (resolved.bindings.length === 0) {
          // A type-only import in a module that renders nothing cannot reach the renderer.
          if (!rendersElements(text, file) || file in UNRESOLVED_BASELINE) continue;
          push(file, renderer, {
            kind: "unresolved-renderer-binding",
            detail:
              `references "${renderer.module}" and renders elements, but no local binding for ` +
              `\`${renderer.component}\` could be resolved — the gate cannot prove this module ` +
              "does not pass the sanitiser through (see resolveRendererBindings for the forms it understands)",
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

        const allowed = (renderer.explicitPropAllowlist ?? []).filter((a) => a.file === file);
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
          push(file, renderer, problem);
        }
      }
    }
  }
  return findings;
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const streamdown = SAFE_RENDERERS[0];
/**
 * A fixture tree: the runtime guard (channel 4 fails closed without it), an installed
 * streamdown `.d.ts` exporting `StreamdownProps` (channel 5), plus the planted files.
 * Every planted `packages/<pkg>/` gets a distributable package.json.
 */
function tree(files, { guardKeys = streamdown.dangerousProps, dts = true } = {}) {
  const out = {};
  if (guardKeys !== null)
    out[streamdown.runtimeGuard.file] =
      `const SANITIZER_OVERRIDE_KEYS = [${guardKeys.map((k) => `"${k}"`).join(", ")}] as const;\n`;
  if (dts) {
    out["node_modules/streamdown/package.json"] = JSON.stringify({ types: "./dist/index.d.ts" });
    out["node_modules/streamdown/dist/index.d.ts"] =
      typeof dts === "string"
        ? dts
        : "type StreamdownProps = {};\nexport { type StreamdownProps };\n";
  }
  Object.assign(out, files);
  for (const rel of Object.keys(out)) {
    const m = /^packages\/([^/]+)\//.exec(rel);
    if (m && !out[`packages/${m[1]}/package.json`])
      out[`packages/${m[1]}/package.json`] = JSON.stringify({ name: `@elabs-ai/${m[1]}` });
  }
  return { files: out };
}
const mod = (...lines) => tree({ "packages/fake/src/x.tsx": lines.join("\n") });
const IMPORT = 'import { Streamdown } from "streamdown";';

export default {
  id: "sanitizer-passthrough",
  scope: "packages",
  doc: 'Wrap a safe-by-default renderer (Streamdown) only with `Omit<…, "rehypePlugins">` on every props type and `stripSanitizerOverrides(props)` before spreading props onto it; never set `rehypePlugins` outside the reviewed allowlist.',
  baseline: "none",
  run: scan,
  fixtures: {
    pass: [
      tree({}),
      // clean wrapper: Omit<> + strip call
      mod(
        'import type { ComponentProps } from "react";',
        IMPORT,
        'export type GoodProps = Omit<ComponentProps<typeof Streamdown>, "rehypePlugins">;',
        "export const Good = ({ ...props }: GoodProps) => {",
        "  stripSanitizerOverrides(props);",
        "  return <Streamdown {...props} />;",
        "};",
      ),
      // inline deletes clear channel 2; an indexed access is exempt from channel 1
      mod(
        IMPORT,
        'type C = NonNullable<ComponentProps<typeof Streamdown>["components"]>;',
        'type P = ComponentProps<typeof Streamdown>["plugins"];',
        "export const Good = ({ ...props }) => {",
        "  delete props.rehypePlugins;",
        '  return <Streamdown data-slot="x" components={c} {...props} />;',
        "};",
      ),
      // an Omit<> around the package's own props alias
      mod(
        'import { Streamdown, type StreamdownProps } from "streamdown";',
        'export type Ok = Omit<StreamdownProps, "rehypePlugins">;',
        "/** Accepts StreamdownProps minus the sanitiser prop. */",
        "export const A = (p: Ok) => <Streamdown>{p.children}</Streamdown>;",
      ),
      // compliant createElement caller
      mod(
        IMPORT,
        "export const Good = (props) => {",
        "  stripSanitizerOverrides(props);",
        "  return createElement(Streamdown, props);",
        "};",
      ),
      // type-only i18n seam in a .ts file renders nothing
      tree({
        "packages/fake/src/i18n.ts":
          'import type { StreamdownTranslations } from "streamdown";\nexport type P = Partial<StreamdownTranslations>;\n',
      }),
      // a module that never references the renderer
      tree({
        "packages/fake/src/u.tsx": "export const U = ({ ...props }) => <div {...props} />;\n",
      }),
      // the reviewed markdown-preview allowlist: exactly 2 sites
      tree({
        [streamdown.explicitPropAllowlist[0].file]: [
          IMPORT,
          "export const A = () => <Streamdown rehypePlugins={p}>{md}</Streamdown>;",
          "export const B = () => <Streamdown rehypePlugins={p}>{md}</Streamdown>;",
        ].join("\n"),
      }),
      // tests and stories are not shipped
      tree({
        "packages/fake/src/x.test.tsx": `${IMPORT}\nexport type B = ComponentProps<typeof Streamdown>;`,
      }),
      // the adapter shape (type namespace + dynamic import + member binding), compliant
      mod(
        'import type * as StreamdownExports from "streamdown";',
        "type StreamdownModule = typeof StreamdownExports;",
        "let streamdown: StreamdownModule | undefined;",
        'async function load() { streamdown ??= await import("streamdown"); }',
        "export const View = ({ ...props }) => {",
        "  const Streamdown = streamdown?.Streamdown;",
        "  stripSanitizerOverrides(props);",
        "  return <Streamdown {...props} />;",
        "};",
      ),
    ],
    fail: [
      // channel 0: referenced, renders, unresolvable → fail closed
      mod(
        'import * as NS from "streamdown";',
        "const Renderer = pickRenderer(NS);",
        "export const Bad = ({ ...rest }) => <Renderer {...rest} />;",
      ),
      // channel 1: bare ComponentProps, incomplete Omit, alias (evasion A), namespace-indexed
      mod(
        IMPORT,
        "export type BadProps = ComponentProps<typeof Streamdown> & { loading?: boolean };",
        "export const A = () => <Streamdown />;",
      ),
      mod(
        IMPORT,
        'export interface BadProps extends Omit<ComponentProps<typeof Streamdown>, "components"> {}',
        "export const A = () => <Streamdown />;",
      ),
      mod(
        'import { Streamdown, type StreamdownProps } from "streamdown";',
        "export type BadA = StreamdownProps & { loading?: boolean };",
        "export const A = (p: BadA) => <Streamdown>{p.children}</Streamdown>;",
      ),
      mod(
        'import * as NS from "streamdown";',
        'export type Bad = ComponentProps<NS["Streamdown"]>;',
        "export const C = () => <NS.Streamdown />;",
      ),
      // channel 2: unstripped spread, renamed (evasion B), aliased import (D), namespace member (C)
      mod(IMPORT, 'export const Bad = ({ ...props }) => <Streamdown data-slot="x" {...props} />;'),
      mod(IMPORT, "export const Fine = ({ ...rest }) => <Streamdown {...rest} />;"),
      mod(
        'import { Streamdown as SD } from "streamdown";',
        "export const Bad = ({ ...props }) => <SD {...props} />;",
      ),
      mod(
        'import * as NS from "streamdown";',
        "export const C = ({ ...rest }) => <NS.Streamdown {...rest} />;",
      ),
      // channel G: a compliant wrapper cannot vouch for a later sibling
      mod(
        IMPORT,
        "export const Good = ({ ...props }) => {",
        "  stripSanitizerOverrides(props);",
        "  return <Streamdown {...props} />;",
        "};",
        "export const Bad = ({ ...props }) => <Streamdown {...props} />;",
      ),
      // render following: local rebind chain, createElement with the whole props bag
      mod(
        IMPORT,
        "const S2 = Streamdown;",
        "const S3 = S2;",
        "export const Bad = ({ ...props }) => <S3 {...props} />;",
      ),
      mod(IMPORT, "export const Bad = (props) => createElement(Streamdown, props);"),
      // channel 3: explicit prop, JSX and createElement key, and outside the allowlisted file
      mod(IMPORT, "export const Bad = () => <Streamdown rehypePlugins={mine}>{md}</Streamdown>;"),
      mod(IMPORT, "export const Bad = () => createElement(Streamdown, { rehypePlugins: [] });"),
      // allowlisted file, but a third site
      tree({
        [streamdown.explicitPropAllowlist[0].file]: [
          IMPORT,
          "export const A = () => <Streamdown rehypePlugins={p}>{md}</Streamdown>;",
          "export const B = () => <Streamdown rehypePlugins={p}>{md}</Streamdown>;",
          "export const C = () => <Streamdown rehypePlugins={p}>{md}</Streamdown>;",
        ].join("\n"),
      }),
      // reproduction E: the literal #36 hole, reopened
      mod(
        'import { Streamdown, type StreamdownProps } from "streamdown";',
        "export const Reopened = ({ ...rest }: StreamdownProps) => <Streamdown {...rest} />;",
      ),
      // channel 4: guard lost the key / is missing / is unreadable
      tree({}, { guardKeys: [] }),
      tree({}, { guardKeys: null }),
      tree({ [streamdown.runtimeGuard.file]: "export const NOTHING = 1;" }),
      // channel 5: alias renamed upstream / types not installed
      tree({}, { dts: "type StreamdownConfig = {};\nexport { type StreamdownConfig };\n" }),
      tree({}, { dts: false }),
    ],
  },
};
