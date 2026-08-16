// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- carry the `*?worker` ambient type into any program that imports this module (apps' tsc).
/// <reference path="../monaco-workers.d.ts" />
/**
 * Monaco web-worker wiring for Vite apps.
 *
 * Monaco runs language intelligence (TS/JS diagnostics, JSON schema, CSS/HTML
 * services) in web workers. This module registers a `MonacoEnvironment.getWorker`
 * factory using Vite's `?worker` import suffix, which makes Vite bundle each
 * worker entry. Import it ONCE at the app entry, before any editor mounts:
 *
 *   import "@qlik-coe-emea/qlabs-components-editor/monaco-environment";
 *
 * Without this, the editor still renders + highlights, but completions,
 * diagnostics and hovers are unavailable.
 *
 * NOTE: `?worker` is a Vite-only transform. Non-Vite consumers must provide
 * their own `self.MonacoEnvironment.getWorker(Url)` — see the package README.
 */
import type { Environment } from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

/**
 * Monaco mints its Trusted-Types policies through this hook when it is present
 * (`vs/base/browser/trustedTypes.js`, and the pre-bundled copy in
 * `vs/common/workers.js`), falling back to `trustedTypes.createPolicy` when it is
 * not. We supply it to **de-duplicate by name**.
 *
 * Why: `monaco-editor@0.55` ships the "mint `defaultWorkerFactory` at module
 * init" block TWICE, in two different source files —
 * `vs/base/browser/webWorkerFactory.js` (reached from `editorWorkerService`) and
 * `vs/common/workers.js` (the pre-bundled `createWebWorker` API surface reached
 * from `editor.api`). Both are in the main-thread graph, so both run. No bundler
 * can dedupe them: they are distinct source files, not one module resolved twice.
 *
 * Under `require-trusted-types-for 'script'` the second call is refused —
 * "a TrustedTypePolicy with that name already exists and the directive does not
 * contain 'allow-duplicates'" — and Monaco reports it through
 * `onUnexpectedError`. Memoizing here fixes it at the source instead of making
 * every consumer widen their CSP with `'allow-duplicates'`, which would let ANY
 * script re-register a policy name.
 *
 * A no-op where Trusted Types is unsupported (Firefox, Safari): returns
 * `undefined`, exactly as Monaco's own fallback does, and Monaco then uses the
 * raw string. A refused name also returns `undefined` (the browser still logs the
 * CSP violation, so a missing allowlist entry stays visible) rather than throwing.
 *
 * See `docs/CSP-AND-NETWORK.md` §2.6.
 */
type TrustedTypesHook = NonNullable<Environment["createTrustedTypesPolicy"]>;
type MonacoPolicy = ReturnType<TrustedTypesHook>;
type PolicyOptions = Parameters<TrustedTypesHook>[1];

/** `lib.dom` carries no Trusted-Types types, so the factory is typed structurally. */
interface TrustedTypesGlobal {
  trustedTypes?: { createPolicy(name: string, options?: PolicyOptions): MonacoPolicy };
}

const policyCache = new Map<string, MonacoPolicy>();

const monacoEnvironment: Environment = {
  createTrustedTypesPolicy(policyName, policyOptions) {
    if (policyCache.has(policyName)) return policyCache.get(policyName);

    let policy: MonacoPolicy;
    try {
      policy = (globalThis as unknown as TrustedTypesGlobal).trustedTypes?.createPolicy(
        policyName,
        policyOptions,
      );
    } catch {
      policy = undefined;
    }

    policyCache.set(policyName, policy);
    return policy;
  },

  getWorker(_workerId: string, label: string): Worker {
    switch (label) {
      case "json":
        return new JsonWorker();
      case "css":
      case "scss":
      case "less":
        return new CssWorker();
      case "html":
      case "handlebars":
      case "razor":
        return new HtmlWorker();
      case "typescript":
      case "javascript":
        return new TsWorker();
      default:
        return new EditorWorker();
    }
  },
};

(globalThis as unknown as { MonacoEnvironment: Environment }).MonacoEnvironment = monacoEnvironment;
