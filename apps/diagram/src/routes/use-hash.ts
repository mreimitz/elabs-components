import { useEffect, useMemo, useState } from "react";
import { PRESENT_PARAM } from "../interaction/presentation-mode";
import { docParam } from "../io/share-url";

/**
 * The live `location.hash`, as it is. `useHash()` below is what the galleries read.
 * Added by DG-04, shared by every gallery since; DG-22 adds the Atlas routes on top.
 */
function useRawHash(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return hash;
}

// ── DG-22: the Atlas routes ─────────────────────────────────────────────────────────────
// `#home` · `#d/<path>[&present][&step=n]` · `#catalog[/vendor[/entry]]` · `#settings` ·
// `#dev/<gallery>`. No router dependency: a handful of routes over `location.hash`.

/** The v1 dev galleries, now under `#dev/<name>` (their own grammar follows the name). */
export const DEV_ROUTES = [
  "nodes",
  "zones",
  "edges",
  "legend",
  "spec-check",
  "lens-check", // maintainer 2026-09-27 (lens switch): deriveVisualLens has no test runner
  "icons",
] as const;

/** `#d/<path>`: a workspace diagram. */
const DOC_PREFIX = "d/";
const DEV_PREFIX = "dev/";
const STEP_PARAM = "step";

export type Route =
  | { kind: "home" }
  | {
      kind: "doc";
      /**
       * The workspace path (`examples/lakehouse-aws.yaml`). `null` is the document the tab
       * holds that is no workspace file: an old `#doc=…` share link (kept for one release,
       * see `share`) or DG-18's bare `#present`.
       */
      path: string | null;
      present?: boolean;
      /** Plan V11's story link (`&step=n`); DG-31 reads it. */
      step?: number;
      /** One release: an old `#doc=<text>` share link (DG-16) maps here. */
      share?: string;
    }
  | { kind: "catalog"; vendor?: string; entry?: string }
  | { kind: "settings" }
  | { kind: "dev"; name: string };

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");
const decodePath = (path: string) => path.split("/").map(decodeSegment).join("/");

/** `dev/legend/none` or v1's bare `legend/none` → `legend/none`; not a gallery → `null`. */
function devName(head: string): string | null {
  const name = head.startsWith(DEV_PREFIX) ? head.slice(DEV_PREFIX.length) : head;
  const gallery = name.split("/")[0] ?? "";
  return (DEV_ROUTES as readonly string[]).includes(gallery) ? name : null;
}

/**
 * The route a hash names. `#` and `#home` are Home; an unknown hash is Home too. The hash is
 * read as `&`-separated parts: the route itself, then `present`, `step=n` and (one release)
 * DG-16's `doc=<text>`. v1's bare gallery hashes (`#nodes`, `#legend/none`) map to the
 * `#dev/…` routes for one release, so old bookmarks keep working; v1's bare `#icons[/<vendor>]`
 * opens the catalog (DG-24), and the icon sheet stays at `#dev/icons[/<vendor>]`.
 */
export function parseRoute(hash: string): Route {
  const parts = hash
    .replace(/^#/, "")
    .split("&")
    .filter((part) => part !== "");
  const present = parts.some(
    (part) => part === PRESENT_PARAM || part.startsWith(`${PRESENT_PARAM}=`),
  );
  const stepPart = parts.find((part) => part.startsWith(`${STEP_PARAM}=`));
  const step = stepPart ? Number(stepPart.slice(STEP_PARAM.length + 1)) : Number.NaN;
  const flags = {
    ...(present ? { present: true } : {}),
    ...(Number.isInteger(step) && step >= 0 ? { step } : {}),
  };
  const head = parts.find((part) => !part.includes("=") && part !== PRESENT_PARAM) ?? "";

  if (head.startsWith(DOC_PREFIX) && head.length > DOC_PREFIX.length) {
    return { kind: "doc", path: decodePath(head.slice(DOC_PREFIX.length)), ...flags };
  }
  if (head === "" || head === "home") {
    // One release: an old share link, `#doc=<text>[&present]`, is the document it carries.
    const share = docParam(hash);
    if (share !== null) return { kind: "doc", path: null, share, ...flags };
    // DG-18's Present button writes a bare `#present` (it keeps only `key=value` parts).
    if (present) return { kind: "doc", path: null, ...flags };
    return { kind: "home" };
  }
  if (head === "catalog" || head.startsWith("catalog/")) {
    const [, vendor, entry] = head.split("/").map(decodeSegment);
    return {
      kind: "catalog",
      ...(vendor ? { vendor } : {}),
      ...(entry ? { entry } : {}),
    };
  }
  if (head === "settings") return { kind: "settings" };
  // DG-24: v1's bare `#icons[/<vendor>]` opens the catalog; `#dev/icons` stays the dev sheet.
  if (head === "icons" || head.startsWith("icons/")) {
    const [, vendor] = head.split("/").map(decodeSegment);
    return { kind: "catalog", ...(vendor ? { vendor } : {}) };
  }
  const dev = devName(head);
  if (dev !== null) return { kind: "dev", name: dev };
  return { kind: "home" };
}

/** The canonical hash of a route (`parseRoute(toHash(r))` equals `r`). */
export function toHash(route: Route): string {
  switch (route.kind) {
    case "home":
      return "#home";
    case "doc": {
      const params = [
        ...(route.present ? [PRESENT_PARAM] : []),
        ...(route.step !== undefined ? [`${STEP_PARAM}=${route.step}`] : []),
      ];
      const head =
        route.path !== null
          ? `${DOC_PREFIX}${encodePath(route.path)}`
          : route.share !== undefined
            ? new URLSearchParams({ doc: route.share }).toString()
            : "";
      const body = [head, ...params].filter((part) => part !== "").join("&");
      return body === "" ? "#home" : `#${body}`;
    }
    case "catalog":
      return `#${["catalog", route.vendor, route.vendor ? route.entry : undefined]
        .filter((part): part is string => Boolean(part))
        .map(encodeURIComponent)
        .join("/")}`;
    case "settings":
      return "#settings";
    case "dev":
      return `#${DEV_PREFIX}${route.name}`;
  }
}

/** Go to a route. `replace`: no new Back step (a redirect, a renamed file). */
export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const hash = toHash(route);
  if (hash === window.location.hash) return;
  // A fragment-only `replace` fires `hashchange` like an assignment does.
  if (options.replace) window.location.replace(hash);
  else window.location.hash = hash;
}

/** The current route. */
export function useRoute(): Route {
  const hash = useRawHash();
  return useMemo(() => parseRoute(hash), [hash]);
}

/**
 * The hash the v1 galleries read. Under `#dev/…` it is given back in v1's form (`#dev/legend/
 * none` → `#legend/none`), so each gallery keeps parsing its own grammar unchanged.
 */
export function useHash(): string {
  const hash = useRawHash();
  return hash.startsWith(`#${DEV_PREFIX}`) ? `#${hash.slice(DEV_PREFIX.length + 1)}` : hash;
}
