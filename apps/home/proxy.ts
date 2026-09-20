import { NextResponse, type NextRequest } from "next/server";

/**
 * A Storybook DEV server also answers on paths that ignore the /storybook/ prefix: its preview
 * iframe pulls /@vite/client, /@id/…, /@fs/… and /vite-inject-mocker-entry.js from the ROOT, and
 * modules inside Vite's root (apps/docs) come back as /.storybook/… or /stories/… urls. Without
 * these the story frames stay blank, so a LOCAL Storybook could not be shown through the site at
 * all — which is why new stories looked missing while the site quietly showed the published
 * release. Only a localhost STORYBOOK_ORIGIN turns this on (`.vscode/start-home.mjs` sets it
 * whenever a local Storybook is running), so the deployed site never takes this path.
 *
 * The request is fetched here rather than handed to `rewrites()` or `NextResponse.rewrite` because
 * both re-serialise the query string: Vite tells `?worker` apart from `?worker=`, and with the `=`
 * it serves the raw module, which crashes the preview with "does not provide an export named
 * 'default'" — one broken module is enough to leave every story frame blank.
 */
const STORYBOOK_ORIGIN = process.env.STORYBOOK_ORIGIN?.replace(/\/+$/, "") ?? "";
const STORYBOOK_IS_LOCAL = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(STORYBOOK_ORIGIN);
/** Vite's own valueless module-url flags, in the order they appear in its docs. */
const VITE_BARE_FLAGS =
  /([?&](?:worker|sharedworker|raw|url|inline|no-inline|init|import|direct|used|html-proxy))=(?=&|$)/g;
const VITE_ROOT_PATH =
  /^\/(?:@vite|@id|@fs|@react-refresh|node_modules|sb-preview|sb-common-assets|sb-addons|sb-manager|\.storybook|stories|vite-inject-mocker-entry\.js)(?:\/|$)/;

/**
 * Adds the trailing slash Storybook needs at /storybook (ADR 0038 §2). Storybook loads every
 * asset by a RELATIVE url (./sb-manager/…), which resolves under /storybook/ only with the slash.
 * A next.config redirect cannot do this: Next compiles every redirect source with an optional
 * trailing slash, so `/storybook` → `/storybook/` also matched `/storybook/` and looped.
 * `skipTrailingSlashRedirect` in next.config.ts lets this function see the raw path; the
 * matcher also admits `/storybook/`, hence the exact check.
 */
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (STORYBOOK_IS_LOCAL && VITE_ROOT_PATH.test(path)) {
    const raw = request.url.slice(request.url.indexOf("/", request.url.indexOf("://") + 3));
    // Next normalises the query before this function ever sees it, so Vite's bare flags arrive as
    // `?worker=` / `?raw=`, and Vite matches only the bare form. Put those back by name, never
    // every empty value, so a query that means something empty is left alone.
    const suffix = raw.replace(VITE_BARE_FLAGS, "$1");
    const headers = new Headers(request.headers);
    // Vite checks Host against its own allowedHosts; ours would be the website's.
    headers.delete("host");
    return fetch(`${STORYBOOK_ORIGIN}${suffix}`, { headers, redirect: "manual" });
  }

  if (path !== "/storybook") return NextResponse.next();
  // A plain URL, not `nextUrl.clone()`: NextURL drops the trailing slash and re-encodes the query
  // when it serialises; this keeps `?path=/story/…` byte-for-byte.
  const target = new URL(request.url);
  target.pathname = "/storybook/";
  return NextResponse.redirect(target, 308);
}

// The Vite roots below never occur in production traffic (nothing on the deployed site links to
// them), so this stays a dev-only detour rather than an extra hop per Storybook asset.
export const config = {
  matcher: [
    "/storybook",
    "/@vite/:path*",
    "/@id/:path*",
    "/@fs/:path*",
    "/@react-refresh",
    "/node_modules/:path*",
    "/vite-inject-mocker-entry.js",
    "/sb-preview/:path*",
    "/sb-common-assets/:path*",
    "/sb-addons/:path*",
    "/sb-manager/:path*",
    "/.storybook/:path*",
    "/stories/:path*",
  ],
};
