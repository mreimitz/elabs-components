/**
 * Refuse any request that is not from this machine's own pages or tools (found while
 * hardening DG-35; mounted on DG-21's `/api/workspace` now, and on DG-35's `/mcp` later).
 *
 * Why here and not Vite: a plugin's `configureServer` middleware runs BEFORE Vite's own
 * `hostCheckMiddleware` and `corsMiddleware` (vite 6.4.3 `_createServer`: the plugin hooks
 * run, then `middlewares.use(corsMiddleware…)`, then `middlewares.use(hostCheckMiddleware…)`),
 * so the plugin's routes get neither. Two checks:
 *
 * - `Host` must name localhost, 127.0.0.1 or [::1] (DNS rebinding: a hostile page whose
 *   domain resolves to 127.0.0.1 still sends its own name as `Host`).
 * - `Origin`, when present, must be this server's own origin (`http://<Host>`): a browser
 *   page elsewhere cannot drive the tools. Non-browser clients (Claude Code, curl) send no
 *   `Origin`.
 */
import { URL } from "node:url";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** `localhost:5180` → `localhost`, `[::1]:5180` → `[::1]`; null when unparsable. */
export function hostnameOf(host) {
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return null;
  }
}

/**
 * @param {import("node:http").IncomingMessage} req
 * @returns {string | null} why the request is refused, or null when it may pass
 */
export function refuseNonLocal(req) {
  const host = req.headers.host;
  if (!host || !LOCAL_HOSTNAMES.has(hostnameOf(host) ?? "")) {
    return "This server only answers requests addressed to localhost.";
  }
  const origin = req.headers.origin;
  if (origin !== undefined && origin !== `http://${host}`) {
    return `Requests from ${origin} are not allowed.`;
  }
  return null;
}
