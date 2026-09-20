// registry: reset-password-01 — copied 2026-09-19
"use client";

import { useState, type FormEvent } from "react";
import { CircleCheck } from "lucide-react";
import {
  Button,
  FieldControl,
  FieldError,
  FieldLabel,
  FieldRoot,
  Spinner,
} from "@elabs-ai/components-ui";
import {
  AuthCard,
  AuthLink,
  PasswordInput,
  passwordScore,
  PasswordStrength,
} from "../auth-parts/auth-card";
import { useAuthSubmit, type AuthSubmitResult } from "../auth-parts/use-auth-submit";

export interface ResetPasswordProps {
  onSubmit?: (password: string) => AuthSubmitResult;
  loginHref?: string;
  /** Whose password this is — shown so the person knows the link is theirs. */
  email?: string;
  productName?: string;
}

/** Choose a new password — strength explained, the two entries compared, then a clear end. */
export function ResetPassword({
  onSubmit,
  loginHref = "#login",
  email = "ada@acme.example",
  productName,
}: ResetPasswordProps) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [tried, setTried] = useState(false);
  const submit = useAuthSubmit();
  const weak =
    passwordScore(password) >= 3 ? null : "Choose a stronger password — see what is still missing.";
  const mismatch = again === password ? null : "The two passwords are not the same.";

  function handle(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    if (weak || mismatch) return;
    void submit.run(() => onSubmit?.(password));
  }

  if (submit.done) {
    return (
      <AuthCard
        description="You are signed out everywhere else, so nobody keeps an old session."
        productName={productName}
        title="Password changed"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <CircleCheck aria-hidden="true" className="size-10 text-success-text" />
          <Button asChild className="w-full">
            <a href={loginHref}>Sign in with the new password</a>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      description={
        <>
          For <strong className="text-foreground">{email}</strong>
        </>
      }
      footer={<AuthLink href={loginHref}>Back to sign in</AuthLink>}
      productName={productName}
      title="Choose a new password"
    >
      <form className="flex flex-col gap-4" noValidate onSubmit={handle}>
        <FieldRoot invalid={tried && weak !== null} required>
          <FieldLabel>New password</FieldLabel>
          <FieldControl>
            <PasswordInput
              autoComplete="new-password"
              onValueChange={setPassword}
              value={password}
            />
          </FieldControl>
          <PasswordStrength value={password} />
          {tried && weak ? <FieldError>{weak}</FieldError> : null}
        </FieldRoot>
        <FieldRoot invalid={tried && mismatch !== null} required>
          <FieldLabel>Type it once more</FieldLabel>
          <FieldControl>
            <PasswordInput autoComplete="new-password" onValueChange={setAgain} value={again} />
          </FieldControl>
          {tried && mismatch ? <FieldError>{mismatch}</FieldError> : null}
          {submit.error ? <FieldError>{submit.error}</FieldError> : null}
        </FieldRoot>
        <Button disabled={submit.pending} type="submit">
          {submit.pending ? <Spinner label="Saving" /> : null}
          {submit.pending ? "Saving…" : "Change password"}
        </Button>
      </form>
    </AuthCard>
  );
}
