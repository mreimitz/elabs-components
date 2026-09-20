// registry: forgot-password-01 — copied 2026-09-19
"use client";

import { useState, type FormEvent } from "react";
import { MailCheck } from "lucide-react";
import {
  Button,
  FieldControl,
  FieldError,
  FieldLabel,
  FieldRoot,
  Input,
  Spinner,
} from "@elabs-ai/components-ui";
import { AuthCard, AuthLink, isEmail } from "../auth-parts/auth-card";
import { useAuthSubmit, type AuthSubmitResult } from "../auth-parts/use-auth-submit";

export interface ForgotPasswordProps {
  onSubmit?: (email: string) => AuthSubmitResult;
  loginHref?: string;
  productName?: string;
}

/**
 * Forgot password — asks for the email, then says the SAME thing whether or not an account
 * exists, so the form cannot be used to find out who has one.
 */
export function ForgotPassword({
  onSubmit,
  loginHref = "#login",
  productName,
}: ForgotPasswordProps) {
  const [email, setEmail] = useState("");
  const [tried, setTried] = useState(false);
  const submit = useAuthSubmit();
  const error = !email.trim()
    ? "Enter the email you signed up with."
    : !isEmail(email)
      ? "That does not look like an email address."
      : null;

  function handle(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (error) return;
    void submit.run(() => onSubmit?.(email.trim()));
  }

  if (submit.done) {
    return (
      <AuthCard
        description={
          <>
            If <strong className="text-foreground">{email.trim()}</strong> has an account, a reset
            link is on its way. It works for 30 minutes.
          </>
        }
        footer={<AuthLink href={loginHref}>Back to sign in</AuthLink>}
        productName={productName}
        title="Check your inbox"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <MailCheck aria-hidden="true" className="size-10 text-primary" />
          <p className="text-body text-muted-foreground">
            Nothing after a few minutes? Look in spam, or try a different address.
          </p>
          <Button onClick={submit.reset} variant="outline">
            Use a different email
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      description="Enter your email and we will send you a link to choose a new one."
      footer={<AuthLink href={loginHref}>Back to sign in</AuthLink>}
      productName={productName}
      title="Forgot your password?"
    >
      <form className="flex flex-col gap-4" noValidate onSubmit={handle}>
        <FieldRoot invalid={tried && error !== null} required>
          <FieldLabel>Email</FieldLabel>
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
          {tried && error ? <FieldError>{error}</FieldError> : null}
          {submit.error ? <FieldError>{submit.error}</FieldError> : null}
        </FieldRoot>
        <Button disabled={submit.pending} type="submit">
          {submit.pending ? <Spinner label="Sending the link" /> : null}
          {submit.pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthCard>
  );
}
