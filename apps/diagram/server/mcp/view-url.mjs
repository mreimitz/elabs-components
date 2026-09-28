/** Origin comes only from the local Host/Origin guard, never forwarded headers. */
export function viewUrl(ctx, path) {
  if (!ctx.origin || !/\.ya?ml$/i.test(path)) return undefined;
  return `${ctx.origin}/#v/${path.split("/").map(encodeURIComponent).join("/")}`;
}
