import { type CSSProperties, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { ILLUSTRATION_ACCENT_VAR } from "../../illustrations/illustration-base";

// ─── Variants ────────────────────────────────────────────────────────────────

export const statePanelVariants = cva(
  [
    "flex flex-col items-center justify-center gap-3 rounded-xl px-6 py-12 text-center",
    "animate-in fade-in slide-in-from-bottom-2 duration-base ease-entrance",
  ],
  {
    variants: {
      kind: {
        empty: "border border-dashed bg-surface",
        // error: the non-color, monochrome-survivable cue is the rail's WIDTH
        // (border-s-4, 4px, vs the 1px hairline on the other three edges) —
        // not its hue (per styling-and-tokens.md's border/border-strong
        // decision test: "if I deleted this line, could a sighted user still
        // tell the two regions apart?" here it's the thickness that answers
        // yes). So the rail's COLOR should stay in the destructive family
        // like the rest of the panel, not fall back to the neutral
        // `border-strong` rung — a 4px grey rail beside three red hairlines
        // read as a CSS-specificity bug, not a deliberate accent (#71).
        // `border-s-destructive` is the FILL rung (styling-and-tokens.md
        // "which status rung a graphical MARK reaches for") — guaranteed
        // >=3:1 against --card/--background in every theme, so it still
        // satisfies the WCAG 1.4.11 non-text-contrast guarantee the old
        // `border-border-strong` comment claimed. The icon (:87-91) and the
        // eyebrow (:148-152 below) are the third and fourth non-color cues.
        error: "border border-destructive/30 bg-destructive/5 border-s-4 border-s-destructive",
        loading: "",
      },
    },
    defaultVariants: { kind: "empty" },
  },
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StatePanelProps extends VariantProps<typeof statePanelVariants> {
  /**
   * The visual/semantic kind of state.
   * - `"empty"` — neutral "nothing here yet" (dashed border, surface bg).
   * - `"error"` — recoverable failure (destructive border/bg, alert role).
   * - `"loading"` — in-progress (spinner, status/live-region role).
   */
  kind?: "empty" | "error" | "loading";
  /** Heading text. */
  title?: ReactNode;
  /** Supporting description below the title. */
  description?: ReactNode;
  /**
   * Icon shown above the title, clamped to a uniform 40×40 so mismatched
   * glyphs stay tidy. For `"error"` defaults to a built-in warning triangle.
   * For `"loading"` defaults to an animated spinner. Ignored when
   * `illustration` is also provided — see `illustration`.
   */
  icon?: ReactNode;
  /**
   * A larger illustration (one of `@elabs-ai/components-ui`'s shipped
   * `*Illustration` components, or a consumer's own `ReactNode`) shown above
   * the title instead of `icon`. Unlike `icon`, it is **not** clamped to
   * 40×40 — an illustration governs its own size (see each illustration's
   * `size` prop, `rem`-based, ~64px–160px). Takes precedence over `icon`
   * when both are given.
   */
  illustration?: ReactNode;
  /** Accessible label for the spinner in loading state. @default "Loading…" */
  loadingLabel?: string;
  /** Spinner size (loading kind only). @default "md" */
  size?: "sm" | "md" | "lg";
  /** Primary / secondary action buttons. */
  actions?: ReactNode;
  className?: string;
}

// ─── Default icons ────────────────────────────────────────────────────────────

const sizeMap: Record<string, string> = { sm: "size-4", md: "size-6", lg: "size-8" };

function DefaultSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <svg
      className={cn("animate-spin text-muted-foreground", sizeMap[size])}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4Z" />
    </svg>
  );
}

