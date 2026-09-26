"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { CircleCheck } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Button,
  cn,
  FieldControl,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldRoot,
  Input,
} from "@elabs-ai/components-ui";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EmailCaptureProps {
  /**
   * Called with the trimmed address. Return a message to show it as the
   * field's error; return nothing to confirm.
   */
  onSubmit?: (email: string) => string | void | Promise<string | void>;
  /** Field label. Default “Email”. */
  label?: ReactNode;
  /** Button text at rest / while pending. */
  action?: string;
  pendingAction?: string;
  /** Under the field — a promise about frequency or privacy. */
  hint?: ReactNode;
  /** Shown once the address is accepted; receives the trimmed address. */
  confirmation: (email: string) => ReactNode;
  /** Message when the address does not look like one. */
  invalidMessage?: string;
  placeholder?: string;
  className?: string;
}

/**
 * The one email-capture form every marketing surface shares — newsletter,
 * changelog, blog footer, careers “tell me first”: a labelled email field
 * beside its button, the format check, the pending button, the server's
 * message as the field error and a success `Alert` that names the address.
 * Nothing here talks to a server; `onSubmit` is the host's.
 */
export function EmailCapture({
  onSubmit,
  label = "Email",
  action = "Subscribe",
  pendingAction = "Subscribing…",
  hint,
  confirmation,
  invalidMessage = "Enter an email address we can write to.",
  placeholder = "you@company.com",
  className,
}: EmailCaptureProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");

  async function submit(event: FormEvent) {
    event.preventDefault();
    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) return setError(invalidMessage);
    setError(null);
    setState("pending");
    const message = await onSubmit?.(address);
    if (message) {
      setError(message);
      return setState("idle");
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <Alert
        className={cn("items-center", className)}
        data-slot="email-capture-done"
        role="status"
        variant="success"
      >
        <CircleCheck aria-hidden="true" />
        <AlertDescription>{confirmation(email.trim())}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form
      className={cn("flex flex-col gap-3 text-start", className)}
      data-slot="email-capture"
      noValidate
      onSubmit={submit}
    >
      <FieldRoot invalid={error !== null}>
        <FieldLabel>{label}</FieldLabel>
        <div className="flex flex-col gap-2 @md:flex-row">
          <FieldControl>
            <Input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder={placeholder}
              type="email"
              value={email}
            />
          </FieldControl>
          <Button disabled={state === "pending"} type="submit">
            {state === "pending" ? pendingAction : action}
          </Button>
        </div>
        {hint ? <FieldDescription>{hint}</FieldDescription> : null}
        {error ? <FieldError>{error}</FieldError> : null}
      </FieldRoot>
    </form>
  );
}
