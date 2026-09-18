import { NextResponse, type NextRequest } from "next/server";

/**
 * Adds the trailing slash Storybook needs at /storybook (ADR 0038 §2). Storybook loads every
 * asset by a RELATIVE url (./sb-manager/…), which resolves under /storybook/ only with the slash.
 * A next.config redirect cannot do this: Next compiles every redirect source with an optional
 * trailing slash, so `/storybook` → `/storybook/` also matched `/storybook/` and looped.
 * `skipTrailingSlashRedirect` in next.config.ts lets this function see the raw path; the
 * matcher also admits `/storybook/`, hence the exact check.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== "/storybook") return NextResponse.next();
  // A plain URL, not `nextUrl.clone()`: NextURL drops the trailing slash and re-encodes the query
  // when it serialises; this keeps `?path=/story/…` byte-for-byte.
  const target = new URL(request.url);
  target.pathname = "/storybook/";
  return NextResponse.redirect(target, 308);
}

export const config = { matcher: "/storybook" };