function DefaultErrorIcon() {
  // Use the Lucide CircleAlert icon (solid ring + exclamation) for the error state.
  // Rendered at size-10 so it reads clearly even at small panel sizes.
  return <CircleAlert className="size-10" aria-hidden="true" />;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Unified state panel covering empty, error, and loading states.
 * Replaces the three separate `EmptyState` / `ErrorState` / `LoadingState` components
 * while keeping those as back-compat thin wrappers.
 */
export function StatePanel({
  kind = "empty",
  title,
  description,
  icon,
  illustration,
  loadingLabel = "Loading…",
  size = "md",
  actions,
  className,
}: StatePanelProps) {
  const isLoading = kind === "loading";
  const isError = kind === "error";

  // Role: loading → status + live region; error → alert; empty → (none needed).
  const roleProps = isLoading
    ? ({ role: "status", "aria-live": "polite" } as const)
    : isError
      ? ({ role: "alert" } as const)
      : {};

  // Default title / description fallbacks for error state (mirroring old ErrorState).
  const resolvedTitle = title ?? (isError ? "Something went wrong" : undefined);
  const resolvedDescription =
    description ?? (isError ? "An unexpected error occurred. Please try again." : undefined);

  // Resolve displayed icon.
  let resolvedIcon: ReactNode;
  if (icon !== undefined) {
    resolvedIcon = icon;
  } else if (isLoading) {
    resolvedIcon = <DefaultSpinner size={size} />;
  } else if (isError) {
    resolvedIcon = <DefaultErrorIcon />;
  }

  return (
    <div data-kind={kind} className={cn(statePanelVariants({ kind }), className)} {...roleProps}>
      {/* Error eyebrow: "Error" label shown above the icon so the panel reads
          as an error structurally even in monochrome themes. This is running
          TEXT, not a mark, so it takes the ink rung `text-destructive-text`
          (>= 4.5:1, gated in themes-contrast.test.ts) — not the fill rung
          `text-destructive`, whose contract is only the 3:1 mark bar (see
          "Which status rung a graphical MARK reaches for", styling-and-tokens.md
          #381). Combined with the thick left border from statePanelVariants it
          gives two non-color structural cues. The icon below deliberately
          KEEPS text-destructive: an icon is a mark, so the fill rung is
          correct there — do not "tidy" it onto -text too. */}
      {isError && (
        <span className="text-meta font-semibold uppercase tracking-widest text-destructive-text">
          Error
        </span>
      )}

      {illustration ? (
        // Illustration wins over `icon` when both are given. No `[&_svg]:size-10`
        // clamp here — an illustration governs its own (rem-based) size, unlike
        // the fixed-size icon slot below. For `kind="error"` this also sets the
        // `--illustration-accent` custom property every illustration's accent
        // ink reads through, so ANY illustration (not just `ErrorIllustration`)
        // retints its accent to `--destructive-text` instead of staying pinned
        // to its default hue inside a red-tinted slot (#24 fix round 1, P0-2).
        // TEXT rung, not the FILL token below: the wrapper's `text-destructive`
        // class already puts the SUBJECT (silhouette) on the fill rung, so an
        // accent override reading the same `--destructive` token collapsed
        // onto it and disappeared (#48 finding 2) — `--destructive-text` is a
        // deliberately distinct, deeper rung (matches the fallback every
        // other illustration's own accent already uses: `--primary-text`,
        // `--success-text`) so the accent stays visible against the retinted
        // silhouette.
        <div
          className={cn(isError ? "text-destructive" : "text-muted-foreground")}
          style={
            isError
              ? ({ [ILLUSTRATION_ACCENT_VAR]: "var(--destructive-text)" } as CSSProperties)
              : undefined
          }
        >
          {illustration}
        </div>
      ) : resolvedIcon ? (
        // Error icon keeps text-destructive (not muted) so it stays visible even
        // when rendered at low contrast. In monochrome themes the icon shape
        // (CircleAlert) carries the cue; the color is supplemental.
        <div
          className={cn("[&_svg]:size-10", isError ? "text-destructive" : "text-muted-foreground")}
        >
          {resolvedIcon}
        </div>
      ) : null}

      {(resolvedTitle || resolvedDescription) && (
        // A 112px+ illustration (default `size="7rem"`) needs a heavier title
        // to group with, and more air between the artwork and the copy than
        // between the title and its own description — otherwise the caption
        // reads as an afterthought under the artwork instead of one grouped
        // unit (#47). `mt-2` (on top of the root's `gap-3`) only fires on the
        // illustration path; the plain `icon` path (a fixed 40x40 glyph) is
        // untouched. The title/description gap stays the tight `space-y-1`
        // either way — that's the "one visually distinct unit" the two lines
        // read as.
        <div className={cn("space-y-1", illustration && "mt-2")}>
          {resolvedTitle && (
            <h3
              className={cn(
                "font-semibold text-foreground",
                illustration ? "text-subtitle" : "text-sm",
              )}
            >
              {resolvedTitle}
            </h3>
          )}
          {resolvedDescription && (
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">{resolvedDescription}</p>
          )}
        </div>
      )}

      {/* Loading label (visually shown as supporting text; also the live-region content). */}
      {isLoading && loadingLabel && (
        <span className="text-sm text-muted-foreground">{loadingLabel}</span>
      )}

      {actions ? <div className="mt-1 flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
