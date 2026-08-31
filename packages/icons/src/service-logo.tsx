import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

/**
 * ServiceLogo — a slot for a THIRD-PARTY SERVICE'S own mark (Slack, GitHub, a
 * customer's SSO provider, …), where `@elabs-ai/components-icons` never vendors the
 * trademark-bearing asset itself (issue #25). The package ships the MACHINERY —
 * a registry, a themable render contract, a monogram fallback — and the
 * CONSUMER supplies the content by calling `registerServiceLogos` (a licensing
 * decision that belongs to the app, not to brand-ui). This mirrors
 * `@elabs-ai/components-ai`'s `ModelSelectorLogo`, but never fetches a remote
 * asset at runtime — see docs/CSP-AND-NETWORK.md.
 *
 * A registered mark legitimately paints itself with the service's OWN brand
 * colour as a raw literal — that is a deliberate, narrow exception to the
 * semantic-tokens-only rule (docs/TOKEN_GUIDELINES.md), scoped to marks
 * rendered through this component and carved out of `brand-ui audit`'s
 * raw-color rules by the `ServiceLogo` / `data-service-logo` marker
 * (`packages/cli/lib/audit.mjs`).
 */

/** A registered mark's render callback. `variant` lets a well-behaved mark (one
 *  built on `currentColor`, like this package's own icons) respond to "mono";
 *  a mark that only knows its own brand colours may ignore it. */
export type ServiceLogoRender = (props: { size: number; variant: "brand" | "mono" }) => ReactNode;

export interface ServiceLogoDefinition {
  /** Render the mark from JSX/SVG the consumer owns. Preferred over `src` — it
   *  can respond to `size`/`variant` and never causes a network request. */
  render?: ServiceLogoRender;
  /** Or point at an image asset (a local/bundled file, a data: URI, or a
   *  same-origin URL the consumer controls — never an arbitrary remote origin,
   *  see docs/CSP-AND-NETWORK.md). */
  src?: string;
  /** Accessible name for this service. Falls back to a title-cased `name`. */
  label?: string;
}

export type ServiceLogoRegistry = Record<string, ServiceLogoDefinition>;

const globalServiceLogos: ServiceLogoRegistry = {};

/**
 * Register one or more service marks, merging into (and overriding by name)
 * whatever is already registered. Call once at app start with the marks your
 * product is licensed to display — brand-ui ships none.
 */
export function registerServiceLogos(entries: ServiceLogoRegistry): void {
  Object.assign(globalServiceLogos, entries);
}

/** Remove every globally registered mark. Mainly useful between tests. */
export function clearServiceLogos(): void {
  for (const key of Object.keys(globalServiceLogos)) delete globalServiceLogos[key];
}

function titleCase(name: string): string {
  const cased = name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return cased.length > 0 ? cased : name;
}

/** Lightweight class joiner — @elabs-ai/components-icons stays dependency-free (no clsx/tailwind-merge). */
function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export interface ServiceLogoProps extends Omit<HTMLAttributes<HTMLSpanElement>, "color"> {
  /** The service's registry key, e.g. "slack", "github". An unregistered name
   *  renders a monogram fallback instead of broken/blank output. */
  name: string;
  /** Pixel size for both width & height. Defaults to 24 (mirrors `Icon`). */
  size?: number | string;
  /** Accessible name override. Defaults to the registry entry's own `label`,
   *  else a title-cased `name`. Ignored when `decorative` is set. */
  label?: string;
  /** "brand" (default) renders the mark's own colours. "mono" asks a
   *  registered `render` mark to draw via `currentColor` (best-effort — it's
   *  the mark author's choice) and desaturates a `src` image; the fallback
   *  tile is already mono regardless of this prop. */
  variant?: "brand" | "mono";
  /** Scope marks to this instance only, merged over (and overriding) the
   *  global registry — for tests or a locally-scoped set. */
  logos?: ServiceLogoRegistry;
  /** Set true when adjacent visible text already names the service, so the
   *  mark is hidden from assistive tech instead of announcing a duplicate
   *  name. Defaults to false — the mark carries its own accessible name. */
  decorative?: boolean;
}

/**
 * A consistently-sized slot for a third-party service's mark, with an
 * accessible monogram fallback when nothing is registered for `name` yet.
 */
export const ServiceLogo = forwardRef<HTMLSpanElement, ServiceLogoProps>(function ServiceLogo(
  { name, size = 24, label, variant = "brand", logos, decorative = false, className, ...props },
  ref,
) {
  const entry = logos?.[name] ?? globalServiceLogos[name];
  const numericSize = typeof size === "number" ? size : Number.parseFloat(String(size)) || 24;
  const accessibleName = label ?? entry?.label ?? titleCase(name);

  return (
    <span
      ref={ref}
      data-slot="service-logo"
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : accessibleName}
      className={cx("inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      {...props}
    >
      {entry ? (
        <span aria-hidden="true" className="inline-flex size-full items-center justify-center">
          {entry.render ? (
            entry.render({ size: numericSize, variant })
          ) : entry.src ? (
            <img
              src={entry.src}
              alt=""
              width={numericSize}
              height={numericSize}
              className={cx("size-full object-contain", variant === "mono" && "grayscale")}
            />
          ) : null}
        </span>
      ) : (
        <ServiceLogoFallback name={name} />
      )}
    </span>
  );
});

function ServiceLogoFallback({ name }: { name: string }) {
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  return (
    <span
      aria-hidden="true"
      data-slot="service-logo-fallback"
      className="inline-flex size-full items-center justify-center rounded-md bg-muted text-muted-foreground"
    >
      <svg viewBox="0 0 24 24" width="60%" height="60%" role="presentation" focusable="false">
        <text
          x="12"
          y="12"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="13"
          fontWeight="600"
          fill="currentColor"
        >
          {initial}
        </text>
      </svg>
    </span>
  );
}
