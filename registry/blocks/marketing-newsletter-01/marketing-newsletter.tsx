"use client";

import type { ReactNode } from "react";
import { Card, CardContent } from "@elabs-ai/components-ui";
import { EmailCapture } from "@/components/marketing-parts/email-capture";

export interface MarketingNewsletterProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Return a message to show it as the error; return nothing on success. */
  onSubscribe?: (email: string) => string | void | Promise<string | void>;
}

/** Newsletter sign-up — one field, a promise about frequency, and a real confirmation. */
export function MarketingNewsletter({
  title = "One email a month, written by the people who build it",
  description = "What shipped, what we learned from a customer, and one number worth knowing.",
  onSubscribe,
}: MarketingNewsletterProps) {
  return (
    <section
      className="@container mx-auto w-full max-w-7xl px-4 py-16"
      data-slot="marketing-newsletter"
    >
      <Card>
        <CardContent className="grid grid-cols-1 items-center gap-8 p-8 @3xl:grid-cols-2">
          <div className="flex flex-col gap-2">
            <h2 className="text-title font-semibold text-balance">{title}</h2>
            <p className="text-body text-muted-foreground text-pretty">{description}</p>
          </div>
          <EmailCapture
            confirmation={(address) => (
              <>
                You are on the list. The next issue goes to <strong>{address}</strong>.
              </>
            )}
            hint="No tracking pixels. Unsubscribe with one click."
            onSubmit={onSubscribe}
          />
        </CardContent>
      </Card>
    </section>
  );
}
