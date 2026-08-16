import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cn, Heading, type HeadingLevel } from "@elabs/components-ui";

export interface ChatGreetingProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Primary line, e.g. "Good morning, Avery". */
  title: ReactNode;
  /**
   * Second line, rendered under `title` inside the same heading. Independent
   * of `accent` — either may be passed alone.
   */
  subtitle?: ReactNode;
  /**
   * Phrase rendered in `text-primary-text` with a bold underline, appended
   * after `subtitle` (or alone). The underline + weight is a NON-hue channel
   * deliberately layered on top of the color — `blueprint`’s `--primary` is a
   * near-white "pen" (its whole monochrome design intent, see
   * `blueprint-decoration.md`), so on that theme the accent colour alone is
   * indistinguishable from the surrounding `--foreground` headline text. The
   * underline/weight keep the phrase legible as an accent in EVERY theme,
   * not only the two where hue alone would carry it.
   */
  accent?: ReactNode;
  /** Soft primary glow behind the headline. Default `true`; `false` for dense/embedded use. */
  orb?: boolean;
  /**
   * Semantic heading level for `title`. Default `1` (a chat empty state is
   * typically the only heading on the page). Override to `2`+ when ChatGreeting
   * sits inside a page or route that already renders its own `<h1>` —
   * `Heading` decouples `level` from `size`, so the visual display-scale rung
   * stays put regardless of the level chosen.
   */
  level?: HeadingLevel;
}

/**
 * ChatGreeting — the centered first-run greeting for an empty chat/composer scene.
 *
 * A display-scale headline (`title`, then `subtitle` with an `accent` phrase
 * in `text-primary-text` + a bold underline, so the accent reads in every theme —
 * including `blueprint`, whose monochrome `--primary` is otherwise the same
 * near-white as the headline) over an optional soft primary glow. Pair it
 * with `<Composer />` for the standard empty/first-run chat state.
 *
 * Distinct from `ConversationEmptyState` (a generic centered "No messages yet"
 * message panel) — this is the display-scale greeting anatomy, not a status
 * message.
 */
export const ChatGreeting = forwardRef<HTMLDivElement, ChatGreetingProps>(function ChatGreeting(
  { title, subtitle, accent, orb = true, level = 1, className, ...props },
  ref,
) {
  const hasSecondLine = subtitle != null || accent != null;

  return (
    <div
      ref={ref}
      data-slot="chat-greeting"
      // `isolate` gives the root its own stacking context so the negative-
      // z-index orb paints ABOVE an ancestor's own background instead of
      // beneath it (CSS painting order step 2 vs step 3) — without it, any
      // opaque wrapper (e.g. a `bg-background` scene container) occludes the
      // glow entirely. See issue #254 root-cause.
      className={cn("relative isolate mb-10 text-center", className)}
      {...props}
    >
      {orb ? (
        <div
          aria-hidden="true"
          data-slot="chat-greeting-orb"
          className="pointer-events-none absolute start-1/2 top-0 -z-10 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-3xl"
        />
      ) : null}
      <Heading data-slot="chat-greeting-title" level={level} size="display">
        {title}
        {hasSecondLine ? (
          <>
            <br />
            {subtitle}
            {subtitle != null && accent != null ? " " : null}
            {accent != null ? (
              // #399 — accent phrase inside a headline is TEXT: `-text` rung.
              <span className="font-bold text-primary-text underline decoration-2 underline-offset-4">
                {accent}
              </span>
            ) : null}
          </>
        ) : null}
      </Heading>
    </div>
  );
});
