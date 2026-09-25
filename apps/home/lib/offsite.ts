/**
 * Links that leave the site open in a new tab, so the page a reader came from stays put: another
 * origin (GitHub, npm, the changelog) or Storybook, which is its own app behind the `/storybook/`
 * rewrite (ADR 0038 §2). Every other href is a page of this site and keeps the current tab.
 */
export function isOffsite(href: string): boolean {
  return /^https?:\/\//.test(href) || href.startsWith("/storybook");
}

const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const;

/** Spread onto an `<a>`: the new-tab attributes when `href` leaves the site, nothing otherwise. */
export function offsiteProps(href: string): typeof NEW_TAB | Record<string, never> {
  return isOffsite(href) ? NEW_TAB : {};
}
