import { type ReactNode } from "react";
import { Reveal, RevealGroup } from "@qlik-coe-emea/qlabs-components-ui";
import { cn } from "@qlik-coe-emea/qlabs-components-ui/lib/cn";

export interface HeroProps {
  /** Small label above the headline. */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Call-to-action buttons. */
  actions?: ReactNode;
  /** Optional product shot / illustration to the side. */
  media?: ReactNode;
  /** Reveal the text stack (and split media) on mount. Motion-gated. Defaults to true. */
  animate?: boolean;
  className?: string;
}

/** Marketing hero. Centered when no media, split when media is provided. */
export function Hero({
  eyebrow,
  title,
  description,
  actions,
  media,
  animate = true,
  className,
}: HeroProps) {
  const split = Boolean(media);

  const eyebrowEl = eyebrow ? (
    <span className="inline-block rounded-full border bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
      {eyebrow}
    </span>
  ) : null;
  const titleEl = (
    <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
      {title}
    </h1>
  );
  const descriptionEl = description ? (
    <p className={cn("text-lg text-muted-foreground", !split && "mx-auto max-w-2xl")}>
      {description}
    </p>
  ) : null;
  const actionsEl = actions ? (
    <div className={cn("flex flex-wrap gap-3", !split && "justify-center")}>{actions}</div>
  ) : null;

  const stackClassName = cn("space-y-6", !split && "mx-auto");
  const stack = animate ? (
    <RevealGroup appear="up" speed="slow" staggerMs={80} className={stackClassName}>
      {eyebrowEl}
      {titleEl}
      {descriptionEl}
      {actionsEl}
    </RevealGroup>
  ) : (
    <div className={stackClassName}>
      {eyebrowEl}
      {titleEl}
      {descriptionEl}
      {actionsEl}
    </div>
  );

  const mediaEl = split ? <div className="min-w-0">{media}</div> : null;

  return (
    <section className={cn("w-full px-4 py-16 sm:py-24", className)}>
      <div
        className={cn(
          "mx-auto grid max-w-7xl items-center gap-10",
          split ? "lg:grid-cols-2" : "max-w-3xl text-center",
        )}
      >
        {stack}
        {split && mediaEl ? (
          animate ? (
            <Reveal appear="left" speed="slow">
              {mediaEl}
            </Reveal>
          ) : (
            mediaEl
          )
        ) : null}
      </div>
    </section>
  );
}
