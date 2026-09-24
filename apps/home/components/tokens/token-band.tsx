"use client";

/**
 * TokenBand — the "One token system" section (RM-103, concept §4.5, §5a "Scroll choreography 5"):
 * three panels — a token spotlight, the theme-family swatches, and the generated gate catalogue —
 * revealed in on scroll with `RevealOnEnter`'s stagger (`@elabs-ai/components-ui`). Mounted
 * between the works-with matrix and the closing route cards (wave-4 ruling 24).
 */
import { RevealOnEnter, TokenSpotlight } from "@elabs-ai/components-ui";
import { GatesBand } from "@elabs-ai/components-marketing";
import { gates, countFor } from "../../lib/content";
import { gatesBandCopy, shellCopy, tokenBandCopy } from "../../content/copy";
import { ThemeSwatches } from "./theme-swatches";

export function TokenBand() {
  return (
    <section
      id="tokens"
      data-slot="token-band"
      className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16"
    >
      <div className="flex flex-col gap-3">
        <h2 className="text-title text-foreground">{tokenBandCopy.heading}</h2>
        <p className="max-w-prose text-body text-muted-foreground">{tokenBandCopy.intro}</p>
      </div>
      <RevealOnEnter stagger className="flex flex-col gap-16">
        <TokenSpotlight tokens={tokenBandCopy.tokens} />
        <ThemeSwatches />
        <GatesBand
          gates={gates}
          count={countFor("gates").value}
          categoryLabels={gatesBandCopy.categoryLabels}
          footer={
            <>
              {gatesBandCopy.footerPrefix}{" "}
              <a
                className="underline underline-offset-2 focus-ring"
                href={`${shellCopy.links.github}/blob/main/docs/GATES.md`}
              >
                {gatesBandCopy.footerLinkText}
              </a>{" "}
              {gatesBandCopy.footerSuffix}
            </>
          }
        />
      </RevealOnEnter>
    </section>
  );
}
