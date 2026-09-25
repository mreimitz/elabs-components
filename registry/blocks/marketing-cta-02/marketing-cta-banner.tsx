import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Sparkline } from "@elabs-ai/components-charts";
import { Button } from "@elabs-ai/components-ui";

export interface CtaProof {
  /** The number, already formatted for the reader ("312"). */
  value: string;
  /** What it counts ("teams started this week"). */
  label: string;
  /** Daily counts behind the number, oldest first — drawn as a sparkline beside it. */
  series: number[];
  /** Accessible name for the sparkline. */
  seriesLabel?: string;
  /** How fresh the number is ("Updated a minute ago"). Omit to show nothing. */
  note?: string;
}

export interface MarketingCtaBannerProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  /** A small, live-looking fact that makes the ask concrete. `null` hides it. */
  proof?: CtaProof | null;
  /** Under the buttons: what it costs to try. */
  reassurance?: ReactNode;
}

const DEFAULT_PROOF: CtaProof = {
  value: "312",
  label: "teams started this week",
  series: [18, 24, 31, 29, 42, 47, 38, 52, 61, 58, 66, 74, 71, 83],
  seriesLabel: "Teams that started, per day over the last two weeks",
  note: "Updated a minute ago",
};

/**
 * The closing ask as a full-width band on the primary plate: a headline, one thing to do,
 * one quieter alternative, and a small proof card with a live number and its trend. The
 * band takes the gradient from the primary tokens, so it re-tints with every theme.
 */
export function MarketingCtaBanner({
  eyebrow = "Relay",
  title = "Ship the pipeline you sketched on the whiteboard",
  description = "Connect a repository, describe the deploy in a sentence, and watch Relay draw the steps. Edit any of them. Nothing runs until you say so.",
  primaryLabel = "Start free",
  primaryHref = "#register",
  secondaryLabel = "See a two-minute demo",
  secondaryHref = "#demo",
  proof = DEFAULT_PROOF,
  reassurance = "Free for teams up to five · no card · your repository stays yours",
}: MarketingCtaBannerProps) {
  return (
    <section
      className="@container w-full bg-primary bg-linear-to-br from-primary via-primary to-primary-active text-primary-foreground"
      data-slot="marketing-cta-banner"
    >
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-4 py-16 @4xl:grid-cols-[1fr_auto] @4xl:gap-16 @4xl:py-24">
        {/*
          Everything inside INHERITS the plate’s ink — no `text-*-foreground` re-declared on
          a descendant, so the decoration dial’s high-level re-inking of `.bg-primary` still
          reaches every line (see `CTASection`). Quieter comes from the type rung.
        */}
        <div className="flex max-w-2xl flex-col gap-6" data-slot="marketing-cta-banner-copy">
          {eyebrow ? <p className="text-eyebrow uppercase">{eyebrow}</p> : null}
          <h2 className="text-display font-semibold text-balance">{title}</h2>
          <p className="text-subtitle text-pretty">{description}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <a href={primaryHref}>
                {primaryLabel}
                <ArrowRight aria-hidden="true" />
              </a>
            </Button>
            <Button
              asChild
              className="hover:bg-primary-foreground/10 hover:text-inherit"
              size="lg"
              variant="ghost"
            >
              <a href={secondaryHref}>{secondaryLabel}</a>
            </Button>
          </div>
          {reassurance ? <p className="text-meta">{reassurance}</p> : null}
        </div>

        {proof ? (
          <div
            className="flex w-full max-w-sm flex-col gap-3 rounded-xl bg-card p-5 text-card-foreground shadow-ring-lg @4xl:w-72"
            data-slot="marketing-cta-banner-proof"
          >
            <p className="flex flex-col gap-0.5">
              <span className="text-kpi font-semibold tabular-nums">{proof.value}</span>
              <span className="text-meta text-muted-foreground">{proof.label}</span>
            </p>
            <Sparkline
              className="w-full"
              emphasizeLast
              fit="fill"
              height={48}
              label={proof.seriesLabel ?? proof.label}
              values={proof.series}
              variant="bar"
            />
            {proof.note ? (
              <p className="flex items-center gap-2 text-meta text-muted-foreground">
                <span aria-hidden="true" className="size-2 rounded-full bg-success" />
                {proof.note}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
