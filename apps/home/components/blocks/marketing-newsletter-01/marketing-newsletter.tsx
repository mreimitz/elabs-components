// registry: marketing-newsletter-01 — copied 2026-09-19
"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { CircleCheck } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  Input,
} from "@elabs-ai/components-ui";

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
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");

  async function handle(event: FormEvent) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return setError("Enter an email address we can write to.");
    }
    setError(null);
    setState("pending");
    const message = await onSubscribe?.(email.trim());
    if (message) {
      setError(message);
      return setState("idle");
    }
    setState("done");
  }

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
          {state === "done" ? (
            <p aria-live="polite" className="flex items-center gap-3 text-body">
              <CircleCheck aria-hidden="true" className="size-6 shrink-0 text-success-text" />
              <span>
                You are on the list. The next issue goes to <strong>{email.trim()}</strong>.
              </span>
            </p>
          ) : (
            <form className="flex flex-col gap-3" noValidate onSubmit={handle}>
              <FieldRoot invalid={error !== null}>
                <FieldLabel>Email</FieldLabel>
                <div className="flex flex-col gap-2 @md:flex-row">
                  <FieldControl>
                    <Input
                      autoComplete="email"
                      inputMode="email"
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@company.com"
                      type="email"
                      value={email}
                    />
                  </FieldControl>
                  <Button disabled={state === "pending"} type="submit">
                    {state === "pending" ? "Subscribing…" : "Subscribe"}
                  </Button>
                </div>
                <FieldDescription>No tracking pixels. Unsubscribe with one click.</FieldDescription>
                {error ? <FieldError>{error}</FieldError> : null}
              </FieldRoot>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
