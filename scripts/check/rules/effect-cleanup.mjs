/**
 * effect-cleanup — a `useEffect`/`useLayoutEffect` that acquires a resource
 * releases it: the effect returns a cleanup, and that effect names the matching
 * release call.
 *
 * Acquisitions (anywhere in the effect body except inside the returned cleanup):
 *   `addEventListener`                         → `removeEventListener` or `.abort(` (AbortSignal)
 *   `setInterval`                              → `clearInterval`
 *   `setTimeout`                               → `clearTimeout`
 *   `new ResizeObserver|MutationObserver|IntersectionObserver` → `.disconnect(` or `.unobserve(`
 *   `.subscribe(`                              → any returned cleanup (unsubscribe shapes vary)
 *
 * A finding when the effect returns no cleanup at all, or returns one but the release
 * call never appears in the effect (a `clear…Timeout`/`cancel…Timer` helper counts). Other helpers defined OUTSIDE
 * the effect (`return () => stopAll()`) are reported — inline them or name the release.
 */
import { calleeName, isFunctionLike, lineOfNode, parse, ts, walk } from "../lib/ts-ast.mjs";

const IGNORE = [
  "**/*.{test,stories}.{ts,tsx}",
  "**/{node_modules,dist,storybook-static,.turbo,coverage,__output}/**",
];

const OBSERVERS = new Set(["ResizeObserver", "MutationObserver", "IntersectionObserver"]);
const RELEASE = {
  addEventListener: /\bremoveEventListener\b|\.abort\(/,
  // a named helper (`clearStyleTimeout()`, `cancelPollInterval()`) also counts as the release
  setInterval: /\bclearInterval\b|\b(?:clear|cancel)\w*(?:Interval|Timer|Poll)\b/,
  setTimeout: /\bclearTimeout\b|\b(?:clear|cancel)\w*(?:Timeout|Timer)\b/,
  observer: /\.disconnect\(|\.unobserve\(/,
  subscribe: /[\s\S]/,
};

function checkEffect(call, sf, file, out) {
  const t = ts();
  const fn = call.arguments[0];
  if (!fn || !(t.isArrowFunction(fn) || t.isFunctionExpression(fn))) return;
  if (!t.isBlock(fn.body)) return; // expression body: returns whatever the call returns
  const cleanups = [];
  const acquired = [];
  walk(fn.body, (n) => {
    if (n !== fn.body && isFunctionLike(n)) {
      // nested callbacks (handlers, .then, rAF) still acquire; only a returned cleanup is exempt
      if (t.isReturnStatement(n.parent) && ownerOf(n.parent) === fn) {
        cleanups.push(n);
        return false;
      }
    }
    if (
      t.isReturnStatement(n) &&
      n.expression &&
      ownerOf(n) === fn &&
      !isFunctionLike(n.expression)
    )
      cleanups.push(n.expression);
    if (t.isNewExpression(n) && t.isIdentifier(n.expression) && OBSERVERS.has(n.expression.text))
      acquired.push({ node: n, kind: "observer", label: `new ${n.expression.text}` });
    if (t.isCallExpression(n)) {
      const name = calleeName(n);
      if (name === "addEventListener" || name === "setInterval" || name === "setTimeout")
        acquired.push({ node: n, kind: name, label: name });
      else if (name === "subscribe" && t.isPropertyAccessExpression(n.expression))
        acquired.push({ node: n, kind: "subscribe", label: ".subscribe" });
    }
  });
  if (acquired.length === 0) return;
  const effectText = fn.body.getText(sf);
  for (const a of acquired) {
    const missing = cleanups.length === 0 || !RELEASE[a.kind].test(effectText);
    if (!missing) continue;
    out.push({
      file,
      line: lineOfNode(sf, a.node),
      msg: `${a.label} in ${calleeName(call)} without a cleanup that releases it — return a function that ${
        a.kind === "observer"
          ? "disconnects it"
          : a.kind === "subscribe"
            ? "unsubscribes"
            : `calls ${a.kind === "addEventListener" ? "removeEventListener" : a.kind === "setInterval" ? "clearInterval" : "clearTimeout"}`
      }`,
    });
  }
}

/** The nearest enclosing function-like of a node. */
function ownerOf(node) {
  let p = node.parent;
  while (p && !isFunctionLike(p)) p = p.parent;
  return p;
}

export function scanText(file, text) {
  if (!/\buse(?:Layout)?Effect\b/.test(text)) return [];
  if (!/addEventListener|setInterval|setTimeout|Observer\b|\.subscribe\(/.test(text)) return [];
  const sf = parse(file, text);
  const out = [];
  const t = ts();
  walk(sf, (n) => {
    if (t.isCallExpression(n)) {
      const name = calleeName(n);
      if (name === "useEffect" || name === "useLayoutEffect") checkEffect(n, sf, file, out);
    }
  });
  return out;
}

const src = (body) => ({ files: { "packages/ui/src/components/x/x.tsx": body } });

export default {
  id: "effect-cleanup",
  scope: "components",
  doc: "A `useEffect`/`useLayoutEffect` that adds a listener, starts a timer/interval, creates an observer or subscribes returns a cleanup that removes/clears/disconnects/unsubscribes it.",
  baseline: "per-file",
  run(ctx) {
    return ctx
      .glob("packages/*/src/**/*.{ts,tsx}", { ignore: IGNORE })
      .flatMap((file) => scanText(file, ctx.readFile(file)));
  },
  fixtures: {
    pass: [
      src(`useEffect(() => {
  const onResize = () => setViewportWidth(window.innerWidth);
  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, []);`),
      src(`useLayoutEffect(() => {
  const el = ref.current;
  if (!el) return;
  const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
  ro.observe(el);
  return () => ro.disconnect();
}, []);`),
      src(`React.useEffect(() => {
  if (!copied) return;
  const id = setTimeout(() => setCopied(false), 2000);
  return () => clearTimeout(id);
}, [copied]);`),
      src(`useEffect(() => {
  const controller = new AbortController();
  document.addEventListener("keydown", onKey, { signal: controller.signal });
  return () => controller.abort();
}, [onKey]);`),
      src(`useEffect(() => {
  const unsubscribe = store.subscribe(() => setSnapshot(store.get()));
  return unsubscribe;
}, [store]);`),
    ],
    fail: [
      src(`useEffect(() => {
  window.addEventListener("resize", onResize);
}, []);`),
      src(`useEffect(() => {
  if (!open) return;
  setTimeout(() => inputRef.current?.focus(), 0);
}, [open]);`),
      src(`useLayoutEffect(() => {
  const observer = new MutationObserver(sync);
  observer.observe(ref.current!, { attributes: true });
  return () => {
    setReady(false);
  };
}, []);`),
      src(`useEffect(() => {
  const id = setInterval(tick, 1000);
}, [tick]);`),
    ],
  },
};
