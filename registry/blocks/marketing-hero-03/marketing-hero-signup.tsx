"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, Check, CheckCircle2 } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Avatar,
  AvatarFallback,
  AvatarGroup,
  Button,
  Heading,
  Input,
  Label,
  Rating,
  Spinner,
  Text,
  cn,
} from "@elabs-ai/components-ui";

export interface HeroBenefit {
  label: string;
}

export interface HeroSocialProof {
  /** Names behind the stacked avatars — initials are drawn from them. */
  people: string[];
  /** The line beside the avatars, e.g. “Joined by 2,400 teams”. */
  caption: string;
  /** Stars out of five. */
  rating: number;
  ratingCaption?: string;
}

export interface MarketingHeroSignupProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  emailLabel?: string;
  emailPlaceholder?: string;
  submitLabel?: string;
  /** Under the form — what happens next, and the escape hatch. */
  fineprint?: ReactNode;
  benefits?: HeroBenefit[];
  proof?: HeroSocialProof;
  /**
   * Called with a valid address. Return a promise to hold the pending state until it
   * settles; throw to show the error. Defaults to a short simulated request.
   */
  onSubscribe?: (email: string) => Promise<void> | void;
  className?: string;
}

const DEFAULT_BENEFITS: HeroBenefit[] = [
  { label: "Drafts a reply from your help centre in under a second" },
  { label: "Keeps your tone — it learns from replies your team already sent" },
  { label: "Every suggestion cites the article it came from" },
];

const DEFAULT_PROOF: HeroSocialProof = {
  people: ["Ines Marques", "Kwame Mensah", "Yuki Tanaka", "Olav Berg", "Priya Nair"],
  caption: "Joined by 2,400 teams",
  rating: 4.8,
  ratingCaption: "4.8 from 610 reviews",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type FormState = { kind: "idle" } | { kind: "pending" } | { kind: "done"; email: string };

/**
 * A centred hero with the sign-up inline: one email field that validates on submit, shows
 * its pending state on the button, and confirms with the address it sent to. Three
 * benefits under it, then the people already in.
 */
export function MarketingHeroSignup({
  eyebrow = "Early access",
  title = "Answer support tickets in your own words, faster",
  description = "Quill drafts the reply, cites the article it came from and leaves the send button to you. Be first in when it opens next month.",
  emailLabel = "Work email",
  emailPlaceholder = "you@company.com",
  submitLabel = "Get early access",
  fineprint = "One email when your invite is ready. No newsletter, no sharing your address.",
  benefits = DEFAULT_BENEFITS,
  proof = DEFAULT_PROOF,
  onSubscribe,
  className,
}: MarketingHeroSignupProps) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const subscribe =
    onSubscribe ??
    (() =>
      new Promise<void>((resolve) => {
        timer.current = window.setTimeout(resolve, 900);
      }));

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const address = email.trim();
    if (!EMAIL_RE.test(address)) {
      setError("Enter a work email address, like you@company.com.");
      return;
    }
    setError(null);
    setState({ kind: "pending" });
    try {
      await subscribe(address);
      setState({ kind: "done", email: address });
    } catch {
      setState({ kind: "idle" });
      setError("That did not go through. Try again in a moment.");
    }
  };

  const pending = state.kind === "pending";

  return (
    <section
      className={cn("@container mx-auto w-full max-w-7xl px-4 py-16 @4xl:py-24", className)}
      data-slot="marketing-hero-signup"
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-4">
          {eyebrow ? (
            <Text as="span" tone="primary" variant="eyebrow">
              {eyebrow}
            </Text>
          ) : null}
          <Heading className="text-balance" level={1} size="display-lg">
            {title}
          </Heading>
          <Text className="max-w-prose text-pretty" tone="muted" variant="lead">
            {description}
          </Text>
        </div>

        <div className="flex w-full max-w-xl flex-col gap-3" data-slot="marketing-hero-signup-form">
          {state.kind === "done" ? (
            <Alert className="text-start" role="status" variant="success">
              <CheckCircle2 aria-hidden="true" />
              <AlertDescription>
                You are on the list. We will write to{" "}
                <span className="font-medium text-foreground">{state.email}</span> when your invite
                is ready.
              </AlertDescription>
            </Alert>
          ) : (
            <form className="flex flex-col gap-2" noValidate onSubmit={onSubmit}>
              <div className="flex flex-col gap-2 @md:flex-row">
                <div className="flex min-w-0 flex-1 flex-col text-start">
                  <Label className="sr-only" htmlFor={`${id}-email`}>
                    {emailLabel}
                  </Label>
                  <Input
                    aria-describedby={error ? `${id}-error` : undefined}
                    aria-invalid={error ? true : undefined}
                    autoComplete="email"
                    className="h-control-lg"
                    disabled={pending}
                    id={`${id}-email`}
                    inputMode="email"
                    name="email"
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (error) setError(null);
                    }}
                    placeholder={emailPlaceholder}
                    type="email"
                    value={email}
                  />
                </div>
                <Button
                  aria-busy={pending || undefined}
                  className="shrink-0"
                  disabled={pending}
                  size="lg"
                  type="submit"
                >
                  {pending ? (
                    <>
                      <Spinner aria-hidden="true" />
                      Sending…
                    </>
                  ) : (
                    <>
                      {submitLabel}
                      <ArrowRight aria-hidden="true" />
                    </>
                  )}
                </Button>
              </div>
              {error ? (
                <p
                  className="text-start text-caption text-destructive-text"
                  id={`${id}-error`}
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
            </form>
          )}
          {fineprint ? <p className="text-meta text-muted-foreground">{fineprint}</p> : null}
        </div>

        {benefits.length ? (
          <ul
            className="flex flex-col items-start gap-2 text-start @2xl:flex-row @2xl:justify-center @2xl:gap-6"
            data-slot="marketing-hero-signup-benefits"
          >
            {benefits.map((benefit) => (
              <li className="flex items-start gap-2 text-body" key={benefit.label}>
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                {benefit.label}
              </li>
            ))}
          </ul>
        ) : null}

        {proof ? (
          <div
            className="flex flex-col items-center gap-3 border-t border-border-strong pt-8 @md:flex-row @md:justify-center @md:gap-6"
            data-slot="marketing-hero-signup-proof"
          >
            <div className="flex items-center gap-3">
              <AvatarGroup aria-label="Some of the people already in">
                {proof.people.map((person) => (
                  <Avatar className="size-8" key={person}>
                    <AvatarFallback className="text-caption" name={person} />
                    <span className="sr-only">{person}</span>
                  </Avatar>
                ))}
              </AvatarGroup>
              <span className="text-body font-medium">{proof.caption}</span>
            </div>
            <span aria-hidden="true" className="hidden text-muted-foreground @md:inline">
              ·
            </span>
            <div className="flex items-center gap-2">
              <Rating
                allowHalf
                aria-label={`${proof.rating} out of 5`}
                readOnly
                value={proof.rating}
              />
              {proof.ratingCaption ? (
                <span className="text-meta text-muted-foreground tabular-nums">
                  {proof.ratingCaption}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
