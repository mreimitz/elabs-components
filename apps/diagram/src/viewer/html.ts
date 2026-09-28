import { safeSnapshotJson, validateSnapshot, type ViewerSnapshot } from "./manifest";
export interface ViewerTemplate {
  code: string;
  css: string;
}
const htmlText = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
/** Hash exactly the escaped script bytes that the HTML parser will execute. */
export async function viewerHtml(
  snapshot: ViewerSnapshot,
  template: ViewerTemplate,
  title: string,
): Promise<string> {
  validateSnapshot(snapshot);
  if (typeof template.code !== "string" || typeof template.css !== "string")
    throw new Error("The offline viewer template is invalid.");
  const code = template.code.replace(/<\/script/gi, "<\\/script");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  const hash = btoa(String.fromCharCode(...new Uint8Array(digest)));
  const csp = `default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  return `<!doctype html><html lang="en" data-theme="${htmlText(snapshot.theme)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${htmlText(csp)}"><title>${htmlText(title)}</title><style>${template.css.replace(/<\/style/gi, "<\\/style")}</style></head><body><div id="root"></div><script id="atlas-snapshot" type="application/json">${safeSnapshotJson(snapshot)}</script><script>${code}</script></body></html>`;
}
